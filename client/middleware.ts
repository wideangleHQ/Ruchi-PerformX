import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  const protectedRoutes = [
    '/dashboard', '/tasks', '/requests', '/transfers',
    '/notifications', '/scoring', '/analytics', '/incentives',
    '/admin', '/profile', '/settings',
  ];

  const publicRoutes = [
    '/login', '/signup', '/forgot-password', '/verify-otp', '/reset-password',
  ];

  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));
  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isPublic && token && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
