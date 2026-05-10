// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {SafeYield} from "../src/SafeYield.sol";

contract DeploySafeYield is Script {
    function run() external {
        vm.startBroadcast();

        SafeYield safeYield = new SafeYield();
        console.log("SafeYield deployed at:", address(safeYield));

        vm.stopBroadcast();
    }
}
