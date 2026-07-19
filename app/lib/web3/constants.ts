/**
 * Celo / MiniPay constants.
 *
 * xero runs as a MiniPay Mini App: the wallet is provided by MiniPay
 * (injected at `window.ethereum` with `isMiniPay === true`). Phase 1 is
 * free-play — games are recorded on-chain via `TicTacToe.sol` but no
 * token changes hands. Phase 2 adds USDT staking; USDT_ADDRESS and the
 * stake constants below are wired up ahead of that, unused until then.
 */

import { celo, celoAlfajores } from "wagmi/chains";

// Set NEXT_PUBLIC_USE_TESTNET=true during development against Alfajores.
export const ACTIVE_CHAIN = process.env.NEXT_PUBLIC_USE_TESTNET === "true" ? celoAlfajores : celo;
export const CHAIN_ID = ACTIVE_CHAIN.id;

// Deployed TicTacToe contract address. Unset until the contract in
// contracts/src/TicTacToe.sol is deployed (see contracts/README.md).
export const TIC_TAC_TOE_CONTRACT_ADDRESS = (process.env
  .NEXT_PUBLIC_TIC_TAC_TOE_CONTRACT_ADDRESS as `0x${string}` | undefined) || null;

// --- Phase 2 (wagering) — not yet wired into the UI ---

// Native USD₮ (Tether) on Celo mainnet. Override via NEXT_PUBLIC_USDT_ADDRESS.
export const USDT_ADDRESS = (process.env.NEXT_PUBLIC_USDT_ADDRESS ||
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e") as `0x${string}`;
export const STAKE_TOKEN_DECIMALS = 6; // USDT on Celo uses 6 decimals
