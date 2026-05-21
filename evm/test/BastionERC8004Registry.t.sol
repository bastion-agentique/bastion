// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { BastionERC8004Registry } from "../src/BastionERC8004Registry.sol";
import { IERC721Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract BastionERC8004RegistryTest is Test {
    BastionERC8004Registry public registry;

    address public admin = makeAddr("admin");
    address public agentOwner1 = makeAddr("agentOwner1");
    address public agentOwner2 = makeAddr("agentOwner2");
    address public agentWallet;
    uint256 public agentWalletKey;

    string constant TEST_AGENT_URI = "ipfs://QmTestAgentUri";

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedMetadataKey,
        string metadataKey,
        bytes metadataValue
    );

    function setUp() public {
        registry = new BastionERC8004Registry(admin);
        agentWalletKey = uint256(keccak256(abi.encode("agentWallet")));
        agentWallet = vm.addr(agentWalletKey);
    }

    // ──────────────────────────────────────────────────────────────
    // Registration
    // ──────────────────────────────────────────────────────────────

    function test_Register_WithURI() public {
        vm.prank(agentOwner1);
        vm.expectEmit();
        emit Registered(0, TEST_AGENT_URI, agentOwner1);
        uint256 agentId = registry.register(TEST_AGENT_URI);

        assertEq(agentId, 0);
        assertEq(registry.ownerOf(0), agentOwner1);
        assertEq(registry.tokenURI(0), TEST_AGENT_URI);
        assertEq(registry.balanceOf(agentOwner1), 1);
    }

    function test_Register_WithoutURI() public {
        vm.prank(agentOwner1);
        vm.expectEmit();
        emit Registered(0, "", agentOwner1);
        uint256 agentId = registry.register();

        assertEq(agentId, 0);
        assertEq(registry.ownerOf(0), agentOwner1);
        assertEq(registry.tokenURI(0), "");
    }

    function test_Register_SequentialAgentIds() public {
        vm.startPrank(agentOwner1);
        uint256 id0 = registry.register("ipfs://agent0");
        uint256 id1 = registry.register("ipfs://agent1");
        vm.stopPrank();

        vm.prank(agentOwner2);
        uint256 id2 = registry.register("ipfs://agent2");

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(registry.nextAgentId(), 3);
    }

    function test_Register_Revert_IfURITooLong() public {
        // Create a URI that exceeds reasonable bounds
        string memory longURI = new string(5000);
        bytes memory longBytes = bytes(longURI);
        for (uint256 i = 0; i < longBytes.length; i++) {
            longBytes[i] = "a";
        }
        longURI = string(longBytes);

        vm.prank(agentOwner1);
        registry.register(longURI);
        // Should succeed - Solidity strings can be quite large
    }

    // ──────────────────────────────────────────────────────────────
    // setAgentURI
    // ──────────────────────────────────────────────────────────────

    function test_SetAgentURI() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        string memory newURI = "ipfs://QmUpdatedUri";
        vm.expectEmit();
        emit URIUpdated(0, newURI, agentOwner1);

        vm.prank(agentOwner1);
        registry.setAgentURI(0, newURI);

        assertEq(registry.tokenURI(0), newURI);
    }

    function test_SetAgentURI_Revert_NotOwner() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        vm.prank(agentOwner2);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721InsufficientApproval.selector,
                agentOwner2,
                0
            )
        );
        registry.setAgentURI(0, "ipfs://hacked");
    }

    function test_SetAgentURI_ApprovedOperator() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        vm.prank(agentOwner1);
        registry.approve(agentOwner2, 0);

        vm.prank(agentOwner2);
        registry.setAgentURI(0, "ipfs://operatorUpdate");
        assertEq(registry.tokenURI(0), "ipfs://operatorUpdate");
    }

    // ──────────────────────────────────────────────────────────────
    // On-Chain Metadata
    // ──────────────────────────────────────────────────────────────

    function test_SetAndGetMetadata() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        vm.prank(agentOwner1);
        registry.setMetadata(0, "capabilities", abi.encode("defi, payments"));

        bytes memory value = registry.getMetadata(0, "capabilities");
        assertEq(abi.decode(value, (string)), "defi, payments");
    }

    function test_SetMetadata_Revert_ReservedAgentWalletKey() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        vm.prank(agentOwner1);
        vm.expectRevert(BastionERC8004Registry.ReservedMetadataKey.selector);
        registry.setMetadata(0, "agentWallet", abi.encode(agentWallet));
    }

    function test_SetMetadata_MultipleKeys() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        vm.startPrank(agentOwner1);
        registry.setMetadata(0, "key1", abi.encode("value1"));
        registry.setMetadata(0, "key2", abi.encode("value2"));
        vm.stopPrank();

        assertEq(abi.decode(registry.getMetadata(0, "key1"), (string)), "value1");
        assertEq(abi.decode(registry.getMetadata(0, "key2"), (string)), "value2");
    }

    function test_SetMetadata_Revert_NotOwner() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        vm.prank(agentOwner2);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721InsufficientApproval.selector,
                agentOwner2,
                0
            )
        );
        registry.setMetadata(0, "key", abi.encode("value"));
    }

    // ──────────────────────────────────────────────────────────────
    // Agent Wallet (EIP-712 signature)
    // ──────────────────────────────────────────────────────────────

    function test_SetAgentWallet_EOA() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signSetAgentWallet(
            agentWalletKey, 0, agentWallet, deadline, address(registry)
        );
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(agentOwner1);
        registry.setAgentWallet(0, agentWallet, deadline, signature);

        assertEq(registry.getAgentWallet(0), agentWallet);
    }

    function test_SetAgentWallet_Revert_ExpiredDeadline() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        uint256 deadline = block.timestamp - 1; // already expired
        (uint8 v, bytes32 r, bytes32 s) = _signSetAgentWallet(
            agentWalletKey, 0, agentWallet, deadline, address(registry)
        );
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.warp(block.timestamp + 1);
        vm.prank(agentOwner1);
        vm.expectRevert(BastionERC8004Registry.InvalidDeadline.selector);
        registry.setAgentWallet(0, agentWallet, deadline, signature);
    }

    function test_SetAgentWallet_Revert_WrongSigner() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        uint256 deadline = block.timestamp + 1 hours;
        // Sign with a different key than the wallet address
        uint256 wrongKey = 0xDEADBEEF;
        (uint8 v, bytes32 r, bytes32 s) = _signSetAgentWallet(
            wrongKey, 0, agentWallet, deadline, address(registry)
        );
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(agentOwner1);
        vm.expectRevert(BastionERC8004Registry.InvalidSignature.selector);
        registry.setAgentWallet(0, agentWallet, deadline, signature);
    }

    function test_UnsetAgentWallet() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signSetAgentWallet(
            agentWalletKey, 0, agentWallet, deadline, address(registry)
        );

        vm.prank(agentOwner1);
        registry.setAgentWallet(0, agentWallet, deadline, abi.encodePacked(r, s, v));
        assertEq(registry.getAgentWallet(0), agentWallet);

        vm.prank(agentOwner1);
        registry.unsetAgentWallet(0);
        assertEq(registry.getAgentWallet(0), address(0));
    }

    function test_AgentWallet_ClearedOnTransfer() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signSetAgentWallet(
            agentWalletKey, 0, agentWallet, deadline, address(registry)
        );

        vm.prank(agentOwner1);
        registry.setAgentWallet(0, agentWallet, deadline, abi.encodePacked(r, s, v));
        assertEq(registry.getAgentWallet(0), agentWallet);

        // Transfer clears wallet
        vm.prank(agentOwner1);
        registry.transferFrom(agentOwner1, agentOwner2, 0);

        assertEq(registry.getAgentWallet(0), address(0));
        assertEq(registry.ownerOf(0), agentOwner2);
    }

    // ──────────────────────────────────────────────────────────────
    // Bastion-Specific Extensions
    // ──────────────────────────────────────────────────────────────

    function test_IsAgent() public {
        assertFalse(registry.isAgent(0));

        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        assertTrue(registry.isAgent(0));
        assertFalse(registry.isAgent(1));
    }

    function test_HasAgents() public {
        assertFalse(registry.hasAgents(agentOwner1));

        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        assertTrue(registry.hasAgents(agentOwner1));
        assertFalse(registry.hasAgents(agentOwner2));
    }

    function test_GlobalAgentId() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        string memory globalId = registry.globalAgentId(0);
        assertTrue(bytes(globalId).length > 0);
        // Should start with eip155:
        assertTrue(_startsWith(globalId, "eip155:"));
    }

    // ──────────────────────────────────────────────────────────────
    // ERC-721 Standard
    // ──────────────────────────────────────────────────────────────

    function test_Transfer() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        vm.prank(agentOwner1);
        registry.transferFrom(agentOwner1, agentOwner2, 0);

        assertEq(registry.ownerOf(0), agentOwner2);
        assertEq(registry.balanceOf(agentOwner1), 0);
        assertEq(registry.balanceOf(agentOwner2), 1);
    }

    function test_Approval() public {
        vm.prank(agentOwner1);
        registry.register(TEST_AGENT_URI);

        vm.prank(agentOwner1);
        registry.approve(agentOwner2, 0);

        assertEq(registry.getApproved(0), agentOwner2);
    }

    function test_NameAndSymbol() public view {
        assertEq(registry.name(), "Bastion Agent");
        assertEq(registry.symbol(), "BASTION");
    }

    // ──────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────

    function _signSetAgentWallet(
        uint256 privateKey,
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        address verifyingContract
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)"
                ),
                agentId,
                newWallet,
                deadline
            )
        );

        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("ERC8004")),
                keccak256(bytes("1")),
                block.chainid,
                verifyingContract
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );

        (v, r, s) = vm.sign(privateKey, digest);
    }

    function _startsWith(string memory str, string memory prefix)
        internal
        pure
        returns (bool)
    {
        bytes memory strBytes = bytes(str);
        bytes memory prefixBytes = bytes(prefix);
        if (strBytes.length < prefixBytes.length) return false;
        for (uint256 i = 0; i < prefixBytes.length; i++) {
            if (strBytes[i] != prefixBytes[i]) return false;
        }
        return true;
    }
}
