"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 管理员运营仪表盘路由
 *
 * GET  /api/admin/dashboard   — 运营指标仪表盘
 * GET  /api/admin/backups      — 备份列表
 * POST /api/admin/backups/restore — 手动恢复备份
 */
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const dashboard_service_1 = require("../services/dashboard.service");
const backup_service_1 = require("../services/backup.service");
const http_error_1 = require("../lib/http-error");
const security_audit_service_1 = require("../services/security-audit.service");
const router = (0, express_1.Router)();
// 运营指标仪表盘
router.get("/admin/dashboard", auth_1.requireAdmin, async (req, res) => {
    try {
        const metrics = await (0, dashboard_service_1.getDashboardMetrics)();
        res.json({ success: true, data: metrics });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 备份列表
router.get("/admin/backups", auth_1.requireAdmin, async (req, res) => {
    try {
        const backups = await (0, backup_service_1.listBackups)();
        res.json({ success: true, data: backups });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 手动触发全量备份
router.post("/admin/backups/full", auth_1.requireAdmin, async (req, res) => {
    try {
        const result = await (0, backup_service_1.performFullBackup)();
        if (result) {
            await (0, security_audit_service_1.writeAuditLog)({
                action: "admin_action",
                resourceType: "backup",
                resourceId: result.name,
                details: { action: "manual_full", size: result.sizeBytes },
                severity: "low",
                ctx: { adminId: req.user?.id, userId: req.user?.id, ipAddress: req.ip },
            });
            res.json({ success: true, data: result });
        }
        else {
            res.status(500).json({ success: false, error: "备份失败" });
        }
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 手动恢复备份
router.post("/admin/backups/restore/:name", auth_1.requireAdmin, async (req, res) => {
    try {
        // 恢复操作必须写入关键审计日志
        await (0, security_audit_service_1.writeAuditLog)({
            action: "admin_action",
            resourceType: "backup_restore",
            resourceId: req.params.name,
            details: { action: "restore_requested" },
            severity: "critical",
            ctx: { adminId: req.user?.id, userId: req.user?.id, ipAddress: req.ip },
        }, true); // 关键审计：写入失败则拒绝
        const result = await (0, backup_service_1.restoreFromBackup)(req.params.name);
        res.json(result);
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=admin-dashboard.js.map