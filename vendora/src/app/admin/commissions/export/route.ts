import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  // Prevent spreadsheet formula injection by neutralising cells that start with a formula character.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV of commissions completed in [from, to] for manual reconciliation. Admin only (also enforced by RLS). */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.viewer.role !== 'admin') {
    return NextResponse.json({ message: 'ليست لديك صلاحية.' }, { status: 403 });
  }

  const from = request.nextUrl.searchParams.get('from') ?? '';
  const to = request.nextUrl.searchParams.get('to') ?? '';
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ message: 'صيغة التاريخ غير صحيحة.' }, { status: 400 });
  }
  const toExclusive = new Date(new Date(`${to}T00:00:00Z`).getTime() + 24 * 3600 * 1000).toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('commissions')
    .select('completed_at, payable_at, status, eligible_subtotal_iqd, rate_bps, commission_iqd, paid_at, paid_reference, orders:order_id(order_number), businesses:supplier_business_id(name)')
    .gte('completed_at', new Date(`${from}T00:00:00Z`).toISOString())
    .lt('completed_at', toExclusive)
    .order('completed_at', { ascending: true })
    .limit(10000);
  if (error) {
    return NextResponse.json({ message: 'تعذر إنشاء الملف.' }, { status: 500 });
  }

  const header = ['order_number', 'supplier', 'completed_at', 'payable_at', 'status', 'eligible_subtotal_iqd', 'rate_bps', 'commission_iqd', 'paid_at', 'paid_reference'];
  const lines = (data ?? []).map((row) => {
    const r = row as unknown as {
      completed_at: string; payable_at: string; status: string; eligible_subtotal_iqd: number; rate_bps: number; commission_iqd: number;
      paid_at: string | null; paid_reference: string | null; orders: { order_number: string } | null; businesses: { name: string } | null;
    };
    return [r.orders?.order_number, r.businesses?.name, r.completed_at, r.payable_at, r.status, r.eligible_subtotal_iqd, r.rate_bps, r.commission_iqd, r.paid_at, r.paid_reference]
      .map(csvCell)
      .join(',');
  });

  const body = `﻿${[header.join(','), ...lines].join('\r\n')}\r\n`;
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vendora-commissions-${from}-to-${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
