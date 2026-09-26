/* 文件域（05/files.md，OneDrive 三栏浏览器） */

export interface FileProvider {
  id: string
  provider: 'onedrive'
  status: 'pending' | 'connected' | 'expired' | 'denied'
  clientId: string | null
  driveId: string | null
  accountId: string | null
  accountName: string | null
  syncStatus: 'idle' | 'syncing' | 'error'
  syncedItemCount: number
  lastSyncAt: string | null
  lastError: string | null
  tokenExpiresAt: string | null
}

export interface FileItem {
  id: string
  providerId: string
  externalFileId: string
  parentExternalFileId: string | null
  path: string
  name: string
  itemType: 'folder' | 'file'
  mimeType: string | null
  size: number | null
  etag: string | null
  contentHash: string | null
  createdAt: string
  modifiedAt: string
  syncedAt: string
  indexStatus: string
}

export interface FileShare {
  itemId: string
  itemName: string
  path: string
  permissionType: string
  permissionId: string | null
  webUrl: string
  expiresAt: string | null
  createdAt: string
}

export interface SyncStatus {
  syncStatus: 'idle' | 'syncing' | 'error'
  lastError: string | null
  lastSyncAt: string | null
  syncedItemCount: number
}

export interface OneDriveBindingStart {
  providerId: string
  userCode: string
  verificationUri: string
  expiresIn: number
}

export interface OneDriveBindingStatus {
  status: 'pending' | 'connected' | 'expired' | 'denied'
  driveId: string | null
  accountId: string | null
  accountName: string | null
  userCode: string | null
  verificationUri: string | null
  deviceCodeExpiresAt: string | null
}

export interface UploadSession {
  uploadUrl: string
  expirationDateTime: string | null
  path: string
  fileName: string
}

export interface FileTextSnapshot {
  id: string
  path: string
  name: string
  content: string
  byteSize: number
  reason: 'pre-edit' | 'pre-restore'
  createdAt: string
}
