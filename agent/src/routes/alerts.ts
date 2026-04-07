import { Router } from 'express';
import * as db from '../db';
import { broadcast } from '../broadcaster';

const router = Router();

router.get('/', (_req, res) => {
  res.json(db.getAlerts());
});

router.post('/:id/resolve', (req, res) => {
  const { id } = req.params;
  db.resolveAlert(id);
  broadcast({ type: 'alert:resolve', data: { id } });
  res.json({ success: true });
});

export default router;
