"use client";

import type { ReactNode } from "react";
import { useMiniPay } from "@/lib/web3/hooks/useMiniPay";

/**
 * Gates the app on having a wallet connection — but only when the game is
 * running on-chain. In demo mode (no contract deployed yet) there's nothing
 * to connect to, so the game is playable without a wallet.
 *
 * - Inside MiniPay: the wallet auto-connects, so this renders straight
 *   through (no connect button — the connection is implicit).
 * - Outside MiniPay: shows a "Connect Wallet" button until an injected
 *   wallet is connected.
 */
export function ConnectGate({
  requireWallet,
  children,
}: {
  requireWallet: boolean;
  children: ReactNode;
}) {
  const { isReady, isMiniPay, isConnected, isConnecting, connectWallet } = useMiniPay();

  if (!requireWallet) return <>{children}</>;

  if (!isReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-x border-t-transparent" />
      </div>
    );
  }

  if (isConnected) return <>{children}</>;

  if (isMiniPay) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-x border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 p-6 text-center">
      <p className="max-w-sm text-sm text-white/60">
        Open xero inside <span className="font-semibold text-white/80">MiniPay</span> to play with
        your wallet — it connects automatically. In a normal browser, connect a wallet first.
      </p>
      <button onClick={connectWallet} disabled={isConnecting} className="btn-primary max-w-xs">
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </button>
    </div>
  );
}
