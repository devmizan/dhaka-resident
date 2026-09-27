import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";

/**
 * Runs an action body and converts expected errors into a serialisable result.
 * Unexpected errors are logged on the server and replaced with a generic message,
 * so internal details never reach the browser.
 */
export async function handleAction<T>(body: () => Promise<T>, successMessage?: string): Promise<ActionResult<T>> {
  try {
    const data = await body();
    return { ok: true, data, message: successMessage };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors, code: error.code };
    }
    console.error("[action failed]", error);
    return { ok: false, error: "Something went wrong on our side. Please try again." };
  }
}
