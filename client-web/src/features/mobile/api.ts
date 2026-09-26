import { apiDelete, apiGet, apiPost } from '@/api/client'
import type {
  DeviceDeletePreview,
  DeviceMergePreview,
  FrequentPlace,
  LivenessOverview,
  LocationOverview,
  LocationTrack,
  MobileAnalyticsOverview,
  MobileChartDto as MobileAnalyticsChartDto,
  MobileDevice,
  MobileHeatmapBucket,
  MobileTimelineBlock,
  MovementStats,
  SegmentPointsPage,
} from './types'

/** 位置分析公共查询参数组（rangeStartUtc/rangeEndUtc/timezone/deviceId/maxAccuracy/includeRejected + force） */
function locQ(params: Record<string, unknown>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  return q.toString()
}

export const mobileApi = {
  analyticsOverview: (params: Record<string, unknown>) =>
    apiGet<MobileAnalyticsOverview>(`/api/v1/mobile/analytics/overview?${locQ(params)}`),
  heatmap: (params: Record<string, unknown>) =>
    apiGet<MobileHeatmapBucket[]>(`/api/v1/mobile/analytics/heatmap?${locQ(params)}`),
  charts: (params: Record<string, unknown>) =>
    apiGet<MobileAnalyticsChartDto[]>(`/api/v1/mobile/analytics/charts?${locQ(params)}`),
  timelineBlocks: (params: Record<string, unknown> & { page?: number; pageSize?: number }) =>
    apiGet<{ items: MobileTimelineBlock[]; hasMore: boolean; totalCount: number; nextCursor: string | null }>(
      `/api/v1/mobile/analytics/timeline-blocks?${locQ(params)}`,
    ),
  blockSessions: (blockId: string, params: Record<string, unknown>) =>
    apiGet<{ id: string; packageName: string; displayName: string; startUtc: string; endUtc: string | null; durationSeconds: number; lifeCategory: string }[]>(
      `/api/v1/mobile/analytics/timeline-blocks/${encodeURIComponent(blockId)}/sessions?${locQ(params)}`,
    ),

  devices: () => apiGet<MobileDevice[]>('/api/v1/mobile/devices'),
  devicesManage: (sortBy: 'data' | 'active') =>
    apiGet<MobileDevice[]>(`/api/v1/mobile/devices/manage?sortBy=${sortBy}`),
  deviceDetail: (deviceId: string) =>
    apiGet<import('./types').DeviceDetail>(`/api/v1/mobile/devices/${encodeURIComponent(deviceId)}/detail`),
  renameDevice: (deviceId: string, displayName: string) =>
    apiPost(`/api/v1/mobile/devices/${encodeURIComponent(deviceId)}/rename`, { displayName }),
  deletePreview: (deviceId: string) =>
    apiGet<DeviceDeletePreview>(`/api/v1/mobile/devices/${encodeURIComponent(deviceId)}/delete-preview`),
  deleteDevice: (deviceId: string) =>
    apiDelete<string>(`/api/v1/mobile/devices/${encodeURIComponent(deviceId)}`),
  mergePreview: (body: { sourceDeviceIds: string[]; targetDeviceId: string }) =>
    apiPost<DeviceMergePreview>('/api/v1/mobile/devices/merge/preview', body),
  merge: (body: { sourceDeviceIds: string[]; targetDeviceId: string }) =>
    apiPost<string>('/api/v1/mobile/devices/merge', body),
  exportDevice: (deviceId: string) =>
    apiGet<unknown>(`/api/v1/mobile/devices/${encodeURIComponent(deviceId)}/export`),

  livenessOverview: (params: Record<string, unknown>) =>
    apiGet<LivenessOverview>(`/api/v1/mobile/liveness/overview?${locQ(params)}`),

  locationOverview: (params: Record<string, unknown>) =>
    apiGet<LocationOverview>(`/api/v1/mobile/location/analytics/overview?${locQ(params)}`),
  tracks: (params: Record<string, unknown>) =>
    apiGet<LocationTrack[]>(`/api/v1/mobile/location/analytics/tracks?${locQ(params)}`),
  frequentPlaces: (params: Record<string, unknown>) =>
    apiGet<{ home: FrequentPlace | null; places: FrequentPlace[] }>(
      `/api/v1/mobile/location/analytics/frequent-places?${locQ(params)}`,
    ),
  movementStats: (params: Record<string, unknown>) =>
    apiGet<MovementStats>(`/api/v1/mobile/location/analytics/movement-stats?${locQ(params)}`),
  segmentPoints: (segmentId: string, params: Record<string, unknown> & { cursor?: string; pageSize?: number }) =>
    apiGet<SegmentPointsPage>(
      `/api/v1/mobile/location/analytics/segments/${encodeURIComponent(segmentId)}/points?${locQ(params)}`,
    ),

  /** 全站唯一 cursor 分页（历史位置原始点表，cursor 栈回退） */
  rawPointsPager(segmentId: string, base: Record<string, unknown>) {
    const stack: (string | null)[] = [null]
    let index = 0
    return {
      get pageIndex() {
        return index
      },
      async fetch(pageDelta: number): Promise<SegmentPointsPage> {
        const target = Math.max(0, Math.min(index + pageDelta, stack.length - 1))
        index = target
        const res = await mobileApi.segmentPoints(segmentId, {
          ...base,
          cursor: stack[index] ?? undefined,
          pageSize: 200,
        })
        if (res.hasMore && res.nextCursor && index === stack.length - 1) stack.push(res.nextCursor)
        return res
      },
      reset() {
        stack.length = 1
        index = 0
      },
    }
  },
}
