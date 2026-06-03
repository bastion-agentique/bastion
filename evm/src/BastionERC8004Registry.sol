// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
// @notice: UNDER ACTIVE DEVELOPMENT — Not production-ready. Bastion's primary deployment target is Solana.

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IERC1271 } from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @title BastionERC8004Registry
/// @notice ERC-8004 Identity Registry for Bastion AI agents.
/// Implements the full ERC-8004 Trustless Agents Identity Registry specification.
/// Every agent registered through Bastion receives an ERC-721 identity token that
/// is discoverable across the entire agent ecosystem.
///
/// ERC-8004 spec: https://eips.ethereum.org/EIPS/eip-8004
contract BastionERC8004Registry is ERC721URIStorage, EIP712, Ownable {
    using ECDSA for bytes32;

    /// @notice EIP-712 typehash for the setAgentWallet signature.
    bytes32 private constant _SET_AGENT_WALLET_TYPEHASH =
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)");

    /// @notice The metadata key reserved for the agent wallet address.
    string public constant METADATA_KEY_AGENT_WALLET = "agentWallet";

    uint256 private _nextAgentId;

    mapping(uint256 agentId => mapping(string metadataKey => bytes metadataValue))
        private _metadata;

    event Registered(
        uint256 indexed agentId, string agentURI, address indexed owner
    );

    event URIUpdated(
        uint256 indexed agentId, string newURI, address indexed updatedBy
    );

    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedMetadataKey,
        string metadataKey,
        bytes metadataValue
    );

    error InvalidAgentId();
    error InvalidDeadline();
    error InvalidSignature();
    error ReservedMetadataKey();

    constructor(
        address _owner
    )
        ERC721("Bastion Agent", "BASTION")
        EIP712("ERC8004", "1")
        Ownable(_owner)
    {}

    // ──────────────────────────────────────────────────────────────
    // ERC-8004 Registration
    // ──────────────────────────────────────────────────────────────

    /// @notice Register a new agent with a URI pointing to its ERC-8004 registration file.
    /// @param agentURI URI resolving to the agent registration file (ipfs://, https://, or data: URI).
    /// @return agentId The ERC-721 tokenId assigned to the new agent.
    function register(
        string calldata agentURI
    ) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        emit Registered(agentId, agentURI, msg.sender);
    }

    /// @notice Register a new agent without a URI (to be set later via setAgentURI).
    /// @return agentId The ERC-721 tokenId assigned to the new agent.
    function register() external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);

        emit Registered(agentId, "", msg.sender);
    }

    /// @notice Register a new agent with a URI and optional on-chain metadata.
    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadataEntries
    ) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        for (uint256 i = 0; i < metadataEntries.length; i++) {
            _setMetadata(agentId, metadataEntries[i].metadataKey, metadataEntries[i].metadataValue);
        }

        emit Registered(agentId, agentURI, msg.sender);
    }

    /// @notice Update the agent's registration file URI.
    /// Callable by the owner or an approved operator.
    function setAgentURI(
        uint256 agentId,
        string calldata newURI
    ) external {
        address owner = _requireOwned(agentId);
        _checkAuthorized(owner, msg.sender, agentId);
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    // ──────────────────────────────────────────────────────────────
    // On-Chain Metadata (ERC-8004)
    // ──────────────────────────────────────────────────────────────

    /// @notice Get an agent's on-chain metadata value.
    function getMetadata(
        uint256 agentId,
        string calldata metadataKey
    ) external view returns (bytes memory) {
        return _metadata[agentId][metadataKey];
    }

    /// @notice Set an agent's on-chain metadata value.
    /// The reserved key "agentWallet" cannot be set via this function.
    /// Callable by the owner or an approved operator.
    function setMetadata(
        uint256 agentId,
        string calldata metadataKey,
        bytes calldata metadataValue
    ) external {
        address owner = _requireOwned(agentId);
        _checkAuthorized(owner, msg.sender, agentId);
        _setMetadata(agentId, metadataKey, metadataValue);
    }

    function _setMetadata(
        uint256 agentId,
        string memory metadataKey,
        bytes memory metadataValue
    ) internal {
        if (
            keccak256(abi.encodePacked(metadataKey))
                == keccak256(abi.encodePacked(METADATA_KEY_AGENT_WALLET))
        ) {
            revert ReservedMetadataKey();
        }
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    // ──────────────────────────────────────────────────────────────
    // Agent Wallet (ERC-8004)
    // ──────────────────────────────────────────────────────────────

    /// @notice Get the agent's payment wallet address.
    function getAgentWallet(
        uint256 agentId
    ) external view returns (address) {
        bytes memory raw = _metadata[agentId][METADATA_KEY_AGENT_WALLET];
        if (raw.length == 0) return address(0);
        return abi.decode(raw, (address));
    }

    /// @notice Set the agent's payment wallet address.
    /// Requires a valid EIP-712 (EOA) or ERC-1271 (smart contract) signature
    /// from the new wallet proving control. Only the agent owner may call.
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    ) external {
        _requireOwned(agentId);
        _checkAuthorized(ownerOf(agentId), msg.sender, agentId);
        if (block.timestamp > deadline) revert InvalidDeadline();

        bytes32 structHash = keccak256(
            abi.encode(_SET_AGENT_WALLET_TYPEHASH, agentId, newWallet, deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);

        if (newWallet.code.length == 0) {
            address recovered = digest.recover(signature);
            if (recovered != newWallet) revert InvalidSignature();
        } else {
            if (
                IERC1271(newWallet).isValidSignature(digest, signature)
                    != IERC1271.isValidSignature.selector
            ) revert InvalidSignature();
        }

        _metadata[agentId][METADATA_KEY_AGENT_WALLET] = abi.encode(newWallet);
        emit MetadataSet(
            agentId, METADATA_KEY_AGENT_WALLET, METADATA_KEY_AGENT_WALLET, abi.encode(newWallet)
        );
    }

    /// @notice Clear the agent's payment wallet.
    /// Only the agent owner may call.
    function unsetAgentWallet(
        uint256 agentId
    ) external {
        _requireOwned(agentId);
        _checkAuthorized(ownerOf(agentId), msg.sender, agentId);
        delete _metadata[agentId][METADATA_KEY_AGENT_WALLET];
        emit MetadataSet(agentId, METADATA_KEY_AGENT_WALLET, METADATA_KEY_AGENT_WALLET, "");
    }

    // ──────────────────────────────────────────────────────────────
    // ERC-721 Overrides
    // ──────────────────────────────────────────────────────────────

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @notice When an agent token is transferred, clear the agent wallet.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        delete _metadata[tokenId][METADATA_KEY_AGENT_WALLET];
        return super._update(to, tokenId, auth);
    }

    // ──────────────────────────────────────────────────────────────
    // Bastion-Specific Extensions
    // ──────────────────────────────────────────────────────────────

    /// @notice Get the next agent ID that will be minted.
    function nextAgentId() external view returns (uint256) {
        return _nextAgentId;
    }

    /// @notice Check if an agent exists (has been minted).
    function isAgent(uint256 agentId) external view returns (bool) {
        return agentId < _nextAgentId;
    }

    /// @notice Check if an address owns any agents.
    function hasAgents(address owner) external view returns (bool) {
        return balanceOf(owner) > 0;
    }

    /// @notice Build the globally unique ERC-8004 agent identifier.
    /// Format: {namespace}:{chainId}:{identityRegistry}
    function globalAgentId(
        uint256 agentId
    ) external view returns (string memory) {
        return string(
            abi.encodePacked(
                "eip155:",
                _toString(block.chainid),
                ":",
                _toChecksumAddress(address(this))
            )
        );
    }

    // ──────────────────────────────────────────────────────────────
    // Internal Utilities
    // ──────────────────────────────────────────────────────────────

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _toChecksumAddress(
        address addr
    ) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory addrBytes = abi.encodePacked(addr);
        bytes32 hash = keccak256(abi.encodePacked(_toLowercaseHex(addr)));
        bytes memory result = new bytes(42);
        result[0] = "0";
        result[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            uint8 b = uint8(addrBytes[i]);
            uint8 hashByte = uint8(hash[i]);
            if (hashByte >> 4 >= 8) {
                result[2 + i * 2] = _toUpper(hexChars[b >> 4]);
            } else {
                result[2 + i * 2] = hexChars[b >> 4];
            }
            if ((hashByte & 0x0f) >= 8) {
                result[2 + i * 2 + 1] = _toUpper(hexChars[b & 0x0f]);
            } else {
                result[2 + i * 2 + 1] = hexChars[b & 0x0f];
            }
        }
        return string(result);
    }

    function _toLowercaseHex(
        address addr
    ) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(40);
        bytes20 addrBytes = bytes20(addr);
        for (uint256 i = 0; i < 20; i++) {
            result[i * 2] = hexChars[uint8(addrBytes[i]) >> 4];
            result[i * 2 + 1] = hexChars[uint8(addrBytes[i]) & 0x0f];
        }
        return string(result);
    }

    function _toUpper(bytes1 b) internal pure returns (bytes1) {
        if (uint8(b) >= 0x61 && uint8(b) <= 0x7A) {
            return bytes1(uint8(b) - 32);
        }
        return b;
    }
}

/// @dev Metadata entry struct for register() with metadata.
struct MetadataEntry {
    string metadataKey;
    bytes metadataValue;
}
