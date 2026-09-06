import { describe, expect, it } from 'vitest'
import { COLLAGE_PRESETS, composeCollage } from './composeCollage'
import type { CollageStage } from '@/features/renderer/types'

const media = Array.from({ length: 14 }, (_, i) => ({
  id: `m${i}`,
  width: i % 2 ? 1600 : 900,
  height: i % 2 ? 1200 : 1600,
}))

describe('composeCollage', () => {
  const comp = composeCollage(media, { seed: 5, aspect: '16:9' })
  const stage = comp.stage as CollageStage

  it('결정적이고 콜라주 무대다', () => {
    expect(stage.kind).toBe('collage')
    expect(composeCollage(media, { seed: 5, aspect: '16:9' })).toEqual(comp)
  })
  it('모든 미디어가 어떤 슬롯의 플레이리스트에 한 번 이상 등장한다', () => {
    const seen = new Set(comp.slots.flatMap((s) => (s.playlist ?? []).map((p) => p.mediaId)))
    for (const m of media) expect(seen.has(m.id)).toBe(true)
  })
  it('레이아웃은 연속으로 같은 프리셋을 쓰지 않고, 시간이 이어진다', () => {
    for (let i = 1; i < stage.layouts.length; i++) {
      expect(stage.layouts[i].preset).not.toBe(stage.layouts[i - 1].preset)
      expect(stage.layouts[i].t0).toBeCloseTo(stage.layouts[i - 1].t1)
    }
    expect(comp.duration).toBeGreaterThan(stage.layouts[stage.layouts.length - 1].t1)
  })
  it('슬롯은 보드 안에 있고 셀 프리셋과 개수가 맞는다', () => {
    for (const l of stage.layouts) {
      const ls = comp.slots.filter((s) => s.kenburns.start === l.t0)
      expect(ls.length).toBe(COLLAGE_PRESETS[l.preset].length)
      for (const s of ls) {
        expect(Math.abs(s.x) + s.w / 2).toBeLessThanOrEqual(stage.width / 2)
        expect(Math.abs(s.y) + s.h / 2).toBeLessThanOrEqual(stage.height / 2)
      }
    }
  })
  it('여러 슬롯 레이아웃에서 교체는 한 슬롯씩 순차로 일어난다', () => {
    const multi = stage.layouts.find((l) => COLLAGE_PRESETS[l.preset].length >= 2)!
    const ls = comp.slots.filter((s) => s.kenburns.start === multi.t0)
    const swaps = ls
      .flatMap((s) => (s.playlist ?? []).slice(1).map((p) => p.t0))
      .sort((a, b) => a - b)
    for (let i = 1; i < swaps.length; i++) expect(swaps[i] - swaps[i - 1]).toBeGreaterThan(0.3)
  })
  it('비트가 있으면 교체 시각이 비트에 놓인다', () => {
    const beat = { period: 0.5, phase: 0.1 }
    const c = composeCollage(media, { seed: 2, aspect: '16:9', beat })
    for (const m of c.markers!) {
      const r = (((m - beat.phase) % beat.period) + beat.period) % beat.period
      expect(Math.min(r, beat.period - r)).toBeLessThan(1e-6)
    }
  })
  it('세로 화면은 세로형 프리셋만 쓴다', () => {
    const v = composeCollage(media, { seed: 9, aspect: '9:16' }).stage as CollageStage
    for (const l of v.layouts) expect(['1', '2v', '3x1', '2x2']).toContain(l.preset)
  })
  it('미디어가 없어도 레이아웃 하나는 만든다', () => {
    const e = composeCollage([], { seed: 1, aspect: '16:9' })
    expect((e.stage as CollageStage).layouts.length).toBe(1)
    expect(e.slots.every((s) => s.mediaId === '')).toBe(true)
  })
})
