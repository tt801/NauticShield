# Week 1-2 Device Discovery Sprint

**Goal**: Reliable device discovery and classification for common superyacht tech stack (Ubiquiti routers, Axis/Hikvision cameras, navigation systems, crew devices).

**Success Criteria**:
- Agent scans a test network and correctly identifies 90%+ of known device types
- Unknown devices are detected and alertable
- Device blocking works end-to-end at router level
- Agent runs stable for 24+ hours without crashes

---

## Week 1: Scanner Enhancements

### Task 1.1: Expand OUI Database

**File**: `agent/src/scanner.ts`

Add manufacturer detection for baseline tech stack:

```typescript
const OUI_MAP: Record<string, string> = {
  // Existing
  'A4:C3:F0': 'Apple',      'B8:27:EB': 'Raspberry Pi',
  'E0:65:31': 'Samsung',    'F6:91:3D': 'LG',
  
  // ROUTERS & ACCESS POINTS (Ubiquiti, Cisco, etc.)
  'B0:BE:76': 'Ubiquiti',   '78:8A:20': 'Ubiquiti',      '24:A4:3C': 'Ubiquiti',
  '04:18:D6': 'Cisco',      '00:1A:8E': 'Cisco',
  'D8:84:6F': 'TP-Link',    '98:DE:D0': 'TP-Link',
  '5C:95:AE': 'Netgear',    'E0:55:3D': 'Netgear',
  
  // CAMERAS (Axis, Hikvision, Avigilon, Bosch)
  '00:40:8C': 'Axis',       'AC:CC:8E': 'Axis',
  '00:0A:95': 'Hikvision',  'AC:E2:D3': 'Hikvision',
  '90:A2:DA': 'Avigilon',
  '00:1A:80': 'Bosch',
  
  // NAVIGATION/MARINE (Furuno, Navico, Simrad)
  '00:0C:F3': 'Furuno',     '00:0A:72': 'Navico',        '00:1D:F7': 'Simrad',
  
  // PRINTERS & OFFICE
  '08:00:69': 'Xerox',      'B0:5A:DA': 'HP',            '44:65:0D': 'Brother',
  
  // SWITCHES & MANAGED NETWORK
  '00:11:88': 'Extreme',    '00:1A:A2': 'Arista',
  
  // MEDIA & AV
  '00:04:20': 'Denon',      'B0:68:E6': 'Yamaha',
  '1C:BD:B9': 'Sonos',      'AA:BB:CC': 'Apple TV',
  
  // GUEST DEVICES (Common phones)
  '00:19:E0': 'HTC',        '00:1B:63': 'Nokia',         '00:21:47': 'BlackBerry',
};
```

**Validation**: Create a test with sample MAC addresses from each category.

---

### Task 1.2: Enhance Device Type Guessing

**File**: `agent/src/types.ts`

Extend DeviceType to support maritime baseline:

```typescript
export type DeviceType = 
  // Network gear
  | 'router' 
  | 'access-point' 
  | 'switch'
  | 'firewall'
  
  // Cameras & CCTV
  | 'camera'           // IP camera
  | 'nvr'              // Network video recorder
  
  // Navigation/OT
  | 'chart-plotter'    // ECDIS or similar
  | 'radar'
  | 'ais-receiver'
  | 'engine-monitor'
  | 'autopilot'
  
  // AV / Control
  | 'av-control'       // Crestron, Savant, Control4
  | 'av-receiver'      // Denon, Yamaha
  | 'tv'
  | 'projector'
  | 'speaker'
  
  // Crew/Guest IT
  | 'phone'
  | 'tablet'
  | 'laptop'
  | 'desktop'
  
  // Other
  | 'printer'
  | 'nas'              // Network-attached storage
  | 'server'
  | 'unknown';
```

---

### Task 1.3: Implement Port-Based Classification

**File**: `agent/src/scanner.ts` → new function `classifyByPorts()`

Add port scanning to refine device type:

```typescript
async function classifyByPorts(ip: string, mac: string): Promise<DeviceType> {
  // Quick classification based on common service ports
  const commonPorts = [
    { port: 80,   type: 'camera' as const },      // HTTP web UI
    { port: 443,  type: 'camera' as const },      // HTTPS
    { port: 554,  type: 'camera' as const },      // RTSP (video streaming)
    { port: 5000, type: 'av-control' as const },  // Crestron DM
    { port: 5353, type: 'av-receiver' as const }, // Bonjour (AV devices)
    { port: 139,  type: 'laptop' as const },      // SMB (Windows shares)
    { port: 445,  type: 'laptop' as const },      // SMB modern
    { port: 22,   type: 'server' as const },      // SSH
  ];
  
  for (const { port, type } of commonPorts) {
    if (await isPortOpen(ip, port)) {
      return type;
    }
  }
  
  return guessDeviceType(mac);
}

async function isPortOpen(ip: string, port: number, timeoutMs = 500): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    
    socket.connect(port, ip, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}
```

---

### Task 1.4: Add mDNS Probing (Optional, Priority 2)

**File**: `agent/src/scanner.ts` → new function `classifyByMdns()`

Detect device names via mDNS (helps identify cameras, AV systems):

```typescript
// Uses mdns library or simple UDP broadcast for device name discovery
// Fallback: skip if no mDNS library available
```

---

## Week 2: Device Blocking & Refinement

### Task 2.1: Implement Device Blocking at Router

**File**: `agent/src/routerController.ts`

Extend to support block/unblock operations:

```typescript
export async function blockDevice(mac: string): Promise<boolean> {
  // Build iptables rule to drop traffic from this MAC
  const rule = `iptables -I FORWARD -m mac --mac-source ${mac} -j DROP`;
  return await executeSSHCommand(rule);
}

export async function unblockDevice(mac: string): Promise<boolean> {
  // Remove the block rule
  const rule = `iptables -D FORWARD -m mac --mac-source ${mac} -j DROP`;
  return await executeSSHCommand(rule);
}

export async function isDeviceBlocked(mac: string): Promise<boolean> {
  // Check if MAC is in current iptables rules
  const result = await executeSSHCommand('iptables -L FORWARD | grep ${mac}');
  return result.exitCode === 0;
}
```

---

### Task 2.2: Persist Block/Unblock State

**File**: `agent/src/db.ts`

Add device block state to database:

```typescript
export interface DeviceBlockState {
  mac: string;
  blocked: boolean;
  blockedAt?: string;
  reason?: string;
}

export function setDeviceBlocked(mac: string, blocked: boolean, reason?: string): void {
  // Store in DB, sync to router
}

export function getDeviceBlockState(mac: string): DeviceBlockState | null {
  // Retrieve from DB
}
```

---

### Task 2.3: Create Device Classification Tests

**File**: `agent/src/__tests__/scanner.test.ts` (new)

Test OUI lookup and device classification:

```typescript
import { guessDeviceType, getManufacturer } from '../scanner';

describe('Device Classification', () => {
  it('classifies Ubiquiti MAC as router', () => {
    expect(guessDeviceType('B0:BE:76:AA:BB:CC')).toBe('router');
  });
  
  it('classifies Axis MAC as camera', () => {
    expect(guessDeviceType('00:40:8C:AA:BB:CC')).toBe('camera');
  });
  
  it('classifies Hikvision MAC as camera', () => {
    expect(guessDeviceType('00:0A:95:AA:BB:CC')).toBe('camera');
  });
  
  it('falls back to unknown for unrecognized MAC', () => {
    expect(guessDeviceType('FF:FF:FF:AA:BB:CC')).toBe('unknown');
  });
});
```

---

### Task 2.4: Update API Endpoints for Block/Unblock

**File**: `agent/src/routes/devices.ts` (new)

Add endpoints:

```typescript
app.post('/api/devices/:mac/block', async (req, res) => {
  const { mac } = req.params;
  try {
    const success = await blockDevice(mac);
    if (success) {
      db.setDeviceBlocked(mac, true, req.body.reason);
      broadcaster.broadcast({ 
        type: 'device:update', 
        data: { mac, blocked: true } 
      });
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to block device at router' });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/devices/:mac/unblock', async (req, res) => {
  const { mac } = req.params;
  try {
    const success = await unblockDevice(mac);
    if (success) {
      db.setDeviceBlocked(mac, false);
      broadcaster.broadcast({ 
        type: 'device:update', 
        data: { mac, blocked: false } 
      });
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to unblock device at router' });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
```

---

### Task 2.5: Update Frontend for Device Blocking

**File**: `src/pages/Devices.tsx`

Add block/unblock buttons:

```typescript
// In DeviceListItem component:
<button 
  onClick={() => handleBlockDevice(device.mac, true)}
  disabled={device.blocked}
>
  {device.blocked ? '🚫 Blocked' : 'Block Device'}
</button>

<button 
  onClick={() => handleBlockDevice(device.mac, false)}
  disabled={!device.blocked}
>
  ✅ Unblock
</button>
```

---

### Task 2.6: Stability Testing (48-hour runtime)

**Acceptance Criteria**:
- Agent runs for 48 hours without crash
- Scanner cycles every 30 seconds without memory leak
- WebSocket connections stay alive
- Alerts are fired correctly for new/offline devices
- Device blocking persists across agent restart

---

## Success Metrics

| Metric | Target | By End of Week |
|--------|--------|---|
| Device discovery accuracy | 90%+ correct type | ✓ |
| False positive unknown alerts | <5% | ✓ |
| Block/unblock latency | <5 seconds | ✓ |
| Agent uptime | >99.5% (48-hour test) | ✓ |
| Supported device types | 15+ types | ✓ |
| OUI database coverage | 25+ manufacturers | ✓ |

---

## Testing Checklist

- [ ] Run scanner against test network with known devices
- [ ] Verify each device type is correctly classified
- [ ] Test block/unblock on live Ubiquiti router
- [ ] Verify alerts fire for new unknown devices
- [ ] Verify alerts clear when device is labeled
- [ ] Run 48-hour stability test with continuous scanning
- [ ] Test WebSocket push updates for device changes
- [ ] Verify frontend shows block/unblock status
- [ ] Test all routes with cURL/Postman before UI integration

---

## Rollout Plan

After Week 1-2 passes:
1. Deploy agent to test environment (Raspberry Pi on home network)
2. Run for 72 hours, collect logs
3. If stable, ready for pilot boat deployment
4. Week 3 starts device isolation workflows (next phase)
