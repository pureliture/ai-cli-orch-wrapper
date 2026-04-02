import { type Writable } from 'node:stream';
export type SessionStatus = 'running' | 'done' | 'failed' | 'cancelled';
export interface TaskRecord {
    id: string;
    provider: string;
    command: string;
    status: SessionStatus;
    pid?: number;
    permissionProfile?: string;
    startedAt: string;
    endedAt?: string;
}
export declare class SessionStore {
    private readonly baseDir;
    constructor(baseDir?: string);
    create(provider: string, command: string, pid?: number, permissionProfile?: string): Promise<TaskRecord>;
    update(id: string, patch: Partial<TaskRecord>): Promise<TaskRecord>;
    read(id: string): Promise<TaskRecord>;
    markDone(id: string): Promise<void>;
    markFailed(id: string): Promise<void>;
    markCancelled(id: string): Promise<void>;
    outputLogPath(id: string): string;
    errorLogPath(id: string): string;
    sessionDir(id: string): string;
    /** Returns the most-recently-created session ID, or undefined if none exist. */
    latestId(): string | undefined;
    /** Creates a tee writable: chunks go to stdout AND to the session output.log. */
    createOutputTee(id: string): Writable;
}
export declare const sessionStore: SessionStore;
//# sourceMappingURL=store.d.ts.map