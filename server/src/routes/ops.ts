// server/src/routes/ops.ts
//
// Operations dashboard API.
// Style mirrors server/src/routes/marketplace-revenue.ts:
//   router.use(requireAuth); try/catch + sendError; { success: true, data }.
//
// Mount in server/src/index.ts (alongside the other route registrations):
//   import opsRoutes from './routes/ops';
//   app.use('/api/ops', opsRoutes);
//
// Routes:
//   GET /api/ops/snapshot   -> full dashboard (admin only)
//   GET /api/ops/public     -> anonymous subset for marketing page (no auth)

import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { sendError } from '../lib/http-error';
import { getOpsSnapshot, getPublicMetrics } from '../services/ops.service';

const router = Router();

/**
 * GET /api/ops/snapshot
 * Full operations dashboard — admin only.
 */
router.get('/snapshot', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const data = await getOpsSnapshot();
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * GET /api/ops/public
 * Anonymous, safe-for-public subset (marketing page). No admin required.
 */
router.get('/public', async (_req: AuthRequest, res: Response) => {
  try {
    const data = await getPublicMetrics();
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;
