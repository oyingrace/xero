// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TicTacToe
 * @notice On-chain tic-tac-toe against a computer opponent, for a MiniPay
 *         Mini App on Celo. The caller is X and always moves first; the
 *         contract plays O at one of three difficulties:
 *
 *         - Hard: exhaustive minimax over the (tiny) game tree — the
 *           computer can never be beaten, only drawn or lost to.
 *         - Medium: takes an immediate win or blocks an immediate loss,
 *           otherwise plays a pseudo-random empty cell. Beatable.
 *         - Easy: always a pseudo-random empty cell. Beatable.
 *
 * @dev One transaction per game, submitted once the game is already over.
 *      The player plays the whole game client-side first (an identical
 *      engine lives at app/lib/game/engine.ts), then calls `playGame` with
 *      every X move they made plus the random seed their client used for
 *      Easy/Medium. The contract independently replays the entire game —
 *      placing each X, then computing and placing each O reply itself —
 *      and only that replay determines the recorded outcome. A player
 *      can't fake a result: the move list alone lets anyone (including
 *      this contract) reproduce and verify the whole game.
 *
 *      This replaces an earlier design where every move was its own
 *      transaction (`startGame` + repeated `makeMove` calls), which gave
 *      real-time on-chain verification of each move but meant signing a
 *      transaction per move. This version trades that away for a single
 *      signature per game.
 *
 *      Easy/Medium's random fallback is seeded from the caller-supplied
 *      `seed` (combined with the move index), not blockhash/timestamp —
 *      that makes it exactly reproducible by the client ahead of
 *      submission, so what the player saw while playing always matches
 *      what gets recorded. The trade is that a player who tried different
 *      seeds locally could pick a favorable one before submitting; that's
 *      an acceptable trade since Easy/Medium are intentionally beatable
 *      already. Hard is unaffected either way, since it never uses
 *      randomness.
 *
 *      Free play: no token changes hands. A phase 2 contract will add
 *      USDT staking and automatic payout once the economics (stake tiers,
 *      payout multiplier, treasury funding) are decided; deliberately not
 *      built here to avoid guessing those numbers.
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

    uint8 internal constant EMPTY = 0;
    uint8 internal constant PLAYER = 1;
    uint8 internal constant COMPUTER = 2;

    /// @dev X moves first, so at most ceil(9/2) = 5 X moves can ever occur.
    uint8 internal constant MAX_PLAYER_MOVES = 5;

    struct Game {
        address player;
        uint8[9] board;
        Status status;
        Difficulty difficulty;
    }

    uint256 public nextGameId;
    mapping(uint256 => Game) private _games;

    event GamePlayed(
        uint256 indexed gameId,
        address indexed player,
        Difficulty difficulty,
        uint256 seed,
        uint8[] moves,
        uint8[9] board,
        Status status
    );

    error InvalidMoveCount();
    error InvalidCell();
    error CellOccupied();
    error GameIncomplete();

    /**
     * @notice Plays a full game of tic-tac-toe in one transaction and
     *         records the result. `moves` is every cell the player (X)
     *         played, in order; the contract computes every O reply
     *         itself using `difficulty` and `seed`. Reverts unless `moves`
     *         reaches a finished game (win, loss, or draw) — play to
     *         completion locally before calling this.
     */
    function playGame(Difficulty difficulty, uint256 seed, uint8[] calldata moves)
        external
        returns (uint256 gameId, uint8[9] memory board, Status status)
    {
        if (moves.length == 0 || moves.length > MAX_PLAYER_MOVES) revert InvalidMoveCount();

        status = Status.Active;
        for (uint8 i = 0; i < moves.length; i++) {
            uint8 cell = moves[i];
            if (cell >= 9) revert InvalidCell();
            if (board[cell] != EMPTY) revert CellOccupied();

            board[cell] = PLAYER;
            status = _statusOf(board);
            if (status != Status.Active) break;

            uint8 computerCell = _bestMove(board, difficulty, seed, i);
            board[computerCell] = COMPUTER;
            status = _statusOf(board);
            if (status != Status.Active) break;
        }

        if (status == Status.Active) revert GameIncomplete();

        gameId = nextGameId++;
        _games[gameId] = Game({player: msg.sender, board: board, status: status, difficulty: difficulty});

        emit GamePlayed(gameId, msg.sender, difficulty, seed, moves, board, status);
    }

    /// @notice Reads back a recorded game's player, board, status, and difficulty.
    function getGame(uint256 gameId)
        external
        view
        returns (address player, uint8[9] memory board, Status status, Difficulty difficulty)
    {
        Game storage game = _games[gameId];
        return (game.player, game.board, game.status, game.difficulty);
    }

    // ---- Game logic ----

    function _hasWinner(uint8[9] memory board, uint8 mark) internal pure returns (bool) {
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

    function _isFull(uint8[9] memory board) internal pure returns (bool) {
        for (uint8 i = 0; i < 9; i++) {
            if (board[i] == EMPTY) return false;
        }
        return true;
    }

    function _statusOf(uint8[9] memory board) internal pure returns (Status) {
        if (_hasWinner(board, PLAYER)) return Status.PlayerWon;
        if (_hasWinner(board, COMPUTER)) return Status.ComputerWon;
        if (_isFull(board)) return Status.Draw;
        return Status.Active;
    }

    /// @dev Picks the computer's (O's) move for the game's chosen difficulty.
    function _bestMove(uint8[9] memory board, Difficulty difficulty, uint256 seed, uint8 moveIndex)
        internal
        pure
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

        uint256 randomSeed = uint256(keccak256(abi.encodePacked(seed, moveIndex)));
        return _randomEmptyCell(board, randomSeed);
    }

    /// @dev The 8 winning lines, as cell-index triples.
    function _lines() internal pure returns (uint8[3][8] memory lines) {
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
    function _findWinningMove(uint8[9] memory board, uint8 mark) internal pure returns (bool found, uint8 cell) {
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
    function _randomEmptyCell(uint8[9] memory board, uint256 seed) internal pure returns (uint8) {
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
        internal
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
    function _bestMoveHard(uint8[9] memory board) internal pure returns (uint8 bestCell) {
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
