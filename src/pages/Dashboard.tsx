import { networkStatus, devices, alerts } from '../data/mockData';

function InternetStatusCard() {
  const { internetStatus, downloadSpeed, uploadSpeed, latency, primaryConnection, backupConnection, backupStatus } = networkStatus;

  const statusConfig = {
    good: { label: 'Good', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-400' },
    slow: { label: 'Slow', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
    down: { label: 'Down', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-400' },
  };

  const cfg = statusConfig[internetStatus];

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Internet Status</h3>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${cfg.bg} ${cfg.border}`}>
          <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
          <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-2xl font-bold text-white">{downloadSpeed}</div>
          <div className="text-xs text-gray-500 mt-0.5">Mbps ↓ Down</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{uploadSpeed}</div>
          <div className="text-xs text-gray-500 mt-0.5">Mbps ↑ Up</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{latency}ms</div>
          <div className="text-xs text-gray-500 mt-0.5">Latency</div>
        </div>
      </div>
      <div className="pt-4 border-t border-gray-700 flex gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-gray-400">Primary: <span className="text-white font-medium">{primaryConnection}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-xs text-gray-400">Backup: <span className="text-gray-300 font-medium">{backupConnection} ({backupStatus})</span></span>
        </div>
      </div>
    </div>
  );
}

function HealthCard() {
  const score = networkStatus.healthScore;
  const color = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
  const trackColor = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Network Health</h3>
      <div className="flex items-end gap-3 mb-4">
        <div className={`text-5xl font-bold ${color}`}>{score}</div>
        <div className="text-2xl text-gray-500 mb-1">/ 100</div>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
        <div
          className={`h-2.5 rounded-full transition-all ${trackColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="text-xs text-gray-500">All critical navigation systems operational</div>
    </div>
  );
}

function AlertsSummaryCard() {
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const infoCount = alerts.filter(a => a.severity === 'info').length;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Alerts (Last 24h)</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="text-sm text-gray-300">Critical</span>
          </div>
          <span className="text-lg font-bold text-red-400">{criticalCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-sm text-gray-300">Warning</span>
          </div>
          <span className="text-lg font-bold text-amber-400">{warningCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-sm text-gray-300">Info</span>
          </div>
          <span className="text-lg font-bold text-blue-400">{infoCount}</span>
        </div>
      </div>
      <div className="pt-3 border-t border-gray-700 mt-3">
        <div className="text-xs text-gray-500">{alerts.length} total alerts in last 24 hours</div>
      </div>
    </div>
  );
}

function DeviceSummaryCard() {
  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const unknown = devices.filter(d => d.status === 'unknown').length;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Device Summary</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="text-sm text-gray-300">Online</span>
          </div>
          <span className="text-lg font-bold text-green-400">{online}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="text-sm text-gray-300">Offline</span>
          </div>
          <span className="text-lg font-bold text-red-400">{offline}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-sm text-gray-300">Unknown</span>
          </div>
          <span className="text-lg font-bold text-amber-400">{unknown}</span>
        </div>
      </div>
      <div className="pt-3 border-t border-gray-700 mt-3">
        <div className="text-xs text-gray-500">{devices.length} total devices registered</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Vessel network overview — real-time status</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InternetStatusCard />
        <HealthCard />
        <AlertsSummaryCard />
        <DeviceSummaryCard />
      </div>
    </div>
  );
}
