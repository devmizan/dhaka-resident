import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: send visitors without a session cookie to the login page.
 * Every protected page, server action and route handler still verifies the session
 * and role on the server.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("dr_session") || request.cookies.has("__Host-dr_session");
  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
