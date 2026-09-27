export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED";

/** An expected, user-facing error. Its message is safe to show in the UI. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly fieldErrors?: Record<string, string[] | undefined>;

  constructor(code: AppErrorCode, message: string, fieldErrors?: Record<string, string[] | undefined>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export const unauthenticated = (message = "Please sign in to continue.") => new AppError("UNAUTHENTICATED", message);
export const forbidden = (message = "You don't have permission to do that.") => new AppError("FORBIDDEN", message);
export const notFound = (message = "We couldn't find that item.") => new AppError("NOT_FOUND", message);
export const conflict = (message: string) => new AppError("CONFLICT", message);
export const invalid = (message: string, fieldErrors?: Record<string, string[] | undefined>) =>
  new AppError("VALIDATION", message, fieldErrors);

/** True when a Prisma call failed on a unique constraint (P2002). */
export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002");
}
