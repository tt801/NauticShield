import { Router } from 'express';
import { randomUUID } from 'crypto';
import * as db from '../db';
import { broadcast } from '../broadcaster';

const router = Router();

// GET /api/cyber/assessments
router.get('/assessments', (_req, res) => {
  res.json(db.listAssessments());
});

// POST /api/cyber/assessments  — save a completed scan
router.post('/assessments', (req, res) => {
  const { score, checks, cadence } = req.body as { score: number; checks: string; cadence?: string };
  if (score === undefined || !checks) {
    return res.status(400).json({ error: 'score and checks are required' });
  }
  const assessment = db.addAssessment({
    id:      randomUUID(),
    runAt:   new Date().toISOString(),
    score,
    checks,
    cadence: cadence ?? 'manual',
  });

  // Auto-create findings for any failed or warned checks
  const parsed = JSON.parse(checks) as Array<{ category: string; check: string; status: string; detail: string; weight: number }>;
  for (const c of parsed) {
    if (c.status === 'fail' || c.status === 'warn') {
      db.addFinding({
        id:           randomUUID(),
        assessmentId: assessment.id,
        category:     c.category,
        check_name:   c.check,
        status:       c.status,
        detail:       c.detail,
        weight:       c.weight,
        findingStatus:'open',
        remediatedAt: '',
        notes:        '',
        createdAt:    new Date().toISOString(),
      });
    }
  }

  broadcast({ type: 'cyber:assessment', data: assessment });
  res.status(201).json(assessment);
});

// GET /api/cyber/findings
router.get('/findings', (_req, res) => {
  res.json(db.listFindings());
});

// PATCH /api/cyber/findings/:id  — mark remediated, add notes
router.patch('/findings/:id', (req, res) => {
  const patch: Partial<Pick<db.CyberFinding, 'findingStatus' | 'remediatedAt' | 'notes'>> = {};
  if (req.body.findingStatus) patch.findingStatus = req.body.findingStatus;
  if (req.body.notes !== undefined) patch.notes = req.body.notes;
  if (req.body.findingStatus === 'remediated') patch.remediatedAt = new Date().toISOString();
  const updated = db.updateFinding(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: 'Finding not found' });
  broadcast({ type: 'cyber:finding', data: updated });
  res.json(updated);
});

export default router;
