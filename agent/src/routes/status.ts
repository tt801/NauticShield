import { Router } from 'express';
import * as db from '../db';

const router = Router();

router.get('/', (_req, res) => {
  const internetStatus = db.getInternetStatus();
  const networkHealth  = db.getNetworkHealth();
  res.json({ internetStatus, networkHealth });
});

export default router;
