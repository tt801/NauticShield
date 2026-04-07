import { Router } from 'express';
import { randomUUID } from 'crypto';
import * as db from '../db';
import { broadcast } from '../broadcaster';

const router = Router();

router.get('/', (_req, res) => {
  res.json(db.getVoyageLog());
});

router.post('/', (req, res) => {
  const { date, location, region, avgDownMbps, avgLatencyMs, uptimePct, provider, incidents, blocks, notes } = req.body as Partial<db.VoyageEntry>;
  if (!date || !location) {
    return res.status(400).json({ error: 'date and location are required' });
  }
  const entry = db.addVoyageEntry({
    id:           randomUUID(),
    date:         date,
    location:     location,
    region:       region       ?? '',
    avgDownMbps:  avgDownMbps  ?? 0,
    avgLatencyMs: avgLatencyMs ?? 0,
    uptimePct:    uptimePct    ?? 100,
    provider:     provider     ?? 'Starlink',
    incidents:    incidents    ?? 0,
    blocks:       typeof blocks === 'string' ? blocks : JSON.stringify(blocks ?? []),
    notes:        notes        ?? '',
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
