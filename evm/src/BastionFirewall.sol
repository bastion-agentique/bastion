// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IBastionFirewall, PackedUserOperation } from "./interfaces/IBastionFirewall.sol";
import { IBastionPolicy } from "./interfaces/IBastionPolicy.sol";
import { IBastionAudit } from "./interfaces/IBastionAudit.sol";

/// @title BastionFirewall
/// @notice ERC-7579 compatible validator that enforces agent transaction policies.
/// Every agent transaction passes through this firewall before execution.
/// Blocks unauthorized targets, selectors, value limits, gas limits,
/// rate limits, and cooldown violations.
contract BastionFirewall is IBastionFirewall, Ownable, Pausable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant _VALIDATOR_TYPEHASH =
        keccak256("BastionValidator(address account,uint256 chainId)");

    bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
    bytes4 internal constant VALIDATOR_VALID = 0x7b3b2015;

    IBastionPolicy public immutable policyEngine;
    IBastionAudit public immutable auditLog;

    mapping(address account => bytes32 validatorHash) private _installedAccounts;

    /// @param _policyEngine The BastionPolicy contract address.
    /// @param _auditLog The BastionAudit contract address.
    /// @param _owner The owner of the firewall contract.
    constructor(
        IBastionPolicy _policyEngine,
        IBastionAudit _auditLog,
        address _owner
    ) Ownable(_owner) EIP712("BastionFirewall", "1.0.0") {
        require(address(_policyEngine) != address(0), "zero policy engine");
        require(address(_auditLog) != address(0), "zero audit log");
        policyEngine = _policyEngine;
        auditLog = _auditLog;
    }

    // ──────────────────────────────────────────────────────────────
    // ERC-7579 IValidator Interface
    // ──────────────────────────────────────────────────────────────

    /// @inheritdoc IBastionFirewall
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 /* userOpHash */
    ) external override whenNotPaused returns (uint validationData) {
        address agent = userOp.sender;

        if (_installedAccounts[agent] == bytes32(0)) {
            revert NotAuthorized(agent, address(0), bytes4(0));
        }

        (address target, uint value, bytes4 selector,) = _decodeCallData(userOp.callData);

        // Run firewall checks
        (bool allowed, bytes memory reason) =
            policyEngine.checkTransaction(agent, target, value, userOp.callData);

        uint gasBefore = gasleft();

        if (!allowed) {
            auditLog.record(
                agent,
                target,
                selector,
                value,
                gasBefore - gasleft(),
                false,
                reason,
                userOp.signature
            );
            emit TransactionBlocked(agent, target, selector, value, block.timestamp, reason);
            revert NotAuthorized(agent, target, selector);
        }

        auditLog.record(
            agent, target, selector, value, gasBefore - gasleft(), true, "", userOp.signature
        );

        emit TransactionAllowed(agent, target, selector, value, block.timestamp);

        // SIG_VALIDATION_SUCCESS per ERC-4337: 0 on success
        return 0;
    }

    /// @inheritdoc IBastionFirewall
    function isValidForAccount(
        address account
    ) external view override returns (bytes4) {
        return _installedAccounts[account] != bytes32(0) ? VALIDATOR_VALID : bytes4(0);
    }

    /// @inheritdoc IBastionFirewall
    function onInstall(
        bytes calldata /* data */
    ) external override {
        address account = msg.sender;
        bytes32 hash = keccak256(abi.encode(_VALIDATOR_TYPEHASH, account, block.chainid));
        _installedAccounts[account] = hash;
        emit PolicyUpdated(account, address(0), bytes4(0), true, block.timestamp);
    }

    /// @inheritdoc IBastionFirewall
    function onUninstall(
        bytes calldata
    ) external override {
        address account = msg.sender;
        delete _installedAccounts[account];
    }

    // ──────────────────────────────────────────────────────────────
    // Admin Functions
    // ──────────────────────────────────────────────────────────────

    /// @notice Pause the firewall. No transactions pass while paused.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the firewall.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Check if an account has the Bastion validator installed.
    function isInstalled(
        address account
    ) external view returns (bool) {
        return _installedAccounts[account] != bytes32(0);
    }

    // ──────────────────────────────────────────────────────────────
    // Internal Helpers
    // ──────────────────────────────────────────────────────────────

    function _decodeCallData(
        bytes calldata callData
    ) internal pure returns (address target, uint value, bytes4 selector, bytes memory params) {
        require(callData.length >= 4, "callData too short");
        // solhint-disable-next-line no-inline-assembly
        assembly {
            target := shr(96, calldataload(callData.offset))
            value := calldataload(add(callData.offset, 32))
            selector := calldataload(add(callData.offset, 68))
        }
        uint paramsLen = callData.length - 68;
        params = callData[68:68 + paramsLen];
    }
}
