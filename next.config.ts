import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Exercise images are admin-entered URLs on arbitrary hosts, so the
     * optimizer accepts any https origin — the win is that a 40px thumbnail
     * no longer downloads the full-size original (next/image resizes and
     * re-encodes on demand). Only admins control which URLs actually render.
     */
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    /**
     * Client router cache: re-use the RSC payload of visited pages so
     * tab-switching is instant AND doesn't silently re-fetch from the server.
     *
     * These pages are dynamic (cookie/auth-gated), so the `dynamic` window is
     * what governs them. At the old 300s (5 min) the router cache expired mid-
     * session and every navigation re-rendered the page on the server (server
     * logs + a `loading.tsx` flash) even though nothing had changed — the
     * "cached for only a few minutes" bug.
     *
     * We make the window effectively indefinite (24h — the router cache is
     * in-memory and cleared on a full reload/PWA restart anyway, so this is
     * really "for the whole session"). Freshness is not sacrificed: every
     * mutation busts the relevant route via revalidatePath/updateTag in its
     * server action, which refreshes the router cache on the spot; the two
     * client reads (history, progress) are separately owned by TanStack Query.
     */
    staleTimes: {
      dynamic: 86_400,
      static: 86_400,
    },
  },
};

export default nextConfig;
