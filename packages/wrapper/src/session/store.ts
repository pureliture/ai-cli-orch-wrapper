import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, createWriteStream, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { Transform, type Writable } from 'node:stream';

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

export class SessionStore {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(homedir(), '.aco', 'sessions');
  }

  async create(provider: string, command: string, pid?: number, permissionProfile?: string): Promise<TaskRecord> {
    const id = randomUUID();
    const sessionDir = join(this.baseDir, id);
    await mkdir(sessionDir, { recursive: true, mode: 0o700 });

    const record: TaskRecord = {
      id,
      provider,
      command,
      status: 'running',
      startedAt: new Date().toISOString(),
      ...(pid !== undefined && { pid }),
      ...(permissionProfile !== undefined && { permissionProfile }),
    };

    await writeFile(join(sessionDir, 'task.json'), JSON.stringify(record, null, 2));
    return record;
  }

  async update(id: string, patch: Partial<TaskRecord>): Promise<TaskRecord> {
    const record = await this.read(id);
    const updated = { ...record, ...patch };
    await writeFile(join(this.baseDir, id, 'task.json'), JSON.stringify(updated, null, 2));
    return updated;
  }

  async read(id: string): Promise<TaskRecord> {
    const path = join(this.baseDir, id, 'task.json');
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as TaskRecord;
  }

  async markDone(id: string): Promise<void> {
    await this.update(id, { status: 'done', endedAt: new Date().toISOString() });
  }

  async markFailed(id: string): Promise<void> {
    await this.update(id, { status: 'failed', endedAt: new Date().toISOString() });
  }

  async markCancelled(id: string): Promise<void> {
    await this.update(id, { status: 'cancelled', endedAt: new Date().toISOString() });
  }

  outputLogPath(id: string): string {
    return join(this.baseDir, id, 'output.log');
  }

  errorLogPath(id: string): string {
    return join(this.baseDir, id, 'error.log');
  }

  sessionDir(id: string): string {
    return join(this.baseDir, id);
  }

  /** Returns the most-recently-started session ID, or undefined if none exist. */
  latestId(): string | undefined {
    if (!existsSync(this.baseDir)) return undefined;

    const entries = readdirSync(this.baseDir)
      .map((name) => this.readStartedAt(name))
      .filter((e): e is { name: string; startedAt: string } => e !== null);

    if (entries.length === 0) return undefined;
    entries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return entries[0].name;
  }

  private readStartedAt(name: string): { name: string; startedAt: string } | null {
    const taskFile = join(this.baseDir, name, 'task.json');
    try {
      const raw = readFileSync(taskFile, 'utf8');
      const record = JSON.parse(raw) as { startedAt?: string };
      return { name, startedAt: record.startedAt ?? '' };
    } catch {
      return null;
    }
  }

  /** Creates a tee writable: chunks go to stdout AND to the session output.log. */
  createOutputTee(id: string): Writable {
    const logPath = this.outputLogPath(id);
    const fileStream = createWriteStream(logPath, { flags: 'a', mode: 0o600 });

    const tee = new Transform({
      transform(chunk: Buffer, _enc: string, cb: () => void) {
        process.stdout.write(chunk);
        fileStream.write(chunk);
        this.push(chunk);
        cb();
      },
      flush(cb: () => void) {
        fileStream.end(cb);
      },
    });

    return tee;
  }
}

export const sessionStore = new SessionStore();
