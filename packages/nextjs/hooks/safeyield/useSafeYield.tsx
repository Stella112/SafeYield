"use client";

import { useCallback, useMemo, useState } from "react";
import { useAllow, useEncrypt, useIsAllowed, useUserDecrypt } from "@zama-fhe/react-sdk";
import { bytesToHex, keccak256, toBytes } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { SafeYield } from "~~/contracts/SafeYield";
import { deploymentFor } from "~~/utils/contract";

type CircleHandles = readonly [
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
];
type PassportHandles = readonly [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

export type CircleForm = {
  rwaLabel: string;
  contribution: string;
  rwaNav: string;
  agentFeeCap: string;
};

export type WaterfallForm = {
  circleId: string;
  commitmentKind: string;
  yieldReceived: string;
  commitmentAmount: string;
  emergencyTarget: string;
  reliabilityScore: string;
};

export type AgentForm = {
  circleId: string;
  taskType: string;
  x402FeePaid: string;
  requestedFee: string;
  agentScore: string;
};

const asBig = (value: string, fallback = 0n) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return BigInt(trimmed);
};

const asNumber = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const SAFEYIELD_CHAIN_ID = 11155111;
export const SAFEYIELD_CHAIN_NAME = "Sepolia";

export const useSafeYield = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const deployment = useMemo(() => deploymentFor(SafeYield, chainId), [chainId]);
  const encrypt = useEncrypt();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeCircleId, setActiveCircleId] = useState("1");
  const [activePassportId, setActivePassportId] = useState("1");
  const [circleHandles, setCircleHandles] = useState<CircleHandles | undefined>();
  const [passportHandles, setPassportHandles] = useState<PassportHandles | undefined>();
  const [decryptEnabled, setDecryptEnabled] = useState(false);

  const deployedAddress = deployment?.address as string | undefined;
  const hasContract = Boolean(
    deployedAddress && deployedAddress.toLowerCase() !== "0x0000000000000000000000000000000000000000",
  );
  const contractAddress = deployedAddress as `0x${string}` | undefined;
  const allowanceAddress = (contractAddress ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const abi = deployment?.abi;
  const circleId = asBig(activeCircleId, 1n);
  const passportId = asBig(activePassportId, 1n);

  const nextCircleRead = useReadContract({
    address: hasContract ? contractAddress : undefined,
    abi,
    functionName: "nextCircleId",
    query: { enabled: Boolean(hasContract && isConnected), refetchOnWindowFocus: false },
  });

  const nextPassportRead = useReadContract({
    address: hasContract ? contractAddress : undefined,
    abi,
    functionName: "nextPassportId",
    query: { enabled: Boolean(hasContract && isConnected), refetchOnWindowFocus: false },
  });

  const publicCircleRead = useReadContract({
    address: hasContract ? contractAddress : undefined,
    abi,
    functionName: "getPublicCircle",
    args: [circleId],
    query: { enabled: Boolean(hasContract && isConnected && circleId > 0n), refetchOnWindowFocus: false, retry: false },
  });

  const privateCircleRead = useReadContract({
    address: hasContract ? contractAddress : undefined,
    abi,
    functionName: "getPrivateCircle",
    args: [circleId],
    query: { enabled: false, retry: false },
  });

  const privatePassportRead = useReadContract({
    address: hasContract ? contractAddress : undefined,
    abi,
    functionName: "getPrivatePassport",
    args: [passportId],
    query: { enabled: false, retry: false },
  });

  const decryptTargets = useMemo(() => {
    const targets: Array<{ handle: `0x${string}`; contractAddress: `0x${string}` }> = [];
    if (contractAddress && circleHandles) {
      for (const handle of circleHandles) targets.push({ handle, contractAddress });
    }
    if (contractAddress && passportHandles) {
      for (const handle of passportHandles) targets.push({ handle, contractAddress });
    }
    return targets;
  }, [circleHandles, contractAddress, passportHandles]);

  const { mutate: allow, isPending: isAllowing } = useAllow();
  const { data: isAllowed } = useIsAllowed({ contractAddresses: [allowanceAddress] });
  const decrypt = useUserDecrypt({ handles: decryptTargets }, { enabled: decryptEnabled && Boolean(isAllowed) });

  const refresh = useCallback(() => {
    nextCircleRead.refetch();
    nextPassportRead.refetch();
    publicCircleRead.refetch();
  }, [nextCircleRead, nextPassportRead, publicCircleRead]);

  const switchToSafeYieldNetwork = useCallback(async () => {
    if (!isConnected) {
      setMessage("Connect your wallet first.");
      return;
    }
    if (chainId === SAFEYIELD_CHAIN_ID) {
      setMessage(`Wallet is already on ${SAFEYIELD_CHAIN_NAME}.`);
      return;
    }
    try {
      setMessage(`Requesting ${SAFEYIELD_CHAIN_NAME} in your wallet...`);
      await switchChainAsync({ chainId: SAFEYIELD_CHAIN_ID });
      setMessage(`Switched to ${SAFEYIELD_CHAIN_NAME}.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : `Open MetaMask and switch to ${SAFEYIELD_CHAIN_NAME}, then try Start Pool again.`,
      );
    }
  }, [chainId, isConnected, switchChainAsync]);

  const waitForSuccess = useCallback(
    async (hash: `0x${string}`, label: string) => {
      if (!publicClient) return;
      setMessage(`${label} submitted. Waiting for confirmation...`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`${label} reverted onchain.`);
    },
    [publicClient],
  );

  const createCircle = useCallback(
    async (form: CircleForm) => {
      if (!hasContract || !contractAddress || !address || !abi || isProcessing) return;
      setIsProcessing(true);
      try {
        setMessage("Encrypting private circle inputs...");
        const encrypted = await encrypt.mutateAsync({
          values: [
            { value: asBig(form.contribution), type: "euint64" },
            { value: asBig(form.rwaNav), type: "euint64" },
            { value: asBig(form.agentFeeCap), type: "euint64" },
          ],
          contractAddress,
          userAddress: address,
        });
        const rwaHash = keccak256(toBytes(form.rwaLabel || "tokenized-rwa-yield-circle"));
        const target = nextCircleRead.data ? BigInt(nextCircleRead.data as bigint) : circleId;
        const hash = await writeContractAsync({
          address: contractAddress,
          abi,
          functionName: "createCircle",
          args: [
            rwaHash,
            bytesToHex(encrypted.handles[0]!),
            bytesToHex(encrypted.handles[1]!),
            bytesToHex(encrypted.handles[2]!),
            bytesToHex(encrypted.inputProof),
          ],
          gas: 15_000_000n,
        });
        await waitForSuccess(hash, "Private yield circle");
        setActiveCircleId(target.toString());
        setMessage(`Circle ${target.toString()} created.`);
        refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsProcessing(false);
      }
    },
    [
      abi,
      address,
      circleId,
      contractAddress,
      encrypt,
      hasContract,
      isProcessing,
      nextCircleRead.data,
      refresh,
      waitForSuccess,
      writeContractAsync,
    ],
  );

  const computeWaterfall = useCallback(
    async (form: WaterfallForm) => {
      if (!hasContract || !contractAddress || !address || !abi || isProcessing) return;
      setIsProcessing(true);
      try {
        setMessage("Encrypting yield and commitment terms...");
        const encrypted = await encrypt.mutateAsync({
          values: [
            { value: asBig(form.yieldReceived), type: "euint64" },
            { value: asBig(form.commitmentAmount), type: "euint64" },
            { value: asBig(form.emergencyTarget), type: "euint64" },
            { value: asBig(form.reliabilityScore), type: "euint16" },
          ],
          contractAddress,
          userAddress: address,
        });
        const targetCircle = asBig(form.circleId, circleId);
        const hash = await writeContractAsync({
          address: contractAddress,
          abi,
          functionName: "computeYieldWaterfall",
          args: [
            targetCircle,
            asNumber(form.commitmentKind, 0),
            bytesToHex(encrypted.handles[0]!),
            bytesToHex(encrypted.handles[1]!),
            bytesToHex(encrypted.handles[2]!),
            bytesToHex(encrypted.handles[3]!),
            bytesToHex(encrypted.inputProof),
          ],
          gas: 15_000_000n,
        });
        await waitForSuccess(hash, "Yield waterfall");
        setActiveCircleId(targetCircle.toString());
        setMessage("Private waterfall computed. YieldLock is ready for permission checks.");
        refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsProcessing(false);
      }
    },
    [
      abi,
      address,
      circleId,
      contractAddress,
      encrypt,
      hasContract,
      isProcessing,
      refresh,
      waitForSuccess,
      writeContractAsync,
    ],
  );

  const submitAgentPassport = useCallback(
    async (form: AgentForm) => {
      if (!hasContract || !contractAddress || !address || !abi || isProcessing) return;
      setIsProcessing(true);
      try {
        setMessage("Encrypting agent permission passport...");
        const encrypted = await encrypt.mutateAsync({
          values: [
            { value: asBig(form.x402FeePaid), type: "euint64" },
            { value: asBig(form.requestedFee), type: "euint64" },
            { value: asBig(form.agentScore), type: "euint16" },
          ],
          contractAddress,
          userAddress: address,
        });
        const targetPassport = nextPassportRead.data ? BigInt(nextPassportRead.data as bigint) : passportId;
        const hash = await writeContractAsync({
          address: contractAddress,
          abi,
          functionName: "submitAgentPassport",
          args: [
            asBig(form.circleId, circleId),
            asNumber(form.taskType, 0),
            bytesToHex(encrypted.handles[0]!),
            bytesToHex(encrypted.handles[1]!),
            bytesToHex(encrypted.handles[2]!),
            bytesToHex(encrypted.inputProof),
          ],
          gas: 15_000_000n,
        });
        await waitForSuccess(hash, "Agent passport");
        setActivePassportId(targetPassport.toString());
        setMessage(`Agent passport ${targetPassport.toString()} submitted.`);
        refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsProcessing(false);
      }
    },
    [
      abi,
      address,
      circleId,
      contractAddress,
      encrypt,
      hasContract,
      isProcessing,
      nextPassportRead.data,
      passportId,
      refresh,
      waitForSuccess,
      writeContractAsync,
    ],
  );

  const executeYieldLock = useCallback(async () => {
    if (!hasContract || !contractAddress || !abi || isProcessing) return;
    setIsProcessing(true);
    try {
      setMessage("Executing YieldLock through encrypted agent permission...");
      const hash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: "executeYieldLock",
        args: [circleId, passportId],
        gas: 15_000_000n,
      });
      await waitForSuccess(hash, "YieldLock");
      setMessage("YieldLock executed. Authorized values can now be selectively decrypted.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsProcessing(false);
    }
  }, [
    abi,
    circleId,
    contractAddress,
    hasContract,
    isProcessing,
    passportId,
    refresh,
    waitForSuccess,
    writeContractAsync,
  ]);

  const readPrivateCircle = useCallback(async () => {
    if (!hasContract || !contractAddress || !abi) return;
    try {
      setMessage("Reading encrypted circle handles...");
      const result = await privateCircleRead.refetch();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("No circle handles returned.");
      setCircleHandles(result.data as CircleHandles);
      setMessage("Circle handles loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [abi, contractAddress, hasContract, privateCircleRead]);

  const readPrivatePassport = useCallback(async () => {
    if (!hasContract || !contractAddress || !abi) return;
    try {
      setMessage("Reading encrypted passport handles...");
      const result = await privatePassportRead.refetch();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("No passport handles returned.");
      setPassportHandles(result.data as PassportHandles);
      setMessage("Passport handles loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [abi, contractAddress, hasContract, privatePassportRead]);

  const decryptLoadedHandles = useCallback(() => {
    if (!contractAddress || decryptTargets.length === 0) {
      setMessage("Load encrypted result handles first.");
      return;
    }
    setDecryptEnabled(true);
    if (!isAllowed) {
      setMessage("Authorizing decryption...");
      allow([contractAddress]);
      return;
    }
    setMessage("Decrypting authorized result handles...");
  }, [allow, contractAddress, decryptTargets.length, isAllowed]);

  return {
    address: contractAddress,
    hasContract,
    isConnected,
    chainId,
    walletAddress: address,
    message,
    isProcessing,
    activeCircleId,
    setActiveCircleId,
    activePassportId,
    setActivePassportId,
    nextCircleId: nextCircleRead.data?.toString(),
    nextPassportId: nextPassportRead.data?.toString(),
    publicCircle: publicCircleRead.data,
    switchToSafeYieldNetwork,
    createCircle,
    computeWaterfall,
    submitAgentPassport,
    executeYieldLock,
    readPrivateCircle,
    readPrivatePassport,
    decryptLoadedHandles,
    isAllowing,
    isDecrypting: decrypt.isFetching,
    circleHandles,
    passportHandles,
    decrypted: decrypt.data ?? {},
  };
};
