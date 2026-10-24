import { formatDateTime, formatIQD } from '@/lib/format';
import { ORDER_STATUS_LABELS } from '@/lib/orders/rules';
import { PAYMENT_LABELS, ROLE_LABELS } from '@/lib/labels';
import type { OrderDetail } from '@/lib/orders/load';
import { Card, StatusBadge } from '@/components/ui/card';

/** Read-only order summary: header, items (immutable snapshots), totals, delivery and contact details. */
export function OrderSummary({ detail, showCounterparty }: { detail: OrderDetail; showCounterparty: 'buyer' | 'supplier' | 'staff' }) {
  const { order, items, buyerBusiness, supplierBusiness } = detail;
  const counterparty =
    showCounterparty === 'buyer' ? supplierBusiness : showCounterparty === 'supplier' ? buyerBusiness : null;

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">رقم الطلب</p>
            <p className="font-mono text-lg font-bold text-brand-900" dir="ltr">
              {order.order_number}
            </p>
          </div>
          <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">تاريخ الطلب</dt>
            <dd className="font-semibold">{formatDateTime(order.created_at)}</dd>
          </div>
          <div>
            <dt className="text-muted">طريقة الدفع</dt>
            <dd className="font-semibold">{PAYMENT_LABELS[order.payment_method]}</dd>
          </div>
          {counterparty ? (
            <div>
              <dt className="text-muted">{showCounterparty === 'buyer' ? 'المورد' : 'المشتري'}</dt>
              <dd className="font-semibold">
                {counterparty.name} <span className="text-muted">· {counterparty.city_name}</span>
              </dd>
            </div>
          ) : null}
          {showCounterparty !== 'buyer' ? (
            <>
              <div>
                <dt className="text-muted">هاتف التنسيق</dt>
                <dd className="font-semibold" dir="ltr">
                  {order.contact_phone}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">عنوان التوصيل</dt>
                <dd className="font-semibold">
                  {order.delivery_city_name} · {order.delivery_address}
                </dd>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <dt className="text-muted">عنوان التوصيل</dt>
              <dd className="font-semibold">
                {order.delivery_city_name} · {order.delivery_address}
              </dd>
            </div>
          )}
          {order.buyer_notes ? (
            <div className="sm:col-span-3">
              <dt className="text-muted">ملاحظات المشتري</dt>
              <dd className="whitespace-pre-line">{order.buyer_notes}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-brand-50 text-right text-brand-900">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">المنتج</th>
                <th scope="col" className="px-4 py-3 font-semibold">سعر الوحدة</th>
                <th scope="col" className="px-4 py-3 font-semibold">الكمية</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{item.product_name}</span>
                    <span className="block text-xs text-muted">{item.product_unit}</span>
                  </td>
                  <td className="px-4 py-3 tabular">{formatIQD(item.unit_price_iqd)}</td>
                  <td className="px-4 py-3 tabular">{item.quantity}</td>
                  <td className="px-4 py-3 text-left font-semibold tabular">{formatIQD(item.line_total_iqd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 border-t border-line bg-brand-50/40 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">المجموع الفرعي</span>
            <span className="tabular">{formatIQD(order.subtotal_iqd)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">التوصيل</span>
            <span className="tabular">{order.delivery_fee_iqd > 0 ? formatIQD(order.delivery_fee_iqd) : 'يتفق عليه مع المورد'}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>الإجمالي</span>
            <span className="tabular">{formatIQD(order.total_iqd)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function OrderTimeline({ detail, roleLabels = true }: { detail: OrderDetail; roleLabels?: boolean }) {
  return (
    <Card>
      <h2 className="mb-5 text-lg font-bold text-brand-900">سجل الحالة</h2>
      <ol className="space-y-5">
        {detail.events.map((event, index) => (
          <li key={`${event.created_at}-${index}`} className="relative ps-6">
            <span className="absolute start-0 top-1.5 size-3 rounded-full bg-lime-400 ring-4 ring-lime-100" aria-hidden="true" />
            {index < detail.events.length - 1 ? <span className="absolute start-[5px] top-5 h-full w-px bg-line" aria-hidden="true" /> : null}
            <p className="font-semibold text-brand-900">{ORDER_STATUS_LABELS[event.to_status]}</p>
            <p className="text-xs text-muted">
              {formatDateTime(event.created_at)}
              {roleLabels ? ` · ${ROLE_LABELS[event.actor_role]}` : ''}
            </p>
            {event.note ? <p className="mt-1 text-sm text-ink/80">{event.note}</p> : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}
