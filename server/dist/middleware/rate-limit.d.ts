import { NextFunction, Request, Response } from 'express';
export declare const apiLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare function aiLimiter(): import("express-rate-limit").RateLimitRequestHandler;
export declare const text2imgLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare function modelFetchLimiter(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=rate-limit.d.ts.map