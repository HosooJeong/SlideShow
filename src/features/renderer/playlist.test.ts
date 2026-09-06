import { describe, expect, it } from 'vitest'
import { itemWindow, playlistAt, scheduleSwaps } from './playlist'
import type { PlaylistItem, Slot } from './types'

const items: PlaylistItem[] = [
  { mediaId: 'a', mediaAspect: 1, t0: 1, duration: 0, kind: 'cut', dir: [1, 0] },
  { mediaId: 'b', mediaAspect: 1, t0: 3, duration: 0.4, kind: 'wipe', dir: [1, 0] },
  { mediaId: 'c', mediaAspect: 1, t0: 5, duration: 0.4, kind: 'push', dir: [0, 1] },
]

describe('playlistAt', () => {
  it('첫 항목 전에도 첫 항목을 가리킨다', () => {
    expect(playlistAt(items, 0)).toMatchObject({ index: 0, prev: -1, mix: 1 })
  })
  it('전환 중에는 이전 항목과 진행도를 준다', () => {
    const s = playlistAt(items, 3.2)
    expect(s.index).toBe(1)
    expect(s.prev).toBe(0)
    expect(s.mix).toBeGreaterThan(0)
    expect(s.mix).toBeLessThan(1)
    expect(s.kind).toBe('wipe')
  })
  it('전환이 끝나면 prev가 없다', () => {
    expect(playlistAt(items, 3.5)).toMatchObject({ index: 1, prev: -1, mix: 1 })
    expect(playlistAt(items, 9)).toMatchObject({ index: 2, prev: -1, mix: 1 })
  })
  it('빈 목록', () => {
    expect(playlistAt([], 1).index).toBe(-1)
  })
})

describe('itemWindow', () => {
  const slot = { playlist: items } as Slot
  it('다음 항목 시작까지', () => {
    expect(itemWindow(slot, 0, 99)).toEqual({ start: 1, end: 3 })
  })
  it('마지막은 슬롯 끝까지', () => {
    expect(itemWindow(slot, 2, 12)).toEqual({ start: 5, end: 12 })
  })
})

describe('scheduleSwaps', () => {
  const mk = (n: number): Slot[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      mediaId: '',
      mediaAspect: 1,
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      h: 1,
      rotation: 0,
      frame: 'none',
      kenburns: { start: 0, end: 0, zoomFrom: 1, zoomTo: 1, panFrom: [0, 0], panTo: [0, 0] },
      appear: { kind: 'none', t0: 0, duration: 0 },
      inkSeed: 1,
    }))
  const media = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, width: 4, height: 3 }))

  it('슬롯마다 첫 장을 엇갈려 채우고 이후 한 슬롯씩 갈아끼운다', () => {
    const slots = mk(3)
    const used = scheduleSwaps({
      slots,
      media,
      from: 0,
      start: 10,
      end: 20,
      interval: 1,
      stagger: 0.1,
      swapDuration: 0.35,
      pick: () => ({ kind: 'wipe', dir: [1, 0] }),
    })
    expect(slots.map((s) => s.playlist![0].mediaId)).toEqual(['m0', 'm1', 'm2'])
    expect(slots.map((s) => s.playlist![0].t0)).toEqual([10, 10.1, 10.2])
    const swaps = slots.flatMap((s) => s.playlist!.slice(1).map((p) => ({ t0: p.t0, id: s.id })))
    swaps.sort((a, b) => a.t0 - b.t0)
    // 순차: 서로 다른 슬롯이 돌아가며 바뀌고 같은 시각에 두 슬롯이 바뀌지 않는다
    for (let i = 1; i < swaps.length; i++) expect(swaps[i].t0).toBeGreaterThan(swaps[i - 1].t0)
    expect(swaps[0].id).toBe('s0')
    expect(swaps[1].id).toBe('s1')
    expect(swaps[0].t0).toBeCloseTo(11)
    expect(used).toBe(3 + swaps.length)
    // 마지막 교체는 끝 0.6초 전에 끝난다
    expect(Math.max(...swaps.map((s) => s.t0)) + 0.35).toBeLessThan(20 - 0.6)
  })
  it('미디어가 다 소비되면 멈춘다', () => {
    const slots = mk(2)
    const used = scheduleSwaps({
      slots,
      media: media.slice(0, 3),
      from: 0,
      start: 0,
      end: 60,
      interval: 1,
      stagger: 0,
      swapDuration: 0.3,
      pick: () => ({ kind: 'cut', dir: [1, 0] }),
    })
    expect(used).toBe(3)
  })
})
