import { apiGet, apiPost } from '@/api/client'
import type {
  CategoryDictionaryItem,
  ContextSuggestion,
  LabelingQueueItem,
  PcActivityAnalysis,
  PcAppUsageItem,
  PcCategoryDistributionItem,
  PcSummaryResponse,
  ProductivityDashboard,
  SiteDailyRow,
  SiteSummary,
  SiteTimelineRow,
} from './types'

export interface AppKnowledgePreview {
  recommendation: { categoryName: string | null; categoryPath: string | null }
  preview: {
    affectedRecordCount: number
    affectedDurationSeconds: number
    currentCategoryCounts: Record<string, number>
    newCategoryCounts: Record<string, number>
    requiresConfirmation: boolean
    summary: string
  }
}

export const pcApi = {
  summary: (date: string, force = false) =>
    apiGet<PcSummaryResponse>(`/api/v1/pc/summary?date=${date}${force ? '&force=true' : ''}`),
  heatmapGrid: (params: { start: string; end: string; dimension: string }) =>
    apiGet<import('./types').HeatmapGridResponse>(
      `/api/v1/pc/heatmap/grid?start=${params.start}&end=${params.end}&dimension=${params.dimension}`,
    ),
  activityAnalysis: (date: string, blockMinutes = 60) =>
    apiGet<PcActivityAnalysis>(`/api/v1/pc/activity-analysis?date=${date}&blockMinutes=${blockMinutes}`),
  appUsage: (date: string, limit = 8) =>
    apiGet<{ items: PcAppUsageItem[]; totalMinutes: number }>(
      `/api/v1/pc/aggregation/app-usage?date=${date}&limit=${limit}`,
    ),
  categoryDistribution: (date: string) =>
    apiGet<{ items: PcCategoryDistributionItem[] }>(`/api/v1/pc/aggregation/category-distribution?date=${date}`),
  productivity: (date: string) =>
    apiGet<ProductivityDashboard>(`/api/v1/pc/productivity/dashboard?date=${date}`),
  classificationQueue: (limit: number, mode = 'queue') =>
    apiGet<{ items: LabelingQueueItem[] }>(`/api/v1/pc/classification/queue?limit=${limit}&mode=${mode}`),
  label: (body: { targetType: string; target: string; categoryName?: string; categoryId?: string; scope: 'all' | 'keyword' }) =>
    apiPost<{ ok: boolean; categoryName: string | null; created: string }>('/api/v1/pc/classification/label', body),
  categoryDictionary: () => apiGet<CategoryDictionaryItem[]>('/api/v1/pc/categories/dictionary'),

  /** 浏览器站点（browser-tt） */
  browserSummary: (params: { date?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams()
    if (params.date) q.set('date', params.date)
    if (params.from) q.set('from', params.from)
    if (params.to) q.set('to', params.to)
    return apiGet<SiteSummary>(`/api/v1/pc/browser-tt/summary?${q}`)
  },
  browserDaily: (params: { from: string; to: string }) =>
    apiGet<SiteDailyRow[]>(`/api/v1/pc/browser-tt/daily?from=${params.from}&to=${params.to}`),
  browserTimeline: (date: string) => apiGet<SiteTimelineRow[]>(`/api/v1/pc/browser-tt/timeline?date=${date}`),
  browserImport: (body: { content: string; mode?: 'overwrite' | 'add' }) =>
    apiPost<{ rows: number; dates: number; hosts: number; skipped: number; format: string }>(
      '/api/v1/pc/browser-tt/import',
      body,
    ),

  /** 上下文建议（app-knowledge 同构预览/应用） */
  suggestions: (date: string) =>
    apiGet<ContextSuggestion[]>(`/api/v1/pc/classification/suggestions?date=${date}`),
  suggestReject: (id: string) =>
    apiPost<string>(`/api/v1/pc/classification/suggestions/${id}/reject`, {}),
  suggestPreview: (id: string, body: { categoryName?: string; range: { mode: 'today' | 'range' } }) =>
    apiPost<AppKnowledgePreview>(
      `/api/v1/pc/app-knowledge/suggestions/${id}/preview`,
      body,
    ),
  suggestApply: (id: string, body: { categoryName?: string; range: { mode: 'today' | 'range' } }) =>
    apiPost<{ message: string }>(`/api/v1/pc/app-knowledge/suggestions/${id}/apply`, body),
}
