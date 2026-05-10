#!/usr/bin/env bash
# Start anvil + FHEVM cleartext host stack + SafeYield in one command.
set -euo pipefail

PORT="${ANVIL_PORT:-8545}"
RPC_URL="http://127.0.0.1:$PORT"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
export PATH="$REPO_ROOT/scripts:$PATH"

FORGE_FHEVM_DIR="$(find "$REPO_ROOT/packages/foundry/dependencies" -maxdepth 1 -type d -name 'forge-fhevm-*' | head -1)"

if [[ -z "$FORGE_FHEVM_DIR" || ! -d "$FORGE_FHEVM_DIR" ]]; then
  echo "error: forge-fhevm not found under packages/foundry/dependencies/" >&2
  echo "copy or install forge-fhevm, then rerun this script" >&2
  exit 1
fi

for bin in anvil forge cast jq; do
  command -v "$bin" >/dev/null || { echo "error: missing '$bin' on PATH" >&2; exit 1; }
done

if command -v lsof >/dev/null 2>&1 && lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "port $PORT in use, killing stale process..."
  lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

if [[ ! -d "$FORGE_FHEVM_DIR/out" ]]; then
  echo "building forge-fhevm (first run)..."
  (cd "$FORGE_FHEVM_DIR" && forge soldeer install && forge build)
fi

ANVIL_PID=
cleanup() { [[ -n "$ANVIL_PID" ]] && kill "$ANVIL_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "starting anvil on port $PORT..."
ANVIL_STATE="${ANVIL_STATE:-$REPO_ROOT/.anvil-state.json}"
ANVIL_ARGS="--host 127.0.0.1 --port $PORT --chain-id 31337 --auto-impersonate --silent"
if [[ -f "$ANVIL_STATE" ]]; then
  echo "  restoring anvil state from $ANVIL_STATE"
  anvil $ANVIL_ARGS --load-state "$ANVIL_STATE" --dump-state "$ANVIL_STATE" &
else
  anvil $ANVIL_ARGS --dump-state "$ANVIL_STATE" &
fi
ANVIL_PID=$!

for _ in $(seq 1 150); do
  cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1 && break
  sleep 0.2
done
kill -0 "$ANVIL_PID" 2>/dev/null || { echo "anvil failed to start on port $PORT" >&2; exit 1; }

echo "deploying FHEVM cleartext host stack..."
(unset CHAIN FOUNDRY_CHAIN DAPP_CHAIN; cd "$FORGE_FHEVM_DIR" && ./deploy-local.sh --rpc-url "$RPC_URL" --skip-build)

echo "deploying SafeYield..."
RPC_URL="$RPC_URL" "$SCRIPT_DIR/deploy-localhost.sh"

echo
echo "anvil + FHEVM host + SafeYield ready on $RPC_URL (chain id 31337)"
echo "next: pnpm start (in another terminal)"
echo

wait "$ANVIL_PID"
