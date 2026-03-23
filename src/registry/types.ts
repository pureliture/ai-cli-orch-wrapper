export interface LockedItem {
  url: string;
  localPath: string;
  downloadedAt: string;
}

export interface LockFile {
  lockVersion: string;
  items: LockedItem[];
}
