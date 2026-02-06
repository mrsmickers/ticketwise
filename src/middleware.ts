import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Remove X-Frame-Options to allow iframe embedding
  // CSP frame-ancestors handles security instead
  response.headers.delete("X-Frame-Options");
  
  // Security headers
  response.headers.set("Content-Security-Policy", "frame-ancestors *");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  
  // Note: HSTS should be set at Cloudflare level, not here
  // (Cloudflare handles SSL termination)
  
  return response;
}

export const config = {
  matcher: "/:path*",
};
