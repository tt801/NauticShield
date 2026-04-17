import { Router } from 'express';
import * as db from '../db';
import { applyGuestNetworkSettings } from '../routerController';

const router = Router();

router.get('/', (_req, res) => {
  res.json(db.getGuestNetworkSettings());
});

router.put('/', (req, res) => {
  const saved = db.setGuestNetworkSettings(req.body ?? {});
  applyGuestNetworkSettings(saved, db.getDevices())
    .then(routerSync => res.json({ ...saved, routerSync }))
    .catch(error => res.json({
      ...saved,
      routerSync: {
        platform: process.env.ROUTER_PLATFORM ?? 'none',
        status: 'error',
        message: error instanceof Error ? error.message : 'Router sync failed',
        appliedAt: new Date().toISOString(),
      },
    }));
});

router.post('/speed-test', (_req, res) => {
  res.json(db.runGuestNetworkSpeedTest());
});

export default router;