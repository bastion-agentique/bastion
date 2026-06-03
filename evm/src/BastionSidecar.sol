// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
// @notice: UNDER ACTIVE DEVELOPMENT — Not production-ready. Bastion's primary deployment target is Solana.

import { IBastionSidecar } from "./interfaces/IBastionSidecar.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title BastionSidecar
/// @notice On-chain oracle for the off-chain Bastion policy evaluator sidecar.
///
/// The sidecar runs a Rust HTTP server that exposes a POST /api/v2/evaluate endpoint.
/// This contract provides the on-chain half of the request/fulfill pattern:
///
/// 1. Agent wallet calls `requestEvaluate()` before submitting a UserOperation
/// 2. An off-chain relayer listens for `EvaluationRequested` events
/// 3. Relayer calls the sidecar HTTP API with the transaction data
/// 4. Relayer calls `fulfillEvaluate()` with the sidecar's response
/// 5. The firewall reads the stored result to decide pass/block/HITL
///
/// For production: the relayer can be a Chainlink Functions job, Gelato task,
/// or a lightweight Rust process that reads events and calls the sidecar.
contract BastionSidecar is IBastionSidecar, Ownable {
    /// @notice Verifier address authorized to fulfill evaluation requests.
    address public verifier;

    /// @notice Mapping from request ID to evaluation result.
    mapping(bytes32 => bool) public evaluations;
    mapping(bytes32 => string) public evaluationReasons;
    mapping(bytes32 => uint8) public evaluationDecisions;

    /// @notice Prevents re-requesting the same transaction.
    mapping(bytes32 => bool) private _requested;

    constructor(address _owner) Ownable(_owner) {
        verifier = _owner;
    }

    /// @notice Set the verifier address (only owner).
    function setVerifier(address _verifier) external onlyOwner {
        verifier = _verifier;
    }

    /// @notice Request a policy evaluation from the sidecar.
    /// @param agent The agent address.
    /// @param target The transaction target address.
    /// @param value The transaction value in wei.
    function requestEvaluate(
        address agent,
        address target,
        uint256 value
    ) external returns (bytes32 requestId) {
        requestId = keccak256(
            abi.encodePacked(agent, target, value, block.timestamp, block.chainid)
        );
        require(!_requested[requestId], "already requested");
        _requested[requestId] = true;

        emit EvaluationRequested(
            requestId,
            agent,
            target,
            value,
            block.chainid,
            block.timestamp
        );
    }

    /// @notice Fulfill an evaluation request with the sidecar's result.
    /// @param requestId The request ID to fulfill.
    /// @param decision 0=Pass, 1=Block, 2=PendingHITL
    /// @param reason Human-readable reason (empty for pass).
    function fulfillEvaluate(
        bytes32 requestId,
        uint8 decision,
        string calldata reason
    ) external {
        require(msg.sender == verifier, "only verifier");
        require(_requested[requestId], "not requested");

        bool allowed = decision == 0;
        evaluations[requestId] = allowed;
        evaluationReasons[requestId] = reason;
        evaluationDecisions[requestId] = decision;

        emit EvaluationFulfilled(requestId, allowed, reason, decision);
    }

    /// @notice Check the evaluation result for a request ID.
    function getEvaluation(
        bytes32 requestId
    ) external view returns (bool allowed, string memory reason, uint8 decision) {
        require(_requested[requestId], "not requested");
        return (
            evaluations[requestId],
            evaluationReasons[requestId],
            evaluationDecisions[requestId]
        );
    }
}
