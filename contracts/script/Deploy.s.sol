// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TicTacToe} from "../src/TicTacToe.sol";

/**
 * @dev Deploys TicTacToe.sol. Run with:
 *
 *   forge script script/Deploy.s.sol --rpc-url celo_alfajores --broadcast --private-key $DEPLOYER_PRIVATE_KEY
 *
 * Set DEPLOYER_PRIVATE_KEY and CELO_ALFAJORES_RPC_URL / CELO_RPC_URL in
 * contracts/.env (see .env.example) before running.
 */
contract Deploy is Script {
    function run() external returns (TicTacToe ticTacToe) {
        vm.startBroadcast();
        ticTacToe = new TicTacToe();
        vm.stopBroadcast();

        console.log("TicTacToe deployed at:", address(ticTacToe));
    }
}
