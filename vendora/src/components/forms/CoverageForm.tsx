'use client';

import { useActionState } from 'react';
import { setSupplierCoverageAction } from '@/lib/actions/supplier';
import { INITIAL_FORM_STATE } from '@/lib/actions/types';
import { Alert, Card } from '../ui';
import { SubmitButton } from '../SubmitButton';

export function CoverageForm({ cities, selected }: { cities: Array<{ code: string; name_ar: string }>; selected: string[] }) {
  const [state, action] = useActionState(setSupplierCoverageAction, INITIAL_FORM_STATE);
  return (
    <Card>
      <h2 className="text-lg font-bold text-brand-950">مناطق التوصيل والتغطية</h2>
      <p className="mt-1 text-sm text-muted">اختر المدن التي تستطيع توصيل طلباتها. تظهر للتجار في صفحتك العامة.</p>
      <form action={action} className="mt-5 space-y-5">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.success ? <Alert tone="success">{state.success}</Alert> : null}
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">المدن</legend>
          {cities.map((city) => (
            <label key={city.code} className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="checkbox" name="cities" value={city.code} defaultChecked={selected.includes(city.code)} className="size-4 accent-brand-700" />
              <span className="font-semibold text-brand-950">{city.name_ar}</span>
            </label>
          ))}
        </fieldset>
        <SubmitButton>حفظ التغطية</SubmitButton>
      </form>
    </Card>
  );
}
