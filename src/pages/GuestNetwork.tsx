import { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldX,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Smartphone,
  Laptop,
  Tv,
  Camera,
  Router,
  HelpCircle,
  Gauge,
  Eye,
  EyeOff,
  Globe,
  Zap,
  BarChart2,
} from 'lucide-react';
import type { Device, DeviceType } from '@/data/mock';
import { useVesselData } from '@/context/VesselDataProvider';

// ── Helpers ───────────────────────────────────────────────────────

const typeIcons: Record<DeviceType, React.ElementType> = {
  phone:   Smartphone,
  laptop:  Laptop,
  tv:      Tv,
  camera:  Camera,
  router:  Router,
  unknown: HelpCircle,
};

type DeviceAccess = 'approved' | 'blocked' | 'pending';

interface BandwidthLimit { label: string; value: string }
const bwOptions: BandwidthLimit[] = [
  { label: 'Unlimited',  value: 'unlimited' },
  { label: '50 Mbps',    value: '50'        },
  { label: '25 Mbps',    value: '25'        },
  { label: '10 Mbps',    value: '10'        },
  { label: '5 Mbps',     value: '5'         },
];

// Guest device filtering happens inside the component (based on live device types)

// Mock per-device data usage (GB this session)
const MOCK_USAGE: Record<string, number> = {
  'd-1': 1.2, 'd-2': 3.8, 'd-3': 0.4, 'd-4': 0.1, 'd-5': 2.1,
  'd-6': 0.0, 'd-7': 5.4, 'd-8': 0.2, 'd-9': 1.1, 'd-10': 0.6,
  'd-11': 0.0, 'd-12': 3.2,
};
const MAX_USAGE = 6; // GB cap for bar display

// ── Card shell ────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 14, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ── Device row ────────────────────────────────────────────────────

function GuestDeviceRow({
  device,
  access,
  bandwidth,
  onApprove,
  onBlock,
  onBandwidth,
}: {
  device: Device;
  access: DeviceAccess;
  bandwidth: string;
  onApprove: () => void;
  onBlock:   () => void;
  onBandwidth: (v: string) => void;
}) {
  const Icon      = typeIcons[device.type as DeviceType];
  const isUnknown = device.type === 'unknown';

  const accessStyle: Record<DeviceAccess, { color: string; bg: string; border: string; label: string }> = {
    approved: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',   label: 'Approved' },
    blocked:  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   label: 'Blocked'  },
    pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)',  label: 'Pending'  },
  };
  const ac = accessStyle[access];

  const usage = MOCK_USAGE[device.id] ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: '#0a0f18',
      border: `1px solid ${isUnknown && access === 'pending' ? 'rgba(245,158,11,0.3)' : access === 'blocked' ? 'rgba(239,68,68,0.2)' : '#1a2535'}`,
      borderRadius: 12, padding: '12px 16px',
    }}>
      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUnknown ? 'rgba(245,158,11,0.1)' : 'rgba(14,165,233,0.08)',
      }}>
        <Icon size={16} color={isUnknown ? '#f59e0b' : '#0ea5e9'} />
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {device.name}
          </span>
          {isUnknown && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
              <AlertTriangle size={10} /> Unknown
            </span>
          )}
        </div>
        <div style={{ color: '#6b7f92', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>{device.mac}</div>
      </div>

      {/* Bandwidth selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <Gauge size={13} color="#4a5a6a" />
        <select
          value={bandwidth}
          onChange={e => onBandwidth(e.target.value)}
          disabled={access === 'blocked'}
          style={{
            background: '#0d1421', color: access === 'blocked' ? '#3a4a5a' : '#8899aa',
            border: '1px solid #1a2535', borderRadius: 6, padding: '4px 8px', fontSize: 12,
            cursor: access === 'blocked' ? 'default' : 'pointer', outline: 'none',
          }}
        >
          {bwOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Status badge */}
      <span style={{ background: ac.bg, color: ac.color, border: `1px solid ${ac.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
        {ac.label}
      </span>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onApprove}
          disabled={access === 'approved'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: 'none', cursor: access === 'approved' ? 'default' : 'pointer',
            background: access === 'approved' ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.15)',
            color: access === 'approved' ? '#22c55e99' : '#22c55e',
          }}
        >
          <Unlock size={12} /> Approve
        </button>
        <button
          onClick={onBlock}
          disabled={access === 'blocked'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: 'none', cursor: access === 'blocked' ? 'default' : 'pointer',
            background: access === 'blocked' ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.15)',
            color: access === 'blocked' ? '#ef444499' : '#ef4444',
          }}
        >
          <Lock size={12} /> Block
        </button>
      </div>
    </div>
    {/* Data usage bar */}
    {access !== 'blocked' && usage > 0 && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px 8px', background: '#0a0f18', borderRadius: '0 0 12px 12px', borderTop: '1px solid #0d1421' }}>
        <BarChart2 size={11} color="#4a5a6a" />
        <div style={{ flex: 1, height: 4, background: '#1a2535', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (usage / MAX_USAGE) * 100)}%`, height: '100%', background: usage > 4 ? '#f59e0b' : '#0ea5e9', borderRadius: 2, transition: 'width 0.4s' }} />
        </div>
        <span style={{ color: '#4a5a6a', fontSize: 10, fontFamily: 'monospace', flexShrink: 0 }}>{usage.toFixed(1)} GB</span>
      </div>
    )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function GuestNetwork() {
  const { devices } = useVesselData();
  const guestDevices = useMemo(
    () => devices.filter(d => d.type === 'phone' || d.type === 'laptop' || d.type === 'unknown'),
    [devices]
  );

  // Initial state: unknown devices = pending, known = approved
  const [accessMap, setAccessMap] = useState<Record<string, DeviceAccess>>({});
  const [bwMap,     setBwMap]     = useState<Record<string, string>>({});

  // Sync new guest devices into maps as they appear
  useEffect(() => {
    setAccessMap(m => {
      const next = { ...m };
      guestDevices.forEach(d => { if (!(d.id in next)) next[d.id] = d.type === 'unknown' ? 'pending' : 'approved'; });
      return next;
    });
    setBwMap(m => {
      const next = { ...m };
      guestDevices.forEach(d => { if (!(d.id in next)) next[d.id] = 'unlimited'; });
      return next;
    });
  }, [guestDevices]);

  const setAccess = (id: string, v: DeviceAccess) => setAccessMap(m => ({ ...m, [id]: v }));
  const setBw     = (id: string, v: string)        => setBwMap(m => ({ ...m, [id]: v }));

  const [wifiEnabled,   setWifiEnabled]   = useState(true);
  const [portalEnabled, setPortalEnabled] = useState(true);
  const [ssid,          setSsid]          = useState('Aurora Guest');
  const [showPass,      setShowPass]      = useState(false);
  const [wifiPass,      setWifiPass]      = useState('Yacht2026!');
  const [splashType,    setSplashType]    = useState<'tos' | 'click' | 'none'>('tos');
  const [speedRunning,  setSpeedRunning]  = useState(false);
  const [speedResult,   setSpeedResult]   = useState<{dl: number; ul: number; ping: number} | null>(null);

  function runSpeedTest() {
    setSpeedRunning(true);
    setSpeedResult(null);
    setTimeout(() => {
      setSpeedResult({ dl: 47 + Math.random() * 15, ul: 18 + Math.random() * 8, ping: 28 + Math.random() * 20 });
      setSpeedRunning(false);
    }, 2400);
  }

  const approved = guestDevices.filter(d => accessMap[d.id] === 'approved').length;
  const blocked  = guestDevices.filter(d => accessMap[d.id] === 'blocked').length;
  const pending  = guestDevices.filter(d => accessMap[d.id] === 'pending').length;
  const unknown  = guestDevices.filter(d => d.type === 'unknown').length;

  function blockAllUnknown() {
    setAccessMap(m => {
      const next = { ...m };
      guestDevices.filter(d => d.type === 'unknown').forEach(d => { next[d.id] = 'blocked'; });
      return next;
    });
  }

  function approveAll() {
    setAccessMap(m => {
      const next = { ...m };
      guestDevices.forEach(d => { next[d.id] = 'approved'; });
      return next;
    });
  }

  return (
    <div style={{ padding: 28, maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Guest Network</div>
          <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
            Control which devices can access the internet and set speed limits
          </div>
        </div>
        {pending > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600 }}>
            <AlertTriangle size={13} />
            {pending} device{pending > 1 ? 's' : ''} awaiting review
          </div>
        )}
      </div>

      {/* Network master switch */}
      <Card style={{ borderLeft: `4px solid ${wifiEnabled ? '#22c55e' : '#ef4444'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: wifiEnabled ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', borderRadius: 12, padding: 12 }}>
              <Wifi size={22} color={wifiEnabled ? '#22c55e' : '#ef4444'} />
            </div>
            <div>
              <div style={{ color: '#f0f4f8', fontSize: 15, fontWeight: 700 }}>Guest Wi-Fi Network</div>
              <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 2 }}>
                {wifiEnabled ? 'Active — guests can connect' : 'Disabled — no guest access'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setWifiEnabled(v => !v)}
            style={{
              padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: wifiEnabled ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
              color: wifiEnabled ? '#ef4444' : '#22c55e',
            }}
          >
            {wifiEnabled ? 'Disable Network' : 'Enable Network'}
          </button>
        </div>
      </Card>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Total Devices',   value: guestDevices.length, color: '#0ea5e9'  },
          { label: 'Approved',        value: approved,            color: '#22c55e'  },
          { label: 'Blocked',         value: blocked,             color: '#ef4444'  },
          { label: 'Pending Review',  value: pending,             color: '#f59e0b'  },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardLabel>{label}</CardLabel>
            <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
          </Card>
        ))}
      </div>

      {/* Captive Portal Settings */}
      <Card style={{ borderLeft: `4px solid ${portalEnabled ? '#8b5cf6' : '#1a2535'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: portalEnabled ? 16 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: portalEnabled ? 'rgba(139,92,246,0.12)' : 'rgba(26,37,53,0.5)', borderRadius: 12, padding: 12 }}>
              <Globe size={20} color={portalEnabled ? '#8b5cf6' : '#4a5a6a'} />
            </div>
            <div>
              <div style={{ color: '#f0f4f8', fontSize: 15, fontWeight: 700 }}>Captive Portal</div>
              <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 2 }}>
                {portalEnabled ? 'Guests see a splash page before internet access' : 'Disabled — guests connect directly'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setPortalEnabled(v => !v)}
            style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', background: portalEnabled ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}
          >
            {portalEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        {portalEnabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* SSID */}
            <div>
              <div style={{ color: '#6b7f92', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>SSID (Network Name)</div>
              <input
                value={ssid}
                onChange={e => setSsid(e.target.value)}
                style={{ width: '100%', background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 8, color: '#f0f4f8', fontSize: 13, padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {/* Password */}
            <div>
              <div style={{ color: '#6b7f92', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Wi-Fi Password</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={wifiPass}
                  onChange={e => setWifiPass(e.target.value)}
                  style={{ flex: 1, background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 8, color: '#f0f4f8', fontSize: 13, padding: '8px 12px', outline: 'none' }}
                />
                <button onClick={() => setShowPass(v => !v)} style={{ background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#6b7f92', display: 'flex', alignItems: 'center' }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {/* Splash type */}
            <div>
              <div style={{ color: '#6b7f92', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Splash Page Type</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([['tos','Accept T&Cs'],['click','Click-through'],['none','No Page']] as const).map(([v, lbl]) => (
                  <button
                    key={v}
                    onClick={() => setSplashType(v)}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      border: '1px solid', cursor: 'pointer',
                      background: splashType === v ? 'rgba(139,92,246,0.15)' : '#0a0f18',
                      color: splashType === v ? '#8b5cf6' : '#6b7f92',
                      borderColor: splashType === v ? 'rgba(139,92,246,0.4)' : '#1a2535',
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Speed Test */}
      <Card style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={16} color="#0ea5e9" />
            <div>
              <div style={{ color: '#f0f4f8', fontSize: 14, fontWeight: 700 }}>Network Speed Test</div>
              <div style={{ color: '#6b7f92', fontSize: 12 }}>Run a quick speed test on the guest network</div>
            </div>
          </div>
          <button
            onClick={runSpeedTest}
            disabled={speedRunning}
            style={{ padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: speedRunning ? 'default' : 'pointer', background: speedRunning ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.15)', color: speedRunning ? '#0ea5e977' : '#0ea5e9' }}
          >
            {speedRunning ? 'Testing…' : 'Run Test'}
          </button>
        </div>
        {speedResult && !speedRunning && (
          <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
            {[
              { label: 'Download', value: `${speedResult.dl.toFixed(1)} Mbps`, color: '#22c55e' },
              { label: 'Upload',   value: `${speedResult.ul.toFixed(1)} Mbps`, color: '#0ea5e9' },
              { label: 'Ping',     value: `${speedResult.ping.toFixed(0)} ms`,  color: '#f59e0b' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ color: '#6b7f92', fontSize: 11, marginBottom: 4 }}>{label}</div>
                <div style={{ color, fontSize: 18, fontWeight: 800 }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Bulk actions */}
      <Card style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#6b7f92', fontSize: 13, fontWeight: 500 }}>Bulk actions:</span>
          {unknown > 0 && (
            <button
              onClick={blockAllUnknown}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
            >
              <ShieldX size={13} /> Block All Unknown Devices
            </button>
          )}
          <button
            onClick={approveAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}
          >
            <ShieldCheck size={13} /> Approve All Known Devices
          </button>
        </div>
      </Card>

      {/* Device list */}
      <Card>
        <CardLabel>{guestDevices.length} devices on guest network</CardLabel>
        {pending > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#f59e0b', fontSize: 13 }}>
            <AlertTriangle size={14} />
            {pending} unrecognised device{pending > 1 ? 's are' : ' is'} connected and awaiting your approval. Review carefully.
          </div>
        )}
        {all(accessMap) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#22c55e', fontSize: 13 }}>
            <CheckCircle2 size={14} /> All devices reviewed — network is secure.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Unknown / pending first */}
          {guestDevices
            .slice()
            .sort((a, b) => {
              const order = { pending: 0, blocked: 1, approved: 2 };
              return order[accessMap[a.id] ?? 'pending'] - order[accessMap[b.id] ?? 'pending'];
            })
            .map(d => (
              <GuestDeviceRow
                key={d.id}
                device={d}
                access={accessMap[d.id] ?? 'pending'}
                bandwidth={bwMap[d.id] ?? 'unlimited'}
                onApprove={() => setAccess(d.id, 'approved')}
                onBlock={() => setAccess(d.id, 'blocked')}
                onBandwidth={v => setBw(d.id, v)}
              />
            ))}
        </div>
      </Card>

    </div>
  );
}

function all(m: Record<string, DeviceAccess>) {
  return Object.values(m).every(v => v !== 'pending');
}
