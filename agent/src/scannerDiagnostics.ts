export type ScanSubnetMode = 'auto' | 'fixed' | 'all';

export interface ScannerDiagnostics {
  scanMode: ScanSubnetMode;
  configuredSubnet?: string;
  allowedSubnets: string[];
  activeSubnet?: string;
  configuredSubnetSeen?: boolean;
  configuredSubnetMissStreak: number;
  warnAfterCycles: number;
  lastWarning?: string;
  lastUpdatedAt: string;
}

let scannerDiagnostics: ScannerDiagnostics = {
  scanMode: 'auto',
  allowedSubnets: [],
  configuredSubnetMissStreak: 0,
  warnAfterCycles: 3,
  lastUpdatedAt: new Date().toISOString(),
};

export function setScannerDiagnostics(patch: Partial<ScannerDiagnostics>) {
  scannerDiagnostics = {
    ...scannerDiagnostics,
    ...patch,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function getScannerDiagnostics(): ScannerDiagnostics {
  return { ...scannerDiagnostics };
}
