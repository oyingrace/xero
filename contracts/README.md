# contracts

`TicTacToe.sol` — on-chain tic-tac-toe against a computer opponent, built for the [xero](../README.md) MiniPay Mini App on [Celo](https://celo.org).

The player is X and always moves first. `makeMove` places the player's X, then — if the game continues — computes the computer's O reply using an exhaustive minimax search and places it, all in the same transaction. The computer can never be beaten, only drawn or lost to.

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

> **Note:** this contract was written and compile-checked (via `solc`) in an environment without network access to install Foundry itself, so `forge build` / `forge test` have not been run against it yet. Run the test suite in `test/TicTacToe.t.sol` before deploying — it covers game start/move validation and asserts (by exhaustive first-empty-cell play from every opening) that the computer never loses.

## Deploying

```bash
cp .env.example .env   # fill in DEPLOYER_PRIVATE_KEY and an RPC URL
forge script script/Deploy.s.sol --rpc-url celo_alfajores --broadcast --private-key $DEPLOYER_PRIVATE_KEY
```

Then set `NEXT_PUBLIC_TIC_TAC_TOE_CONTRACT_ADDRESS` in the app's `.env.local` to the deployed address. Until that's set, the frontend runs the identical game engine locally ("demo mode") so it's playable without a deployed contract.

## Design notes

- **No token custody in phase 1** — no `Ownable`, `ReentrancyGuard`, or ERC-20 dependency, since there's nothing to protect yet. Phase 2 will pull in OpenZeppelin for the staking/payout path.
- **Minimax, not a heuristic shortcut** — an earlier design considered a cheaper win/block/fork/block-fork rule set, but it was proven beatable by a specific move sequence during development (see `app/lib/game/engine.ts`'s history/comments). Since this contract will eventually guard real stakes, correctness took priority over gas: minimax with alpha-beta pruning is exhaustive and mathematically guaranteed never to lose.
- **Gas cost is unbenchmarked** — the search is heaviest on the computer's first move (up to 8 empty cells) and shrinks every move after. Celo's gas prices are low, but run `forge test --gas-report` once Foundry is available and confirm the cost is acceptable before mainnet deploy; optimize (e.g. bitboard packing) only if it isn't.
