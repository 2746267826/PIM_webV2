import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deferredIntervalMs } from '@/lib/polling'
import { pcApi } from './api'

export const pcKeys = {
  summary: (date: string) => ['pc', 'summary', date] as const,
  heatmap: (start: string, end: string, dim: string) => ['pc', 'heatmap', start, end, dim] as const,
  activity: (date: string) => ['pc', 'activity-analysis', date] as const,
  appUsage: (date: string) => ['pc', 'app-usage', date] as const,
  categories: (date: string) => ['pc', 'categories', date] as const,
  productivity: (date: string) => ['pc', 'productivity', date] as const,
  queue: (limit: number) => ['pc', 'labeling-queue', limit] as const,
  dictionary: ['pc', 'category-dictionary'] as const,
  suggestions: (date: string) => ['pc', 'suggestions', date] as const,
  browserSummary: (key: string) => ['pc', 'browser', 'summary', key] as const,
  browserDaily: (from: string, to: string) => ['pc', 'browser', 'daily', from, to] as const,
  browserTimeline: (date: string) => ['pc', 'browser', 'timeline', date] as const,
}

export function usePcSummary(date: string, force = false) {
  return useQuery({
    queryKey: [...pcKeys.summary(date), force],
    queryFn: () => pcApi.summary(date, force),
    refetchInterval: () => deferredIntervalMs(),
  })
}

export function useHeatmapGrid(start: string, end: string, dimension: string, enabled = true, force = false) {
  return useQuery({
    queryKey: [...pcKeys.heatmap(start, end, dimension), force],
    queryFn: () => pcApi.heatmapGrid({ start, end, dimension, force }),
    enabled,
  })
}

export function useActivityAnalysis(date: string, enabled = true, force = false) {
  return useQuery({
    queryKey: [...pcKeys.activity(date), force],
    queryFn: () => pcApi.activityAnalysis(date, 60, force),
    enabled,
    refetchInterval: () => deferredIntervalMs(),
  })
}

export function useAppUsage(date: string, enabled = true) {
  return useQuery({
    queryKey: pcKeys.appUsage(date),
    queryFn: () => pcApi.appUsage({ date, timezone: 'Asia/Shanghai', limit: 8 }),
    enabled,
  })
}

export function useCategoryDistribution(date: string, enabled = true) {
  return useQuery({
    queryKey: pcKeys.categories(date),
    queryFn: () => pcApi.categoryDistribution({ date, timezone: 'Asia/Shanghai' }),
    enabled,
  })
}

/** 专注块（今日页/总览页用） */
export function useFocusBlocks(date: string, enabled = true) {
  return useQuery({
    queryKey: ['pc', 'focus-blocks', date],
    queryFn: () => pcApi.focusBlocks({ date, timezone: 'Asia/Shanghai' }),
    enabled,
  })
}

/** 深夜使用（总览页用） */
export function useLateNight(date: string, enabled = true) {
  return useQuery({
    queryKey: ['pc', 'late-night', date],
    queryFn: () => pcApi.lateNight({ date, timezone: 'Asia/Shanghai' }),
    enabled,
  })
}

export function useProductivity(date: string, enabled = true, force = false) {
  return useQuery({
    queryKey: [...pcKeys.productivity(date), force],
    queryFn: () => pcApi.productivity(date, force),
    enabled,
  })
}

export function useLabelingQueue(limit: number) {
  return useQuery({
    queryKey: pcKeys.queue(limit),
    queryFn: () => pcApi.classificationQueue(limit),
    refetchInterval: () => deferredIntervalMs(),
  })
}

export function useCategoryDictionary() {
  return useQuery({
    queryKey: pcKeys.dictionary,
    queryFn: () => pcApi.categoryDictionary(),
    staleTime: 60_000,
  })
}

export function useContextSuggestions(date: string) {
  return useQuery({
    queryKey: pcKeys.suggestions(date),
    queryFn: () => pcApi.suggestions(date),
    refetchInterval: () => deferredIntervalMs(),
  })
}

export function useLabelMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { targetType: string; target: string; categoryName?: string; categoryId?: string; scope: 'all' | 'keyword' }) =>
      pcApi.label(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pc'] })
      void qc.invalidateQueries({ queryKey: ['today'] })
    },
  })
}

export function useSuggestionActions() {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['pc'] })
    void qc.invalidateQueries({ queryKey: ['today'] })
  }
  return {
    reject: useMutation({ mutationFn: (id: string) => pcApi.suggestReject(id), onSuccess: invalidate }),
    preview: useMutation({
      mutationFn: ({ id, categoryName }: { id: string; categoryName?: string }) =>
        pcApi.suggestPreview(id, { categoryName, range: { mode: 'today' } }),
    }),
    apply: useMutation({
      mutationFn: ({ id, categoryName }: { id: string; categoryName?: string }) =>
        pcApi.suggestApply(id, { categoryName, range: { mode: 'today' } }),
      onSuccess: invalidate,
    }),
  }
}
