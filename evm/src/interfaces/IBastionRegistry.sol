// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IBastionRegistry
/// @notice Registry of authorized agents, targets, and validators.
/// Implements a minimal on-chain directory for Bastion ecosystem participants.
interface IBastionRegistry {
    struct AgentInfo {
        address agent;
        string name;
        string metadataURI;
        address owner;
        bool isActive;
        uint registeredAt;
    }

    struct TargetInfo {
        address target;
        string name;
        bool isVerified;
        address verifier;
        uint registeredAt;
    }

    /// @notice Register an AI agent in the Bastion ecosystem.
    function registerAgent(
        string calldata name,
        string calldata metadataURI
    ) external returns (bytes32 agentId);

    /// @notice Register a target contract that agents can interact with.
    function registerTarget(
        address target,
        string calldata name
    ) external returns (bytes32 targetId);

    /// @notice Verify a target contract (admin-only operation).
    function verifyTarget(
        address target
    ) external;

    /// @notice Check if an agent is registered and active.
    function isAgentActive(
        address agent
    ) external view returns (bool);

    /// @notice Check if a target is verified.
    function isTargetVerified(
        address target
    ) external view returns (bool);

    /// @notice Get agent information.
    function getAgent(
        address agent
    ) external view returns (AgentInfo memory);

    /// @notice Get target information.
    function getTarget(
        address target
    ) external view returns (TargetInfo memory);

    event AgentRegistered(
        bytes32 indexed agentId, address indexed agent, string name, address owner, uint timestamp
    );

    event TargetRegistered(
        bytes32 indexed targetId, address indexed target, string name, uint timestamp
    );

    event TargetVerified(address indexed target, address indexed verifier, uint timestamp);

    error AgentAlreadyRegistered(address agent);
    error AgentNotRegistered(address agent);
    error TargetAlreadyRegistered(address target);
    error TargetNotRegistered(address target);
    error NotAgentOwner(address agent, address caller);
    error NotAdmin(address caller);
}
