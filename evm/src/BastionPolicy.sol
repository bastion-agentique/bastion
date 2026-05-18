// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IBastionPolicy } from "./interfaces/IBastionPolicy.sol";

/// @title BastionPolicy
/// @notice Policy engine storing per-agent transaction rules.
/// Manages allowed targets, selectors, value limits, gas limits,
/// daily transaction quotas, and cooldown windows.
contract BastionPolicy is IBastionPolicy, Ownable {
    /// @notice Per-agent allowlist: agent => target => selector => allowed.
    mapping(address agent => mapping(address target => mapping(bytes4 selector => bool))) private
        _allowlist;

    /// @notice Per-agent policy configuration.
    mapping(address agent => Policy) private _policies;

    /// @notice Per-agent transaction counter for rate limiting.
    mapping(address agent => uint count) private _txCount;
    mapping(address agent => uint windowStart) private _txWindow;

    /// @notice Per-agent last transaction timestamp for cooldown.
    mapping(address agent => uint timestamp) private _lastTx;

    uint private constant _WINDOW_DURATION = 1 days;

    constructor(
        address _owner
    ) Ownable(_owner) { }

    // ──────────────────────────────────────────────────────────────
    // Policy Management
    // ──────────────────────────────────────────────────────────────

    /// @inheritdoc IBastionPolicy
    function setPolicy(
        address agent,
        Policy calldata policy
    ) external override onlyOwner {
        if (policy.agent == address(0)) revert AgentNotRegistered(address(0));

        // Clear existing allowlist
        Policy storage old = _policies[agent];
        for (uint i = 0; i < old.allowedTargets.length; i++) {
            for (uint j = 0; j < old.allowedSelectors.length; j++) {
                _allowlist[agent][old.allowedTargets[i]][old.allowedSelectors[j]] = false;
            }
        }

        _policies[agent] = policy;

        // Rebuild allowlist
        for (uint i = 0; i < policy.allowedTargets.length; i++) {
            for (uint j = 0; j < policy.allowedSelectors.length; j++) {
                _allowlist[agent][policy.allowedTargets[i]][policy.allowedSelectors[j]] = true;
            }
        }

        // Reset rate limit window
        _txCount[agent] = 0;
        _txWindow[agent] = block.timestamp;
    }

    /// @inheritdoc IBastionPolicy
    function removePolicy(
        address agent
    ) external override onlyOwner {
        Policy storage p = _policies[agent];
        for (uint i = 0; i < p.allowedTargets.length; i++) {
            for (uint j = 0; j < p.allowedSelectors.length; j++) {
                _allowlist[agent][p.allowedTargets[i]][p.allowedSelectors[j]] = false;
            }
        }
        delete _policies[agent];
        delete _txCount[agent];
        delete _txWindow[agent];
        delete _lastTx[agent];
    }

    // ──────────────────────────────────────────────────────────────
    // Transaction Validation
    // ──────────────────────────────────────────────────────────────

    /// @inheritdoc IBastionPolicy
    function checkTransaction(
        address agent,
        address target,
        uint value,
        bytes calldata callData
    ) external view override returns (bool allowed, bytes memory reason) {
        Policy storage policy = _policies[agent];

        if (policy.agent == address(0)) {
            return (false, abi.encodePacked("PolicyNotSet"));
        }
        if (!policy.isActive) {
            return (false, abi.encodePacked("PolicyInactive"));
        }

        // Decode selector
        bytes4 selector;
        if (callData.length >= 4) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                selector := calldataload(callData.offset)
            }
        }

        // Check target + selector allowlist
        if (!_allowlist[agent][target][selector]) {
            return (false, abi.encodePacked("TargetNotAllowed"));
        }

        // Check value limit
        if (value > policy.maxValuePerTx) {
            return (false, abi.encodePacked("ValueExceedsLimit"));
        }

        // Check rate limit (daily)
        if (_txCount[agent] >= policy.dailyTxLimit) {
            return (false, abi.encodePacked("DailyTxLimitExceeded"));
        }

        // Check cooldown
        if (block.timestamp < _lastTx[agent] + policy.cooldownSeconds) {
            return (false, abi.encodePacked("CooldownNotElapsed"));
        }

        return (true, "");
    }

    // ──────────────────────────────────────────────────────────────
    // View Functions
    // ──────────────────────────────────────────────────────────────

    /// @inheritdoc IBastionPolicy
    function getPolicy(
        address agent
    ) external view override returns (Policy memory) {
        if (_policies[agent].agent == address(0)) revert AgentNotRegistered(agent);
        return _policies[agent];
    }

    /// @inheritdoc IBastionPolicy
    function getTxCount(
        address agent
    ) external view override returns (uint) {
        if (block.timestamp >= _txWindow[agent] + _WINDOW_DURATION) {
            return 0;
        }
        return _txCount[agent];
    }

    /// @notice Check if a specific selector for a target is in the agent's allowlist.
    function isSelectorAllowed(
        address agent,
        address target,
        bytes4 selector
    ) external view returns (bool) {
        return _allowlist[agent][target][selector];
    }
}
