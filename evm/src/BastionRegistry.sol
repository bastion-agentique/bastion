// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IBastionRegistry } from "./interfaces/IBastionRegistry.sol";

/// @title BastionRegistry
/// @notice On-chain directory of AI agents, target contracts, and validators.
/// Lightweight registry that supports the Bastion ecosystem discoverability.
contract BastionRegistry is IBastionRegistry, Ownable {
    mapping(address agent => AgentInfo) private _agents;
    mapping(address target => TargetInfo) private _targets;
    mapping(address owner => address[] agents) private _ownerAgents;

    address public admin;

    modifier onlyAdmin() {
        if (msg.sender != admin && msg.sender != owner()) revert NotAdmin(msg.sender);
        _;
    }

    constructor(
        address _owner
    ) Ownable(_owner) {
        admin = _owner;
    }

    /// @notice Set the admin address.
    function setAdmin(
        address _admin
    ) external onlyOwner {
        admin = _admin;
    }

    // ──────────────────────────────────────────────────────────────
    // Agent Registration
    // ──────────────────────────────────────────────────────────────

    /// @inheritdoc IBastionRegistry
    function registerAgent(
        string calldata name,
        string calldata metadataURI
    ) external override returns (bytes32 agentId) {
        address agent = msg.sender;
        if (_agents[agent].agent != address(0)) revert AgentAlreadyRegistered(agent);

        agentId = keccak256(abi.encodePacked(agent, name, block.timestamp));
        _agents[agent] = AgentInfo({
            agent: agent,
            name: name,
            metadataURI: metadataURI,
            owner: msg.sender,
            isActive: true,
            registeredAt: block.timestamp
        });
        _ownerAgents[msg.sender].push(agent);

        emit AgentRegistered(agentId, agent, name, msg.sender, block.timestamp);
    }

    /// @notice Deactivate an agent (owner only).
    function deactivateAgent(
        address agent
    ) external {
        if (_agents[agent].owner != msg.sender) revert NotAgentOwner(agent, msg.sender);
        _agents[agent].isActive = false;
    }

    /// @notice Reactivate an agent (owner only).
    function reactivateAgent(
        address agent
    ) external {
        if (_agents[agent].owner != msg.sender) revert NotAgentOwner(agent, msg.sender);
        _agents[agent].isActive = true;
    }

    // ──────────────────────────────────────────────────────────────
    // Target Registration
    // ──────────────────────────────────────────────────────────────

    /// @inheritdoc IBastionRegistry
    function registerTarget(
        address target,
        string calldata name
    ) external override returns (bytes32 targetId) {
        if (_targets[target].target != address(0)) revert TargetAlreadyRegistered(target);

        targetId = keccak256(abi.encodePacked(target, name, block.timestamp));
        _targets[target] = TargetInfo({
            target: target,
            name: name,
            isVerified: false,
            verifier: address(0),
            registeredAt: block.timestamp
        });

        emit TargetRegistered(targetId, target, name, block.timestamp);
    }

    /// @inheritdoc IBastionRegistry
    function verifyTarget(
        address target
    ) external override onlyAdmin {
        if (_targets[target].target == address(0)) revert TargetNotRegistered(target);
        _targets[target].isVerified = true;
        _targets[target].verifier = msg.sender;

        emit TargetVerified(target, msg.sender, block.timestamp);
    }

    // ──────────────────────────────────────────────────────────────
    // View Functions
    // ──────────────────────────────────────────────────────────────

    /// @inheritdoc IBastionRegistry
    function isAgentActive(
        address agent
    ) external view override returns (bool) {
        return _agents[agent].isActive;
    }

    /// @inheritdoc IBastionRegistry
    function isTargetVerified(
        address target
    ) external view override returns (bool) {
        return _targets[target].isVerified;
    }

    /// @inheritdoc IBastionRegistry
    function getAgent(
        address agent
    ) external view override returns (AgentInfo memory) {
        if (_agents[agent].agent == address(0)) revert AgentNotRegistered(agent);
        return _agents[agent];
    }

    /// @inheritdoc IBastionRegistry
    function getTarget(
        address target
    ) external view override returns (TargetInfo memory) {
        if (_targets[target].target == address(0)) revert TargetNotRegistered(target);
        return _targets[target];
    }

    /// @notice Get all agents owned by an address.
    function getAgentsByOwner(
        address owner
    ) external view returns (AgentInfo[] memory) {
        address[] storage agentList = _ownerAgents[owner];
        AgentInfo[] memory results = new AgentInfo[](agentList.length);
        for (uint i = 0; i < agentList.length; i++) {
            results[i] = _agents[agentList[i]];
        }
        return results;
    }
}
