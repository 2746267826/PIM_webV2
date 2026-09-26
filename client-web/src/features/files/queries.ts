import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fixedIntervalMs } from '@/lib/polling'
import { filesApi } from './api'
import { uploadEngine, type TransferItem } from './upload-engine'

export const filesKeys = {
  providers: ['files', 'providers'] as const,
  items: (path: string, q: string, sort: string, order: string) =>
    ['files', 'items', path, q, sort, order] as const,
  search: (q: string) => ['files', 'search', q] as const,
  syncStatus: (providerId: string) => ['files', 'sync-status', providerId] as const,
  shares: (id: string) => ['files', 'shares', id] as const,
  allShares: ['files', 'all-shares'] as const,
  snapshots: (id: string) => ['files', 'snapshots', id] as const,
}

export function useProviders() {
  return useQuery({ queryKey: filesKeys.providers, queryFn: filesApi.providers })
}

export function useFileItems(path: string, q: string, sort: string, order: string) {
  return useQuery({
    queryKey: filesKeys.items(path, q, sort, order),
    queryFn: () => filesApi.listItems({ path, q: q || undefined, sort, order }),
    placeholderData: (prev) => prev,
  })
}

export function useFileSearch(q: string, enabled: boolean) {
  const [debounced, setDebounced] = useState(q)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), 250)
    return () => clearTimeout(timer)
  }, [q])
  return useQuery({
    queryKey: filesKeys.search(debounced),
    queryFn: () => filesApi.search(debounced),
    enabled: enabled && debounced.trim().length > 0,
  })
}

/** 同步状态：条件轮询——仅 syncing 时 2 秒，否则停止 */
export function useSyncStatus(providerId: string | undefined) {
  return useQuery({
    queryKey: filesKeys.syncStatus(providerId ?? ''),
    queryFn: () => filesApi.syncStatus(providerId!),
    enabled: providerId != null,
    refetchInterval: (query) =>
      query.state.data?.syncStatus === 'syncing' ? fixedIntervalMs(2_000)() : false,
  })
}

/** 绑定状态：固定 5 秒轮询（向导打开期间） */
export function useBindingStatus(providerId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['files', 'binding-status', providerId],
    queryFn: () => filesApi.bindingStatus(providerId!),
    enabled: enabled && providerId != null,
    refetchInterval: enabled ? fixedIntervalMs(5_000) : false,
  })
}

export function useFileMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['files'] })
  }
  return {
    createFolder: useMutation({ mutationFn: (path: string) => filesApi.createFolder(path), onSuccess: invalidate }),
    move: useMutation({
      mutationFn: ({ id, destinationPath }: { id: string; destinationPath: string }) => filesApi.move(id, destinationPath),
      onSuccess: invalidate,
    }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => filesApi.rename(id, name),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => filesApi.remove(id), onSuccess: invalidate }),
    startSync: useMutation({ mutationFn: (id: string) => filesApi.startSync(id), onSuccess: invalidate }),
    share: useMutation({
      mutationFn: ({ id, permissionType, expiresInDays }: { id: string; permissionType: 'view' | 'edit'; expiresInDays?: 7 | 30 | null }) =>
        filesApi.share(id, { permissionType, expiresInDays }),
      onSuccess: invalidate,
    }),
    revokeShare: useMutation({
      mutationFn: ({ id, permissionId }: { id: string; permissionId: string }) => filesApi.revokeShare(id, permissionId),
      onSuccess: invalidate,
    }),
    saveText: useMutation({
      mutationFn: ({ id, content }: { id: string; content: string }) => filesApi.saveText(id, content),
      onSuccess: (_d, v) => {
        void qc.invalidateQueries({ queryKey: filesKeys.snapshots(v.id) })
      },
    }),
    restoreSnapshot: useMutation({
      mutationFn: ({ id, snapshotId }: { id: string; snapshotId: string }) => filesApi.restoreSnapshot(id, snapshotId),
      onSuccess: invalidate,
    }),
  }
}

/** 传输队列订阅（引擎为外部单例，用订阅桥接到 React） */
export function useTransferQueue(): { items: TransferItem[]; retry: (id: string) => void; clearFinished: () => void } {
  const [items, setItems] = useState<TransferItem[]>(() => uploadEngine.snapshot())
  useEffect(() => uploadEngine.subscribe(setItems), [])
  return {
    items,
    retry: (id: string) => uploadEngine.retry(id),
    clearFinished: () => uploadEngine.clearFinished(),
  }
}
