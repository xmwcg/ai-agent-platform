"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const requireAdmin_1 = require("../middleware/requireAdmin");
const http_error_1 = require("../lib/http-error");
const ops_service_1 = require("../services/ops.service");
const router = (0, express_1.Router)();
// ───────────── API 状态 ─────────────
router.get('/', (_req, res) => { res.json({ ok: true, name: 'ops' }); });
/**
 * GET /api/ops/snapshot
 * Full operations dashboard — admin only.
 */
router.get('/snapshot', auth_1.requireAuth, requireAdmin_1.requireAdmin, async (_req, res) => {
    try {
        const data = await (0, ops_service_1.getOpsSnapshot)();
        res.json({ success: true, data });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
/**
 * GET /api/ops/public
 * Anonymous, safe-for-public subset (marketing page). No admin required.
 */
router.get('/public', async (_req, res) => {
    try {
        const data = await (0, ops_service_1.getPublicMetrics)();
        res.json({ success: true, data });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=ops.js.map