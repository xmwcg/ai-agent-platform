export interface PrivateLicensePackage {
  id: string;
  name: string;
  tagline?: string;
  version: string;
  price: number;
  validDays: number;
  offline: boolean;
  seats: number;
  features: string[];
  highlighted?: boolean;
}

export const PRIVATE_LICENSE_PACKAGES: PrivateLicensePackage[] = [];

export function getPrivateLicensePackage(packageId: string): PrivateLicensePackage | undefined {
  return PRIVATE_LICENSE_PACKAGES.find(p => p.id === packageId);
}