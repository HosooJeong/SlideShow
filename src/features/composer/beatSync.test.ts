import { describe, expect, it } from 'vitest'
import { beatOptsFrom, phaseDelay, quantizeToBeat } from './beatSync'
import { composeNewspaper } from './composeNewspaper'
import { composeStream } from './composeStream'

const media = Array.from({ length: 7 }, (_, i) => ({
  id: `m${i}`,
  width: i % 2 ? 1600 : 900,
  height: i % 2 ? 1200 : 1600,
}))
const beat = { period: 0.5, phase: 0.2 } // 120 BPM, 첫 비트 0.2s

const onBeat = (t: number) => {
  const r = (((t - beat.phase) % beat.period) + beat.period) % beat.period
  return Math.min(r, beat.period - r)
}

describe('beatOptsFrom', () => {
  it('신뢰도가 낮거나 꺼져 있으면 undefined', () => {
    expect(
      beatOptsFrom({ beats: { bpm: 120, beats: [0.2], confidence: 0.05 }, syncBeats: true }),
    ).toBeUndefined()
    expect(
      beatOptsFrom({ beats: { bpm: 120, beats: [0.2], confidence: 0.9 }, syncBeats: false }),
    ).toBeUndefined()
  })
  it('주기와 위상을 만든다', () => {
    const o = beatOptsFrom({ beats: { bpm: 120, beats: [1.7], confidence: 0.9 }, syncBeats: true })
    expect(o?.period).toBeCloseTo(0.5)
    expect(o?.phase).toBeCloseTo(0.2)
  })
})

describe('quantizeToBeat / phaseDelay', () => {
  it('정수배로 올림·내림', () => {
    expect(quantizeToBeat(1.4, beat)).toBeCloseTo(1.5)
    expect(quantizeToBeat(0.1, beat)).toBeCloseTo(0.5)
    expect(quantizeToBeat(1.4, undefined)).toBe(1.4)
  })
  it('지연을 더하면 위상에 맞는다', () => {
    const a = 3.33
    expect(onBeat(a + phaseDelay(a, beat))).toBeLessThan(1e-9)
  })
})

describe('비트 동기 컴포저', () => {
  it('신문: 모든 도착 마커가 비트에 놓인다', () => {
    const comp = composeNewspaper(media, { seed: 3, aspect: '16:9', beat })
    expect(comp.markers!.length).toBeGreaterThan(5)
    for (const m of comp.markers!) expect(onBeat(m)).toBeLessThan(1e-6)
  })
  it('스트림: 모든 도착 마커가 비트에 놓인다', () => {
    const comp = composeStream(media, { seed: 3, aspect: '16:9', beat })
    expect(comp.markers!.length).toBe(media.length)
    for (const m of comp.markers!) expect(onBeat(m)).toBeLessThan(1e-6)
  })
  it('비트 없이도 마커는 있다', () => {
    expect(composeNewspaper(media, { seed: 3, aspect: '16:9' }).markers!.length).toBeGreaterThan(0)
  })
})
