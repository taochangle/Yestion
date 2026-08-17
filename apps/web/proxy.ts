import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = ["/dashboard"];

export function proxy(request: NextRequest) {
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
  matcher: ["/dashboard/:path*"]
};
