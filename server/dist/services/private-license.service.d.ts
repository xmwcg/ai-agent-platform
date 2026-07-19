import { PrivateLicensePackage } from '../config/private-license';
export interface IssuedLicense {
    licenseJson: Record<string, unknown>;
    downloadUrl?: string;
    serial?: string;
}
/**
 * 调用金网通 store 的 /api/admin/issue（模式 B）直接签发私有化 license。
 * 契约：{ product, version, validDays, seats, offline, email, orderNo, adminToken }
 * 金网通用 PLATFORM_EDITION_MAP[version] 映射内部 edition，validDays<0 视为永久(36500)。
 */
export declare function issuePrivateLicense(pkg: PrivateLicensePackage, orderNo: string, userEmail: string): Promise<IssuedLicense>;
//# sourceMappingURL=private-license.service.d.ts.map