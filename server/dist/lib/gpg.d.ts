export declare class GpgEncryptor {
    private key?;
    constructor(key?: Buffer | null);
    encryptFile(inputPath: string, outputPath: string): Promise<boolean>;
    decryptFile(inputPath: string, outputPath: string): Promise<boolean>;
}
//# sourceMappingURL=gpg.d.ts.map