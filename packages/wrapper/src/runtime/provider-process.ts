export function terminateProviderProcess(pid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  if (process.platform !== 'win32') {
    try {
      process.kill(-pid, signal);
      return true;
    } catch {
      // Fall back to direct PID termination below.
    }
  }

  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}
