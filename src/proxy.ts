import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * In Supabase mode: refresh the auth session cookie and gate the app behind
 * /login. In JSON mode (development) this is a no-op.
 */
export async function proxy(request: NextRequest) {
  const backend =
    process.env.DATA_BACKEND ??
    (process.env.NODE_ENV === "production" ? "supabase" : "json");
  if (backend !== "supabase") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith("/login");
  // The OAuth callback under /auth must run while still unauthenticated (it's
  // what establishes the session), so it's always allowed through.
  const isOAuthCallback = path.startsWith("/auth");

  if (!user && !isLogin && !isOAuthCallback) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and PWA files. The image-extension
    // exclusion keeps public images (logos/, handstand.jpg, uploads/…)
    // loadable on /login — without it the auth gate 307-redirects the logo
    // request itself, so the login page showed only the image's alt text.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|sw.js|.*\\.(?:png|jpe?g|gif|webp|avif|svg)$).*)",
  ],
};
