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

  it('모든 미디어가 정확히 한 슬롯에 배치된다', () => {
    expect(comp.slots.map((s) => s.mediaId).sort()).toEqual(media.map((m) => m.id).sort())
    expect(stage.pages.flatMap((p) => p.slots).length).toBe(media.length)
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
    for (const s of comp.slots) {
      expect(s.appear.kind).toBe('ink')
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
