import { Router } from 'express';
import { randomUUID } from 'crypto';
import * as db from '../db';
import { broadcast } from '../broadcaster';

const router = Router();

router.get('/', (_req, res) => {
  res.json(db.getVoyageLog());
});

// GET /api/voyage/autofill-range?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/autofill-range', (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !dateRe.test(from) || !dateRe.test(to)) {
    return res.status(400).json({ error: 'from and to query params required (YYYY-MM-DD)' });
  }
  res.json(db.getAutofillForRange(from, to));
});

// GET /api/voyage/autofill?date=YYYY-MM-DD
router.get('/autofill', (req, res) => {
  const { date } = req.query as { date?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
  }
  res.json(db.getAutofillForDate(date));
});

router.post('/', (req, res) => {
  const { date, location, region, country, locationTo, locationToCountry, locationToRegion, eta, status, avgDownMbps, avgLatencyMs, uptimePct, provider, incidents, blocks, notes } = req.body as Partial<db.VoyageEntry>;
  if (!date || !location) {
    return res.status(400).json({ error: 'date and location are required' });
  }
  const entry = db.addVoyageEntry({
    id:                randomUUID(),
    date,
    location,
    region:            region            ?? '',
    country:           country           ?? '',
    locationTo:        locationTo        ?? '',
    locationToCountry: locationToCountry ?? '',
    locationToRegion:  locationToRegion  ?? '',
    eta:               eta               ?? '',
    status:            status            ?? 'completed',
    avgDownMbps:       avgDownMbps       ?? 0,
    avgLatencyMs:      avgLatencyMs      ?? 0,
    uptimePct:         uptimePct         ?? 100,
    provider:          provider          ?? 'Starlink',
    incidents:         incidents         ?? 0,
    blocks:            typeof blocks === 'string' ? blocks : JSON.stringify(blocks ?? []),
    notes:             notes             ?? '',
  });
  broadcast({ type: 'voyage:add', data: entry });
  res.status(201).json(entry);
});

router.patch('/:id', (req, res) => {
  const updated = db.updateVoyageEntry(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Entry not found' });
  broadcast({ type: 'voyage:update', data: updated });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const deleted = db.deleteVoyageEntry(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Entry not found' });
  broadcast({ type: 'voyage:delete', data: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
