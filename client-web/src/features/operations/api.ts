import { apiGet, apiPost } from '@/api/client'
import type { OperationConfirmation } from './types'

export const operationsApi = {
  listPending: () => apiGet<OperationConfirmation[]>('/api/v1/operations/confirmations/pending'),
  get: (id: string) => apiGet<OperationConfirmation>(`/api/v1/operations/confirmations/${id}`),
  confirm: (id: string) => apiPost<OperationConfirmation>(`/api/v1/operations/confirmations/${id}/confirm`, {}),
  confirmSecondLevel: (id: string) =>
    apiPost<OperationConfirmation>(`/api/v1/operations/confirmations/${id}/confirm-second-level`, {}),
  confirmStrict: (id: string) =>
    apiPost<OperationConfirmation>(`/api/v1/operations/confirmations/${id}/confirm-strict`, {}),
  reject: (id: string) => apiPost<OperationConfirmation>(`/api/v1/operations/confirmations/${id}/reject`, {}),
}

/* ── 审计时间线（P2） ─────────────────────────────────────── */

export interface AuditVersionItem {
  id: string
  objectType: string
  objectId: string
  confirmationId: string | null
  source: string
  actor: string
  beforeJson: string
  afterJson: string
  changedFieldsJson: string
  createdAt: string
}

export interface AuditRestorePreview {
  objectType: string
  objectId: string
  summary: string
  requiresConfirmation: boolean
  changedFields: string[]
  beforeJson: string | null
  afterJson: string | null
}

export const auditApi = {
  timeline: (objectType: string, objectId: string) =>
    apiGet<{ items: AuditVersionItem[] }>(
      `/api/v1/operations/audit/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`,
    ),
  restorePreview: (auditVersionId: string) =>
    apiPost<AuditRestorePreview>(`/api/v1/operations/audit/${auditVersionId}/restore-preview`, {}),
  export: (params?: { start?: string; end?: string }) => {
    const q = new URLSearchParams()
    if (params?.start) q.set('start', params.start)
    if (params?.end) q.set('end', params.end)
    return apiGet<{ fileName: string; contentType: string; content: string }>(
      `/api/v1/operations/audit/export${q.toString() ? `?${q}` : ''}`,
    )
  },
}
