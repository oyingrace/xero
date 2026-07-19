// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TicTacToe} from "../src/TicTacToe.sol";

/// @dev Exposes TicTacToe's internal helpers so tests can simulate a game
///      move-by-move (to build the move list `playGame` expects) and check
///      the win/block-priority logic directly, without depending on the
///      exact pseudo-random value a given seed happens to produce.
contract TicTacToeHarness is TicTacToe {
    function findWinningMove(uint8[9] memory board, uint8 mark) external pure returns (bool, uint8) {
        return _findWinningMove(board, mark);
    }

    function bestMove(uint8[9] memory board, Difficulty difficulty, uint256 seed, uint8 moveIndex)
        external
        pure
        returns (uint8)
    {
        return _bestMove(board, difficulty, seed, moveIndex);
    }

    function statusOf(uint8[9] memory board) external pure returns (Status) {
        return _statusOf(board);
    }
}

contract TicTacToeTest is Test {
    TicTacToe internal game;
    TicTacToeHarness internal harness;
    address internal player = address(0xBEEF);

    function setUp() public {
        game = new TicTacToe();
        harness = new TicTacToeHarness();
    }

    /// @dev Simulates a full game exactly the way the frontend will: play
    ///      `firstMove`, then always the first empty cell after that,
    ///      using the harness to compute each computer reply. Returns the
    ///      player's move list (what `playGame` expects), the final board,
    ///      and the final status.
    function _simulate(TicTacToe.Difficulty difficulty, uint256 seed, uint8 firstMove)
        internal
        view
        returns (uint8[] memory moves, uint8[9] memory board, TicTacToe.Status status)
    {
        uint8[5] memory buffer; // MAX_PLAYER_MOVES in TicTacToe.sol
        uint8 count = 0;
        status = TicTacToe.Status.Active;

        for (uint8 i = 0; i < 5; i++) {
            uint8 cell = i == 0 ? firstMove : _firstEmptyCell(board);
            board[cell] = 1; // PLAYER
            buffer[count] = cell;
            count++;

            status = harness.statusOf(board);
            if (status != TicTacToe.Status.Active) break;

            uint8 computerCell = harness.bestMove(board, difficulty, seed, i);
            board[computerCell] = 2; // COMPUTER
            status = harness.statusOf(board);
            if (status != TicTacToe.Status.Active) break;
        }

        moves = new uint8[](count);
        for (uint8 i = 0; i < count; i++) {
            moves[i] = buffer[i];
        }
    }

    function _playGame(TicTacToe.Difficulty difficulty, uint256 seed, uint8[] memory moves)
        internal
        returns (uint256 gameId, uint8[9] memory board, TicTacToe.Status status)
    {
        vm.prank(player);
        return game.playGame(difficulty, seed, moves);
    }

    // ---- playGame lifecycle ----

    function test_playGame_recordsTheReplayedResultForTheCaller() public {
        (uint8[] memory moves, uint8[9] memory expectedBoard, TicTacToe.Status expectedStatus) =
            _simulate(TicTacToe.Difficulty.Hard, 1, 0);

        (uint256 gameId, uint8[9] memory board, TicTacToe.Status status) =
            _playGame(TicTacToe.Difficulty.Hard, 1, moves);

        assertEq(gameId, 0);
        assertEq(uint8(status), uint8(expectedStatus));
        for (uint8 i = 0; i < 9; i++) {
            assertEq(board[i], expectedBoard[i], "board must match the independent simulation");
        }

        (address storedPlayer, uint8[9] memory storedBoard, TicTacToe.Status storedStatus, TicTacToe.Difficulty storedDifficulty)
        = game.getGame(gameId);
        assertEq(storedPlayer, player);
        assertEq(uint8(storedStatus), uint8(status));
        assertEq(uint8(storedDifficulty), uint8(TicTacToe.Difficulty.Hard));
        for (uint8 i = 0; i < 9; i++) {
            assertEq(storedBoard[i], board[i]);
        }
    }

    function test_playGame_revertsOnEmptyMoveList() public {
        uint8[] memory moves = new uint8[](0);
        vm.prank(player);
        vm.expectRevert(TicTacToe.InvalidMoveCount.selector);
        game.playGame(TicTacToe.Difficulty.Hard, 1, moves);
    }

    function test_playGame_revertsOnTooManyMoves() public {
        uint8[] memory moves = new uint8[](6);
        for (uint8 i = 0; i < 6; i++) moves[i] = i;
        vm.prank(player);
        vm.expectRevert(TicTacToe.InvalidMoveCount.selector);
        game.playGame(TicTacToe.Difficulty.Hard, 1, moves);
    }

    function test_playGame_revertsOnInvalidCell() public {
        uint8[] memory moves = new uint8[](1);
        moves[0] = 9;
        vm.prank(player);
        vm.expectRevert(TicTacToe.InvalidCell.selector);
        game.playGame(TicTacToe.Difficulty.Hard, 1, moves);
    }

    function test_playGame_revertsOnOccupiedCell() public {
        // Cell 0 is X on the first move, so replaying it on the (nonexistent)
        // "third" move is always occupied regardless of the computer's reply.
        uint8[] memory moves = new uint8[](2);
        moves[0] = 0;
        moves[1] = 0;
        vm.prank(player);
        vm.expectRevert(TicTacToe.CellOccupied.selector);
        game.playGame(TicTacToe.Difficulty.Hard, 1, moves);
    }

    function test_playGame_revertsOnIncompleteGame() public {
        // A single move (1 X + 1 O) can never end a game.
        uint8[] memory moves = new uint8[](1);
        moves[0] = 0;
        vm.prank(player);
        vm.expectRevert(TicTacToe.GameIncomplete.selector);
        game.playGame(TicTacToe.Difficulty.Hard, 1, moves);
    }

    // ---- Hard: must never lose ----

    /// @dev The computer must never lose regardless of which cell the player
    ///      opens with, matching the guarantee proven for the TypeScript
    ///      engine in app/lib/game/engine.test.ts.
    function test_hard_computerNeverLoses_acrossEveryOpening() public {
        for (uint8 opening = 0; opening < 9; opening++) {
            (uint8[] memory moves,, TicTacToe.Status simulatedStatus) =
                _simulate(TicTacToe.Difficulty.Hard, uint256(opening) + 1, opening);
            (,, TicTacToe.Status status) = _playGame(TicTacToe.Difficulty.Hard, uint256(opening) + 1, moves);

            assertEq(uint8(status), uint8(simulatedStatus), "playGame must match the independent simulation");
            assertTrue(
                status == TicTacToe.Status.Draw || status == TicTacToe.Status.ComputerWon,
                "player must never win on hard"
            );
        }
    }

    // ---- Medium/Easy: deterministic win/block priority ----

    function test_findWinningMove_findsAnAvailableWin() public view {
        uint8[9] memory board = [0, 0, 0, 0, 0, 2, 0, 0, 2]; // O at 5,8 — win at 2
        (bool found, uint8 cell) = harness.findWinningMove(board, 2);
        assertTrue(found);
        assertEq(cell, 2);
    }

    function test_findWinningMove_reportsNoneWhenThereIsNoThreat() public view {
        uint8[9] memory board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        (bool found,) = harness.findWinningMove(board, 2);
        assertFalse(found);
    }

    function test_medium_takesAnImmediateWinOverAnything() public view {
        uint8[9] memory board = [0, 0, 0, 0, 0, 2, 0, 0, 2]; // win at 2
        uint8 cell = harness.bestMove(board, TicTacToe.Difficulty.Medium, 0, 0);
        assertEq(cell, 2);
    }

    function test_medium_blocksThePlayersImmediateWin() public view {
        uint8[9] memory board = [1, 0, 0, 1, 0, 0, 0, 0, 0]; // must block at 6
        uint8 cell = harness.bestMove(board, TicTacToe.Difficulty.Medium, 0, 0);
        assertEq(cell, 6);
    }

    function test_easy_ignoresAnImmediateWinAndPlaysLegally() public view {
        // Easy never checks for a win/block, so on a board where cell 2 is
        // the only winning move, its (random) choice is still allowed to
        // land anywhere legal — this just proves it never picks an
        // occupied cell.
        uint8[9] memory board = [1, 2, 0, 1, 0, 0, 0, 0, 2];
        uint8 cell = harness.bestMove(board, TicTacToe.Difficulty.Easy, 42, 7);
        assertTrue(board[cell] == 0, "easy must still choose an empty cell");
    }

    /// @dev Same seed + same moves must always reproduce the same game —
    ///      this is the property the whole one-transaction design leans on
    ///      (the client's local play must match what gets recorded).
    function test_sameSeedAndMoves_alwaysReproduceTheSameGame() public view {
        (uint8[] memory movesA, uint8[9] memory boardA, TicTacToe.Status statusA) =
            _simulate(TicTacToe.Difficulty.Medium, 777, 4);
        (uint8[] memory movesB, uint8[9] memory boardB, TicTacToe.Status statusB) =
            _simulate(TicTacToe.Difficulty.Medium, 777, 4);

        assertEq(uint8(statusA), uint8(statusB));
        assertEq(movesA.length, movesB.length);
        for (uint8 i = 0; i < movesA.length; i++) {
            assertEq(movesA[i], movesB[i]);
        }
        for (uint8 i = 0; i < 9; i++) {
            assertEq(boardA[i], boardB[i]);
        }
    }

    // ---- Legality across many games ----

    function test_medium_alwaysPlaysLegallyToCompletion() public {
        for (uint8 opening = 0; opening < 9; opening++) {
            (uint8[] memory moves,, TicTacToe.Status simulatedStatus) =
                _simulate(TicTacToe.Difficulty.Medium, uint256(opening) + 100, opening);
            (,, TicTacToe.Status status) =
                _playGame(TicTacToe.Difficulty.Medium, uint256(opening) + 100, moves);
            assertEq(uint8(status), uint8(simulatedStatus));
            assertTrue(
                status == TicTacToe.Status.Draw ||
                    status == TicTacToe.Status.ComputerWon ||
                    status == TicTacToe.Status.PlayerWon
            );
        }
    }

    function test_easy_alwaysPlaysLegallyToCompletion() public {
        for (uint8 opening = 0; opening < 9; opening++) {
            (uint8[] memory moves,, TicTacToe.Status simulatedStatus) =
                _simulate(TicTacToe.Difficulty.Easy, uint256(opening) + 200, opening);
            (,, TicTacToe.Status status) = _playGame(TicTacToe.Difficulty.Easy, uint256(opening) + 200, moves);
            assertEq(uint8(status), uint8(simulatedStatus));
            assertTrue(
                status == TicTacToe.Status.Draw ||
                    status == TicTacToe.Status.ComputerWon ||
                    status == TicTacToe.Status.PlayerWon
            );
        }
    }

    function _firstEmptyCell(uint8[9] memory board) internal pure returns (uint8) {
        for (uint8 i = 0; i < 9; i++) {
            if (board[i] == 0) return i;
        }
        revert("no empty cell");
    }
}
