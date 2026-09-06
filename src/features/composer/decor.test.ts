import { describe, expect, it } from 'vitest'
import { confetti, slotStickers } from './decor'
import { PALETTES } from '@/features/themes/palette'
import { createRng } from '@/shared/utils/seededRandom'
import type { Slot } from '@/features/renderer/types'

const slot: Slot = {
  id: 's',
  mediaId: 'm',
  mediaAspect: 1,
  x: 1,
  y: 2,
  z: 0.02,
  w: 4,
  h: 3,
  rotation: 0,
  frame: 'polaroid',
  kenburns: { start: 0, end: 1, zoomFrom: 1, zoomTo: 1, panFrom: [0, 0], panTo: [0, 0] },
  appear: { kind: 'none', t0: 0, duration: 0 },
  inkSeed: 1,
}

describe('slotStickers', () => {
  it('테이프 1~2개 + 스티커 0~1개, 슬롯 모서리 근처, 창 전달', () => {
    const items = slotStickers(slot, PALETTES.doljanchi, createRng(3), { t0: 1, t1: 5 })
    const tapes = items.filter((i) => i.shape === 'tape')
    expect(tapes.length).toBeGreaterThanOrEqual(1)
    expect(tapes.length).toBeLessThanOrEqual(2)
    expect(items.length).toBeLessThanOrEqual(3)
    for (const it of items) {
      expect(Math.abs(it.x - slot.x)).toBeLessThanOrEqual(slot.w / 2 + 0.3)
      expect(Math.abs(it.y - slot.y)).toBeLessThanOrEqual(slot.h / 2 + 0.3)
      expect(it.window).toEqual({ t0: 1, t1: 5 })
      expect(it.z).toBeGreaterThan(slot.z)
    }
  })
  it('결정적', () => {
    expect(slotStickers(slot, PALETTES.doljanchi, createRng(9))).toEqual(
      slotStickers(slot, PALETTES.doljanchi, createRng(9)),
    )
  })
})

describe('confetti', () => {
  it('영역 안에, 사진 위는 피해서 뿌린다', () => {
    const area = { x: 0, y: 0, w: 16, h: 9 }
    const keep = [{ x: 0, y: 0, w: 8, h: 5 }]
    const items = confetti({
      count: 30,
      area,
      keepOut: keep,
      z: 0.01,
      palette: PALETTES.birthday,
      rng: createRng(1),
    })
    expect(items.length).toBe(30)
    for (const it of items) {
      expect(Math.abs(it.x)).toBeLessThanOrEqual(8)
      expect(Math.abs(it.y)).toBeLessThanOrEqual(4.5)
      expect(Math.abs(it.x) < 4 + it.size && Math.abs(it.y) < 2.5 + it.size).toBe(false)
      expect(it.bob[0]).toBeGreaterThan(0)
    }
  })
})
