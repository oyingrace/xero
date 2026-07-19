# xero

xero is tic-tac-toe against the computer, built as a [MiniPay](https://www.opera.com/products/minipay) Mini App on the [Celo](https://celo.org) blockchain. You're X, the computer is O — play the whole game free, then sign one transaction to save the result on-chain. Pick a difficulty before each game — Easy and Medium can be beaten, Hard cannot (see [Difficulty](#difficulty) below).

## Features

- **MiniPay-native wallet** — runs inside MiniPay and uses the player's wallet automatically; a Connect Wallet fallback is available in a normal browser.
- **One transaction per game, not per move** — the whole game plays out locally; when it ends, a single transaction submits your move list and the contract independently replays it to determine (and record) the real outcome.
- **Three difficulties** — Easy (random), Medium (takes obvious wins/blocks, otherwise random), and Hard (exhaustive minimax — mathematically unbeatable).
- **Demo mode** — without a deployed contract configured, the app runs the identical game engine locally with nothing to submit, so it's fully playable during development.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router)
- [wagmi](https://wagmi.sh) + [viem](https://viem.sh) (Celo)
- [Tailwind CSS](https://tailwindcss.com)
- [Foundry](https://book.getfoundry.sh) (contracts)

## Getting started

### Prerequisites

- Node.js 18+
- (Optional) a deployed `TicTacToe` contract (see [`contracts/`](./contracts)) — without one, the app runs in demo mode

### Setup

```bash
npm install
cp .env.example .env.local   # optionally set a deployed contract address
npm run dev
```

Open the app inside MiniPay (or MiniPay's Site Tester) to use the wallet flow. In a normal desktop browser the app loads with a Connect Wallet button once a contract is configured; in demo mode no wallet is required at all.

## How it works

xero runs inside the MiniPay dapp browser, which injects an EIP-1193 provider at `window.ethereum` (`isMiniPay === true`). On load the app auto-connects that wallet and identifies the player by their Celo address — there is no sign-up step.

Starting a game generates a random seed and plays entirely on the device — no wallet, no transaction, just the same engine `TicTacToe.sol` implements running locally. Once the game ends, one button submits everything so far: `playGame(difficulty, seed, moves)`, a single transaction containing every cell the player played. The contract independently replays the whole game from that move list — placing each X, then computing and placing each O reply itself — and only that replay determines what gets recorded. A player can't fake a result this way; the move list alone is enough for anyone, including the contract, to reproduce and verify the game.

**The player pays for that one transaction, and nothing else.** There's no per-move transaction and no separate "logging" step — the computer never submits a transaction of its own, and playing (however many moves it takes) costs nothing until the single save-the-result step at the end.

This is phase 1: **free play** — games are recorded on-chain but no token changes hands. A phase 2 will add USDT staking and automatic payout once stake tiers, payout multiplier, and treasury funding are decided; see [`contracts/README.md`](./contracts/README.md) for the design notes.

## Difficulty

Chosen once, when a game starts:

| Difficulty | Behavior |
| --- | --- |
| Easy | Always a random empty cell. No strategy. |
| Medium | Takes an immediate win or blocks an immediate loss; otherwise random. Has no deeper lookahead, so it can be forked and beaten. |
| Hard | Exhaustive minimax search over the whole game tree. Mathematically guaranteed to never lose — the best a player can do is draw. |

Tic-tac-toe is a "solved" game: with perfect play from both sides it always ends in a draw. Hard plays that perfect strategy, which is what makes it unbeatable — not a difficulty knob turned up, but an opponent that never makes a mistake to exploit. Easy and Medium are intentionally weaker so there's actually a game to win.

## Configuration

Copy `.env.example` to `.env.local` and set:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_TIC_TAC_TOE_CONTRACT_ADDRESS` | Deployed `TicTacToe` contract address. Unset = demo mode (local engine, no wallet needed). |
| `NEXT_PUBLIC_USE_TESTNET` | Set to `true` to run against Celo Alfajores instead of mainnet. |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run the game engine's unit tests (Vitest) |

## Project structure

```
app/
  page.tsx          # the whole game — board, status, start/replay
  components/        # Board, ConnectGate
  lib/
    game/           # engine.ts (rules + minimax), useTicTacToeGame hook
    web3/           # MiniPay hook, wagmi config, contract ABI, constants
contracts/          # TicTacToe.sol + Foundry project (see contracts/README.md)
```
