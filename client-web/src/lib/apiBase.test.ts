import { beforeEach, describe, expect, it } from 'vitest'
import {
  apiUrl,
  candidateUrl,
  getApiBase,
  getApiBaseHistory,
  needsServerSetup,
  setApiBase,
} from './apiBase'
import { STORAGE_KEYS, remove } from './storage'

beforeEach(() => {
  remove(STORAGE_KEYS.apiBase)
  remove(STORAGE_KEYS.apiBaseHistory)
})

describe('setApiBase / getApiBase', () => {
  it('去除尾部斜杠', () => {
    setApiBase('http://192.168.1.10:5858///')
    expect(getApiBase()).toBe('http://192.168.1.10:5858')
  })

  it('空值表示同源', () => {
    setApiBase('  ')
    expect(getApiBase()).toBe('')
  })

  it('无协议地址抛错', () => {
    expect(() => setApiBase('192.168.1.10:5858')).toThrow('协议')
  })
})

describe('apiUrl / candidateUrl', () => {
  it('同源时原样返回相对路径', () => {
    setApiBase('')
    expect(apiUrl('/api/v1/status')).toBe('/api/v1/status')
  })

  it('配置后拼接绝对地址', () => {
    setApiBase('http://10.0.0.2:5858')
    expect(apiUrl('/api/v1/status')).toBe('http://10.0.0.2:5858/api/v1/status')
  })

  it('candidateUrl 不影响当前生效地址', () => {
    setApiBase('http://a.example')
    expect(candidateUrl('http://b.example/', '/api/version')).toBe('http://b.example/api/version')
    expect(getApiBase()).toBe('http://a.example')
  })
})

describe('历史记录', () => {
  it('去重并置顶，最多 5 条', () => {
    for (const b of ['http://a', 'http://b', 'http://c', 'http://d', 'http://e', 'http://f']) {
      setApiBase(b)
    }
    let hist = getApiBaseHistory()
    expect(hist).toEqual(['http://f', 'http://e', 'http://d', 'http://c', 'http://b'])
    setApiBase('http://d')
    hist = getApiBaseHistory()
    expect(hist[0]).toBe('http://d')
    expect(hist).toHaveLength(5)
  })
})

describe('needsServerSetup（壳内未配置 → 首启向导）', () => {
  it('非壳环境恒为 false', () => {
    setApiBase('')
    expect(needsServerSetup()).toBe(false)
  })
})
