// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console } from "forge-std/Script.sol";
import { BastionPolicy } from "../src/BastionPolicy.sol";
import { BastionAudit } from "../src/BastionAudit.sol";
import { BastionFirewall } from "../src/BastionFirewall.sol";
import { BastionRegistry } from "../src/BastionRegistry.sol";
import { IBastionPolicy } from "../src/interfaces/IBastionPolicy.sol";
import { IBastionAudit } from "../src/interfaces/IBastionAudit.sol";

/// @title DeployBastion
/// @notice Deploy the full Bastion protocol to any EVM chain.
/// Usage:
///   forge script script/DeployBastion.s.sol --rpc-url base --broadcast --verify
///   forge script script/DeployBastion.s.sol --rpc-url polygon --broadcast --verify
contract DeployBastion is Script {
    function run() external {
        uint deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Audit
        BastionAudit audit = new BastionAudit();
        console.log("BastionAudit deployed at:", address(audit));

        // 2. Deploy Policy
        BastionPolicy policy = new BastionPolicy(deployer);
        console.log("BastionPolicy deployed at:", address(policy));

        // 3. Deploy Registry
        BastionRegistry registry = new BastionRegistry(deployer);
        console.log("BastionRegistry deployed at:", address(registry));

        // 4. Deploy Firewall
        BastionFirewall firewall = new BastionFirewall(
            IBastionPolicy(address(policy)), IBastionAudit(address(audit)), deployer
        );
        console.log("BastionFirewall deployed at:", address(firewall));

        vm.stopBroadcast();

        console.log("\n=== Bastion Protocol Deployed ===");
        console.log("Chain ID:", block.chainid);
        console.log("Audit:", address(audit));
        console.log("Policy:", address(policy));
        console.log("Registry:", address(registry));
        console.log("Firewall:", address(firewall));
    }
}
