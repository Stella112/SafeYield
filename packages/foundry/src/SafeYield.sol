// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint16, euint64, externalEuint16, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SafeYield
/// @notice Private RWA yield circles with FHE YieldLock commitments and encrypted agent permissions.
contract SafeYield is ZamaEthereumConfig {
    uint16 public constant SCORE_STRONG = 900;
    uint16 public constant SCORE_RELIABLE = 720;
    uint16 public constant MIN_AGENT_SCORE = 700;
    uint64 public constant MIN_X402_AGENT_FEE = 100;

    enum CircleStatus {
        None,
        Active,
        Locked
    }

    enum CommitmentKind {
        FamilySupport,
        Rent,
        SchoolFees,
        EmergencyReserve,
        FreelancerPayout,
        Reinvestment
    }

    struct Circle {
        address owner;
        bytes32 rwaHash;
        CircleStatus status;
        euint64 contribution;
        euint64 rwaNav;
        euint64 yieldReceived;
        euint64 reserveBuffer;
        euint64 safeWithdrawal;
        euint64 userYieldShare;
        euint64 commitmentAmount;
        euint64 agentFeeCap;
        euint16 circleScore;
        ebool commitmentActive;
        ebool yieldShareEligible;
        ebool reserveHealthy;
    }

    struct AgentPassport {
        address agent;
        uint8 taskType;
        euint64 x402FeePaid;
        euint64 requestedFee;
        euint16 agentScore;
        ebool allowed;
        ebool feeSettled;
    }

    uint256 public nextCircleId = 1;
    uint256 public nextPassportId = 1;
    mapping(uint256 circleId => Circle) private circles;
    mapping(uint256 passportId => AgentPassport) private passports;

    event CircleCreated(uint256 indexed circleId, address indexed owner, bytes32 rwaHash);
    event YieldWaterfallComputed(uint256 indexed circleId, CommitmentKind indexed kind);
    event AgentPassportSubmitted(uint256 indexed passportId, uint256 indexed circleId, address indexed agent);
    event YieldLockExecuted(uint256 indexed circleId, uint256 indexed passportId);

    function createCircle(
        bytes32 rwaHash,
        externalEuint64 encryptedContribution,
        externalEuint64 encryptedRwaNav,
        externalEuint64 encryptedAgentFeeCap,
        bytes calldata inputProof
    ) external returns (uint256 circleId) {
        circleId = nextCircleId++;
        Circle storage circle = circles[circleId];
        circle.owner = msg.sender;
        circle.rwaHash = rwaHash;
        circle.status = CircleStatus.Active;
        circle.contribution = FHE.fromExternal(encryptedContribution, inputProof);
        circle.rwaNav = FHE.fromExternal(encryptedRwaNav, inputProof);
        circle.agentFeeCap = FHE.fromExternal(encryptedAgentFeeCap, inputProof);
        circle.yieldReceived = FHE.asEuint64(0);
        circle.reserveBuffer = FHE.asEuint64(0);
        circle.safeWithdrawal = FHE.asEuint64(0);
        circle.userYieldShare = FHE.asEuint64(0);
        circle.commitmentAmount = FHE.asEuint64(0);
        circle.circleScore = FHE.asEuint16(0);
        circle.commitmentActive = FHE.asEbool(false);
        circle.yieldShareEligible = FHE.asEbool(false);
        circle.reserveHealthy = FHE.asEbool(false);

        _allowCircle(circle, msg.sender);

        emit CircleCreated(circleId, msg.sender, rwaHash);
    }

    function computeYieldWaterfall(
        uint256 circleId,
        CommitmentKind kind,
        externalEuint64 encryptedYieldReceived,
        externalEuint64 encryptedCommitmentAmount,
        externalEuint64 encryptedEmergencyTarget,
        externalEuint16 encryptedReliabilityScore,
        bytes calldata inputProof
    ) external {
        Circle storage circle = circles[circleId];
        require(msg.sender == circle.owner, "only owner");
        require(circle.status == CircleStatus.Active, "bad status");

        circle.yieldReceived = FHE.fromExternal(encryptedYieldReceived, inputProof);
        circle.commitmentAmount = FHE.fromExternal(encryptedCommitmentAmount, inputProof);
        euint64 emergencyTarget = FHE.fromExternal(encryptedEmergencyTarget, inputProof);
        euint16 reliabilityScore = FHE.fromExternal(encryptedReliabilityScore, inputProof);

        circle.reserveBuffer = _applyBps(circle.yieldReceived, 2_500);
        circle.safeWithdrawal = _applyBps(circle.yieldReceived, 5_500);
        circle.userYieldShare = _applyBps(circle.yieldReceived, 2_000);
        circle.reserveHealthy = FHE.ge(circle.reserveBuffer, emergencyTarget);
        circle.commitmentActive = FHE.ge(circle.safeWithdrawal, circle.commitmentAmount);
        circle.yieldShareEligible = FHE.and(circle.commitmentActive, circle.reserveHealthy);
        circle.circleScore = _scoreCircle(reliabilityScore, circle.reserveHealthy, circle.commitmentActive);

        _allowCircle(circle, msg.sender);

        emit YieldWaterfallComputed(circleId, kind);
    }

    function submitAgentPassport(
        uint256 circleId,
        uint8 taskType,
        externalEuint64 encryptedX402FeePaid,
        externalEuint64 encryptedRequestedFee,
        externalEuint16 encryptedAgentScore,
        bytes calldata inputProof
    ) external returns (uint256 passportId) {
        Circle storage circle = circles[circleId];
        require(circle.status == CircleStatus.Active, "missing circle");

        passportId = nextPassportId++;
        AgentPassport storage passport = passports[passportId];
        passport.agent = msg.sender;
        passport.taskType = taskType;
        passport.x402FeePaid = FHE.fromExternal(encryptedX402FeePaid, inputProof);
        passport.requestedFee = FHE.fromExternal(encryptedRequestedFee, inputProof);
        passport.agentScore = FHE.fromExternal(encryptedAgentScore, inputProof);

        ebool x402Settled = FHE.ge(passport.x402FeePaid, MIN_X402_AGENT_FEE);
        ebool scoreOk = FHE.ge(passport.agentScore, MIN_AGENT_SCORE);
        ebool feeOk = FHE.le(passport.requestedFee, circle.agentFeeCap);
        ebool solvencyOk = FHE.and(circle.reserveHealthy, circle.yieldShareEligible);

        passport.feeSettled = x402Settled;
        passport.allowed = FHE.and(FHE.and(x402Settled, scoreOk), FHE.and(feeOk, solvencyOk));

        FHE.allowThis(passport.x402FeePaid);
        FHE.allowThis(passport.requestedFee);
        FHE.allowThis(passport.agentScore);
        FHE.allowThis(passport.feeSettled);
        FHE.allowThis(passport.allowed);
        FHE.allow(passport.x402FeePaid, msg.sender);
        FHE.allow(passport.requestedFee, msg.sender);
        FHE.allow(passport.agentScore, msg.sender);
        FHE.allow(passport.feeSettled, msg.sender);
        FHE.allow(passport.allowed, msg.sender);
        FHE.allow(passport.allowed, circle.owner);
        FHE.allow(passport.feeSettled, circle.owner);

        emit AgentPassportSubmitted(passportId, circleId, msg.sender);
    }

    function executeYieldLock(uint256 circleId, uint256 passportId) external {
        Circle storage circle = circles[circleId];
        AgentPassport storage passport = passports[passportId];
        require(msg.sender == circle.owner || msg.sender == passport.agent, "not authorized");
        require(circle.status == CircleStatus.Active, "bad status");

        circle.commitmentActive = FHE.and(circle.commitmentActive, passport.allowed);
        circle.safeWithdrawal = FHE.select(circle.commitmentActive, circle.safeWithdrawal, FHE.asEuint64(0));
        circle.status = CircleStatus.Locked;

        _allowCircle(circle, circle.owner);
        FHE.allow(circle.commitmentActive, passport.agent);
        FHE.allow(circle.safeWithdrawal, passport.agent);

        emit YieldLockExecuted(circleId, passportId);
    }

    function getPublicCircle(uint256 circleId)
        external
        view
        returns (address owner, bytes32 rwaHash, CircleStatus status)
    {
        Circle storage circle = circles[circleId];
        return (circle.owner, circle.rwaHash, circle.status);
    }

    function getPrivateCircle(uint256 circleId)
        external
        view
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
        Circle storage circle = circles[circleId];
        require(msg.sender == circle.owner, "only owner");
        return (
            circle.contribution,
            circle.rwaNav,
            circle.yieldReceived,
            circle.reserveBuffer,
            circle.safeWithdrawal,
            circle.userYieldShare,
            circle.commitmentAmount,
            circle.circleScore,
            circle.commitmentActive,
            circle.yieldShareEligible
        );
    }

    function getPrivatePassport(uint256 passportId)
        external
        view
        returns (euint64 x402FeePaid, euint64 requestedFee, euint16 agentScore, ebool feeSettled, ebool allowed)
    {
        AgentPassport storage passport = passports[passportId];
        require(msg.sender == passport.agent, "only agent");
        return (passport.x402FeePaid, passport.requestedFee, passport.agentScore, passport.feeSettled, passport.allowed);
    }

    function _applyBps(euint64 value, uint64 bps) internal returns (euint64) {
        return FHE.div(FHE.mul(value, bps), uint64(10_000));
    }

    function _scoreCircle(euint16 reliabilityScore, ebool reserveHealthy, ebool commitmentActive)
        internal
        returns (euint16)
    {
        ebool strong = FHE.and(FHE.ge(reliabilityScore, SCORE_STRONG), reserveHealthy);
        ebool reliable = FHE.and(FHE.ge(reliabilityScore, SCORE_RELIABLE), commitmentActive);
        return FHE.select(
            strong,
            FHE.asEuint16(960),
            FHE.select(reliable, FHE.asEuint16(810), FHE.select(commitmentActive, FHE.asEuint16(640), FHE.asEuint16(280)))
        );
    }

    function _allowCircle(Circle storage circle, address user) internal {
        FHE.allowThis(circle.contribution);
        FHE.allowThis(circle.rwaNav);
        FHE.allowThis(circle.yieldReceived);
        FHE.allowThis(circle.reserveBuffer);
        FHE.allowThis(circle.safeWithdrawal);
        FHE.allowThis(circle.userYieldShare);
        FHE.allowThis(circle.commitmentAmount);
        FHE.allowThis(circle.agentFeeCap);
        FHE.allowThis(circle.circleScore);
        FHE.allowThis(circle.commitmentActive);
        FHE.allowThis(circle.yieldShareEligible);
        FHE.allowThis(circle.reserveHealthy);

        FHE.allow(circle.contribution, user);
        FHE.allow(circle.rwaNav, user);
        FHE.allow(circle.yieldReceived, user);
        FHE.allow(circle.reserveBuffer, user);
        FHE.allow(circle.safeWithdrawal, user);
        FHE.allow(circle.userYieldShare, user);
        FHE.allow(circle.commitmentAmount, user);
        FHE.allow(circle.agentFeeCap, user);
        FHE.allow(circle.circleScore, user);
        FHE.allow(circle.commitmentActive, user);
        FHE.allow(circle.yieldShareEligible, user);
        FHE.allow(circle.reserveHealthy, user);
    }
}
