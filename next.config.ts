import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Client router cache: re-use the RSC payload of recently visited pages
     * so tab-switching in the bottom nav is instant. Mutations still bust
     * this via revalidatePath in the server actions.
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
