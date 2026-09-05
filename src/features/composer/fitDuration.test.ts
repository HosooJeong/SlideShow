import { describe, expect, it } from 'vitest'
import { DEFAULT_TIMINGS, fitTimings } from './fitDuration'
import { composeNewspaper } from './composeNewspaper'

const media = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, width: 1600, height: 1200 }))

describe('fitTimings', () => {
  it('목표가 같으면 기본값', () => {
    expect(fitTimings(60, 60)).toEqual(DEFAULT_TIMINGS)
  })
  it('목표가 길면 머무름이 늘고, 한계 안에 머문다', () => {
    const t = fitTimings(60, 120)
    expect(t.dwell).toBeGreaterThan(DEFAULT_TIMINGS.dwell)
    expect(t.dwell).toBeLessThanOrEqual(6)
    expect(fitTimings(60, 6000).dwell).toBe(6)
  })
  it('목표가 짧으면 줄어들되 하한 이상', () => {
    expect(fitTimings(60, 10).dwell).toBeGreaterThanOrEqual(1.2)
  })
  it('잘못된 입력은 기본값', () => {
    expect(fitTimings(0, 30)).toEqual(DEFAULT_TIMINGS)
  })
  it('실제 컴포저에 적용하면 길이가 목표 방향으로 움직인다', () => {
    const opts = { seed: 3, aspect: '16:9' as const }
    const base = composeNewspaper(media, opts)
    const target = base.duration * 1.5
    const fitted = composeNewspaper(media, { ...opts, ...fitTimings(base.duration, target) })
    expect(fitted.duration).toBeGreaterThan(base.duration)
    expect(Math.abs(fitted.duration - target) / target).toBeLessThan(0.25)
  })
})
