import { Router } from 'express';
import { randomUUID } from 'crypto';
import * as db from '../db';
import { broadcast } from '../broadcaster';
import { checkCyberFindings } from '../alertEngine';
import { recommendedActionsForFinding } from '../cyberPlaybooks';

const router = Router();
const allowedFindingStatuses: db.CyberFindingStatus[] = ['open', 'investigating', 'in_progress', 'remediated', 'accepted_risk'];

function withPlaybook<T extends db.CyberFinding>(finding: T) {
  return {
    ...finding,
    recommendedActions: recommendedActionsForFinding(finding),
  };
}

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
  const newFindings: ReturnType<typeof db.listFindings> = [];
  for (const c of parsed) {
    if (c.status === 'fail' || c.status === 'warn') {
      const finding = db.addFinding({
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
      newFindings.push(finding);
    }
  }
  // Fire cyber:critical alerts for any 'fail' findings
  checkCyberFindings(newFindings);

  broadcast({ type: 'cyber:assessment', data: assessment });
  res.status(201).json(assessment);
});

// GET /api/cyber/findings
router.get('/findings', (_req, res) => {
  res.json(db.listFindings().map(withPlaybook));
});

// PATCH /api/cyber/findings/:id  — mark remediated, add notes
router.patch('/findings/:id', (req, res) => {
  const patch: Partial<Pick<db.CyberFinding, 'findingStatus' | 'remediatedAt' | 'notes'>> = {};
  if (req.body.findingStatus) {
    const nextStatus = req.body.findingStatus as db.CyberFindingStatus;
    if (!allowedFindingStatuses.includes(nextStatus)) {
      return res.status(400).json({ error: `Invalid findingStatus. Allowed: ${allowedFindingStatuses.join(', ')}` });
    }
    patch.findingStatus = nextStatus;
    patch.remediatedAt = nextStatus === 'remediated' ? new Date().toISOString() : '';
  }
  if (req.body.notes !== undefined) patch.notes = req.body.notes;
  const updated = db.updateFinding(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: 'Finding not found' });
  // Clear any open cyber:critical alert for this finding
  checkCyberFindings([updated]);
  const enriched = withPlaybook(updated);
  broadcast({ type: 'cyber:finding', data: enriched });
  res.json(enriched);
});

export default router;
