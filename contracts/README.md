# contracts

`TicTacToe.sol` — on-chain tic-tac-toe against a computer opponent, built for the [xero](../README.md) MiniPay Mini App on [Celo](https://celo.org).

The player is X and always moves first. `startGame(difficulty)` opens a game at one of three difficulties; `makeMove` places the player's X, then — if the game continues — computes and places the computer's O reply, all in the same transaction. **The player pays gas for every transaction** — there is no separate settlement or logging step, and the computer never submits a transaction of its own.

| Difficulty | Behavior |
| --- | --- |
| Easy (0) | Always a pseudo-random empty cell. |
| Medium (1) | Takes an immediate win/block, otherwise pseudo-random. Beatable — no lookahead. |
| Hard (2) | Exhaustive minimax with alpha-beta pruning. Mathematically guaranteed to never lose. |

This is phase 1: **free play**. Games are recorded on-chain but no token changes hands. A phase 2 contract will add USDT staking and automatic payout once the economics (stake tiers, payout multiplier, treasury funding) are decided with the product owner — deliberately not guessed at here.

## Setup

This is a [Foundry](https://book.getfoundry.sh) project.

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
cd contracts
forge install   # pulls the forge-std submodule if not already present
forge build
forge test
```

> **Note:** this contract was written and compile-checked (via `solc`, including resolving the forge-std submodule import) in an environment without network access to install Foundry itself, so `forge build` / `forge test` have not been run against it yet. Run the test suite in `test/TicTacToe.t.sol` before deploying — it covers game start/move validation, asserts (by exhaustive first-empty-cell play from every opening) that Hard never loses, and tests Medium's win/block priority deterministically via a `TicTacToeHarness` contract that exposes the internal helpers directly.

## Deploying

```bash
cp .env.example .env   # fill in DEPLOYER_PRIVATE_KEY and an RPC URL
forge script script/Deploy.s.sol --rpc-url celo_alfajores --broadcast --private-key $DEPLOYER_PRIVATE_KEY
```

Then set `NEXT_PUBLIC_TIC_TAC_TOE_CONTRACT_ADDRESS` in the app's `.env.local` to the deployed address. Until that's set, the frontend runs the identical game engine locally ("demo mode") so it's playable without a deployed contract.

## Design notes

- **No token custody in phase 1** — no `Ownable`, `ReentrancyGuard`, or ERC-20 dependency, since there's nothing to protect yet. Phase 2 will pull in OpenZeppelin for the staking/payout path.
- **Hard is minimax, not a heuristic shortcut** — an earlier design considered a cheaper win/block/fork/block-fork rule set, but it was proven beatable by a specific move sequence during development (see `app/lib/game/engine.ts`'s history/comments). Since Hard needs to guard real stakes eventually, correctness took priority over gas there: minimax with alpha-beta pruning is exhaustive and mathematically guaranteed never to lose.
- **Easy/Medium's randomness is not manipulation-proof** — `_bestMove`'s fallback seeds from `blockhash(block.number - 1)` and `block.timestamp`, both of which a block producer can influence. That's an acceptable trade for a free difficulty tier with no money on it, but it means Easy/Medium should not be trusted to fairly gate a staked payout without a better randomness source (e.g. a VRF) — revisit before phase 2 wires up staking on those tiers. Hard is unaffected, since it never uses randomness.
- **Gas cost is unbenchmarked** — the search is heaviest on Hard's first move (up to 8 empty cells) and shrinks every move after; Easy/Medium are cheap at any point. Celo's gas prices are low, but run `forge test --gas-report` once Foundry is available and confirm the cost is acceptable before mainnet deploy; optimize (e.g. bitboard packing) only if it isn't.
