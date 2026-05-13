# Pilot Test Day Sign-Off

Date:
Owner:
Environment:

## 1. System Health
- Frontend reachable (127.0.0.1:5173): pass / fail
- Agent health reachable (127.0.0.1:3000/api/health): pass / fail
- Monitor run folder:

## 2. Core Functionality
- Device scan and inventory updates: pass / fail
- Block device action works: pass / fail
- Unblock device action works: pass / fail
- Blocked badge/row state updates correctly: pass / fail

## 3. UX Validation
- Block action message appears (red): pass / fail
- Unblock action message appears (green): pass / fail
- Offline guard disables controls when agent is offline: pass / fail
- Agent status chip reflects online/connecting/offline: pass / fail

## 4. Alerting Validation
- Unknown device first alert critical: pass / fail
- Unknown alert cooldown suppresses repeats: pass / fail
- Offline alert reopen cooldown works: pass / fail
- Unknown-device spike aggregate warning works: pass / fail

## 5. Resilience Validation
- Agent restart recovery: pass / fail
- Browser reconnect recovery: pass / fail
- WebSocket reconnect behavior acceptable: pass / fail

## 6. Performance Notes
- Avg block/unblock response time:
- Scanner cycle stability:
- Any memory/CPU concerns:

## 7. Defects Found
- Defect ID:
- Severity:
- Repro steps:
- Owner:
- Target fix date:

## 8. Go / No-Go
- Decision: GO / NO-GO
- Rationale:
- Required actions before pilot:
