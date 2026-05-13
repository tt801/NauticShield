#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${ROOT_DIR}/stability-logs/live"
mkdir -p "${LOG_DIR}"

FRONTEND_LOG="${LOG_DIR}/frontend.log"
AGENT_LOG="${LOG_DIR}/agent.log"
PID_FILE="${LOG_DIR}/pids.env"

if [[ -f "${PID_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${PID_FILE}" || true
  if [[ -n "${FRONTEND_PID:-}" ]] && ps -p "${FRONTEND_PID}" >/dev/null 2>&1; then
    echo "Frontend already running (PID ${FRONTEND_PID})"
  fi
  if [[ -n "${AGENT_PID:-}" ]] && ps -p "${AGENT_PID}" >/dev/null 2>&1; then
    echo "Agent already running (PID ${AGENT_PID})"
  fi
fi

pushd "${ROOT_DIR}" >/dev/null
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort >"${FRONTEND_LOG}" 2>&1 &
FRONTEND_PID=$!
popd >/dev/null

pushd "${ROOT_DIR}/agent" >/dev/null
npm run dev >"${AGENT_LOG}" 2>&1 &
AGENT_PID=$!
popd >/dev/null

cat > "${PID_FILE}" <<EOF
FRONTEND_PID=${FRONTEND_PID}
AGENT_PID=${AGENT_PID}
EOF

echo "Started frontend PID ${FRONTEND_PID} and agent PID ${AGENT_PID}"
echo "Frontend URL: http://127.0.0.1:5173"
echo "Agent URL:    http://127.0.0.1:3000/api/health"
echo "Logs: ${LOG_DIR}"
