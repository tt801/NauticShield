import { Router } from 'express';
import * as db from '../db';

const router = Router();

// GET /api/notifications — get current prefs
router.get('/', (_req, res) => {
  res.json(db.getNotificationPrefs());
});

// PUT /api/notifications — update prefs
router.put('/', (req, res) => {
  const { emailTo, phoneTo, categories } = req.body as Partial<db.NotificationPrefs>;
  const updated = db.setNotificationPrefs({ emailTo, phoneTo, categories });
  res.json(updated);
});

export default router;
