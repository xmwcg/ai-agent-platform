"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSecret = generateSecret;
exports.generateTotp = generateTotp;
exports.verifyTotp = verifyTotp;
exports.generateOtpAuthUrl = generateOtpAuthUrl;
/**
 * TOTP (Time-based One-Time Password) 工具
 * 纯实现，无外部依赖。RFC 6238 / RFC 4226 兼容。
 */
const crypto = __importStar(require("crypto"));
function generateSecret(length = 32) {
    return crypto.randomBytes(length).toString("base64").replace(/[+=]/g, "").slice(0, length);
}
function sha1Hmac(key, data) {
    return crypto.createHmac("sha1", key).update(data).digest();
}
function getCounter(step = 30) {
    const time = Math.floor(Date.now() / 1000 / step);
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(time));
    return buf;
}
function truncate(hash) {
    const offset = hash[hash.length - 1] & 0x0f;
    return ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);
}
function generateTotp(secret, digits = 6, step = 30) {
    const key = Buffer.from(secret, "utf8");
    const counter = getCounter(step);
    const hash = sha1Hmac(key, counter);
    const code = truncate(hash) % Math.pow(10, digits);
    return code.toString().padStart(digits, "0");
}
function verifyTotp(secret, token, digits = 6, step = 30) {
    return generateTotp(secret, digits, step) === token;
}
function generateOtpAuthUrl(label, secret, issuer = "AIbak") {
    return "otpauth://totp/" + encodeURIComponent(issuer) + ":" + encodeURIComponent(label) +
        "?secret=" + encodeURIComponent(secret) + "&issuer=" + encodeURIComponent(issuer);
}
//# sourceMappingURL=totp.js.map