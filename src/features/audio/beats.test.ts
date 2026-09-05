import { describe, expect, it } from 'vitest'
import { beatGrid, detectBeats, estimateBpm, onsetEnvelope, quantizeTimings } from './beats'

/** bpm 박자의 클릭 트랙(짧은 감쇠 사인 버스트) + 약한 노이즈 */
function clickTrack(bpm: number, seconds: number, sr = 22050, offset = 0.1) {
  const n = Math.floor(seconds * sr)
  const out = new Float32Array(n)
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1
  for (let i = 0; i < n; i++) out[i] = rnd() * 0.01
  const period = 60 / bpm
  for (let t = offset; t < seconds; t += period) {
    const start = Math.floor(t * sr)
    for (let i = 0; i < 1200 && start + i < n; i++) {
      out[start + i] += Math.sin((i / sr) * 2 * Math.PI * 1000) * Math.exp(-i / 300) * 0.8
    }
  }
  return out
}

describe('detectBeats', () => {
  it('120bpm 클릭 트랙의 템포를 찾는다', () => {
    const { bpm, confidence } = estimateBpm(onsetEnvelope(clickTrack(120, 12)), 22050)
    expect(Math.abs(bpm - 120)).toBeLessThan(2)
    expect(confidence).toBeGreaterThan(0.2)
  })
  it('90bpm도 찾는다', () => {
    const { bpm } = estimateBpm(onsetEnvelope(clickTrack(90, 12)), 22050)
    expect(Math.abs(bpm - 90)).toBeLessThan(2)
  })
  it('비트 그리드 위상이 클릭 위치에 맞는다', () => {
    const info = detectBeats(clickTrack(120, 12, 22050, 0.25), 22050)
    expect(info.beats.length).toBeGreaterThan(20)
    // 클릭은 0.25 + k*0.5 에 있다
    const errs = info.beats.slice(1, 10).map((b) => Math.abs((((b - 0.25) % 0.5) + 0.5) % 0.5))
    const nearest = errs.map((e) => Math.min(e, 0.5 - e))
    expect(Math.max(...nearest)).toBeLessThan(0.06)
  })
  it('무음은 bpm 0', () => {
    expect(detectBeats(new Float32Array(22050 * 4), 22050).bpm).toBe(0)
  })
})

describe('beatGrid', () => {
  it('길이 안의 비트만 만든다', () => {
    const grid = beatGrid(new Float32Array(1000), 120, 10, 22050)
    expect(grid[grid.length - 1]).toBeLessThan(10)
    expect(grid.length).toBeGreaterThanOrEqual(19)
  })
})

describe('quantizeTimings', () => {
  it('이동+머무름이 비트 주기의 정수배가 된다', () => {
    const q = quantizeTimings({ dwell: 2.4, travel: 1.3 }, 120)
    expect(((q.dwell + q.travel) / 0.5) % 1).toBeCloseTo(0)
  })
  it('bpm이 0이면 그대로', () => {
    expect(quantizeTimings({ dwell: 2.4, travel: 1.3 }, 0)).toEqual({ dwell: 2.4, travel: 1.3 })
  })
  it('머무름은 최소 반 비트 이상', () => {
    const q = quantizeTimings({ dwell: 0.1, travel: 1.3 }, 60)
    expect(q.dwell).toBeGreaterThanOrEqual(0.5)
  })
})
