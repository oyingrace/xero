// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TicTacToe} from "../src/TicTacToe.sol";

contract TicTacToeTest is Test {
    TicTacToe internal game;
    address internal player = address(0xBEEF);

    function setUp() public {
        game = new TicTacToe();
    }

    function _start() internal returns (uint256 gameId) {
        vm.prank(player);
        gameId = game.startGame();
    }

    function _move(uint256 gameId, uint8 cell) internal returns (uint8[9] memory board, TicTacToe.Status status) {
        vm.prank(player);
        return game.makeMove(gameId, cell);
    }

    function test_startGame_opensAnActiveGameForTheCaller() public {
        uint256 gameId = _start();
        (address storedPlayer,, TicTacToe.Status status) = game.getGame(gameId);
        assertEq(storedPlayer, player);
        assertEq(uint8(status), uint8(TicTacToe.Status.Active));
    }

    function test_makeMove_placesXAndTheComputerRepliesInOneCall() public {
        uint256 gameId = _start();
        (uint8[9] memory board,) = _move(gameId, 0);

        assertEq(board[0], 1, "player's X should be placed");
        uint256 computerMoves = 0;
        for (uint256 i = 0; i < 9; i++) {
            if (board[i] == 2) computerMoves++;
        }
        assertEq(computerMoves, 1, "computer should have replied exactly once");
    }

    function test_makeMove_revertsForSomeoneElsesGame() public {
        uint256 gameId = _start();
        vm.prank(address(0xC0FFEE));
        vm.expectRevert(TicTacToe.NotYourGame.selector);
        game.makeMove(gameId, 0);
    }

    function test_makeMove_revertsOnOccupiedCell() public {
        uint256 gameId = _start();
        _move(gameId, 0);
        vm.prank(player);
        vm.expectRevert(TicTacToe.CellOccupied.selector);
        game.makeMove(gameId, 0);
    }

    function test_makeMove_revertsOnInvalidCell() public {
        uint256 gameId = _start();
        vm.prank(player);
        vm.expectRevert(TicTacToe.InvalidCell.selector);
        game.makeMove(gameId, 9);
    }

    function test_makeMove_revertsWhenGameIsOver() public {
        uint256 gameId = _start();
        (, TicTacToe.Status status) = _move(gameId, 0);
        // Play out the rest of the board following empty cells in order.
        while (status == TicTacToe.Status.Active) {
            (uint8[9] memory board, TicTacToe.Status s) = _readGame(gameId);
            uint8 nextCell = _firstEmptyCell(board);
            (, status) = _move(gameId, nextCell);
            s;
        }
        vm.prank(player);
        vm.expectRevert(TicTacToe.GameNotActive.selector);
        game.makeMove(gameId, 0);
    }

    /// @dev The computer must never lose regardless of which empty cells the
    ///      player happens to fill in, matching the guarantee proven for the
    ///      TypeScript engine in app/lib/game/engine.test.ts.
    function test_computerNeverLoses_acrossFirstAvailableCellPlay() public {
        for (uint8 opening = 0; opening < 9; opening++) {
            uint256 gameId = _start();
            (uint8[9] memory board, TicTacToe.Status status) = _move(gameId, opening);
            while (status == TicTacToe.Status.Active) {
                uint8 nextCell = _firstEmptyCell(board);
                (board, status) = _move(gameId, nextCell);
            }
            assertTrue(
                status == TicTacToe.Status.Draw || status == TicTacToe.Status.ComputerWon,
                "player must never win"
            );
        }
    }

    function _readGame(uint256 gameId) internal view returns (uint8[9] memory board, TicTacToe.Status status) {
        (, board, status) = game.getGame(gameId);
    }

    function _firstEmptyCell(uint8[9] memory board) internal pure returns (uint8) {
        for (uint8 i = 0; i < 9; i++) {
            if (board[i] == 0) return i;
        }
        revert("no empty cell");
    }
}
