import { describe, expect, it } from 'vitest'
import { musicGain } from './envelope'

const base = { end: 30, musicDuration: 60, fadeIn: 2, fadeOut: 4, volume: 0.8 }

describe('musicGain', () => {
  it('시작은 0, 페이드인 후 volume', () => {
    expect(musicGain(0, base)).toBe(0)
    expect(musicGain(1, base)).toBeCloseTo(0.4)
    expect(musicGain(10, base)).toBeCloseTo(0.8)
  })
  it('영상 끝 전 fadeOut 동안 내려가고 끝에서 0', () => {
    expect(musicGain(28, base)).toBeCloseTo(0.4)
    expect(musicGain(30, base)).toBe(0)
    expect(musicGain(31, base)).toBe(0)
  })
  it('음악이 영상보다 짧으면 음악 끝 기준으로 페이드아웃', () => {
    const g = { ...base, musicDuration: 20 }
    expect(musicGain(18, g)).toBeCloseTo(0.4)
    expect(musicGain(20, g)).toBe(0)
  })
  it('페이드가 0이면 계단', () => {
    expect(musicGain(0.001, { ...base, fadeIn: 0 })).toBeCloseTo(0.8)
  })
})
