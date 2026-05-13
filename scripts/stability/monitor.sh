#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_ROOT="${ROOT_DIR}/stability-logs"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="${LOG_ROOT}/${RUN_ID}"

DURATION_SECONDS="${DURATION_SECONDS:-172800}"   # 48h default
INTERVAL_SECONDS="${INTERVAL_SECONDS:-30}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:5173/}"
AGENT_HEALTH_URL="${AGENT_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
AGENT_SNAPSHOT_URL="${AGENT_SNAPSHOT_URL:-http://127.0.0.1:3000/api/snapshot}"

mkdir -p "${RUN_DIR}"
CSV_FILE="${RUN_DIR}/checks.csv"
SUMMARY_FILE="${RUN_DIR}/summary.txt"

echo "timestamp,frontend_http,agent_health_http,agent_snapshot_http,frontend_latency_ms,agent_latency_ms,node_proc_count,node_rss_mb" > "${CSV_FILE}"

echo "Stability run: ${RUN_ID}" | tee "${SUMMARY_FILE}"
echo "Duration: ${DURATION_SECONDS}s | Interval: ${INTERVAL_SECONDS}s" | tee -a "${SUMMARY_FILE}"
echo "Logs: ${RUN_DIR}" | tee -a "${SUMMARY_FILE}"

START_TS="$(date +%s)"
END_TS=$((START_TS + DURATION_SECONDS))

while [[ "$(date +%s)" -lt "${END_TS}" ]]; do
  NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  FRONTEND_OUT="$(curl -s -o /dev/null -w "%{http_code},%{time_total}" "${FRONTEND_URL}" || echo "000,0")"
  AGENT_OUT="$(curl -s -o /dev/null -w "%{http_code},%{time_total}" "${AGENT_HEALTH_URL}" || echo "000,0")"
  SNAP_OUT="$(curl -s -o /dev/null -w "%{http_code}" "${AGENT_SNAPSHOT_URL}" || echo "000")"

  FRONTEND_HTTP="${FRONTEND_OUT%%,*}"
  FRONTEND_TIME_S="${FRONTEND_OUT##*,}"
  AGENT_HTTP="${AGENT_OUT%%,*}"
  AGENT_TIME_S="${AGENT_OUT##*,}"

  FRONTEND_MS="$(awk -v t="${FRONTEND_TIME_S}" 'BEGIN { printf "%.0f", t * 1000 }')"
  AGENT_MS="$(awk -v t="${AGENT_TIME_S}" 'BEGIN { printf "%.0f", t * 1000 }')"

  NODE_COUNT="$(ps aux | grep -E '[n]ode .*NauticShield 2026' | wc -l | tr -d ' ')"
  NODE_RSS_KB="$(ps aux | grep -E '[n]ode .*NauticShield 2026' | awk '{s+=$6} END {print s+0}')"
  NODE_RSS_MB="$(awk -v kb="${NODE_RSS_KB}" 'BEGIN { printf "%.1f", kb / 1024 }')"

  echo "${NOW},${FRONTEND_HTTP},${AGENT_HTTP},${SNAP_OUT},${FRONTEND_MS},${AGENT_MS},${NODE_COUNT},${NODE_RSS_MB}" >> "${CSV_FILE}"

  sleep "${INTERVAL_SECONDS}"
done

TOTAL="$(($(wc -l < "${CSV_FILE}") - 1))"
FRONTEND_FAILS="$(awk -F, 'NR>1 && $2 != 200 {c++} END {print c+0}' "${CSV_FILE}")"
AGENT_FAILS="$(awk -F, 'NR>1 && $3 != 200 {c++} END {print c+0}' "${CSV_FILE}")"
SNAP_FAILS="$(awk -F, 'NR>1 && $4 != 200 {c++} END {print c+0}' "${CSV_FILE}")"

echo "" | tee -a "${SUMMARY_FILE}"
echo "Samples: ${TOTAL}" | tee -a "${SUMMARY_FILE}"
echo "Frontend non-200: ${FRONTEND_FAILS}" | tee -a "${SUMMARY_FILE}"
echo "Agent health non-200: ${AGENT_FAILS}" | tee -a "${SUMMARY_FILE}"
echo "Agent snapshot non-200: ${SNAP_FAILS}" | tee -a "${SUMMARY_FILE}"
echo "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "${SUMMARY_FILE}"
