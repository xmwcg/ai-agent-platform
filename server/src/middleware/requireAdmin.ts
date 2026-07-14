// server/src/middleware/requireAdmin.ts
//
// Global admin-only guard for operations routes.
//
// Context: User.role is 'user' | 'admin' (server/src/models/User.ts:19) but is
// NOT enforced by any route today. This middleware closes that gap.
//
// Must run AFTER requireAuth (which populates req.user from the JWT).
// Style mirrors server/src/middleware/auth.ts -> requireAuth (res.status + json).
//
// Usage:
//   import { requireAuth, AuthRequest } from '../middleware/auth';
//   import { requireAdmin } from '../middleware/requireAdmin';
//   router.use(requireAuth);
//   router.get('/snapshot', requireAdmin, handler);

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: '未授权，缺少登录信息' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: '需要管理员权限', yourRole: req.user.role });
    return;
  }
  next();
}

export default requireAdmin;
