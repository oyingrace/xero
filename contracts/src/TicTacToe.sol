// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TicTacToe
 * @notice On-chain tic-tac-toe against a computer opponent, for a MiniPay
 *         Mini App on Celo. The caller is X and always moves first; the
 *         contract plays O at one of three difficulties chosen when the
 *         game starts:
 *
 *         - Hard: exhaustive minimax over the (tiny) game tree — the
 *           computer can never be beaten, only drawn or lost to.
 *         - Medium: takes an immediate win or blocks an immediate loss,
 *           otherwise plays a pseudo-random empty cell. Beatable.
 *         - Easy: always a pseudo-random empty cell. Beatable.
 *
 * @dev Phase 1: free play. Games are recorded on-chain but no token
 *      changes hands — `makeMove` does both halves of a round (the
 *      player's move and the computer's reply) in a single transaction,
 *      so the whole game is at most 5 signed transactions, all paid for
 *      by the player. A phase 2 contract will add USDT staking and
 *      automatic payout once the economics (stake tiers, payout
 *      multiplier, treasury funding) are decided; deliberately not built
 *      here to avoid guessing those numbers.
 *
 *      Easy/Medium's pseudo-randomness comes from `blockhash`/
 *      `block.timestamp`, which a block producer can bias. That's an
 *      acceptable trade for a free, casual difficulty tier, but revisit it
 *      before phase 2 wires up staked payouts on those tiers — Hard is
 *      unaffected since it never uses randomness.
 *
 *      The TypeScript mirror of this exact algorithm lives at
 *      app/lib/game/engine.ts (used for the frontend's optimistic/local
 *      play) — keep the two in sync if either changes.
 */
contract TicTacToe {
    enum Status {
        None,
        Active,
        PlayerWon,
        ComputerWon,
        Draw
    }

    enum Difficulty {
        Easy,
        Medium,
        Hard
    }

    uint8 private constant EMPTY = 0;
    uint8 private constant PLAYER = 1;
    uint8 private constant COMPUTER = 2;

    struct Game {
        address player;
        uint8[9] board;
        Status status;
        Difficulty difficulty;
    }

    uint256 public nextGameId;
    mapping(uint256 => Game) private _games;

    event GameStarted(uint256 indexed gameId, address indexed player, Difficulty difficulty);
    event MoveMade(uint256 indexed gameId, uint8[9] board, Status status);

    error NotYourGame();
    error GameNotActive();
    error InvalidCell();
    error CellOccupied();

    /// @notice Opens a new game for the caller with an empty board.
    function startGame(Difficulty difficulty) external returns (uint256 gameId) {
        gameId = nextGameId++;
        Game storage game = _games[gameId];
        game.player = msg.sender;
        game.status = Status.Active;
        game.difficulty = difficulty;
        emit GameStarted(gameId, msg.sender, difficulty);
    }

    /**
     * @notice Plays `cell` as X, then — if the game continues — plays the
     *         computer's O reply and checks the outcome again. Returns and
     *         emits the board state after both halves of the round.
     */
    function makeMove(uint256 gameId, uint8 cell) external returns (uint8[9] memory board, Status status) {
        Game storage game = _games[gameId];
        if (game.player != msg.sender) revert NotYourGame();
        if (game.status != Status.Active) revert GameNotActive();
        if (cell >= 9) revert InvalidCell();
        if (game.board[cell] != EMPTY) revert CellOccupied();

        uint8[9] memory workingBoard = game.board;
        workingBoard[cell] = PLAYER;

        Status newStatus = _statusOf(workingBoard);
        if (newStatus == Status.Active) {
            uint8 computerCell = _bestMove(workingBoard, game.difficulty, gameId, cell);
            workingBoard[computerCell] = COMPUTER;
            newStatus = _statusOf(workingBoard);
        }

        game.board = workingBoard;
        game.status = newStatus;

        board = workingBoard;
        status = newStatus;
        emit MoveMade(gameId, board, status);
    }

    /// @notice Reads back a game's player, board, status, and difficulty.
    function getGame(uint256 gameId)
        external
        view
        returns (address player, uint8[9] memory board, Status status, Difficulty difficulty)
    {
        Game storage game = _games[gameId];
        return (game.player, game.board, game.status, game.difficulty);
    }

    // ---- Game logic ----

    function _hasWinner(uint8[9] memory board, uint8 mark) private pure returns (bool) {
        return
            (board[0] == mark && board[1] == mark && board[2] == mark) ||
            (board[3] == mark && board[4] == mark && board[5] == mark) ||
            (board[6] == mark && board[7] == mark && board[8] == mark) ||
            (board[0] == mark && board[3] == mark && board[6] == mark) ||
            (board[1] == mark && board[4] == mark && board[7] == mark) ||
            (board[2] == mark && board[5] == mark && board[8] == mark) ||
            (board[0] == mark && board[4] == mark && board[8] == mark) ||
            (board[2] == mark && board[4] == mark && board[6] == mark);
    }

    function _isFull(uint8[9] memory board) private pure returns (bool) {
        for (uint8 i = 0; i < 9; i++) {
            if (board[i] == EMPTY) return false;
        }
        return true;
    }

    function _statusOf(uint8[9] memory board) private pure returns (Status) {
        if (_hasWinner(board, PLAYER)) return Status.PlayerWon;
        if (_hasWinner(board, COMPUTER)) return Status.ComputerWon;
        if (_isFull(board)) return Status.Draw;
        return Status.Active;
    }

    /// @dev Picks the computer's (O's) move for the game's chosen difficulty.
    function _bestMove(uint8[9] memory board, Difficulty difficulty, uint256 gameId, uint8 salt)
        private
        view
        returns (uint8)
    {
        if (difficulty == Difficulty.Hard) {
            return _bestMoveHard(board);
        }

        if (difficulty == Difficulty.Medium) {
            (bool canWin, uint8 winCell) = _findWinningMove(board, COMPUTER);
            if (canWin) return winCell;
            (bool mustBlock, uint8 blockCell) = _findWinningMove(board, PLAYER);
            if (mustBlock) return blockCell;
        }

        uint256 seed = uint256(
            keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp, gameId, salt))
        );
        return _randomEmptyCell(board, seed);
    }

    /// @dev The 8 winning lines, as cell-index triples.
    function _lines() private pure returns (uint8[3][8] memory lines) {
        lines[0] = [uint8(0), 1, 2];
        lines[1] = [uint8(3), 4, 5];
        lines[2] = [uint8(6), 7, 8];
        lines[3] = [uint8(0), 3, 6];
        lines[4] = [uint8(1), 4, 7];
        lines[5] = [uint8(2), 5, 8];
        lines[6] = [uint8(0), 4, 8];
        lines[7] = [uint8(2), 4, 6];
    }

    /// @dev First empty cell that would complete a line for `mark`, if any.
    function _findWinningMove(uint8[9] memory board, uint8 mark) private pure returns (bool found, uint8 cell) {
        uint8[3][8] memory lines = _lines();
        for (uint8 i = 0; i < 8; i++) {
            uint8 a = lines[i][0];
            uint8 b = lines[i][1];
            uint8 c = lines[i][2];
            uint8 markCount = 0;
            uint8 emptyCount = 0;
            uint8 emptyCell = 0;
            if (board[a] == mark) markCount++;
            else if (board[a] == EMPTY) {
                emptyCount++;
                emptyCell = a;
            }
            if (board[b] == mark) markCount++;
            else if (board[b] == EMPTY) {
                emptyCount++;
                emptyCell = b;
            }
            if (board[c] == mark) markCount++;
            else if (board[c] == EMPTY) {
                emptyCount++;
                emptyCell = c;
            }
            if (markCount == 2 && emptyCount == 1) {
                return (true, emptyCell);
            }
        }
        return (false, 0);
    }

    /// @dev The `seed`-th empty cell, in board order (0..8).
    function _randomEmptyCell(uint8[9] memory board, uint256 seed) private pure returns (uint8) {
        uint8 emptyCount = 0;
        for (uint8 i = 0; i < 9; i++) {
            if (board[i] == EMPTY) emptyCount++;
        }

        uint256 target = seed % emptyCount;
        uint8 seen = 0;
        for (uint8 i = 0; i < 9; i++) {
            if (board[i] == EMPTY) {
                if (seen == target) return i;
                seen++;
            }
        }
        revert InvalidCell(); // unreachable: caller guarantees emptyCount > 0
    }

    /**
     * @dev Exhaustive minimax with alpha-beta pruning over the remaining
     *      empty cells (at most 8 the first time this is ever called in a
     *      game). The depth-adjusted score prefers a faster computer win
     *      and a slower player win. `board` is mutated and restored in
     *      place as the search back-tracks — safe because Solidity passes
     *      `memory` arrays to internal functions by reference.
     */
    function _minimax(uint8[9] memory board, bool isComputerTurn, int8 depth, int8 alpha, int8 beta)
        private
        pure
        returns (int8)
    {
        Status status = _statusOf(board);
        if (status == Status.ComputerWon) return 10 - depth;
        if (status == Status.PlayerWon) return depth - 10;
        if (status == Status.Draw) return 0;

        uint8 mark = isComputerTurn ? COMPUTER : PLAYER;
        if (isComputerTurn) {
            int8 best = -100;
            for (uint8 i = 0; i < 9; i++) {
                if (board[i] != EMPTY) continue;
                board[i] = mark;
                int8 score = _minimax(board, false, depth + 1, alpha, beta);
                board[i] = EMPTY;
                if (score > best) best = score;
                if (best > alpha) alpha = best;
                if (beta <= alpha) break;
            }
            return best;
        } else {
            int8 best = 100;
            for (uint8 i = 0; i < 9; i++) {
                if (board[i] != EMPTY) continue;
                board[i] = mark;
                int8 score = _minimax(board, true, depth + 1, alpha, beta);
                board[i] = EMPTY;
                if (score < best) best = score;
                if (best < beta) beta = best;
                if (beta <= alpha) break;
            }
            return best;
        }
    }

    /// @dev Picks the computer's (O's) move against the current board via minimax.
    function _bestMoveHard(uint8[9] memory board) private pure returns (uint8 bestCell) {
        int8 bestScore = -101;
        for (uint8 i = 0; i < 9; i++) {
            if (board[i] != EMPTY) continue;
            board[i] = COMPUTER;
            int8 score = _minimax(board, false, 1, -100, 100);
            board[i] = EMPTY;
            if (score > bestScore) {
                bestScore = score;
                bestCell = i;
            }
        }
    }
}
