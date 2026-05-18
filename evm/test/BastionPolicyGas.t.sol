// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { BastionPolicy } from "../src/BastionPolicy.sol";
import { IBastionPolicy } from "../src/interfaces/IBastionPolicy.sol";
import { Test } from "forge-std/Test.sol";

contract BastionPolicyGasTest is Test {
    BastionPolicy public policy;
    address public owner = makeAddr("owner");
    address[] public agents;

    function setUp() public {
        vm.prank(owner);
        policy = new BastionPolicy(owner);

        // Create 5 agents for gas benchmarking
        for (uint i = 0; i < 5; i++) {
            address agent = makeAddr(string(abi.encodePacked("agent", vm.toString(i))));
            agents.push(agent);

            address[] memory targets = new address[](3);
            targets[0] = makeAddr("target-a");
            targets[1] = makeAddr("target-b");
            targets[2] = makeAddr("target-c");

            bytes4[] memory selectors = new bytes4[](2);
            selectors[0] = bytes4(keccak256("transfer(address,uint256)"));
            selectors[1] = bytes4(keccak256("approve(address,uint256)"));

            IBastionPolicy.Policy memory p = IBastionPolicy.Policy({
                agent: agent,
                isActive: true,
                maxValuePerTx: 10 ether,
                maxGasPerTx: 1_000_000,
                dailyTxLimit: 100,
                cooldownSeconds: 0,
                allowedTargets: targets,
                allowedSelectors: selectors,
                extraData: ""
            });

            vm.prank(owner);
            policy.setPolicy(agent, p);
        }
    }

    function testGas_SetPolicy() public {
        address newAgent = makeAddr("new-agent");
        address[] memory targets = new address[](2);
        targets[0] = makeAddr("target-x");
        targets[1] = makeAddr("target-y");

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = bytes4(keccak256("transfer(address,uint256)"));
        selectors[1] = bytes4(keccak256("approve(address,uint256)"));

        IBastionPolicy.Policy memory p = IBastionPolicy.Policy({
            agent: newAgent,
            isActive: true,
            maxValuePerTx: 10 ether,
            maxGasPerTx: 1_000_000,
            dailyTxLimit: 100,
            cooldownSeconds: 0,
            allowedTargets: targets,
            allowedSelectors: selectors,
            extraData: ""
        });

        vm.prank(owner);
        policy.setPolicy(newAgent, p);
    }

    function testGas_CheckTransaction() public {
        bytes memory callData =
            abi.encodeWithSignature("transfer(address,uint256)", address(0x1), 100);
        policy.checkTransaction(agents[0], makeAddr("target-a"), 1 ether, callData);
    }

    function testGas_CheckBlockedTransaction() public {
        bytes memory callData = abi.encodeWithSignature("selfdestruct()");
        policy.checkTransaction(agents[0], makeAddr("target-z"), 0, callData);
    }
}
