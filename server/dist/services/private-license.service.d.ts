import { PrivateLicensePackage } from '../config/private-license';
export interface IssuedLicense {
    licenseJson: Record<string, unknown>;
    downloadUrl?: string;
    serial?: string;
}
/**
 * 签发金网通私有化 License（内嵌 HMAC-SHA256，不需要外部 store）
 * 购买后自动签发，无需人工联系
 */
export declare function issuePrivateLicense(pkg: PrivateLicensePackage, orderNo: string, userEmail: string): IssuedLicense;
/**
 * 客户端激活 License：将 PENDING_ACTIVATION 绑定到真实机器指纹
 */
export declare function activateLicense(existingLicense: Record<string, any>, realFingerprint: string): Record<string, any>;
//# sourceMappingURL=private-license.service.d.ts.map