import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Client router cache: re-use the RSC payload of recently visited pages
     * so tab-switching in the bottom nav is instant. Mutations still bust
     * this via revalidatePath/updateTag in the server actions, so a longer
     * window is safe — and server data is tag-cached anyway (lib/data/cached),
     * making the eventual refetch cheap.
     */
    staleTimes: {
      dynamic: 300,
      static: 300,
    },
  },
};

export default nextConfig;
