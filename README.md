# SafeYield

Private RWA yield circles with FHE YieldLock commitments and encrypted agent permissions.

SafeYield lets people, families, and communities privately pool tokenized RWA yield, route future income into real-life commitments, and let AI agents assist only after encrypted permission checks pass.

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
