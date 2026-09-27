import { describe, expect, it } from 'vitest'
import { heatLevel, HEAT_RAMP_BLUE } from './github-heatmap'

describe('heatLevel（GitHub 贡献图色阶：0 为空格，其余按最大值四等分）', () => {
  it('0 与负值归为第 0 档（空格）', () => {
    expect(heatLevel(0, 100)).toBe(0)
    expect(heatLevel(-5, 100)).toBe(0)
  })

  it('按四等分映射到 1–4 档', () => {
    expect(heatLevel(10, 100)).toBe(1)
    expect(heatLevel(25, 100)).toBe(1)
    expect(heatLevel(26, 100)).toBe(2)
    expect(heatLevel(50, 100)).toBe(2)
    expect(heatLevel(51, 100)).toBe(3)
    expect(heatLevel(75, 100)).toBe(3)
    expect(heatLevel(76, 100)).toBe(4)
    expect(heatLevel(100, 100)).toBe(4)
  })

  it('有值但最大值为 0 时至少落在第 1 档', () => {
    expect(heatLevel(7, 0)).toBe(1)
  })

  it('色阶为 5 档（含空格）', () => {
    expect(HEAT_RAMP_BLUE).toHaveLength(5)
  })
})
