export interface PackInstallOptions {
    global?: boolean;
    force?: boolean;
    binaryName?: string;
}
export declare function packInstall(options?: PackInstallOptions): Promise<void>;
export declare function packUninstall(options?: {
    global?: boolean;
}): Promise<void>;
export declare function packStatus(options?: {
    global?: boolean;
}): Promise<void>;
export declare function packSetup(options?: PackInstallOptions): Promise<void>;
export declare function providerSetup(name: string): Promise<void>;
//# sourceMappingURL=pack-install.d.ts.map