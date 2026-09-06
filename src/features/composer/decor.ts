import type { DecorItem, DecorShape, Slot } from '@/features/renderer/types'
import type { Palette } from '@/features/themes/palette'
import type { Rng } from '@/shared/utils/seededRandom'

const STICKERS: DecorShape[] = ['heart', 'star', 'circle', 'sparkle', 'ring']

/** 사진 슬롯 모서리에 마스킹테이프 1~2개와 가끔 스티커 하나. 슬롯이 보이는 창에만 나타난다 */
export function slotStickers(
  slot: Slot,
  palette: Palette,
  rng: Rng,
  window?: { t0: number; t1: number },
): DecorItem[] {
  const items: DecorItem[] = []
  const z = slot.z + 0.02
  const tapeW = Math.min(slot.w, slot.h) * 0.42
  const corners: [number, number][] = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ]
  const order = rng.shuffle(corners)
  const tapeCount = rng.next() < 0.55 ? 2 : 1
  for (let i = 0; i < tapeCount; i++) {
    const [cx, cy] = order[i]
    items.push({
      shape: 'tape',
      x: slot.x + (cx * slot.w) / 2,
      y: slot.y + (cy * slot.h) / 2,
      z,
      size: tapeW,
      aspect: 0.3,
      rotation: (cx * cy > 0 ? -1 : 1) * (Math.PI / 4) + rng.range(-0.15, 0.15),
      color: rng.pick(palette.tapes),
      opacity: 0.92,
      bob: [0, 0, 0],
      window,
    })
  }
  if (rng.next() < 0.5) {
    const [cx, cy] = order[tapeCount]
    const s = Math.min(slot.w, slot.h) * rng.range(0.14, 0.22)
    items.push({
      shape: rng.pick(STICKERS),
      x: slot.x + (cx * slot.w) / 2 + rng.range(-0.1, 0.1) * s,
      y: slot.y + (cy * slot.h) / 2 + rng.range(-0.1, 0.1) * s,
      z: z + 0.001,
      size: s,
      aspect: 1,
      rotation: rng.range(-0.5, 0.5),
      color: rng.pick(palette.accents),
      opacity: 0.95,
      bob: [0.01, rng.range(1.2, 2.2), rng.range(0, 6.28)],
      window,
    })
  }
  return items
}

/** 배경 컨페티: 영역 안에 흩뿌리되 keepOut(사진들) 안쪽은 피한다. 살랑살랑 떠다닌다 */
export function confetti(opts: {
  count: number
  area: { x: number; y: number; w: number; h: number }
  keepOut: { x: number; y: number; w: number; h: number }[]
  z: number
  palette: Palette
  rng: Rng
  size?: [number, number]
  window?: { t0: number; t1: number }
}): DecorItem[] {
  const { count, area, keepOut, z, palette, rng, size = [0.12, 0.3], window } = opts
  const items: DecorItem[] = []
  let guard = 0
  while (items.length < count && guard++ < count * 20) {
    const x = area.x + rng.range(-area.w / 2, area.w / 2)
    const y = area.y + rng.range(-area.h / 2, area.h / 2)
    const s = rng.range(size[0], size[1])
    const blocked = keepOut.some(
      (k) => Math.abs(x - k.x) < k.w / 2 + s && Math.abs(y - k.y) < k.h / 2 + s,
    )
    if (blocked) continue
    const shape = rng.pick<DecorShape>(['circle', 'circle', 'heart', 'star', 'sparkle', 'ring'])
    items.push({
      shape,
      x,
      y,
      z,
      size: s,
      aspect: 1,
      rotation: rng.range(0, Math.PI * 2),
      color: rng.pick(palette.accents),
      opacity: shape === 'sparkle' ? 0.9 : 0.8,
      bob: [rng.range(0.03, 0.09), rng.range(0.5, 1.3), rng.range(0, 6.28)],
      window,
    })
  }
  return items
}
