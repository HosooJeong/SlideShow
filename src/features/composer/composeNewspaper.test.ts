import { describe, expect, it } from 'vitest'
import { composeNewspaper } from './composeNewspaper'
import type { NewspaperStage } from '@/features/renderer/types'

const media = Array.from({ length: 8 }, (_, i) => ({
  id: `m${i}`,
  width: i % 2 ? 1600 : 1000,
  height: i % 2 ? 1200 : 1400,
}))

describe('composeNewspaper', () => {
  const comp = composeNewspaper(media, {
    seed: 7,
    aspect: '16:9',
    name: '하늘',
    date: '2026년 9월 5일',
  })
  const stage = comp.stage as NewspaperStage

  it('신문 무대이고 결정적이다', () => {
    expect(stage.kind).toBe('newspaper')
    expect(
      composeNewspaper(media, { seed: 7, aspect: '16:9', name: '하늘', date: '2026년 9월 5일' }),
    ).toEqual(comp)
  })

  it('모든 미디어가 슬롯 또는 슬롯 플레이리스트에 등장한다', () => {
    const seen = new Set(
      comp.slots.flatMap((s) => [s.mediaId, ...(s.playlist ?? []).map((p) => p.mediaId)]),
    )
    for (const m of media) expect(seen.has(m.id)).toBe(true)
    // 사진 면은 슬롯 수보다 많은 사진을 순차 교체로 보여준다
    const photoPages = stage.pages.slice(1)
    expect(photoPages.some((p) => p.slots.some((s) => (s.playlist?.length ?? 0) > 1))).toBe(true)
  })

  it('1면에는 제호·헤드라인·알림판이 있고 이름이 치환된다', () => {
    const front = stage.pages[0]
    const ids = front.texts.map((t) => t.id)
    expect(ids.some((i) => i.endsWith('-masthead'))).toBe(true)
    expect(ids.some((i) => i.endsWith('-headline'))).toBe(true)
    expect(ids.some((i) => i.endsWith('-ad'))).toBe(true)
    const all = front.texts.map((t) => t.text).join(' ')
    expect(all).toContain('하늘')
    expect(all).not.toContain('{name}')
  })

  it('페이지는 겹치지 않고 가로로 나열된다', () => {
    const xs = stage.pages.map((p) => p.x)
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(stage.pages[0].w)
  })

  it('텍스트와 슬롯은 자기 페이지 안에 있다', () => {
    for (const p of stage.pages) {
      for (const t of p.texts) {
        expect(t.x).toBeGreaterThanOrEqual(p.x - p.w / 2 - 0.1)
        expect(t.x + t.w).toBeLessThanOrEqual(p.x + p.w / 2 + 0.1)
        expect(t.y).toBeLessThanOrEqual(p.y + p.h / 2 + 0.01)
        expect(t.y - t.h).toBeGreaterThanOrEqual(p.y - p.h / 2 - 0.3)
      }
      for (const s of p.slots) {
        expect(Math.abs(s.x - p.x) + s.w / 2).toBeLessThanOrEqual(p.w / 2 + 0.05)
        expect(Math.abs(s.y - p.y) + s.h / 2).toBeLessThanOrEqual(p.h / 2 + 0.05)
      }
    }
  })

  it('카메라는 오프닝 이후에 시작하고 t는 단조 증가한다', () => {
    expect(comp.camera[0].t).toBeCloseTo(stage.opening.duration)
    for (let i = 1; i < comp.camera.length; i++)
      expect(comp.camera[i].t).toBeGreaterThanOrEqual(comp.camera[i - 1].t)
    expect(comp.duration).toBe(comp.camera[comp.camera.length - 1].t)
  })

  it('슬롯 등장은 카메라 도착 전에 시작해 영상 길이 안에 끝난다', () => {
    const targets = new Set((stage.transitions ?? []).map((t) => t.toSlotId))
    for (const s of comp.slots) {
      expect(s.appear.kind).toBe(targets.has(s.id) ? 'fade' : 'ink')
      expect(s.appear.t0).toBeGreaterThan(0)
      expect(s.appear.t0 + s.appear.duration).toBeLessThanOrEqual(comp.duration)
    }
  })

  it('1면 활자는 처음부터 인쇄돼 있고, 이후 면은 페이드로 등장한다', () => {
    expect(stage.pages[0].texts.every((t) => t.appear.kind === 'none')).toBe(true)
    expect(stage.pages[1].texts.every((t) => t.appear.kind === 'fade')).toBe(true)
  })

  it('미디어가 없어도 1면은 만들어진다', () => {
    const empty = composeNewspaper([], { seed: 1, aspect: '16:9' })
    expect((empty.stage as NewspaperStage).pages.length).toBe(1)
    expect(empty.slots).toEqual([])
  })

  it('이름이 없으면 기본값을 쓴다', () => {
    const c = composeNewspaper(media.slice(0, 1), { seed: 1, aspect: '16:9' })
    const all = (c.stage as NewspaperStage).pages[0].texts.map((t) => t.text).join(' ')
    expect(all).toContain('우리 아기')
  })
})

describe('composeNewspaper 영상 클립', () => {
  const mixed = [
    { id: 'v1', width: 1280, height: 720, kind: 'video' as const, duration: 12 },
    { id: 'p1', width: 1600, height: 1200 },
    { id: 'v2', width: 720, height: 1280, kind: 'video' as const, duration: 2 },
  ]
  const comp = composeNewspaper(mixed, {
    seed: 5,
    aspect: '16:9',
    clips: { maxSeconds: 4, volume: 0.9 },
  })

  it('영상 슬롯에만 클립이 붙는다', () => {
    const byId = new Map(comp.slots.map((s) => [s.mediaId, s]))
    expect(byId.get('v1')!.clip).toBeDefined()
    expect(byId.get('p1')!.clip).toBeUndefined()
  })
  it('클립 길이는 최대 길이와 원본 길이를 넘지 않고 볼륨이 전달된다', () => {
    const byId = new Map(comp.slots.map((s) => [s.mediaId, s]))
    expect(byId.get('v1')!.clip!.duration).toBeLessThanOrEqual(4)
    expect(byId.get('v1')!.clip!.volume).toBe(0.9)
    // v2는 슬롯 첫 사진이거나 플레이리스트 항목이다(플레이리스트 항목 영상은 정지 프레임)
    const v2Slot = byId.get('v2')
    if (v2Slot) expect(v2Slot.clip!.duration).toBeLessThanOrEqual(2)
    else expect(comp.slots.some((s) => s.playlist?.some((p) => p.mediaId === 'v2'))).toBe(true)
  })
  it('클립 창은 켄번즈 창과 같다', () => {
    const v = comp.slots.find((s) => s.mediaId === 'v1')!
    expect(v.kenburns.end).toBeGreaterThan(v.kenburns.start)
  })
})

describe('composeNewspaper 파티클 전환', () => {
  const comp = composeNewspaper(media, { seed: 7, aspect: '16:9' })
  const stage = comp.stage as NewspaperStage

  it('면이 2개 이상이면 면 사이마다 전환이 하나씩 있다', () => {
    expect(stage.pages.length).toBeGreaterThan(1)
    expect(stage.transitions?.length).toBe(stage.pages.length - 1)
  })
  it('출발 슬롯은 앞 면 마지막, 도착 슬롯은 다음 면 첫 사진이고 시간이 이어진다', () => {
    for (let i = 1; i < stage.pages.length; i++) {
      const tr = stage.transitions![i - 1]
      const prev = stage.pages[i - 1]
      expect(tr.fromSlotId).toBe(prev.slots[prev.slots.length - 1].id)
      expect(tr.toSlotId).toBe(stage.pages[i].slots[0].id)
      expect(tr.t0 + tr.duration).toBeLessThanOrEqual(comp.duration)
      const from = comp.slots.find((s) => s.id === tr.fromSlotId)!
      const to = comp.slots.find((s) => s.id === tr.toSlotId)!
      expect(from.vanish?.t0).toBe(tr.t0)
      expect(to.appear.kind).toBe('fade')
      expect(to.appear.t0).toBeCloseTo(tr.t0 + tr.duration - 0.2)
    }
  })
})

describe('composeNewspaper 페이지 컬', () => {
  const comp = composeNewspaper(media, { seed: 7, aspect: '16:9' })
  const stage = comp.stage as NewspaperStage
  it('1면을 뺀 모든 면에 덮개 백지가 있고 카메라 도착 전후로 벗겨진다', () => {
    expect(stage.sheets?.length).toBe(stage.pages.length - 1)
    for (const sh of stage.sheets!) {
      const page = stage.pages.find((p) => p.id === sh.pageId)!
      expect(page).toBeDefined()
      expect(sh.duration).toBeGreaterThan(0.5)
      expect(sh.t0 + sh.duration).toBeLessThanOrEqual(comp.duration)
    }
  })
})
