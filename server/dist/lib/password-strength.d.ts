declare var COMMON_WEAK_PASSWORDS: Set<string>;
declare var SEQUENTIAL_PATTERNS: string[];
declare function isWeakPassword(password: any): {
    weak: boolean;
    reason: string;
} | {
    weak: boolean;
    reason?: undefined;
};
//# sourceMappingURL=password-strength.d.ts.map