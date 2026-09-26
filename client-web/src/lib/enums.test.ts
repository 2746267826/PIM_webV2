import { describe, expect, it } from 'vitest'
import {
  normalizeConfirmationStatus,
  normalizeHealthStatus,
  normalizeRiskLevel,
  riskTone,
} from './enums'

describe('normalizeHealthStatus（后端输出数字，必须归一化）', () => {
  it('数字 0–3 → 语义字符串', () => {
    expect(normalizeHealthStatus(0)).toBe('unknown')
    expect(normalizeHealthStatus(1)).toBe('healthy')
    expect(normalizeHealthStatus(2)).toBe('warning')
    expect(normalizeHealthStatus(3)).toBe('critical')
  })

  it('字符串兼容（大小写不敏感）', () => {
    expect(normalizeHealthStatus('Critical')).toBe('critical')
    expect(normalizeHealthStatus('healthy')).toBe('healthy')
  })

  it('未知值兜底 unknown', () => {
    expect(normalizeHealthStatus(99)).toBe('unknown')
    expect(normalizeHealthStatus(undefined)).toBe('unknown')
  })
})

describe('normalizeRiskLevel', () => {
  it('数字 0/1/2/10–14 → 枚举名', () => {
    expect(normalizeRiskLevel(0)).toBe('Low')
    expect(normalizeRiskLevel(12)).toBe('L2PimFactChange')
    expect(normalizeRiskLevel(14)).toBe('L4BatchOrDestructiveGovernance')
  })

  it('字符串透传', () => {
    expect(normalizeRiskLevel('L2PimFactChange')).toBe('L2PimFactChange')
  })

  it('徽标色调映射', () => {
    expect(riskTone('L1LowRiskAction')).toBe('ok')
    expect(riskTone('L2PimFactChange')).toBe('warn')
    expect(riskTone('L4BatchOrDestructiveGovernance')).toBe('crit')
    expect(riskTone('Medium')).toBe('info')
  })
})

describe('normalizeConfirmationStatus', () => {
  it('数字 0–4 → 枚举名', () => {
    expect(normalizeConfirmationStatus(0)).toBe('Pending')
    expect(normalizeConfirmationStatus(4)).toBe('Executed')
  })
})
