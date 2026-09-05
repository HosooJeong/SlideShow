import { buildVisitPath, pathDuration } from '@/features/renderer/camera/cameraPath'
import { halftoneDefaults } from '@/features/renderer/devices/shaders/halftoneMaterial'
import { inkRevealDefaults } from '@/features/renderer/devices/shaders/inkRevealMaterial'
import { paperDefaults } from '@/features/renderer/devices/shaders/paperMaterial'
import type { Composition, Slot } from '@/features/renderer/types'
import { createRng } from '@/shared/utils/seededRandom'

export type ComposeMedia = { id: string; width: number; height: number }

export type ComposeOptions = {
  seed: number
  aspect: '16:9' | '9:16' | '1:1'
  /** 슬롯당 머무는 시간(초) */
  dwell?: number
  travel?: number
  halftoneStrength?: number
}

export const FOV = 38
const TAN_HALF = Math.tan(((FOV / 2) * Math.PI) / 180)

/** 무대(종이) 크기. 화면 비율에 맞춘 단위 좌표 */
export function stageSize(aspect: ComposeOptions['aspect']): [number, number] {
  if (aspect === '9:16') return [9, 16]
  if (aspect === '1:1') return [12, 12]
  return [16, 9]
}

/** 높이 h가 화면 세로의 fill 비율을 차지하도록 하는 카메라 거리 */
export function distanceForHeight(h: number, fill: number) {
  return h / fill / (2 * TAN_HALF)
}

/**
 * 종이 무대 컴포저. 사진들을 종이 위에 흩뿌리고 카메라가 차례로 방문한다.
 * 같은 (media, options)면 항상 같은 결과.
 */
export function composePaper(media: ComposeMedia[], opts: ComposeOptions): Composition {
  const rng = createRng(opts.seed)
  const [W, H] = stageSize(opts.aspect)
  const dwell = opts.dwell ?? 2.4
  const travel = opts.travel ?? 1.3
  const n = media.length

  // 격자에 흩뿌리기: 셀마다 사진 하나, 셀 안에서 지터
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * W) / H)))
  const rows = Math.max(1, Math.ceil(n / cols))
  const usableW = W * 0.86
  const usableH = H * 0.86
  const cellW = usableW / cols
  const cellH = usableH / rows
  const cell = Math.min(cellW, cellH)

  const slots: Slot[] = media.map((m, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = -usableW / 2 + cellW * (col + 0.5)
    const cy = usableH / 2 - cellH * (row + 0.5)
    const mediaAspect = m.width / m.height || 1
    // 슬롯 비율은 사진 비율을 따르되 극단은 눌러준다
    const slotAspect = Math.min(1.6, Math.max(0.65, mediaAspect))
    const longest = cell * rng.range(0.78, 0.94)
    const w = slotAspect >= 1 ? longest : longest * slotAspect
    const h = slotAspect >= 1 ? longest / slotAspect : longest
    const zoomIn = rng.next() < 0.6
    const zoomA = rng.range(1.0, 1.06)
    const zoomB = rng.range(1.12, 1.22)
    const pan = () => [rng.range(-0.06, 0.06), rng.range(-0.04, 0.04)] as [number, number]
    return {
      id: `slot-${i}`,
      mediaId: m.id,
      mediaAspect,
      x: cx + rng.range(-cellW * 0.08, cellW * 0.08),
      y: cy + rng.range(-cellH * 0.08, cellH * 0.08),
      z: 0.01 + i * 0.002,
      w,
      h,
      rotation: (rng.range(-8, 8) * Math.PI) / 180,
      frame: 'print',
      kenburns: {
        start: 0,
        end: 0,
        zoomFrom: zoomIn ? zoomA : zoomB,
        zoomTo: zoomIn ? zoomB : zoomA,
        panFrom: pan(),
        panTo: pan(),
      },
      appear: { kind: 'ink', t0: 0, duration: travel + 0.8 },
      inkSeed: rng.int(1, 999),
    }
  })

  // 카메라: 전체 보기 → 각 슬롯 근접(슬롯이 화면 세로의 72%) → 전체 보기
  const overviewZ = distanceForHeight(Math.max(H, W / (W / H)) * 1.04, 1)
  const camera = buildVisitPath({
    overview: { x: 0, y: 0, z: overviewZ, lookX: 0, lookY: 0 },
    targets: slots.map((s) => ({
      x: s.x,
      y: s.y,
      z: s.z,
      tilt: s.rotation * 0.35,
      approach: distanceForHeight(s.h, 0.72),
    })),
    approach: distanceForHeight(cell, 0.72),
    dwell,
    travel,
    drift: 0.12,
  })
  const duration = pathDuration(camera)

  // 등장·켄번즈 타이밍을 카메라 도착 시각에 맞춘다
  // buildVisitPath 구조: [overview@0, (near, nearDrift) × n, overview@end]
  slots.forEach((s, i) => {
    const arrive = camera[1 + i * 2].t
    const leave = camera[2 + i * 2].t
    s.appear = { kind: 'ink', t0: arrive - travel * 0.9, duration: travel * 0.9 + 0.7 }
    s.kenburns.start = arrive - travel
    s.kenburns.end = leave + travel
  })

  return {
    version: 1,
    seed: opts.seed,
    stage: {
      kind: 'paper',
      width: W * 1.15,
      height: H * 1.15,
      paper: { ...paperDefaults, seed: opts.seed % 97 },
    },
    slots,
    camera,
    fov: FOV,
    duration,
    devices: {
      film: { grain: 0.15, vignette: 0.5, vignetteOffset: 0.25 },
      dof: { enabled: true, focusRange: 1.2, bokehScale: 3.5 },
      // 근접 뷰에서 슬롯이 화면 세로 72%를 차지하므로 실험실 기본값(70)보다 도트를 촘촘히
      halftone: {
        params: { ...halftoneDefaults, cells: 160, bleed: 0.25 },
        strength: opts.halftoneStrength ?? 0.5,
      },
      ink: { ...inkRevealDefaults, edge: 0.13 },
    },
  }
}
