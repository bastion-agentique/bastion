// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IBastionSidecar
/// @notice Interface for the off-chain Bastion policy evaluation sidecar oracle.
/// The sidecar runs the Rust PolicyEvaluator and returns a FirewallDecision.
interface IBastionSidecar {
    /// @notice Emitted when a policy evaluation is requested from the sidecar.
    /// @param requestId Unique ID for this evaluation request.
    /// @param agent The agent address submitting the transaction.
    /// @param target The destination address.
    /// @param value The transaction value in wei.
    /// @param chainId The chain ID where the evaluation was requested.
    event EvaluationRequested(
        bytes32 indexed requestId,
        address indexed agent,
        address target,
        uint256 value,
        uint256 chainId,
        uint256 timestamp
    );

    /// @notice Emitted when the sidecar fulfills an evaluation request.
    /// @param requestId The request ID that was fulfilled.
    /// @param allowed Whether the transaction passed policy evaluation.
    /// @param reason Human-readable reason if blocked or pending HITL.
    /// @param decision 0=Pass, 1=Block, 2=PendingHITL
    event EvaluationFulfilled(
        bytes32 indexed requestId,
        bool allowed,
        string reason,
        uint8 decision
    );
}
