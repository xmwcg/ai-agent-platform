import { Request, Response, NextFunction } from "express";
declare const ACCESS_TOKEN_EXPIRY: string;
declare const REFRESH_TOKEN_EXPIRY_MS: number;
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        jti?: string;
        sessionId?: string;
    };
}
export declare function generateAccessToken(payload: {
    id: string;
    email: string;
    role: string;
    jti?: string;
    sessionId?: string;
}): string;
export declare function generateRefreshToken(): string;
export declare function hashRefreshToken(token: string): string;
export declare function generateDeviceFingerprint(req: Request): string;
export declare function verifyToken(token: string): {
    id: string;
    email: string;
    role: string;
    jti?: string;
    sessionId?: string;
} | null;
export declare function verifyRefreshToken(token: string): {
    id: string;
    email: string;
    role: string;
} | null;
export declare function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void;
export declare function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function setRefreshTokenCookie(res: Response, token: string): void;
export declare function clearRefreshTokenCookie(res: Response): void;
export declare function extractRefreshToken(req: Request): string | null;
export { ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_MS };
//# sourceMappingURL=auth.d.ts.map