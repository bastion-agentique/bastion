// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { BastionSidecar } from "../src/BastionSidecar.sol";
import { IBastionSidecar } from "../src/interfaces/IBastionSidecar.sol";

/// @title BastionSidecarTest
/// @notice Integration tests for the Bastion sidecar oracle contract.
contract BastionSidecarTest is Test {
    BastionSidecar public sidecar;

    address constant AGENT = address(0x1000);
    address constant TARGET = address(0x2000);
    address constant VERIFIER = address(0x3000);
    address constant STRANGER = address(0x4000);

    function setUp() public {
        sidecar = new BastionSidecar(VERIFIER);
    }

    /// @notice Full request/fulfill flow: request → fulfill → read.
    function test_RequestAndFulfill() public {
        bytes32 requestId = sidecar.requestEvaluate(AGENT, TARGET, 1 ether);

        // Only verifier can fulfill
        vm.prank(VERIFIER);
        sidecar.fulfillEvaluate(requestId, 0, ""); // 0 = Pass

        (bool allowed, string memory reason, uint8 decision) =
            sidecar.getEvaluation(requestId);

        assertTrue(allowed);
        assertEq(decision, 0);
        assertEq(reason, "");
    }

    /// @notice Block decision is stored correctly.
    function test_BlockDecision() public {
        bytes32 requestId = sidecar.requestEvaluate(AGENT, TARGET, 100 ether);

        vm.prank(VERIFIER);
        sidecar.fulfillEvaluate(requestId, 1, "amount exceeds limit"); // 1 = Block

        (bool allowed, string memory reason, uint8 decision) =
            sidecar.getEvaluation(requestId);

        assertFalse(allowed);
        assertEq(decision, 1);
        assertEq(reason, "amount exceeds limit");
    }

    /// @notice Pending HITL decision is stored correctly.
    function test_PendingHITLDecision() public {
        bytes32 requestId = sidecar.requestEvaluate(AGENT, TARGET, 1000 ether);

        vm.prank(VERIFIER);
        sidecar.fulfillEvaluate(
            requestId,
            2,
            "amount 1000000000000000000000 exceeds HITL threshold"
        ); // 2 = PendingHITL

        (bool allowed, string memory reason, uint8 decision) =
            sidecar.getEvaluation(requestId);

        assertFalse(allowed);
        assertEq(decision, 2);
        assertTrue(bytes(reason).length > 0);
    }

    /// @notice Non-verifier cannot fulfill.
    function test_RevertWhen_NotVerifier() public {
        bytes32 requestId = sidecar.requestEvaluate(AGENT, TARGET, 1 ether);

        vm.prank(STRANGER);
        vm.expectRevert("only verifier");
        sidecar.fulfillEvaluate(requestId, 0, "");
    }

    /// @notice Cannot fulfill a request that was never made.
    function test_RevertWhen_NotRequested() public {
        bytes32 fakeId = keccak256("not-real");

        vm.prank(VERIFIER);
        vm.expectRevert("not requested");
        sidecar.fulfillEvaluate(fakeId, 0, "");
    }

    /// @notice Cannot request the same transaction twice.
    function test_RevertWhen_DuplicateRequest() public {
        sidecar.requestEvaluate(AGENT, TARGET, 1 ether);

        vm.expectRevert("already requested");
        sidecar.requestEvaluate(AGENT, TARGET, 1 ether);
    }

    /// @notice Different amounts produce different request IDs.
    function test_DifferentAmounts_DifferentRequestIds() public {
        bytes32 id1 = sidecar.requestEvaluate(AGENT, TARGET, 1 ether);
        bytes32 id2 = sidecar.requestEvaluate(AGENT, TARGET, 2 ether);

        assertTrue(id1 != id2);
    }

    /// @notice Owner can update verifier.
    function test_OwnerCanSetVerifier() public {
        address newVerifier = address(0x5000);

        vm.prank(VERIFIER);
        sidecar.setVerifier(newVerifier);

        assertEq(sidecar.verifier(), newVerifier);
    }

    /// @notice Non-owner cannot update verifier.
    function test_RevertWhen_NonOwnerSetsVerifier() public {
        vm.prank(STRANGER);
        vm.expectRevert();
        sidecar.setVerifier(address(0x5000));
    }

    /// @notice Events are emitted correctly.
    function test_EventsEmitted() public {
        // Expect EvaluationRequested (check all params except requestId since it's a hash)
        vm.expectEmit(false, true, true, true);
        emit IBastionSidecar.EvaluationRequested(
            bytes32(0), AGENT, TARGET, 1 ether, block.chainid, block.timestamp
        );
        bytes32 requestId = sidecar.requestEvaluate(AGENT, TARGET, 1 ether);

        // Expect EvaluationFulfilled (check first indexed topic = requestId)
        vm.expectEmit(true, false, false, false);
        emit IBastionSidecar.EvaluationFulfilled(requestId, true, "", 0);
        vm.prank(VERIFIER);
        sidecar.fulfillEvaluate(requestId, 0, "");
    }
}
