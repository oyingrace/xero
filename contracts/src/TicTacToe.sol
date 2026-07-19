// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TicTacToe
 * @notice On-chain tic-tac-toe against a computer opponent, for a MiniPay
 *         Mini App on Celo. The caller is X and always moves first; the
 *         contract plays O using an exhaustive minimax search over the
 *         (tiny) game tree, so the computer can never be beaten — only
 *         drawn or lost to.
 *
 * @dev Phase 1: free play. Games are recorded on-chain but no token
 *      changes hands — `makeMove` does both halves of a round (the
 *      player's move and the computer's reply) in a single transaction,
 *      so the whole game is at most 5 signed transactions. A phase 2
 *      contract will add USDT staking and automatic payout once the
 *      economics (stake tiers, payout multiplier, treasury funding) are
 *      decided; deliberately not built here to avoid guessing those
 *      numbers.
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

    uint8 private constant EMPTY = 0;
    uint8 private constant PLAYER = 1;
    uint8 private constant COMPUTER = 2;

    struct Game {
        address player;
        uint8[9] board;
        Status status;
    }

    uint256 public nextGameId;
    mapping(uint256 => Game) private _games;

    event GameStarted(uint256 indexed gameId, address indexed player);
    event MoveMade(uint256 indexed gameId, uint8[9] board, Status status);

    error NotYourGame();
    error GameNotActive();
    error InvalidCell();
    error CellOccupied();

    /// @notice Opens a new game for the caller with an empty board.
    function startGame() external returns (uint256 gameId) {
        gameId = nextGameId++;
        Game storage game = _games[gameId];
        game.player = msg.sender;
        game.status = Status.Active;
        emit GameStarted(gameId, msg.sender);
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
            uint8 computerCell = _bestMove(workingBoard);
            workingBoard[computerCell] = COMPUTER;
            newStatus = _statusOf(workingBoard);
        }

        game.board = workingBoard;
        game.status = newStatus;

        board = workingBoard;
        status = newStatus;
        emit MoveMade(gameId, board, status);
    }

    /// @notice Reads back a game's player, board, and status.
    function getGame(uint256 gameId) external view returns (address player, uint8[9] memory board, Status status) {
        Game storage game = _games[gameId];
        return (game.player, game.board, game.status);
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

    /// @dev Picks the computer's (O's) move against the current board.
    function _bestMove(uint8[9] memory board) private pure returns (uint8 bestCell) {
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
