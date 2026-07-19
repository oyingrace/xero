"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/web3/config";

/**
 * Client-side provider tree for the MiniPay Mini App.
 *
 * Wraps the app in wagmi (wallet/chain access) and TanStack Query (wagmi's
 * async cache). Rendered from the root layout as a Client Component boundary.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
