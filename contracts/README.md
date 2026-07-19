# contracts

`TicTacToe.sol` — on-chain tic-tac-toe against a computer opponent, built for the [xero](../README.md) MiniPay Mini App on [Celo](https://celo.org).

The player is X and always moves first. **One transaction per game**, submitted once the game is already decided: the player plays the whole game client-side (an identical engine lives at `app/lib/game/engine.ts`), then calls `playGame(difficulty, seed, moves)` with every X move they made, plus the random seed their client used for Easy/Medium. The contract independently replays the entire game from that move list — placing each X, then computing and placing each O reply itself with the same AI — and only that replay determines the recorded outcome. A player can't fake a result; the moves alone are enough for anyone (including the contract) to reproduce and verify the whole game. Reverts with `GameIncomplete` if the submitted moves don't actually reach a finished game.

This replaced an earlier design (`startGame` + one `makeMove` transaction per move) that verified each move on-chain in real time but meant signing a transaction per move. This version trades that away for one signature per game. **The player still pays all the gas** — there's no separate settlement step, and the computer never submits a transaction of its own.

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

> **Note:** this contract was written and compile-checked (via `solc`, including resolving the forge-std submodule import) in an environment without network access to install Foundry itself, so `forge build` / `forge test` have not been run against it yet. Run the test suite in `test/TicTacToe.t.sol` before deploying — it simulates full games (via a `TicTacToeHarness` that exposes the internal helpers), submits the resulting move list through the real `playGame`, and asserts the on-chain replay matches the simulation exactly; asserts (across every possible opening move) that Hard never loses; and tests Medium's win/block priority and `playGame`'s move-list validation deterministically.

## Deploying

Testnet (Alfajores):

```bash
cp .env.example .env   # fill in DEPLOYER_PRIVATE_KEY and an RPC URL
forge script script/Deploy.s.sol --rpc-url celo_alfajores --broadcast --private-key $DEPLOYER_PRIVATE_KEY
```

Mainnet, with Celoscan verification (get an API key at celoscan.io -> account -> API-Keys, set `CELOSCAN_API_KEY` in `.env`):

```bash
forge script script/Deploy.s.sol \
  --rpc-url celo \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --verify \
  --etherscan-api-key $CELOSCAN_API_KEY \
  --verifier-url https://api.celoscan.io/api
```

This is real CELO and irreversible once broadcast — confirm `forge test` passes first, and that the deployer wallet is funded and correct.

Then set `NEXT_PUBLIC_TIC_TAC_TOE_CONTRACT_ADDRESS` in the app's `.env.local` to the deployed address. Until that's set, the frontend runs the identical game engine locally ("demo mode") so it's playable without a deployed contract.

> **A previous version of this contract (the per-move `startGame`/`makeMove` design) is already deployed to Celo mainnet.** Its interface no longer matches this source — it predates the `playGame` redesign above — so it should be treated as retired once a new contract is deployed and the frontend points at the new address. It isn't upgradeable, so the old address simply stays on-chain, unused.

## Design notes

- **No token custody in phase 1** — no `Ownable`, `ReentrancyGuard`, or ERC-20 dependency, since there's nothing to protect yet. Phase 2 will pull in OpenZeppelin for the staking/payout path.
- **Hard is minimax, not a heuristic shortcut** — an earlier design considered a cheaper win/block/fork/block-fork rule set, but it was proven beatable by a specific move sequence during development (see `app/lib/game/engine.ts`'s history/comments). Since Hard needs to guard real stakes eventually, correctness took priority over gas there: minimax with alpha-beta pruning is exhaustive and mathematically guaranteed never to lose.
- **Easy/Medium's randomness trades manipulation-resistance for reproducibility** — `_bestMove`'s fallback seeds from the caller-supplied `seed` (not `blockhash`/`block.timestamp` as an earlier version did), so the client can compute the exact same sequence locally before ever submitting a transaction — necessary for the one-transaction-per-game design to show the player a live board that's guaranteed to match what gets recorded. The cost: a player who experimented with different seeds locally could pick a favorable one before submitting. That's acceptable since Easy/Medium are intentionally beatable already; revisit before phase 2 if a staked payout ever depends on Easy/Medium's randomness being unpredictable. Hard is unaffected either way, since it never uses randomness.
- **Gas cost is unbenchmarked** — `playGame` runs the whole game in one call; the heaviest single step is Hard's first move (up to 8 empty cells to search), and every difficulty is cheap after that. Celo's gas prices are low, but run `forge test --gas-report` once Foundry is available and confirm the cost is acceptable before mainnet deploy; optimize (e.g. bitboard packing) only if it isn't.
