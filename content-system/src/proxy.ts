import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Keeps the Supabase session cookie fresh and bounces signed-out visitors to
 * the login page. This is a convenience, not the security boundary: every
 * page and action re-checks the user, and the database enforces row level
 * security regardless of what gets through here.
 */
// /api/agent authenticates with an editor access key, /api/inngest with a signing key.
const PUBLIC_PREFIXES = ["/login", "/auth", "/api/inngest", "/api/agent"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not run code between creating the client and this call: it is what
  // refreshes an expiring session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!signedIn && !isPublic) {
    const url = new URL("/login", request.url);
    // Stay on the host the visitor actually used (request.url can report
    // "localhost" when they came in on 127.0.0.1 or a custom domain).
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (host) url.host = host;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
