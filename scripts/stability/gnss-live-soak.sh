#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_ROOT="${ROOT_DIR}/stability-logs"
RUN_ID="gnss-soak-$(date +%Y%m%d-%H%M%S)"
RUN_DIR="${LOG_ROOT}/${RUN_ID}"

DURATION_SECONDS="${DURATION_SECONDS:-1800}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-30}"
AGENT_BASE_URL="${AGENT_BASE_URL:-http://127.0.0.1:3001}"

mkdir -p "${RUN_DIR}"
CSV_FILE="${RUN_DIR}/gnss-soak.csv"
SUMMARY_FILE="${RUN_DIR}/summary.txt"

echo "timestamp,phase,post_status,risk_status,risk_score,profile_mode,anomaly_count,anomaly_kinds" > "${CSV_FILE}"

echo "GNSS live soak run: ${RUN_ID}" | tee "${SUMMARY_FILE}"
echo "Duration: ${DURATION_SECONDS}s | Interval: ${INTERVAL_SECONDS}s" | tee -a "${SUMMARY_FILE}"
echo "Agent base: ${AGENT_BASE_URL}" | tee -a "${SUMMARY_FILE}"
echo "Logs: ${RUN_DIR}" | tee -a "${SUMMARY_FILE}"

HEALTH_OK=0
for _ in {1..40}; do
  HC="$(curl -s -o /dev/null -w "%{http_code}" "${AGENT_BASE_URL}/api/health" || echo "000")"
  if [[ "${HC}" == "200" ]]; then
    HEALTH_OK=1
    break
  fi
  sleep 0.5
done

if [[ "${HEALTH_OK}" -ne 1 ]]; then
  echo "Agent health check did not become ready before soak start." | tee -a "${SUMMARY_FILE}"
  exit 1
fi

START_TS="$(date +%s)"
END_TS=$((START_TS + DURATION_SECONDS))
ITER=0

phase_for_minute() {
  local m="$1"
  local p=$((m % 10))
  if [[ "$p" -le 4 ]]; then
    echo "anchor-benign"
  elif [[ "$p" -le 8 ]]; then
    echo "underway-benign"
  else
    echo "underway-anomaly"
  fi
}

while [[ "$(date +%s)" -lt "${END_TS}" ]]; do
  NOW_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  ELAPSED=$(( $(date +%s) - START_TS ))
  MINUTE=$(( ELAPSED / 60 ))
  PHASE="$(phase_for_minute "${MINUTE}")"

  if [[ "${PHASE}" == "anchor-benign" ]]; then
    LAT="$(awk -v i="${ITER}" 'BEGIN { printf "%.6f", 25.000000 + sin(i/3.0)/4500.0 }')"
    LON="$(awk -v i="${ITER}" 'BEGIN { printf "%.6f", -80.000000 + cos(i/4.0)/5000.0 }')"
    SOG="$(awk -v i="${ITER}" 'BEGIN { printf "%.2f", 0.6 + (i % 4)*0.15 }')"
    COG=$(( (30 + (ITER * 3)) % 360 ))
    SAT=$((8 + (ITER % 3)))
  elif [[ "${PHASE}" == "underway-benign" ]]; then
    LAT="$(awk -v i="${ITER}" 'BEGIN { printf "%.6f", 25.100000 + i*0.0011 }')"
    LON="$(awk -v i="${ITER}" 'BEGIN { printf "%.6f", -80.100000 + i*0.0008 }')"
    SOG="$(awk -v i="${ITER}" 'BEGIN { printf "%.2f", 16.0 + (i % 3)*0.7 }')"
    COG=$(( (90 + (ITER % 5)) % 360 ))
    SAT=$((9 + (ITER % 2)))
  else
    if (( ITER % 2 == 0 )); then
      LAT="25.220000"
      LON="-80.220000"
      SOG="17.20"
      COG="92"
      SAT="10"
    else
      LAT="25.590000"
      LON="-80.730000"
      SOG="0.90"
      COG="132"
      SAT="2"
    fi
  fi

  POST_STATUS="$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${AGENT_BASE_URL}/api/maritime/gnss-sample" \
    -H 'Content-Type: application/json' \
    --data "{\"lat\":${LAT},\"lon\":${LON},\"sogKnots\":${SOG},\"cogDeg\":${COG},\"satelliteCount\":${SAT},\"source\":\"live-soak\",\"timestamp\":\"${NOW_ISO}\"}" \
    || echo "000")"

  RISK_TMP="${RUN_DIR}/risk-${ITER}.json"
  RISK_STATUS="$(curl -s -o "${RISK_TMP}" -w "%{http_code}" "${AGENT_BASE_URL}/api/maritime/risk?refresh=1" || echo "000")"

  read -r RISK_SCORE PROFILE_MODE ANOMALY_COUNT ANOMALY_KINDS <<EOF
$(node - <<'NODE' "${RISK_TMP}"
const fs = require('fs');
const path = process.argv[2];
let d = {};
try { d = JSON.parse(fs.readFileSync(path, 'utf8')); } catch {}
const score = d?.riskScore ?? -1;
const mode = d?.gnss?.profileMode ?? 'unknown';
const anomalies = Array.isArray(d?.gnss?.anomalies) ? d.gnss.anomalies : [];
const byKind = anomalies.reduce((m, a) => {
  m[a.kind] = (m[a.kind] || 0) + 1;
  return m;
}, {});
const kinds = Object.keys(byKind).length === 0
  ? 'none'
  : Object.entries(byKind).map(([k, v]) => `${k}:${v}`).join('|');
console.log(`${score} ${mode} ${anomalies.length} ${kinds}`);
NODE
)
EOF

  echo "${NOW_ISO},${PHASE},${POST_STATUS},${RISK_STATUS},${RISK_SCORE},${PROFILE_MODE},${ANOMALY_COUNT},${ANOMALY_KINDS}" >> "${CSV_FILE}"

  ITER=$((ITER + 1))
  sleep "${INTERVAL_SECONDS}"
done

SAMPLES="$(($(wc -l < "${CSV_FILE}") - 1))"
POST_FAILS="$(awk -F, 'NR>1 && $3 != 201 {c++} END {print c+0}' "${CSV_FILE}")"
RISK_FAILS="$(awk -F, 'NR>1 && $4 != 200 {c++} END {print c+0}' "${CSV_FILE}")"
ANOMALY_SAMPLES="$(awk -F, 'NR>1 && $7 > 0 {c++} END {print c+0}' "${CSV_FILE}")"

{
  echo ""
  echo "Samples: ${SAMPLES}"
  echo "POST failures: ${POST_FAILS}"
  echo "Risk endpoint failures: ${RISK_FAILS}"
  echo "Samples with anomalies: ${ANOMALY_SAMPLES}"
  echo "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} | tee -a "${SUMMARY_FILE}"

echo "Soak complete. Summary: ${SUMMARY_FILE}"
