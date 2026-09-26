import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useConfirmation, useConfirmationActions, usePendingConfirmations } from '../queries'
import type { OperationConfirmation } from '../types'
import {
  normalizeConfirmationStatus,
  normalizeRiskLevel,
  RISK_LABEL,
  riskTone,
  CONFIRMATION_STATUS_LABEL,
} from '@/lib/enums'
import { formatTime } from '@/lib/datetime'
import {
  Button,
  Card,
  EmptyState,
  InlineAlert,
  PageHeader,
  Skeleton,
  Spinner,
  StatusBadge,
  TwoStepButton,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'

/* ── 前后差异对比表（字段级 before/after） ─────────────────── */

function parseJsonSafe(value: string | null): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed != null ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function DiffTable({ before, after }: { before: string | null; after: string | null }) {
  const b = parseJsonSafe(before)
  const a = parseJsonSafe(after)
  if (!b && !a) return null
  const keys = [...new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})])]
  return (
    <div className="overflow-hidden rounded-ctl border border-border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-surface text-left text-xs text-text-3">
            <th className="px-3 py-2 font-medium">字段</th>
            <th className="px-3 py-2 font-medium">变更前</th>
            <th className="px-3 py-2 font-medium">变更后</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {keys.map((key) => {
            const bv = b?.[key]
            const av = a?.[key]
            const changed = JSON.stringify(bv) !== JSON.stringify(av)
            return (
              <tr key={key} className={cn(changed && 'bg-warn-soft/50')}>
                <td className="px-3 py-1.5 align-top font-medium text-text-2">{key}</td>
                <td className="max-w-56 px-3 py-1.5 align-top break-all text-text-3">
                  {bv == null ? '—' : typeof bv === 'object' ? JSON.stringify(bv) : String(bv)}
                </td>
                <td className="max-w-56 px-3 py-1.5 align-top break-all text-text-1">
                  {av == null ? '—' : typeof av === 'object' ? JSON.stringify(av) : String(av)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── 详情面板 ─────────────────────────────────────────────── */

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-[13px]">
      <span className="w-24 shrink-0 text-text-3">{label}</span>
      <span className="min-w-0 flex-1 break-all text-text-1">{children}</span>
    </div>
  )
}

function ConfirmationDetail({ id }: { id: string }) {
  const { data: c, isLoading } = useConfirmation(id)
  const actions = useConfirmationActions()
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => setActionError(null), [id])

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  if (!c) return <EmptyState title="确认单不存在" description="可能已被处理或已过期。" />

  const conf: OperationConfirmation = c
  const status = normalizeConfirmationStatus(conf.status)
  const risk = normalizeRiskLevel(conf.riskLevel)
  const pending = status === 'Pending'

  async function run(action: () => Promise<unknown>, okMessage: string) {
    setActionError(null)
    try {
      await action()
      notifySuccess(okMessage)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '操作失败，请稍后重试')
      notifyError(err instanceof Error ? err.message : '操作失败')
    }
  }

  /* 三档端点分发（规格：requiresStrict→strict；requiresSecondLevel→second-level；否则标准） */
  function confirmDispatch() {
    if (conf.requiresStrictConfirmation) return actions.confirmStrict.mutateAsync(conf.id)
    if (conf.requiresSecondLevelConfirmation) return actions.confirmSecondLevel.mutateAsync(conf.id)
    return actions.confirm.mutateAsync(conf.id)
  }

  const strictInput = c.id.slice(0, 8)

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-divider px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 flex-1 text-base font-semibold text-text-1">{c.summary}</h2>
          <StatusBadge tone={riskTone(risk)}>{RISK_LABEL[risk]}</StatusBadge>
          <StatusBadge tone={status === 'Pending' ? 'info' : 'neutral'} dot={false}>
            {CONFIRMATION_STATUS_LABEL[status]}
          </StatusBadge>
        </div>
        <p className="mt-1 text-xs text-text-4">
          {c.operationType} · {c.source} · 创建于 {formatTime(c.createdAt)} · 过期 {formatTime(c.expiresAt)}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {actionError && <InlineAlert tone="crit" title="操作失败">{actionError}</InlineAlert>}
        {c.aiRecommendation && <InlineAlert tone="info" title="AI 建议">{c.aiRecommendation}</InlineAlert>}
        {c.externalEffect && (
          <InlineAlert tone="warn" title="外部影响">
            {c.externalEffect}
          </InlineAlert>
        )}
        {c.recoveryPath && <InlineAlert tone="ok" title="恢复路径">{c.recoveryPath}</InlineAlert>}

        <div className="rounded-card border border-border p-3">
          <DetailRow label="来源">{c.source}</DetailRow>
          <DetailRow label="操作类型">{c.operationType}</DetailRow>
          {c.changedFields && c.changedFields.length > 0 && (
            <DetailRow label="变更字段">
              <span className="flex flex-wrap gap-1">
                {c.changedFields.map((f) => (
                  <span key={f} className="rounded-badge bg-surface-2 px-1.5 py-0.5 text-xs text-text-2">
                    {f}
                  </span>
                ))}
              </span>
            </DetailRow>
          )}
          {c.allowedActions && (
            <DetailRow label="允许操作">{c.allowedActions.join('、')}</DetailRow>
          )}
          {c.objectType && (
            <DetailRow label="关联对象">
              {c.objectType} {c.objectId ? <span className="mono text-xs text-text-3">{c.objectId}</span> : null}
            </DetailRow>
          )}
        </div>

        {(c.beforeJson || c.afterJson) && (
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-text-1">前后差异</h3>
            <DiffTable before={c.beforeJson} after={c.afterJson} />
          </div>
        )}

        {c.previewJson && (
          <details className="rounded-ctl border border-border px-3 py-2">
            <summary className="cursor-pointer text-[13px] text-text-2">预览载荷（JSON）</summary>
            <pre className="mono mt-2 max-h-64 overflow-auto text-xs text-text-3">{c.previewJson}</pre>
          </details>
        )}
      </div>

      {pending && (
        <div className="flex shrink-0 items-center gap-2 border-t border-divider px-5 py-3">
          <div className="mr-auto text-xs text-text-4">
            {c.requiresStrictConfirmation && (
              <span className="flex items-center gap-1 text-warn">
                <AlertTriangle className="size-3.5" aria-hidden />
                严格确认：请输入编码 <b className="mono">{strictInput}</b> 后再确认
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            disabled={actions.reject.isPending}
            onClick={() =>
              void run(() => actions.reject.mutateAsync(conf.id), '已拒绝该操作')
            }
          >
            拒绝
          </Button>
          {conf.requiresStrictConfirmation ? (
            <TwoStepButton
              onConfirm={async () => {
                await confirmDispatch()
              }}
              armLabel={`确认执行（输入编码 ${strictInput} 已核对）`}
            >
              确认（严格）
            </TwoStepButton>
          ) : (
            <TwoStepButton
              onConfirm={async () => {
                await confirmDispatch()
              }}
            >
              {conf.requiresSecondLevelConfirmation ? '确认（二级）' : '确认执行'}
            </TwoStepButton>
          )}
        </div>
      )}
    </div>
  )
}

/* ── 页面（主从布局） ─────────────────────────────────────── */

export function ConfirmationsPage() {
  const { data: pending = [], isLoading } = usePendingConfirmations()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId && pending.length > 0) setSelectedId(pending[0]!.id)
    if (selectedId && !pending.some((p) => p.id === selectedId)) {
      setSelectedId(pending[0]?.id ?? null)
    }
  }, [pending, selectedId])

  const list = useMemo(() => pending, [pending])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="确认中心" subtitle="高风险/待确认操作的处置中心" />
      <div className="flex min-h-0 flex-1 gap-4">
        {/* 左列表 */}
        <aside className="w-full max-w-[360px] shrink-0 overflow-y-auto md:w-[360px]">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <Card>
              <EmptyState title="没有待确认的操作" description="高风险操作会在这里等待你的确认。" />
            </Card>
          ) : (
            <ul className="space-y-1.5">
              {list.map((item) => {
                const risk = normalizeRiskLevel(item.riskLevel)
                const selected = item.id === selectedId
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'w-full rounded-card border px-3 py-2.5 text-left transition-colors outline-none',
                        selected
                          ? 'border-primary bg-primary-soft'
                          : 'border-border bg-bg shadow-card hover:border-border-strong',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge tone={riskTone(risk)}>{RISK_LABEL[risk]}</StatusBadge>
                        <span className="ml-auto shrink-0 text-[11px] text-text-4">
                          {formatTime(item.expiresAt)} 过期
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] text-text-1">{item.summary}</p>
                      <p className="mt-0.5 text-[11px] text-text-4">
                        {item.source} · {item.operationType}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* 右详情 */}
        <Card className="hidden min-w-0 flex-1 md:block">
          {selectedId ? (
            <ConfirmationDetail id={selectedId} />
          ) : (
            <div className="grid h-full place-items-center">
              {isLoading ? <Spinner className="size-5" /> : <EmptyState title="选择左侧待确认操作查看详情" />}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
