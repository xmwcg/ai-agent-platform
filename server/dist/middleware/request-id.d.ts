/**
 * 请求关联 ID 中间件（可观测性核心原语）
 *
 * 为每个入站请求分配/透传一个 X-Request-Id：
 * - 若上游（网关/nginx）已带 X-Request-Id，则沿用（跨服务串联）；
 * - 否则生成 UUIDv4；
 * - 通过响应头 X-Request-Id 回传，便于前端/客户端在排障时回带；
 * - 业务代码可在 meta 中带上 req.requestId 串联本次请求的所有日志。
 *
 * 需在 apmMiddleware 之前注册，使慢请求/错误日志能带出 requestId。
 */
import { Request, Response, NextFunction } from 'express';
export declare const REQUEST_ID_HEADER = "X-Request-Id";
export interface RequestWithId extends Request {
    requestId?: string;
}
export declare function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void;
export default requestIdMiddleware;
//# sourceMappingURL=request-id.d.ts.map