'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/action-result';

/** Runs a server action from a client component and keeps its result for display. */
export function useAction<I, T>(action: (input: I) => Promise<ActionResult<T>>) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<T> | null>(null);

  function run(input: I, onSuccess?: (result: Extract<ActionResult<T>, { ok: true }>) => void) {
    startTransition(async () => {
      const outcome = await action(input);
      setResult(outcome);
      if (outcome.ok) onSuccess?.(outcome);
    });
  }

  return { run, pending, result, fieldErrors: result && !result.ok ? (result.fieldErrors ?? {}) : {} };
}
