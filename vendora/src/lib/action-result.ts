/** Shape returned by every server action so forms can show a message and field errors. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export const initialActionState: ActionResult = { ok: false, message: '' };

export function fail(message: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, message, fieldErrors };
}
