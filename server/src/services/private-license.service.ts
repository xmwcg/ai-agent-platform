import { PrivateLicensePackage } from "../config/private-license";
import { logger } from "../lib/logger";

export interface IssuedLicense {
  licenseJson: Record<string, unknown>;
  downloadUrl?: string;
  serial?: string;
}

export async function issuePrivateLicense(
  pkg: PrivateLicensePackage,
  orderNo: string,
  userEmail: string
): Promise<IssuedLicense> {
  logger.warn("private-license", "私有化授权模块已归档，不执行实际签发");
  throw new Error("LICENSE_ISSUER_NOT_CONFIGURED");
}