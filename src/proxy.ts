import { NextResponse, type NextRequest } from "next/server";

// Optimistic auth gate: the session cookie is verified for real in the API
// and server components; here we only route signed-out users to /sign-in.
const PROTECTED = ["/home", "/map", "/hunt", "/claim", "/hide", "/campaigns"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("md_session")?.value);
  if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && pathname === "/sign-in") {
    const url = req.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|icon|apple-icon|manifest.webmanifest|favicon.ico).*)"],
};
