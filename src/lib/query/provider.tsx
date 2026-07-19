"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  environmentManager
} from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Per-query staleTime is set at each call site (see lib/query/keys.ts
        // and the two client reads). This is only the fallback for anything
        // that forgets to. Server actions back these reads, so a failed fetch
        // retries once, not the default three times.
        staleTime: 60_000,
        retry: 1,
      },
    },
  });
}

// A single browser QueryClient, created once and reused across client
// navigations — that persistence is what lets a cached read (history, progress)
// survive route changes and only refetch when a mutation invalidates it.
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (environmentManager.isServer()) {
    // The server must never share a client between requests (it would leak one
    // user's data into another's), so make a throwaway one per render.
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // getQueryClient() already memoises in the browser; useState pins the server
  // instance for the life of this render so Suspense can't discard it.
  const [queryClient] = useState(getQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
