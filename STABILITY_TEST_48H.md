# 48-Hour Stability Test (Local Pilot Harness)

## Goal
Validate the NauticShield local stack for 48 hours with repeatable evidence before pilot deployment.

## What This Covers
- Frontend uptime on 127.0.0.1:5173
- Agent health and snapshot endpoint uptime on 127.0.0.1:3000
- Basic runtime resource trend (aggregate Node RSS)
- Manual checks for block/unblock persistence and reconnection behavior

## 1. Start Local Stack
From project root:

```bash
bash scripts/stability/start-local-stack.sh
```

Optional scanner subnet controls (set before starting agent):

```bash
export SCAN_SUBNET_MODE=auto          # auto | fixed | all
export SUBNET=192.168.0               # used when fixed, or preferred in auto
export SCAN_ALLOWED_SUBNETS=192.168.0,192.168.1
export SUBNET_MISS_WARN_CYCLES=3      # warn if SUBNET not seen in ARP for N cycles
```

Quick checks:

```bash
curl -s http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:5173/
```

## 2. Run 48-Hour Monitor

```bash
bash scripts/stability/monitor.sh
```

Optional shorter dry run:

```bash
DURATION_SECONDS=600 INTERVAL_SECONDS=15 bash scripts/stability/monitor.sh
```

Outputs are created under `stability-logs/<timestamp>/`:
- `checks.csv`
- `summary.txt`

## 3. Manual Checks During Run
Perform these at least 3 times during the 48h window:

1. Block/unblock 3 different devices from the Devices page.
2. Restart agent process once and confirm block state remains visible.
3. Disconnect/reconnect browser and verify WS updates resume.
4. Confirm no repeated fetch errors in browser console for routine actions.
5. Verify the Devices header status chip reflects `Agent Online`, `Connecting`, and `Agent Offline` correctly.
6. Verify block feedback UX:
	- Block action shows red status message.
	- Unblock action shows green status message.
	- Message can be dismissed manually.
7. Verify controls are disabled when agent is offline and enabled again on reconnect.
8. Verify unknown-device alert behavior:
	- First unknown alert is critical.
	- Repeat unknown alerts are throttled within cooldown window.
	- Unknown-device aggregate spike warning appears when threshold is met.
9. Verify port/mDNS enrichment:
	- Unknown devices gain improved names/types where possible.
	- Scanner cycle still completes within normal interval.
10. Verify subnet selection behavior:
	- In `auto` mode, scanner logs show the active /24 that matches current ARP activity.
	- In `fixed` mode, scanner only processes the configured subnet.
	- In `all` mode (optionally limited by `SCAN_ALLOWED_SUBNETS`), scanner processes all discovered/allowed subnets.

## 4. Pass Criteria
- Frontend non-200 responses: 0 (or explain transient maintenance events)
- Agent health non-200 responses: 0
- Agent snapshot non-200 responses: <= 1 transient allowed
- No unhandled crashes in frontend or agent logs
- Block/unblock actions remain functional after one agent restart
- WebSocket reconnects use backoff behavior (no rapid reconnect storm)
- Device controls correctly disable/enable with connection state
- Toast/banner feedback visible for block/unblock actions
- Scanner subnet mode behaves as configured (auto/fixed/all)

## 5. Development Progress Included In This Test
The current test run includes these recently completed changes:
1. Port-based unknown-device classification (Task 1.3)
2. Hostname enrichment with mDNS + reverse DNS fallback (Task 1.4)
3. Unknown/offline alert dedupe and severity tuning
4. Devices page lock/unlock UX hardening and feedback messages
5. WebSocket reconnect backoff/jitter and connection-state chip

## 6. Full-Day Validation Plan (Wed or Thu)
Use this if you want a focused single-day validation sprint before pilot rollout.

### 09:00-10:00: Environment Bring-up
1. Start frontend + agent + monitor.
2. Confirm health endpoints and initial scanner cycle.
3. Confirm Devices page shows live agent status.

### 10:00-12:00: Device Control + UX Validation
1. Run lock/unlock loops on at least 5 devices.
2. Validate blocked state badges and row toggle behavior.
3. Confirm feedback messages for success/failure and offline guard.

### 13:00-15:00: Resilience + Reconnect Validation
1. Restart agent process and verify state recovery.
2. Simulate browser reconnect and temporary network interruption.
3. Confirm websocket reconnect backoff behavior in logs.

### 15:00-17:00: Alerts + Classification Validation
1. Validate unknown-device alerts follow cooldown/severity rules.
2. Validate offline alert reopen cooldown.
3. Review device naming/type enrichment quality.

### 17:00-18:00: Go/No-Go Summary
1. Extract pass/fail from `summary.txt` and logs.
2. Record issues with severity and owner.
3. Decide pilot readiness for first two boats.

## 7. Subnet Mode Evidence (2026-05-11)
Controlled comparison runs were executed locally on port 3000 with identical allowed subnets.

### Run A: fixed mode
Environment:

```bash
SCAN_SUBNET_MODE=fixed
SUBNET=192.168.0
SCAN_ALLOWED_SUBNETS=192.168.0,192.168.1
```

Observed logs:
- `Scan mode: fixed   Subnet override: 192.168.0.0/24   Allowed: 192.168.0, 192.168.1`
- `[Scanner] Scanning network (mode=fixed, subnet=192.168.0.0/24)…`
- `[Scanner] ARP entries (raw): 7`
- `[Scanner] Active subnet: 192.168.0.0/24 (7 entries)`
- `[Monitor] Subnet in use: 192.168.0.0/24`

Result: fixed mode correctly constrained scanning to configured subnet.

### Run B: all mode
Environment:

```bash
SCAN_SUBNET_MODE=all
SCAN_ALLOWED_SUBNETS=192.168.0,192.168.1
```

Observed logs:
- `Scan mode: all   Allowed: 192.168.0, 192.168.1`
- `[Scanner] Scanning network (mode=all)…`
- `[Scanner] ARP entries (raw): 7`
- `[Scanner] Active subnet: all discovered (7 entries)`

Result: all mode correctly processed discovered/allowed subnet scope.

### Recommendation for Pilot Default
- Default to `SCAN_SUBNET_MODE=auto` with `SCAN_ALLOWED_SUBNETS=192.168.0,192.168.1`.
- Set `SUBNET` only when vessel LAN is known and stable.
- Use `fixed` mode for troubleshooting or controlled dockside tests.

### Run C: forced misconfiguration warning check
Environment:

```bash
SCAN_SUBNET_MODE=fixed
SUBNET=192.168.99
SUBNET_MISS_WARN_CYCLES=1
```

Observed logs:
- `Scan mode: fixed   Subnet override: 192.168.99.0/24`
- `Subnet miss warning: 1 cycle(s)`
- `[Scanner] Active subnet: 192.168.99.0/24 (0 entries)`
- `[Monitor] Configured subnet 192.168.99.0/24 has not appeared in ARP for 1 consecutive cycle(s). Check vessel LAN segment or adjust SUBNET/SCAN_SUBNET_MODE.`

Result: warning path is functioning and provides actionable guidance when `SUBNET` is misconfigured.
