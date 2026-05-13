import { Router } from 'express';
import * as db from '../db';
import { getScannerDiagnostics } from '../scannerDiagnostics';
import { setScannerDiagnostics } from '../scannerDiagnostics';
import { getScannerRuntimeConfig, updateScannerRuntimeConfig } from '../scannerRuntimeConfig';
import type { AuthedRequest } from '../auth';
import { broadcast } from '../broadcaster';

const router = Router();

router.get('/', (_req, res) => {
  const internetStatus = db.getInternetStatus();
  const networkHealth  = db.getNetworkHealth();
  const scannerDiagnostics = getScannerDiagnostics();
  res.json({ internetStatus, networkHealth, scannerDiagnostics });
});

router.post('/scanner-config', (req: AuthedRequest, res) => {
  const role = req.auth?.role ?? 'crew';
  if (!['owner', 'captain'].includes(role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { scanMode, subnet, allowedSubnets, warnAfterCycles } = req.body as {
    scanMode?: 'auto' | 'fixed' | 'all';
    subnet?: string;
    allowedSubnets?: string[] | string;
    warnAfterCycles?: number;
  };

  const next = updateScannerRuntimeConfig({
    scanMode,
    subnet,
    allowedSubnets: Array.isArray(allowedSubnets)
      ? allowedSubnets
      : typeof allowedSubnets === 'string'
        ? allowedSubnets.split(',').map(v => v.trim()).filter(Boolean)
        : undefined,
    warnAfterCycles,
  });

  const diagnostics = {
    ...getScannerDiagnostics(),
    scanMode: next.scanMode,
    configuredSubnet: next.subnet,
    allowedSubnets: next.allowedSubnets,
    warnAfterCycles: next.warnAfterCycles,
    configuredSubnetMissStreak: 0,
    lastWarning: undefined,
  };
  setScannerDiagnostics(diagnostics);

  const internetStatus = db.getInternetStatus();
  const networkHealth = db.getNetworkHealth();
  if (internetStatus && networkHealth) {
    broadcast({ type: 'status:update', data: { internetStatus, networkHealth, scannerDiagnostics: diagnostics } });
  }

  res.json({ success: true, scannerConfig: next, scannerDiagnostics: diagnostics });
});

router.get('/scanner-config', (_req, res) => {
  const scannerConfig = getScannerRuntimeConfig();
  res.json(scannerConfig);
});

export default router;
