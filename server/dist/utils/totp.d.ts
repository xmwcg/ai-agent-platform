export declare function generateSecret(length?: number): string;
export declare function generateTotp(secret: string, digits?: number, step?: number): string;
export declare function verifyTotp(secret: string, token: string, digits?: number, step?: number): boolean;
export declare function generateOtpAuthUrl(label: string, secret: string, issuer?: string): string;
//# sourceMappingURL=totp.d.ts.map