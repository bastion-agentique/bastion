// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IBastionAudit
/// @notice Immutable on-chain audit trail for agent transactions.
/// Uses EIP-712 typed structured data for signed audit entries.
interface IBastionAudit {
    /// @notice An audit entry recording an agent transaction.
    struct AuditEntry {
        bytes32 id;
        address agent;
        address target;
        bytes4 selector;
        uint value;
        uint gasUsed;
        bool allowed;
        bytes reason;
        uint timestamp;
        uint blockNumber;
        bytes signature;
    }

    /// @notice Record an audit entry for a transaction.
    function record(
        address agent,
        address target,
        bytes4 selector,
        uint value,
        uint gasUsed,
        bool allowed,
        bytes calldata reason,
        bytes calldata signature
    ) external returns (bytes32 entryId);

    /// @notice Get an audit entry by ID.
    function getEntry(
        bytes32 entryId
    ) external view returns (AuditEntry memory);

    /// @notice Get all audit entries for an agent within a time range.
    function getEntriesByAgent(
        address agent,
        uint fromTimestamp,
        uint toTimestamp
    ) external view returns (AuditEntry[] memory);

    /// @notice Get the total number of audit entries recorded.
    function getEntryCount() external view returns (uint);

    /// @notice EIP-712 type hash for audit entries.
    function AUDIT_ENTRY_TYPEHASH() external view returns (bytes32);

    event AuditRecorded(
        bytes32 indexed entryId,
        address indexed agent,
        address indexed target,
        bytes4 selector,
        bool allowed,
        uint timestamp
    );
}
