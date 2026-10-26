import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "scp_session";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET || "ecf3f28535c2993d8cb3053901e9c2c884450090a2011de87d17d289bd30f048";
  return new TextEncoder().encode(secret);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/login") ||
    pathname === "/auth/login" ||
    pathname === "/auth/microsoft/callback" ||
    pathname === "/favicon.ico"
  ) {
    // If user is already logged in and tries to go to login page, redirect to home
    if (pathname === "/auth/login") {
      const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;
      if (sessionCookie) {
        try {
          await jwtVerify(sessionCookie, getSecretKey());
          return NextResponse.redirect(new URL("/", request.url));
        } catch {
          // Token invalid, proceed to login
        }
      }
    }
    return NextResponse.next();
  }

  // Check auth cookie for all other routes
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

  if (!sessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  try {
    await jwtVerify(sessionCookie, getSecretKey());
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/auth/login", request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/assets in public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
