import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * CSV exports for administrators. The database (RLS + is_admin()) is the real
 * gate: a non-admin session would receive no rows, and we also refuse early.
 */
type Row = Record<string, unknown>;
type Named = { legal_name: string } | null | undefined;
type Numbered = { order_number: string } | null | undefined;

interface ExportSpec {
  table: string;
  select: string;
  order: string;
  columns: string[];
  toRecord: (row: Row) => Record<string, unknown>;
}

const EXPORTS: Record<string, ExportSpec> = {
  orders: {
    table: 'orders',
    select:
      'order_number, status, subtotal_iqd, delivery_fee_iqd, total_iqd, created_at, buyer:businesses!orders_buyer_business_id_fkey(legal_name), supplier:businesses!orders_supplier_business_id_fkey(legal_name)',
    order: 'created_at',
    columns: ['order_number', 'status', 'buyer', 'supplier', 'subtotal_iqd', 'delivery_fee_iqd', 'total_iqd', 'created_at'],
    toRecord: (row) => ({
      order_number: row.order_number,
      status: row.status,
      buyer: (row.buyer as Named)?.legal_name ?? '',
      supplier: (row.supplier as Named)?.legal_name ?? '',
      subtotal_iqd: row.subtotal_iqd,
      delivery_fee_iqd: row.delivery_fee_iqd,
      total_iqd: row.total_iqd,
      created_at: row.created_at,
    }),
  },
  commissions: {
    table: 'commissions',
    select:
      'eligible_base_iqd, commission_iqd, status, created_at, settled_at, order:orders!commissions_order_id_fkey(order_number), supplier:businesses!commissions_supplier_business_id_fkey(legal_name)',
    order: 'created_at',
    columns: ['order_number', 'supplier', 'eligible_base_iqd', 'commission_iqd', 'status', 'created_at', 'settled_at'],
    toRecord: (row) => ({
      order_number: (row.order as Numbered)?.order_number ?? '',
      supplier: (row.supplier as Named)?.legal_name ?? '',
      eligible_base_iqd: row.eligible_base_iqd,
      commission_iqd: row.commission_iqd,
      status: row.status,
      created_at: row.created_at,
      settled_at: row.settled_at,
    }),
  },
  suppliers: {
    table: 'businesses',
    select: 'legal_name, phone, city_code, tax_number, verification_status, created_at',
    order: 'created_at',
    columns: ['legal_name', 'phone', 'city_code', 'tax_number', 'verification_status', 'created_at'],
    toRecord: (row) => row,
  },
  audit: {
    table: 'audit_logs',
    select: 'created_at, action, entity_type, entity_id, reason',
    order: 'created_at',
    columns: ['created_at', 'action', 'entity_type', 'entity_id', 'reason'],
    toRecord: (row) => row,
  },
};

/** Spreadsheet-safe CSV cell: quotes when needed and neutralises formula injection. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const spec = EXPORTS[name];
  if (!spec) return NextResponse.json({ error: 'unknown export' }, { status: 404 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data, error } = await supabase.from(spec.table).select(spec.select).order(spec.order, { ascending: false }).limit(5000);
  if (error) return NextResponse.json({ error: 'export failed' }, { status: 500 });

  const records = ((data ?? []) as unknown as Row[]).map((row) => spec.toRecord(row));
  const header = spec.columns.join(',');
  const body = records.map((record) => spec.columns.map((column) => csvCell(record[column])).join(',')).join('\n');

  return new NextResponse(`﻿${header}\n${body}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vendora-${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
