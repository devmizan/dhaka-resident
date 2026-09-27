export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors; code?: string };

export function success<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function done(message?: string): ActionResult<undefined> {
  return { ok: true, data: undefined, message };
}

export function failure(error: string, fieldErrors?: FieldErrors, code?: string): ActionResult<never> {
  return { ok: false, error, fieldErrors, code };
}
