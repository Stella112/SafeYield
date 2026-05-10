# SafeYield

Private RWA yield circles with FHE YieldLock commitments and encrypted agent permissions.

SafeYield lets people, families, and communities privately pool tokenized RWA yield, route future income into real-life commitments, and let AI agents assist only after encrypted permission checks pass.

## Problem

Real-life financial commitments are often funded from sensitive income streams: rent from a shared asset, family support, school fees, emergency savings, supplier payments, or freelance earnings. Today, proving that a commitment is funded usually means exposing balances, income history, payment amounts, or reliability signals to other people, platforms, or agents.

That creates a privacy gap for ordinary users. Families and communities need financial coordination, but they should not have to reveal every contribution, payout, reserve buffer, or trust score just to prove that a payment plan is real.

## Solution

SafeYield uses Zama FHE to let users compute over private income and yield data while keeping the underlying numbers encrypted. A user can create a private income pool, set aside future yield for a real-life commitment, route funds through a private waterfall, and generate selective proof signals without exposing the actual amounts.

AI helpers are permissioned instead of trusted by default. Before an agent can help with a task, SafeYield checks an encrypted Agent Permission Passport: fee paid, requested fee, agent score, task type, and pool safety. The agent only acts when the encrypted checks pass.

## Deployment

- Network: Sepolia
- SafeYield contract: `0xb892c20480FE14607ba8780B8768A9eA3f8611bC`

## Core Primitive

**YieldLock** turns private future yield or income into encrypted commitments for family support, rent, school fees, emergency reserves, freelancer payouts, or reinvestment.

The contract computes over encrypted values:

- private contribution and RWA NAV
- yield received
- reserve buffer
- safe withdrawal amount
- commitment amount
- user yield share
- CircleScore
- agent x402 fee, fee cap, score, solvency, and permission result

## Demo Flow

1. Create a Private Yield Circle.
2. Compute the FHE YieldLock waterfall.
3. Submit an Agent Permission Passport.
4. Execute YieldLock.
5. Reveal selective proofs such as commitment active, yield eligible, and agent allowed.

## Project Layout

- `packages/foundry/src/SafeYield.sol` - FHEVM contract.
- `packages/foundry/test/SafeYield.t.sol` - starter contract tests.
- `packages/foundry/script/DeploySafeYield.s.sol` - deployment script.
- `packages/nextjs/components/SafeYieldConsole.tsx` - working demo UI.
- `packages/nextjs/hooks/safeyield/useSafeYield.tsx` - onchain hook scaffold for the next wiring pass.
- `packages/nextjs/contracts/SafeYield.ts` - frontend ABI/deployment binding.

## Commands

```bash
pnpm install
pnpm contracts:build
pnpm contracts:test
pnpm next:check-types
pnpm start
```

The current demo server runs at `http://localhost:3001`.
