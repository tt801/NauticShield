/// <reference types="node" />
import { Router } from 'express';

import * as db from '../db';
import { evaluateMaritimeRisk, ingestGnssSample, listRecentGnssSamples } from '../maritimeRisk';

const router = Router();

router.get('/risk', async (req, res) => {
  const refresh = String(req.query.refresh ?? '0') === '1';
  const snapshot = await evaluateMaritimeRisk(db.getDevices(), refresh);
  res.json(snapshot);
});

router.get('/gnss-samples', (req, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '60'), 10), 1), 500);
  res.json(listRecentGnssSamples(limit));
});

router.post('/gnss-sample', (req, res) => {
  const { lat, lon, sogKnots, cogDeg, satelliteCount, source, timestamp } = req.body ?? {};
  const latNum = Number(lat);
  const lonNum = Number(lon);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    res.status(400).json({ error: 'lat/lon are required and must be valid coordinates' });
    return;
  }

  const sample = ingestGnssSample({
    lat: latNum,
    lon: lonNum,
    sogKnots: Number.isFinite(Number(sogKnots)) ? Number(sogKnots) : 0,
    cogDeg: Number.isFinite(Number(cogDeg)) ? Number(cogDeg) : 0,
    satelliteCount: Number.isFinite(Number(satelliteCount)) ? Number(satelliteCount) : 0,
    source: typeof source === 'string' && source.trim() ? source.trim() : 'manual',
    timestamp: typeof timestamp === 'string' ? timestamp : undefined,
  });

  res.status(201).json(sample);
});

export default router;
