import { createConfig, http } from "wagmi";
import { celo, celoAlfajores } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { ACTIVE_CHAIN } from "./constants";

/**
 * wagmi config for the MiniPay Mini App.
 *
 * MiniPay injects a standard EIP-1193 provider at `window.ethereum`, so the
 * plain `injected()` connector is all we need — there is no wallet-selection
 * step and no WalletConnect. Inside MiniPay the connection is implicit
 * (auto-connected), so the UI must not render a "Connect Wallet" button.
 *
 * `ssr: true` lets the app hydrate cleanly when server-rendered.
 */
export const wagmiConfig = createConfig({
  chains: [celo, celoAlfajores],
  connectors: [injected()],
  transports: {
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
  ssr: true,
});

export { ACTIVE_CHAIN };

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
