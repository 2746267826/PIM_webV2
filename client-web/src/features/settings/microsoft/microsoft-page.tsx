import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Circle, Cloud, RefreshCw, Unplug, Zap } from 'lucide-react'
import { apiDelete, apiPost, apiPut } from '@/api/client'
import { filesApi } from '@/features/files/api'
import { useProviders } from '@/features/files/queries'
import { outlookApi } from '@/features/calendar/api'
import { DeviceCodeFlow } from './device-code-flow'
import { Button, Card, CardTitle, Chip, Dialog, DialogBody, DialogContent, DialogHeader, InlineAlert, Input, Label, PageHeader, Segmented, Skeleton, StatusBadge } from '@/components/ui'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'

type Tab = 'outlook' | 'onedrive'

/** Microsoft 账户（v0.3 设计：Outlook 日历 + OneDrive 文件合并在一页，双 Tab + 共享状态条） */
export function MicrosoftPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'onedrive' ? 'onedrive' : 'outlook'
  const outlook = useOutlookSettingsSafe()
  const providers = useProviders()
  const provider = providers.data?.[0]

  function setTab(next: Tab) {
    setParams({ tab: next })
  }

  const outlookConnected = outlook.data?.uiStatus === 'connected'
  const oneDriveConnected = provider?.status === 'connected'

  return (
    <div>
      <PageHeader
        title="Microsoft 账户"
        subtitle="Outlook 日历同步与 OneDrive 文件绑定（两个 Client ID 后端独立存储，可填同一个 Azure 应用）"
        actions={
          <Segmented
            value={tab}
            onValueChange={(v) => setTab(v)}
            options={[
              { value: 'outlook', label: 'Outlook 日历' },
              { value: 'onedrive', label: 'OneDrive 文件' },
            ]}
          />
        }
      />

      {/* 共享状态条 */}
      <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-3.5">
        <span className="flex items-center gap-2 text-[13px]">
          <Circle className={cn('size-2.5', outlookConnected ? 'fill-ok text-ok' : 'fill-neutral text-neutral')} aria-hidden />
          日历 {outlookConnected ? '已连接' : '未连接'}
        </span>
        <span className="flex items-center gap-2 text-[13px]">
          <Circle className={cn('size-2.5', oneDriveConnected ? 'fill-ok text-ok' : 'fill-neutral text-neutral')} aria-hidden />
          文件 {oneDriveConnected ? '已绑定' : '未绑定'}
        </span>
        {outlook.data?.lastSyncedAt && (
          <span className="tnum text-xs text-text-4">日历最近同步 {formatTime(outlook.data.lastSyncedAt)}</span>
        )}
        {provider?.lastSyncAt && (
          <span className="tnum text-xs text-text-4">文件最近同步 {formatTime(provider.lastSyncAt)}</span>
        )}
      </Card>

      {tab === 'outlook' ? <OutlookTab /> : <OneDriveTab />}
    </div>
  )
}

/** 容错的 Outlook 设置查询（未配置时后端返回默认值） */
function useOutlookSettingsSafe() {
  return useQuery({
    queryKey: ['calendar', 'outlook', 'settings', 'microsoft-page'],
    queryFn: () => outlookApi.settings(),
    refetchInterval: (q) => (q.state.data?.status === 'waiting-for-user' ? 3000 : false),
    retry: false,
    meta: { silent: true },
  })
}

/* ── Outlook Tab ──────────────────────────────────────────── */

function OutlookTab() {
  const qc = useQueryClient()
  const settings = useOutlookSettingsSafe()
  const [clientId, setClientId] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncRangeOpen, setSyncRangeOpen] = useState(false)
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  useEffect(() => {
    if (settings.data?.clientId) setClientId(settings.data.clientId)
  }, [settings.data?.clientId])

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['calendar', 'outlook'] })

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Client ID + 检查连接 */}
      <Card className="p-4">
        <CardTitle>客户端配置</CardTitle>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="outlook-client-id">Azure 应用 Client ID</Label>
            <Input
              id="outlook-client-id"
              className="mono"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-text-4">需在 Azure 应用注册中允许公共客户端流（设备码）。</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!clientId.trim()}
              onClick={async () => {
                setSaving(true)
                try {
                  await apiPut('/api/v1/calendar/outlook/settings', { clientId: clientId.trim() })
                  notifySuccess('Client ID 已保存')
                  invalidate()
                } catch (err) {
                  notifyError(err instanceof Error ? err.message : '保存失败')
                } finally {
                  setSaving(false)
                }
              }}
            >
              保存
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  await apiPost('/api/v1/calendar/outlook/check', {})
                  notifySuccess('连接检查完成')
                  invalidate()
                } catch (err) {
                  notifyError(err instanceof Error ? err.message : '检查失败')
                }
              }}
            >
              <Zap className="size-3.5" aria-hidden /> 检查连接
            </Button>
          </div>
          {settings.data && (
            <div className="flex flex-wrap items-center gap-2 rounded-ctl bg-surface px-3 py-2 text-xs text-text-3">
              <StatusBadge tone={settings.data.uiStatus === 'connected' ? 'ok' : settings.data.uiStatus === 'waiting-auth' ? 'warn' : 'neutral'} dot={false}>
                {settings.data.uiStatus}
              </StatusBadge>
              <span>令牌：{settings.data.tokenHealth}</span>
              {settings.data.lastError && <span className="text-crit">{settings.data.lastError}</span>}
            </div>
          )}
        </div>
      </Card>

      {/* 设备码授权（3 秒轮询） */}
      <DeviceCodeFlow
        title="设备码授权"
        hint="点击获取代码后在浏览器打开验证页、输入代码完成授权（每 3 秒自动检查）。"
        pollIntervalMs={3000}
        start={async () => {
          const s = await apiPost<{ id: string; userCode: string | null; verificationUri: string | null; expiresAt: string | null }>(
            '/api/v1/calendar/outlook/device-code',
            {},
          )
          return { sessionId: s.id, userCode: s.userCode, verificationUri: s.verificationUri, expiresAt: s.expiresAt }
        }}
        poll={async (sessionId) => {
          const s = await apiPost<{ status: string; errorMessage: string | null }>(
            '/api/v1/calendar/outlook/device-code/poll',
            { sessionId },
          )
          return { status: s.status, errorMessage: s.errorMessage }
        }}
        cancel={async (sessionId) => {
          await apiPost(`/api/v1/calendar/outlook/device-code/${sessionId}/cancel`, {})
        }}
        onConnected={invalidate}
      />

      {/* 同步操作 */}
      <Card className="p-4">
        <CardTitle>同步操作</CardTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { mode: 'normal', label: '立即同步' },
            { mode: 'full-resources', label: '深度同步' },
          ].map((m) => (
            <Button
              key={m.mode}
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  await apiPost('/api/v1/calendar/outlook/sync', { mode: m.mode })
                  notifySuccess(`已触发${m.label}`)
                  invalidate()
                } catch (err) {
                  notifyError(err instanceof Error ? err.message : '触发同步失败')
                }
              }}
            >
              <RefreshCw className="size-3.5" aria-hidden /> {m.label}
            </Button>
          ))}
          <Chip active={syncRangeOpen} onClick={() => setSyncRangeOpen((o) => !o)}>按范围同步…</Chip>
        </div>
        {syncRangeOpen && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="sync-range-start" className="text-[11px]">开始</Label>
              <Input id="sync-range-start" type="datetime-local" className="h-8 w-44" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="sync-range-end" className="text-[11px]">结束</Label>
              <Input id="sync-range-end" type="datetime-local" className="h-8 w-44" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={!rangeStart || !rangeEnd}
              onClick={async () => {
                try {
                  await apiPost('/api/v1/calendar/outlook/sync', {
                    mode: 'range-instances',
                    rangeStart: new Date(rangeStart).toISOString(),
                    rangeEnd: new Date(rangeEnd).toISOString(),
                  })
                  notifySuccess('已按范围触发同步')
                  invalidate()
                } catch (err) {
                  notifyError(err instanceof Error ? err.message : '触发失败')
                }
              }}
            >
              同步该范围
            </Button>
          </div>
        )}
      </Card>

      {/* 断开 / 清理本地数据 */}
      <OutlookDangerZone onChanged={invalidate} />
    </div>
  )
}

function OutlookDangerZone({ onChanged }: { onChanged: () => void }) {
  const [preview, setPreview] = useState<{ bindingCount: number; calendarCount: number; eventCount: number } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <Card className="p-4">
      <CardTitle>连接与本地数据</CardTitle>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="danger-soft"
          size="sm"
          onClick={async () => {
            try {
              await apiPost('/api/v1/calendar/outlook/disconnect', {})
              notifySuccess('已断开 Outlook 连接')
              onChanged()
            } catch (err) {
              notifyError(err instanceof Error ? err.message : '断开失败')
            }
          }}
        >
          <Unplug className="size-3.5" aria-hidden /> 断开连接
        </Button>
        <Button
          variant="danger-soft"
          size="sm"
          onClick={async () => {
            const res = await apiGetPreview()
            setPreview(res)
            setConfirmOpen(true)
          }}
        >
          清理本地数据…
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-text-4">断开不会删除本地日历与事件；「清理本地数据」会软删除它们（云端数据不受影响）。</p>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader title="清理本地 Outlook 数据？" description="软删除 outlook 来源的日历与事件、删除绑定、清空令牌缓存。" />
          <DialogBody>
            {preview ? (
              <InlineAlert tone="warn" title="将清理">
                {preview.bindingCount} 个绑定 · {preview.calendarCount} 个日历 · {preview.eventCount} 个事件
              </InlineAlert>
            ) : (
              <Skeleton className="h-16" />
            )}
          </DialogBody>
          <div className="flex justify-end gap-2 px-5 py-3.5">
            <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>取消</Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                try {
                  await apiDelete('/api/v1/calendar/outlook/local-data')
                  notifySuccess('本地数据已清理')
                  setConfirmOpen(false)
                  onChanged()
                } catch (err) {
                  notifyError(err instanceof Error ? err.message : '清理失败')
                }
              }}
            >
              确认清理
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )

  async function apiGetPreview() {
    const { apiGet } = await import('@/api/client')
    return apiGet<{ bindingCount: number; calendarCount: number; eventCount: number }>(
      '/api/v1/calendar/outlook/local-data/preview',
    )
  }
}

/* ── OneDrive Tab ─────────────────────────────────────────── */

function OneDriveTab() {
  const qc = useQueryClient()
  const providers = useProviders()
  const provider = providers.data?.[0]
  const [clientId, setClientId] = useState('')
  const [bindingSession, setBindingSession] = useState<{ providerId: string; userCode: string; verificationUri: string; expiresAt: string | null } | null>(null)

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['files'] })

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="p-4">
        <CardTitle>OneDrive 绑定</CardTitle>
        {provider?.status === 'connected' ? (
          <div className="mt-3 space-y-2 text-[13px]">
            <div className="flex items-center gap-2">
              <Cloud className="size-4 text-info" aria-hidden />
              <span className="font-medium text-text-1">{provider.accountName ?? '已绑定'}</span>
              <StatusBadge tone="ok" dot={false} className="ml-auto">已连接</StatusBadge>
            </div>
            <div className="mono space-y-0.5 text-[11px] text-text-4">
              <div>driveId: {provider.driveId ?? '—'}</div>
              <div>Client ID: {provider.clientId ?? '—'}</div>
              <div>已同步条目: {provider.syncedItemCount.toLocaleString()}</div>
              {provider.lastSyncAt && <div>最近同步: {formatTime(provider.lastSyncAt)}</div>}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await filesApi.startSync(provider.id)
                    notifySuccess('已开始同步')
                    invalidate()
                  } catch (err) {
                    notifyError(err instanceof Error ? err.message : '同步失败')
                  }
                }}
              >
                <RefreshCw className="size-3.5" aria-hidden /> 手动同步
              </Button>
              <Button
                variant="danger-soft"
                size="sm"
                onClick={async () => {
                  if (!window.confirm('断开 OneDrive？本地文件元数据会被清除，云端文件不受影响。')) return
                  try {
                    await filesApi.unbind(provider.id)
                    notifySuccess('已断开 OneDrive')
                    invalidate()
                  } catch (err) {
                    notifyError(err instanceof Error ? err.message : '断开失败')
                  }
                }}
              >
                <Unplug className="size-3.5" aria-hidden /> 断开
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="onedrive-client-id">Azure 应用 Client ID</Label>
              <Input
                id="onedrive-client-id"
                className="mono"
                placeholder="可填与 Outlook 相同的 Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={!clientId.trim()}
              onClick={async () => {
                try {
                  const s = await filesApi.bindOneDrive(clientId.trim())
                  setBindingSession({ providerId: s.providerId, userCode: s.userCode, verificationUri: s.verificationUri, expiresAt: new Date(Date.now() + s.expiresIn * 1000).toISOString() })
                  invalidate()
                } catch (err) {
                  notifyError(err instanceof Error ? err.message : '发起绑定失败')
                }
              }}
            >
              发起绑定
            </Button>
            {provider?.status === 'pending' && !bindingSession && (
              <InlineAlert tone="warn">已有进行中的绑定会话，请刷新或重新发起。</InlineAlert>
            )}
          </div>
        )}
      </Card>

      {/* OneDrive 设备码向导（5 秒轮询） */}
      {bindingSession && provider?.status !== 'connected' && (
        <DeviceCodeFlow
          title="OneDrive 设备码绑定"
          hint="在浏览器打开验证页并输入代码；绑定完成后文件页即可浏览（每 5 秒自动检查）。"
          pollIntervalMs={5000}
          start={async () => ({
            sessionId: bindingSession.providerId,
            userCode: bindingSession.userCode,
            verificationUri: bindingSession.verificationUri,
            expiresAt: bindingSession.expiresAt,
          })}
          poll={async (providerId) => {
            const s = await filesApi.bindingStatus(providerId)
            return { status: s.status, errorMessage: null, accountName: s.accountName }
          }}
          onConnected={() => {
            setBindingSession(null)
            invalidate()
          }}
        />
      )}
    </div>
  )
}
