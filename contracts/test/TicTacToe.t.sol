// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TicTacToe} from "../src/TicTacToe.sol";

/// @dev Exposes TicTacToe's internal helpers so the deterministic parts of
///      the AI (win/block priority) can be tested directly, without routing
///      through startGame/makeMove and without depending on the exact
///      pseudo-random value blockhash/timestamp happen to produce.
contract TicTacToeHarness is TicTacToe {
    function findWinningMove(uint8[9] memory board, uint8 mark) external pure returns (bool, uint8) {
        return _findWinningMove(board, mark);
    }

    function bestMove(uint8[9] memory board, Difficulty difficulty, uint256 gameId, uint8 salt)
        external
        view
        returns (uint8)
    {
        return _bestMove(board, difficulty, gameId, salt);
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

    function _start(TicTacToe.Difficulty difficulty) internal returns (uint256 gameId) {
        vm.prank(player);
        gameId = game.startGame(difficulty);
    }

    function _move(uint256 gameId, uint8 cell) internal returns (uint8[9] memory board, TicTacToe.Status status) {
        vm.prank(player);
        return game.makeMove(gameId, cell);
    }

    // ---- Game lifecycle (Hard, unless the test is difficulty-specific) ----

    function test_startGame_opensAnActiveGameForTheCaller() public {
        uint256 gameId = _start(TicTacToe.Difficulty.Hard);
        (address storedPlayer,, TicTacToe.Status status, TicTacToe.Difficulty difficulty) = game.getGame(gameId);
        assertEq(storedPlayer, player);
        assertEq(uint8(status), uint8(TicTacToe.Status.Active));
        assertEq(uint8(difficulty), uint8(TicTacToe.Difficulty.Hard));
    }

    function test_makeMove_placesXAndTheComputerRepliesInOneCall() public {
        uint256 gameId = _start(TicTacToe.Difficulty.Hard);
        (uint8[9] memory board,) = _move(gameId, 0);

        assertEq(board[0], 1, "player's X should be placed");
        uint256 computerMoves = 0;
        for (uint256 i = 0; i < 9; i++) {
            if (board[i] == 2) computerMoves++;
        }
        assertEq(computerMoves, 1, "computer should have replied exactly once");
    }

    function test_makeMove_revertsForSomeoneElsesGame() public {
        uint256 gameId = _start(TicTacToe.Difficulty.Hard);
        vm.prank(address(0xC0FFEE));
        vm.expectRevert(TicTacToe.NotYourGame.selector);
        game.makeMove(gameId, 0);
    }

    function test_makeMove_revertsOnOccupiedCell() public {
        uint256 gameId = _start(TicTacToe.Difficulty.Hard);
        _move(gameId, 0);
        vm.prank(player);
        vm.expectRevert(TicTacToe.CellOccupied.selector);
        game.makeMove(gameId, 0);
    }

    function test_makeMove_revertsOnInvalidCell() public {
        uint256 gameId = _start(TicTacToe.Difficulty.Hard);
        vm.prank(player);
        vm.expectRevert(TicTacToe.InvalidCell.selector);
        game.makeMove(gameId, 9);
    }

    function test_makeMove_revertsWhenGameIsOver() public {
        uint256 gameId = _start(TicTacToe.Difficulty.Hard);
        (, TicTacToe.Status status) = _move(gameId, 0);
        while (status == TicTacToe.Status.Active) {
            (, uint8[9] memory board, TicTacToe.Status s,) = game.getGame(gameId);
            uint8 nextCell = _firstEmptyCell(board);
            (, status) = _move(gameId, nextCell);
            s;
        }
        vm.prank(player);
        vm.expectRevert(TicTacToe.GameNotActive.selector);
        game.makeMove(gameId, 0);
    }

    // ---- Hard: must never lose ----

    /// @dev The computer must never lose regardless of which empty cells the
    ///      player happens to fill in, matching the guarantee proven for the
    ///      TypeScript engine in app/lib/game/engine.test.ts.
    function test_hard_computerNeverLoses_acrossFirstAvailableCellPlay() public {
        for (uint8 opening = 0; opening < 9; opening++) {
            uint256 gameId = _start(TicTacToe.Difficulty.Hard);
            (uint8[9] memory board, TicTacToe.Status status) = _move(gameId, opening);
            while (status == TicTacToe.Status.Active) {
                uint8 nextCell = _firstEmptyCell(board);
                (board, status) = _move(gameId, nextCell);
            }
            assertTrue(
                status == TicTacToe.Status.Draw || status == TicTacToe.Status.ComputerWon,
                "player must never win on hard"
            );
        }
    }

    // ---- Medium/Easy: deterministic win/block priority ----
    //
    // These call the harness directly instead of playing through
    // startGame/makeMove, so they exercise the win/block logic exactly
    // without depending on the pseudo-random fallback's exact output.

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

    // ---- Legality smoke tests across full games ----

    function test_medium_alwaysPlaysLegallyToCompletion() public {
        for (uint8 opening = 0; opening < 9; opening++) {
            uint256 gameId = _start(TicTacToe.Difficulty.Medium);
            (uint8[9] memory board, TicTacToe.Status status) = _move(gameId, opening);
            uint256 guard = 0;
            while (status == TicTacToe.Status.Active) {
                guard++;
                assertLt(guard, 9, "game did not terminate");
                uint8 nextCell = _firstEmptyCell(board);
                (board, status) = _move(gameId, nextCell);
            }
            assertTrue(
                status == TicTacToe.Status.Draw ||
                    status == TicTacToe.Status.ComputerWon ||
                    status == TicTacToe.Status.PlayerWon
            );
        }
    }

    function test_easy_alwaysPlaysLegallyToCompletion() public {
        for (uint8 opening = 0; opening < 9; opening++) {
            uint256 gameId = _start(TicTacToe.Difficulty.Easy);
            (uint8[9] memory board, TicTacToe.Status status) = _move(gameId, opening);
            uint256 guard = 0;
            while (status == TicTacToe.Status.Active) {
                guard++;
                assertLt(guard, 9, "game did not terminate");
                uint8 nextCell = _firstEmptyCell(board);
                (board, status) = _move(gameId, nextCell);
            }
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
