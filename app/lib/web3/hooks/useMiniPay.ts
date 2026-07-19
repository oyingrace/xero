"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";

export interface UseMiniPayResult {
  /** True when the app is running inside the MiniPay dapp browser. */
  isMiniPay: boolean;
  /** True once the MiniPay host has been detected (client-side only). */
  isReady: boolean;
  /** The connected wallet address, if any. */
  address?: `0x${string}`;
  /** True while a wallet is connected. */
  isConnected: boolean;
  /** True while a connection attempt is in flight. */
  isConnecting: boolean;
  /** Manually connect an injected wallet (used outside MiniPay). */
  connectWallet: () => void;
}

/**
 * Detects the MiniPay host and manages the wallet connection.
 *
 * - **Inside MiniPay** (`window.ethereum.isMiniPay === true`): auto-connects the
 *   injected wallet, so the UI never shows a connect button — the connection is
 *   implicit.
 * - **Outside MiniPay** (normal browser): does not auto-connect. `connectWallet`
 *   lets the UI offer a "Connect Wallet" button for an injected wallet, so the
 *   app is still usable/testable outside MiniPay.
 */
export function useMiniPay(): UseMiniPayResult {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const { connect, isPending } = useConnect();
  const { address, isConnected } = useAccount();

  const connectWallet = useCallback(() => {
    connect({ connector: injected() });
  }, [connect]);

  useEffect(() => {
    // Deliberately deferred to an effect (not a lazy useState initializer):
    // `window` is only defined client-side, so computing this during render
    // would mismatch the server-rendered HTML and trigger a hydration
    // warning. Running once on mount avoids that at the cost of one extra
    // render pass.
    const detected = typeof window !== "undefined" && Boolean(window.ethereum?.isMiniPay);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMiniPay(detected);
    setIsReady(true);

    if (detected && !isConnected) {
      connect({ connector: injected() });
    }
  }, [connect, isConnected]);

  return {
    isMiniPay,
    isReady,
    address,
    isConnected,
    isConnecting: isPending,
    connectWallet,
  };
}
