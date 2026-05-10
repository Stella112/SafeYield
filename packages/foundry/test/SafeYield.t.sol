// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {
    aclAdd,
    inputVerifierAdd
} from "@fhevm/host-contracts/addresses/FHEVMHostAddresses.sol";
import {FheType} from "@fhevm/host-contracts/contracts/shared/FheType.sol";
import {
    ebool,
    euint16,
    euint64,
    externalEuint16,
    externalEuint64
} from "encrypted-types/EncryptedTypes.sol";
import {CleartextArithmetic} from "forge-fhevm/cleartext/CleartextArithmetic.sol";
import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {InputProofHelper} from "forge-fhevm/InputProofHelper.sol";
import {SafeYield} from "../src/SafeYield.sol";

contract SafeYieldTest is FhevmTest {
    SafeYield safeYield;
    address owner = address(0xA11CE);
    address agent = address(0xA9E17);
    uint256 private inputNonce;

    function setUp() public override {
        super.setUp();
        safeYield = new SafeYield();
    }

    function test_initialCircleId() public view {
        assertEq(safeYield.nextCircleId(), 1);
    }

    function test_initialPassportId() public view {
        assertEq(safeYield.nextPassportId(), 1);
    }

    function test_agentThresholds() public view {
        assertEq(safeYield.MIN_AGENT_SCORE(), 700);
        assertEq(safeYield.MIN_X402_AGENT_FEE(), 100);
    }

    function test_fullPrivateYieldLockFlow() public {
        (externalEuint64 contribution, externalEuint64 rwaNav, externalEuint64 agentFeeCap, bytes memory circleProof) =
            _encryptCircleInputs(120_000, 860_000, 250, owner);

        vm.prank(owner);
        uint256 circleId = safeYield.createCircle(
            keccak256("Lagos rental-income pool"), contribution, rwaNav, agentFeeCap, circleProof
        );

        assertEq(circleId, 1);
        assertEq(safeYield.nextCircleId(), 2);

        (address publicOwner,, SafeYield.CircleStatus status) = safeYield.getPublicCircle(circleId);
        assertEq(publicOwner, owner);
        assertEq(uint8(status), uint8(SafeYield.CircleStatus.Active));

        (
            externalEuint64 yieldReceived,
            externalEuint64 commitmentAmount,
            externalEuint64 emergencyTarget,
            externalEuint16 reliabilityScore,
            bytes memory waterfallProof
        ) = _encryptWaterfallInputs(42_000, 18_000, 9_000, 830, owner);

        vm.prank(owner);
        safeYield.computeYieldWaterfall(
            circleId,
            SafeYield.CommitmentKind.FamilySupport,
            yieldReceived,
            commitmentAmount,
            emergencyTarget,
            reliabilityScore,
            waterfallProof
        );

        (
            euint64 privateContribution,
            euint64 privateRwaNav,
            euint64 privateYieldReceived,
            euint64 reserveBuffer,
            euint64 safeWithdrawal,
            euint64 userYieldShare,
            euint64 privateCommitmentAmount,
            euint16 circleScore,
            ebool commitmentActive,
            ebool yieldShareEligible
        ) = _privateCircle(circleId);

        assertEq(decrypt(privateContribution), 120_000);
        assertEq(decrypt(privateRwaNav), 860_000);
        assertEq(decrypt(privateYieldReceived), 42_000);
        assertEq(decrypt(reserveBuffer), 10_500);
        assertEq(decrypt(safeWithdrawal), 23_100);
        assertEq(decrypt(userYieldShare), 8_400);
        assertEq(decrypt(privateCommitmentAmount), 18_000);
        assertEq(decrypt(circleScore), 810);
        assertTrue(decrypt(commitmentActive));
        assertTrue(decrypt(yieldShareEligible));

        (
            externalEuint64 x402FeePaid,
            externalEuint64 requestedFee,
            externalEuint16 agentScore,
            bytes memory passportProof
        ) = _encryptPassportInputs(120, 180, 790, agent);

        vm.prank(agent);
        uint256 passportId =
            safeYield.submitAgentPassport(circleId, 1, x402FeePaid, requestedFee, agentScore, passportProof);

        assertEq(passportId, 1);
        assertEq(safeYield.nextPassportId(), 2);

        (
            euint64 privateX402FeePaid,
            euint64 privateRequestedFee,
            euint16 privateAgentScore,
            ebool feeSettled,
            ebool helperAllowed
        ) = _privatePassport(passportId);

        assertEq(decrypt(privateX402FeePaid), 120);
        assertEq(decrypt(privateRequestedFee), 180);
        assertEq(decrypt(privateAgentScore), 790);
        assertTrue(decrypt(feeSettled));
        assertTrue(decrypt(helperAllowed));

        vm.prank(agent);
        safeYield.executeYieldLock(circleId, passportId);

        (,, SafeYield.CircleStatus lockedStatus) = safeYield.getPublicCircle(circleId);
        assertEq(uint8(lockedStatus), uint8(SafeYield.CircleStatus.Locked));

        (,,,, euint64 lockedSafeWithdrawal,,,, ebool lockedCommitmentActive,) = _privateCircle(circleId);
        assertEq(decrypt(lockedSafeWithdrawal), 23_100);
        assertTrue(decrypt(lockedCommitmentActive));
    }

    function _privateCircle(uint256 circleId)
        private
        returns (
            euint64 contribution,
            euint64 rwaNav,
            euint64 yieldReceived,
            euint64 reserveBuffer,
            euint64 safeWithdrawal,
            euint64 userYieldShare,
            euint64 commitmentAmount,
            euint16 circleScore,
            ebool commitmentActive,
            ebool yieldShareEligible
        )
    {
        vm.prank(owner);
        return safeYield.getPrivateCircle(circleId);
    }

    function _privatePassport(uint256 passportId)
        private
        returns (euint64 x402FeePaid, euint64 requestedFee, euint16 agentScore, ebool feeSettled, ebool allowed)
    {
        vm.prank(agent);
        return safeYield.getPrivatePassport(passportId);
    }

    function _encryptCircleInputs(uint64 contribution, uint64 rwaNav, uint64 agentFeeCap, address user)
        private
        returns (externalEuint64, externalEuint64, externalEuint64, bytes memory)
    {
        bytes32[] memory handles = new bytes32[](3);
        handles[0] = _mockHandle(contribution, FheType.Uint64, 0);
        handles[1] = _mockHandle(rwaNav, FheType.Uint64, 1);
        handles[2] = _mockHandle(agentFeeCap, FheType.Uint64, 2);

        return (
            externalEuint64.wrap(handles[0]),
            externalEuint64.wrap(handles[1]),
            externalEuint64.wrap(handles[2]),
            _inputProof(handles, user)
        );
    }

    function _encryptWaterfallInputs(
        uint64 yieldReceived,
        uint64 commitmentAmount,
        uint64 emergencyTarget,
        uint16 reliabilityScore,
        address user
    ) private returns (externalEuint64, externalEuint64, externalEuint64, externalEuint16, bytes memory) {
        bytes32[] memory handles = new bytes32[](4);
        handles[0] = _mockHandle(yieldReceived, FheType.Uint64, 0);
        handles[1] = _mockHandle(commitmentAmount, FheType.Uint64, 1);
        handles[2] = _mockHandle(emergencyTarget, FheType.Uint64, 2);
        handles[3] = _mockHandle(reliabilityScore, FheType.Uint16, 3);

        return (
            externalEuint64.wrap(handles[0]),
            externalEuint64.wrap(handles[1]),
            externalEuint64.wrap(handles[2]),
            externalEuint16.wrap(handles[3]),
            _inputProof(handles, user)
        );
    }

    function _encryptPassportInputs(uint64 x402FeePaid, uint64 requestedFee, uint16 agentScore, address user)
        private
        returns (externalEuint64, externalEuint64, externalEuint16, bytes memory)
    {
        bytes32[] memory handles = new bytes32[](3);
        handles[0] = _mockHandle(x402FeePaid, FheType.Uint64, 0);
        handles[1] = _mockHandle(requestedFee, FheType.Uint64, 1);
        handles[2] = _mockHandle(agentScore, FheType.Uint16, 2);

        return (
            externalEuint64.wrap(handles[0]),
            externalEuint64.wrap(handles[1]),
            externalEuint16.wrap(handles[2]),
            _inputProof(handles, user)
        );
    }

    function _mockHandle(uint256 value, FheType fheType, uint8 index) private returns (bytes32 handle) {
        inputNonce += 1;
        bytes memory ciphertext = abi.encodePacked(keccak256(abi.encodePacked(value, uint8(fheType), inputNonce)));
        handle = InputProofHelper.computeInputHandle(ciphertext, index, fheType, aclAdd, uint64(block.chainid));
        _plaintexts[handle] = CleartextArithmetic.normalizePlaintextToType(value, uint8(fheType));
    }

    function _inputProof(bytes32[] memory handles, address user) private view returns (bytes memory) {
        bytes32 domainSeparator = InputProofHelper.computeInputVerifierDomainSeparator(inputVerifierAdd, block.chainid);
        bytes32 digest = InputProofHelper.computeInputVerificationDigest(
            handles, user, address(safeYield), block.chainid, EMPTY_EXTRA_DATA, domainSeparator
        );

        bytes[] memory signatures = new bytes[](1);
        signatures[0] = _signDigest(MOCK_INPUT_SIGNER_PK, digest);
        return InputProofHelper.assembleInputProof(handles, signatures, EMPTY_EXTRA_DATA);
    }
}
