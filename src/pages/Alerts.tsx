import { alerts } from '../data/mockData';
import SeverityBadge from '../components/SeverityBadge';
import type { AlertSeverity } from '../data/mockData';

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

function formatFullTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function alertBorderColor(severity: AlertSeverity): string {
  if (severity === 'critical') return 'border-l-red-500';
  if (severity === 'warning') return 'border-l-amber-500';
  return 'border-l-blue-500';
}

function alertBgColor(severity: AlertSeverity): string {
  if (severity === 'critical') return 'bg-red-500/5';
  if (severity === 'warning') return 'bg-amber-500/5';
  return 'bg-blue-500/5';
}

function alertIconColor(severity: AlertSeverity): string {
  if (severity === 'critical') return 'text-red-400';
  if (severity === 'warning') return 'text-amber-400';
  return 'text-blue-400';
}

function AlertIcon({ severity }: { severity: AlertSeverity }) {
  if (severity === 'critical') {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }
  if (severity === 'warning') {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function Alerts() {
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const infoCount = alerts.filter(a => a.severity === 'info').length;

  const sorted = [...alerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <p className="text-gray-400 text-sm mt-1">All vessel network alerts — last 24 hours</p>
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-sm text-red-400 font-medium">{criticalCount} Critical</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-sm text-amber-400 font-medium">{warningCount} Warning</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-sm text-blue-400 font-medium">{infoCount} Info</span>
        </div>
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {sorted.map(alert => (
          <div
            key={alert.id}
            className={`rounded-xl border border-gray-700 border-l-4 ${alertBorderColor(alert.severity)} ${alertBgColor(alert.severity)} p-5`}
          >
            <div className="flex items-start gap-4">
              <div className={`mt-0.5 flex-shrink-0 ${alertIconColor(alert.severity)}`}>
                <AlertIcon severity={alert.severity} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1.5">
                  <SeverityBadge severity={alert.severity} />
                  <h3 className="text-sm font-semibold text-gray-100">{alert.title}</h3>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{alert.description}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-xs font-medium text-gray-400">{formatTimestamp(alert.timestamp)}</div>
                <div className="text-xs text-gray-600 mt-0.5">{formatFullTimestamp(alert.timestamp)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
