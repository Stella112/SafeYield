"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  BanknotesIcon,
  CheckCircleIcon,
  KeyIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import {
  AgentForm,
  CircleForm,
  SAFEYIELD_CHAIN_ID,
  SAFEYIELD_CHAIN_NAME,
  WaterfallForm,
  useSafeYield,
} from "~~/hooks/safeyield/useSafeYield";

type View = "circle" | "waterfall" | "agent" | "proofs";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-slate-50 outline-none transition placeholder:text-slate-500 focus:border-emerald-300/70 focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_rgba(110,231,183,0.1)]";
const labelClass = "text-xs font-bold uppercase text-slate-400";
const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-[0_18px_46px_rgba(16,185,129,0.22)] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500";
const secondaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-bold text-slate-100 transition hover:border-emerald-300/45 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:text-slate-600";
const panelClass =
  "rounded-lg border border-white/12 bg-slate-950/72 shadow-[0_24px_90px_rgba(2,6,23,0.36)] backdrop-blur-xl";
const surfaceClass = "rounded-lg border border-white/10 bg-white/[0.055]";

const circleDefaults: CircleForm = {
  rwaLabel: "Lagos rental-income pool",
  contribution: "120000",
  rwaNav: "860000",
  agentFeeCap: "250",
};

const waterfallDefaults: WaterfallForm = {
  circleId: "1",
  commitmentKind: "0",
  yieldReceived: "42000",
  commitmentAmount: "18000",
  emergencyTarget: "9000",
  reliabilityScore: "830",
};

const agentDefaults: AgentForm = {
  circleId: "1",
  taskType: "1",
  x402FeePaid: "120",
  requestedFee: "180",
  agentScore: "790",
};

const commitmentKinds = [
  "Family support",
  "Rent",
  "School fees",
  "Emergency reserve",
  "Freelancer payout",
  "Reinvestment",
];

const agentTaskTypes = ["RWA valuation", "Rebalance", "Trigger claim", "Monitor solvency", "Service bid"];

const agentProposals = [
  {
    name: "Payment Helper",
    role: "Checks if the pool can safely pay the commitment",
    taskType: "1",
    x402FeePaid: "120",
    requestedFee: "180",
    agentScore: "790",
  },
  {
    name: "Safety Watcher",
    role: "Checks that emergency savings stay protected",
    taskType: "3",
    x402FeePaid: "140",
    requestedFee: "210",
    agentScore: "845",
  },
  {
    name: "Income Checker",
    role: "Checks the income source before moving money",
    taskType: "0",
    x402FeePaid: "160",
    requestedFee: "240",
    agentScore: "910",
  },
];

const statusLabel = (status?: number) => {
  if (status === 1) return "Active";
  if (status === 2) return "Locked";
  return "Not loaded";
};

const shortValue = (value?: string) => {
  if (!value || value === "0x0000000000000000000000000000000000000000") return "-";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const Field = ({
  label,
  hint,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) => (
  <label className="space-y-2">
    <span className={labelClass}>{label}</span>
    <input className={inputClass} type={type} value={value} onChange={event => onChange(event.target.value)} />
    {hint && <span className="block text-xs leading-5 text-slate-500">{hint}</span>}
  </label>
);

const SelectField = ({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) => (
  <label className="space-y-2">
    <span className={labelClass}>{label}</span>
    <select className={inputClass} value={value} onChange={event => onChange(event.target.value)}>
      {options.map((option, index) => (
        <option key={option} value={index} className="bg-slate-950">
          {option}
        </option>
      ))}
    </select>
    {hint && <span className="block text-xs leading-5 text-slate-500">{hint}</span>}
  </label>
);

const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className={surfaceClass + " p-4"}>
    <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
    <div className="mt-2 min-h-6 break-all text-lg font-semibold text-slate-50">{value}</div>
  </div>
);

const ViewButton = ({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition ${
      active
        ? "border-emerald-300 bg-emerald-300 text-slate-950"
        : "border-white/10 bg-white/[0.045] text-slate-300 hover:border-emerald-300/50 hover:text-white"
    }`}
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);

const HandleValue = ({
  label,
  handle,
  decrypted,
}: {
  label: string;
  handle?: string;
  decrypted: Record<`0x${string}`, bigint | boolean | string> | Record<string, unknown>;
}) => {
  const values = decrypted as Record<string, unknown>;
  const clear = handle ? values[handle] : undefined;
  return (
    <div className={surfaceClass + " p-4"}>
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-3 min-h-10 break-all font-mono text-xs leading-5 text-slate-500">
        {handle || "No handle loaded"}
      </div>
      <div className="mt-4 text-base font-semibold text-slate-100">
        {clear === undefined ? "Encrypted" : typeof clear === "bigint" ? clear.toString() : String(clear)}
      </div>
    </div>
  );
};

const ActionNotice = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-semibold leading-6 text-amber-100">
      {message}
    </div>
  );
};

export default function SafeYieldConsole() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07110f] text-slate-100">
        <div className="rounded-lg border border-white/10 bg-white/[0.055] px-5 py-4 text-sm font-semibold">
          Loading SafeYield...
        </div>
      </main>
    );
  }

  return <SafeYieldRuntime />;
}

function SafeYieldRuntime() {
  const safeYield = useSafeYield();
  const [activeView, setActiveView] = useState<View>("circle");
  const [circleForm, setCircleForm] = useState(circleDefaults);
  const [waterfallForm, setWaterfallForm] = useState(waterfallDefaults);
  const [agentForm, setAgentForm] = useState(agentDefaults);

  const publicCircle = safeYield.publicCircle as readonly [string, string, number] | undefined;
  const contractStatus = safeYield.hasContract ? "Ready" : `Needs ${SAFEYIELD_CHAIN_NAME} contract`;
  const needsWallet = !safeYield.isConnected;
  const wrongNetwork = safeYield.isConnected && safeYield.chainId !== SAFEYIELD_CHAIN_ID;
  const missingContract = safeYield.isConnected && safeYield.chainId === SAFEYIELD_CHAIN_ID && !safeYield.hasContract;
  const actionDisabled = needsWallet || missingContract || safeYield.isProcessing;
  const actionNotice = needsWallet
    ? "Connect your wallet with the button at the top right before starting the pool."
    : wrongNetwork
      ? `Switch your wallet to ${SAFEYIELD_CHAIN_NAME}. Current network: ${safeYield.chainId ?? "unknown"}.`
      : missingContract
        ? `SafeYield is not deployed to ${SAFEYIELD_CHAIN_NAME} yet. Add a valid deployer private key, deploy, then refresh.`
        : undefined;
  const primaryActionLabel = safeYield.isProcessing
    ? "Working..."
    : needsWallet
      ? "Connect Wallet First"
      : wrongNetwork
        ? `Switch To ${SAFEYIELD_CHAIN_NAME}`
        : missingContract
          ? "Needs Sepolia Deploy"
          : undefined;
  const agentFeeCap = Number(circleForm.agentFeeCap) || 0;
  const yieldReceived = Number(waterfallForm.yieldReceived) || 0;
  const commitmentAmount = Number(waterfallForm.commitmentAmount) || 0;
  const bestAgent = useMemo(() => {
    const affordable = agentProposals.filter(proposal => Number(proposal.requestedFee) <= agentFeeCap);
    const pool = affordable.length > 0 ? affordable : agentProposals;
    return [...pool].sort((left, right) => Number(right.agentScore) - Number(left.agentScore))[0];
  }, [agentFeeCap]);
  const agentSignal =
    yieldReceived >= commitmentAmount && agentFeeCap >= Number(bestAgent.requestedFee)
      ? "Ready to request encrypted permission"
      : "Needs a healthier waterfall or higher fee cap";

  const prepareAgent = (proposal: (typeof agentProposals)[number]) => {
    setAgentForm({
      circleId: waterfallForm.circleId || safeYield.activeCircleId,
      taskType: proposal.taskType,
      x402FeePaid: proposal.x402FeePaid,
      requestedFee: proposal.requestedFee,
      agentScore: proposal.agentScore,
    });
  };
  const runAction = (action: () => void) => {
    if (wrongNetwork) {
      safeYield.switchToSafeYieldNetwork();
      return;
    }
    action();
  };

  const timeline = useMemo(
    () => [
      ["Start a pool", safeYield.nextCircleId ? `next ${safeYield.nextCircleId}` : "waiting"],
      ["Plan the payment", publicCircle ? statusLabel(publicCircle[2]) : "waiting"],
      ["Approve AI helper", safeYield.nextPassportId ? `next ${safeYield.nextPassportId}` : "waiting"],
      ["Show private proof", safeYield.circleHandles ? "ready" : "not ready"],
    ],
    [publicCircle, safeYield.circleHandles, safeYield.nextCircleId, safeYield.nextPassportId],
  );

  return (
    <main className="min-h-screen bg-[#07110f] text-slate-100">
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_12%,rgba(45,212,191,0.24),transparent_36%),radial-gradient(circle_at_78%_18%,rgba(251,191,36,0.16),transparent_32%),linear-gradient(180deg,#07110f,#0f172a_58%,#111827)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:72px_72px]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300/40 bg-emerald-300/12">
            <LockClosedIcon className="h-5 w-5 text-emerald-200" />
          </span>
          <div>
            <div className="text-xl font-black text-white">SafeYield</div>
            <div className="text-xs font-bold uppercase text-slate-500">Private income pools on encrypted rails</div>
          </div>
        </div>
        <RainbowKitCustomConnectButton />
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-6 px-5 pb-10 pt-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className={panelClass + " overflow-hidden"}>
            <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="inline-flex rounded-lg border border-emerald-300/30 bg-white/[0.07] px-3 py-2 text-xs font-extrabold uppercase text-emerald-200">
                  Keep amounts private
                </div>
                <h1 className="mt-6 max-w-4xl text-5xl font-black leading-none text-white md:text-7xl">
                  Save future income for real life.
                </h1>
                <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-300">
                  Put income from a shared asset into a private pool, set money aside for rent, school fees, family
                  support, emergency savings, or work payouts, and approve AI helpers without exposing balances.
                </p>
              </div>
              <div className={surfaceClass + " p-5"}>
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
                  <SparklesIcon className="h-5 w-5" />
                  Maya demo
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    "Starts a private income pool",
                    "Sets money aside for family support",
                    "Keeps income and savings hidden",
                    "Lets an AI helper act only if approved",
                  ].map((item, index) => (
                    <div key={item} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-300 text-xs font-black text-slate-950">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium leading-6 text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={panelClass + " p-4"}>
            <div className="grid gap-3 md:grid-cols-4">
              <ViewButton
                active={activeView === "circle"}
                icon={<UserGroupIcon className="h-5 w-5" />}
                label="Start Pool"
                onClick={() => setActiveView("circle")}
              />
              <ViewButton
                active={activeView === "waterfall"}
                icon={<BanknotesIcon className="h-5 w-5" />}
                label="Plan Payment"
                onClick={() => setActiveView("waterfall")}
              />
              <ViewButton
                active={activeView === "agent"}
                icon={<ShieldCheckIcon className="h-5 w-5" />}
                label="AI Helper"
                onClick={() => setActiveView("agent")}
              />
              <ViewButton
                active={activeView === "proofs"}
                icon={<KeyIcon className="h-5 w-5" />}
                label="Private Proof"
                onClick={() => setActiveView("proofs")}
              />
            </div>
          </section>

          {activeView === "circle" && (
            <section className={panelClass}>
              <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">Start A Private Pool</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Add a private deposit and set the most an AI helper can charge.
                  </p>
                </div>
                <button
                  className={primaryButton}
                  disabled={actionDisabled}
                  onClick={() => runAction(() => safeYield.createCircle(circleForm))}
                >
                  <LockClosedIcon className="h-5 w-5" />
                  {primaryActionLabel ?? "Start Pool"}
                </button>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <ActionNotice message={actionNotice} />
                </div>
                <Field
                  label="Income source"
                  hint="Example: rent from a property, invoices, or tokenized yield."
                  value={circleForm.rwaLabel}
                  onChange={value => setCircleForm({ ...circleForm, rwaLabel: value })}
                />
                <Field
                  label="Your private deposit"
                  hint="Only the contract can use this number. Other people do not see it."
                  value={circleForm.contribution}
                  onChange={value => setCircleForm({ ...circleForm, contribution: value })}
                />
                <Field
                  label="Pool value"
                  hint="The private total value of the income source."
                  value={circleForm.rwaNav}
                  onChange={value => setCircleForm({ ...circleForm, rwaNav: value })}
                />
                <Field
                  label="Max agent fee"
                  hint="The highest fee an AI helper is allowed to request."
                  value={circleForm.agentFeeCap}
                  onChange={value => setCircleForm({ ...circleForm, agentFeeCap: value })}
                />
              </div>
            </section>
          )}

          {activeView === "waterfall" && (
            <section className={panelClass}>
              <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">Plan A Safe Payment</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    The app checks income, keeps emergency money aside, then decides if the payment is safe.
                  </p>
                </div>
                <button
                  className={primaryButton}
                  disabled={actionDisabled}
                  onClick={() => runAction(() => safeYield.computeWaterfall(waterfallForm))}
                >
                  <ArrowPathIcon className="h-5 w-5" />
                  {primaryActionLabel ?? "Calculate Plan"}
                </button>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-3">
                <div className="md:col-span-2 xl:col-span-3">
                  <ActionNotice message={actionNotice} />
                </div>
                <Field
                  label="Pool id"
                  hint="Use 1 for the first pool in the demo."
                  value={waterfallForm.circleId}
                  onChange={value => setWaterfallForm({ ...waterfallForm, circleId: value })}
                />
                <SelectField
                  label="Commitment"
                  hint="What this payment is meant to support."
                  value={waterfallForm.commitmentKind}
                  onChange={value => setWaterfallForm({ ...waterfallForm, commitmentKind: value })}
                  options={commitmentKinds}
                />
                <Field
                  label="Income received"
                  hint="The new income that arrived for the pool."
                  value={waterfallForm.yieldReceived}
                  onChange={value => setWaterfallForm({ ...waterfallForm, yieldReceived: value })}
                />
                <Field
                  label="Amount to set aside"
                  hint="The payment you want protected for rent, family, school, or work."
                  value={waterfallForm.commitmentAmount}
                  onChange={value => setWaterfallForm({ ...waterfallForm, commitmentAmount: value })}
                />
                <Field
                  label="Minimum emergency savings"
                  hint="The pool should keep at least this much in reserve."
                  value={waterfallForm.emergencyTarget}
                  onChange={value => setWaterfallForm({ ...waterfallForm, emergencyTarget: value })}
                />
                <Field
                  label="Reliability score"
                  hint="A private 0-1000 trust score for the pool's payment history."
                  value={waterfallForm.reliabilityScore}
                  onChange={value => setWaterfallForm({ ...waterfallForm, reliabilityScore: value })}
                />
              </div>
            </section>
          )}

          {activeView === "agent" && (
            <section className={panelClass}>
              <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">Approve An AI Helper</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    The helper can only act if its fee, trust score, task, and pool safety checks pass privately.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className={secondaryButton}
                    disabled={actionDisabled}
                    onClick={() => runAction(safeYield.executeYieldLock)}
                  >
                    <PlayIcon className="h-5 w-5" />
                    {primaryActionLabel ?? "Run Safe Payment"}
                  </button>
                  <button
                    className={primaryButton}
                    disabled={actionDisabled}
                    onClick={() => runAction(() => safeYield.submitAgentPassport(agentForm))}
                  >
                    <ShieldCheckIcon className="h-5 w-5" />
                    {primaryActionLabel ?? "Ask For Approval"}
                  </button>
                </div>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-5">
                <div className="md:col-span-2 xl:col-span-5">
                  <ActionNotice message={actionNotice} />
                </div>
                <div className={surfaceClass + " md:col-span-2 xl:col-span-5 p-5"}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
                        <SparklesIcon className="h-5 w-5" />
                        Suggested helper
                      </div>
                      <h3 className="mt-3 text-2xl font-black text-white">{bestAgent.name}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{bestAgent.role}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100">
                      {agentSignal}
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {agentProposals.map(proposal => {
                      const affordable = Number(proposal.requestedFee) <= agentFeeCap;
                      return (
                        <button
                          key={proposal.name}
                          className={`rounded-lg border p-4 text-left transition ${
                            proposal.name === bestAgent.name
                              ? "border-emerald-300 bg-emerald-300/12"
                              : "border-white/10 bg-white/[0.04] hover:border-emerald-300/45"
                          }`}
                          onClick={() => prepareAgent(proposal)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-black text-white">{proposal.name}</span>
                            <span
                              className={
                                affordable ? "text-xs font-bold text-emerald-200" : "text-xs font-bold text-amber-200"
                              }
                            >
                              fee {proposal.requestedFee}
                            </span>
                          </div>
                          <div className="mt-2 text-xs leading-5 text-slate-400">{proposal.role}</div>
                          <div className="mt-4 flex items-center justify-between text-xs font-bold uppercase text-slate-500">
                            <span>score {proposal.agentScore}</span>
                            <span>{agentTaskTypes[Number(proposal.taskType)]}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Field
                  label="Pool id"
                  hint="The pool this helper wants to work on."
                  value={agentForm.circleId}
                  onChange={value => setAgentForm({ ...agentForm, circleId: value })}
                />
                <SelectField
                  label="Task type"
                  hint="The job the helper is asking permission to do."
                  value={agentForm.taskType}
                  onChange={value => setAgentForm({ ...agentForm, taskType: value })}
                  options={agentTaskTypes}
                />
                <Field
                  label="x402 fee paid"
                  hint="Shows the helper has paid or settled the access fee."
                  value={agentForm.x402FeePaid}
                  onChange={value => setAgentForm({ ...agentForm, x402FeePaid: value })}
                />
                <Field
                  label="Requested fee"
                  hint="What the helper wants to charge the pool."
                  value={agentForm.requestedFee}
                  onChange={value => setAgentForm({ ...agentForm, requestedFee: value })}
                />
                <Field
                  label="Agent score"
                  hint="A private trust score for the helper."
                  value={agentForm.agentScore}
                  onChange={value => setAgentForm({ ...agentForm, agentScore: value })}
                />
              </div>
            </section>
          )}

          {activeView === "proofs" && (
            <section className={panelClass}>
              <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">Show Private Results</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Reveal only the proof you choose, while the money amounts stay hidden from everyone else.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className={secondaryButton}
                    disabled={actionDisabled}
                    onClick={() => runAction(safeYield.readPrivateCircle)}
                  >
                    <MagnifyingGlassIcon className="h-5 w-5" />
                    Circle
                  </button>
                  <button
                    className={secondaryButton}
                    disabled={actionDisabled}
                    onClick={() => runAction(safeYield.readPrivatePassport)}
                  >
                    <MagnifyingGlassIcon className="h-5 w-5" />
                    Helper
                  </button>
                  <button
                    className={primaryButton}
                    disabled={actionDisabled}
                    onClick={() => runAction(safeYield.decryptLoadedHandles)}
                  >
                    <KeyIcon className="h-5 w-5" />
                    {safeYield.isDecrypting ? "Decrypting" : safeYield.isAllowing ? "Authorizing" : "Decrypt"}
                  </button>
                </div>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                <div className="md:col-span-2 xl:col-span-3">
                  <ActionNotice message={actionNotice} />
                </div>
                <HandleValue
                  label="Emergency savings"
                  handle={safeYield.circleHandles?.[3]}
                  decrypted={safeYield.decrypted}
                />
                <HandleValue
                  label="Safe to pay out"
                  handle={safeYield.circleHandles?.[4]}
                  decrypted={safeYield.decrypted}
                />
                <HandleValue
                  label="Your income share"
                  handle={safeYield.circleHandles?.[5]}
                  decrypted={safeYield.decrypted}
                />
                <HandleValue
                  label="Protected payment"
                  handle={safeYield.circleHandles?.[6]}
                  decrypted={safeYield.decrypted}
                />
                <HandleValue
                  label="Pool trust score"
                  handle={safeYield.circleHandles?.[7]}
                  decrypted={safeYield.decrypted}
                />
                <HandleValue
                  label="Payment protected"
                  handle={safeYield.circleHandles?.[8]}
                  decrypted={safeYield.decrypted}
                />
                <HandleValue
                  label="Income eligible"
                  handle={safeYield.circleHandles?.[9]}
                  decrypted={safeYield.decrypted}
                />
                <HandleValue
                  label="Helper fee settled"
                  handle={safeYield.passportHandles?.[3]}
                  decrypted={safeYield.decrypted}
                />
                <HandleValue
                  label="Helper approved"
                  handle={safeYield.passportHandles?.[4]}
                  decrypted={safeYield.decrypted}
                />
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className={panelClass + " p-5"}>
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-emerald-300" />
              <h2 className="font-black text-white">Current Status</h2>
            </div>
            <div className="mt-5 grid gap-3">
              <Stat label="App state" value={contractStatus} />
              <Stat
                label="Wallet"
                value={safeYield.isConnected ? shortValue(safeYield.walletAddress) : "Not connected"}
              />
              <Stat label="Network" value={safeYield.chainId ?? "Unknown"} />
              <Stat label="Active pool" value={safeYield.activeCircleId} />
              <Stat label="Pool owner" value={shortValue(publicCircle?.[0])} />
              <Stat label="Pool status" value={statusLabel(publicCircle?.[2])} />
              <Stat label="Helper approval" value={safeYield.activePassportId} />
            </div>
          </section>

          <section className={panelClass + " p-5"}>
            <h2 className="font-black text-white">Demo Steps</h2>
            <div className="mt-5 space-y-4">
              {timeline.map(([label, status]) => (
                <div key={label} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  <div>
                    <div className="text-sm font-bold text-slate-100">{label}</div>
                    <div className="font-mono text-xs text-slate-500">{status}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={panelClass + " p-5"}>
            <h2 className="font-black text-white">What SafeYield Proves</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              A person can prove a support payment is active and safely funded without revealing income, balances, or
              payout amounts.
            </p>
          </section>
        </aside>
      </section>

      {safeYield.message && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-emerald-300/25 bg-slate-950/95 px-4 py-3 text-sm text-slate-100 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          {safeYield.message}
        </div>
      )}
    </main>
  );
}
