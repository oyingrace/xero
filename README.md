# xero

xero is tic-tac-toe against the computer, built as a [MiniPay](https://www.opera.com/products/minipay) Mini App on the [Celo](https://celo.org) blockchain. You're X, the computer is O, and every move is a real transaction. Pick a difficulty before each game — Easy and Medium can be beaten, Hard cannot (see [Difficulty](#difficulty) below).

## Features

- **MiniPay-native wallet** — runs inside MiniPay and uses the player's wallet automatically; a Connect Wallet fallback is available in a normal browser.
- **On-chain gameplay** — each move is one signed transaction: the contract places your X, then immediately computes and places the computer's O reply and checks the outcome, all in the same call.
- **Three difficulties** — Easy (random), Medium (takes obvious wins/blocks, otherwise random), and Hard (exhaustive minimax — mathematically unbeatable).
- **Demo mode** — without a deployed contract configured, the app runs the identical game engine locally, so it's fully playable during development.

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

To play, the player calls `startGame(difficulty)` on `TicTacToe.sol`, then `makeMove(gameId, cell)` for each move. The contract places the player's X, then — if the game continues — computes the computer's O reply and places it, returning the updated board and status in the same transaction. At most 5 signed transactions per game.

**The player pays for all of it.** There's no separate "logging" transaction and the computer never submits its own transaction — every `makeMove` call already includes the computer's reply and the final outcome, so whoever's playing (win, lose, or draw) is the one whose wallet signs and pays gas for that move, same as any other Celo transaction.

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
