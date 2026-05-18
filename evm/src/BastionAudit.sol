// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { IBastionAudit } from "./interfaces/IBastionAudit.sol";

/// @title BastionAudit
/// @notice Immutable on-chain audit trail for all agent transactions.
/// Every transaction that passes through the firewall is recorded here.
/// Uses EIP-712 typed structured data for verifiable audit entries.
/// Entries are append-only and never deleted.
contract BastionAudit is IBastionAudit, EIP712 {
    bytes32 public constant AUDIT_ENTRY_TYPEHASH = keccak256(
        "AuditEntry(bytes32 id,address agent,address target,bytes4 selector,uint256 value,uint256 gasUsed,bool allowed,bytes reason,uint256 timestamp,uint256 blockNumber)"
    );

    uint private _entryCount;
    mapping(bytes32 entryId => AuditEntry) private _entries;
    mapping(address agent => bytes32[] entryIds) private _agentEntries;
    mapping(bytes32 entryId => uint index) private _agentEntryIndex;

    bytes32 private immutable _DOMAIN_SEPARATOR;

    constructor() EIP712("BastionAudit", "1.0.0") {
        _DOMAIN_SEPARATOR = _domainSeparatorV4();
    }

    // ──────────────────────────────────────────────────────────────
    // Write (callable by Firewall only)
    // ──────────────────────────────────────────────────────────────

    /// @inheritdoc IBastionAudit
    function record(
        address agent,
        address target,
        bytes4 selector,
        uint value,
        uint gasUsed,
        bool allowed,
        bytes calldata reason,
        bytes calldata signature
    ) external override returns (bytes32 entryId) {
        uint _count = _entryCount;
        bytes32 _id = keccak256(
            abi.encodePacked(
                agent, target, selector, value, gasUsed, allowed, reason, block.timestamp, _count
            )
        );

        AuditEntry memory entry = AuditEntry({
            id: _id,
            agent: agent,
            target: target,
            selector: selector,
            value: value,
            gasUsed: gasUsed,
            allowed: allowed,
            reason: reason,
            timestamp: block.timestamp,
            blockNumber: block.number,
            signature: signature
        });

        _entries[_id] = entry;
        _agentEntries[agent].push(_id);
        _agentEntryIndex[_id] = _agentEntries[agent].length;
        _entryCount = _count + 1;

        emit AuditRecorded(_id, agent, target, selector, allowed, block.timestamp);

        return _id;
    }

    // ──────────────────────────────────────────────────────────────
    // Read
    // ──────────────────────────────────────────────────────────────

    /// @inheritdoc IBastionAudit
    function getEntry(
        bytes32 entryId
    ) external view override returns (AuditEntry memory) {
        return _entries[entryId];
    }

    /// @inheritdoc IBastionAudit
    function getEntriesByAgent(
        address agent,
        uint fromTimestamp,
        uint toTimestamp
    ) external view override returns (AuditEntry[] memory) {
        bytes32[] storage ids = _agentEntries[agent];
        uint count;
        for (uint i = 0; i < ids.length; i++) {
            AuditEntry storage e = _entries[ids[i]];
            if (e.timestamp >= fromTimestamp && e.timestamp <= toTimestamp) {
                count++;
            }
        }

        AuditEntry[] memory results = new AuditEntry[](count);
        uint idx;
        for (uint i = 0; i < ids.length; i++) {
            AuditEntry storage e = _entries[ids[i]];
            if (e.timestamp >= fromTimestamp && e.timestamp <= toTimestamp) {
                results[idx] = e;
                idx++;
            }
        }

        return results;
    }

    /// @inheritdoc IBastionAudit
    function getEntryCount() external view override returns (uint) {
        return _entryCount;
    }

    /// @notice Get the total number of entries for a specific agent.
    function getAgentEntryCount(
        address agent
    ) external view returns (uint) {
        return _agentEntries[agent].length;
    }

    /// @notice Get the domain separator for EIP-712 verification.
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }
}
