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
