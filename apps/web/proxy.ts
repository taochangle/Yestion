import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = ["/", "/chat"];
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8080";

export function proxy(request: NextRequest) {
  // /api/chat is served by a route handler that injects the auth cookie server-side.
  if (request.nextUrl.pathname === "/api/chat") {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const targetUrl = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      apiProxyTarget
    );
    return NextResponse.rewrite(targetUrl);
  }

  const token = request.cookies.get("auth_token")?.value;

  if (protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/chat", "/api/:path*"]
};
