"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUEST_ID_HEADER = void 0;
exports.requestIdMiddleware = requestIdMiddleware;
const crypto_1 = __importDefault(require("crypto"));
exports.REQUEST_ID_HEADER = 'X-Request-Id';
function requestIdMiddleware(req, res, next) {
    const incoming = req.headers['x-request-id'];
    const rid = (Array.isArray(incoming) ? incoming[0] : incoming) || crypto_1.default.randomUUID();
    req.requestId = rid;
    res.setHeader(exports.REQUEST_ID_HEADER, rid);
    next();
}
exports.default = requestIdMiddleware;
//# sourceMappingURL=request-id.js.map