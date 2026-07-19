/**
 * MiniPay injects an EIP-1193 provider at `window.ethereum` and marks it with
 * `isMiniPay: true`. We use that flag to detect the MiniPay host.
 */
interface MiniPayEthereumProvider {
  isMiniPay?: boolean;
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  [key: string]: unknown;
}

interface Window {
  ethereum?: MiniPayEthereumProvider;
}
