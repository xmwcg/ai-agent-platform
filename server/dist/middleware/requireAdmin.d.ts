import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
export declare function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export default requireAdmin;
//# sourceMappingURL=requireAdmin.d.ts.map