import type { CameraKey } from '@/features/renderer/camera/cameraPath'
import { halftoneDefaults } from '@/features/renderer/devices/shaders/halftoneMaterial'
import { inkRevealDefaults } from '@/features/renderer/devices/shaders/inkRevealMaterial'
import { paperDefaults } from '@/features/renderer/devices/shaders/paperMaterial'
import { scheduleSwaps } from '@/features/renderer/playlist'
import type { CollageStage, Composition, Slot, SwapKind } from '@/features/renderer/types'
import { createRng } from '@/shared/utils/seededRandom'
import { phaseDelay, quantizeToBeat, type BeatOpts } from './beatSync'
import { distanceForHeight, FOV, stageSize, type ComposeMedia } from './composePaper'

export type CollageOptions = {
  seed: number
  aspect: '16:9' | '9:16' | '1:1'
  /** 레이아웃 하나가 머무는 시간(초) */
  hold?: number
  /** 사진 교체 간격(초) */
  interval?: number
  halftoneStrength?: number
  clips?: { maxSeconds: number; volume: number }
  beat?: BeatOpts
}

/** 레이아웃 프리셋: 보드(0~1) 좌표의 셀들 [x, y, w, h] (y는 위가 0) */
export const COLLAGE_PRESETS: Record<string, [number, number, number, number][]> = {
  '1': [[0, 0, 1, 1]],
  '2h': [
    [0, 0, 0.5, 1],
    [0.5, 0, 0.5, 1],
  ],
  '2v': [
    [0, 0, 1, 0.5],
    [0, 0.5, 1, 0.5],
  ],
  '2x2': [
    [0, 0, 0.5, 0.5],
    [0.5, 0, 0.5, 0.5],
    [0, 0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5, 0.5],
  ],
  '1x3': [
    [0, 0, 1 / 3, 1],
    [1 / 3, 0, 1 / 3, 1],
    [2 / 3, 0, 1 / 3, 1],
  ],
  '1+2': [
    [0, 0, 0.62, 1],
    [0.62, 0, 0.38, 0.5],
    [0.62, 0.5, 0.38, 0.5],
  ],
  '2+1': [
    [0, 0, 0.38, 0.5],
    [0, 0.5, 0.38, 0.5],
    [0.38, 0, 0.62, 1],
  ],
  '3x1': [
    [0, 0, 1, 1 / 3],
    [0, 1 / 3, 1, 1 / 3],
    [0, 2 / 3, 1, 1 / 3],
  ],
}

const SWAP_KINDS: SwapKind[] = ['wipe', 'push', 'flip', 'wipe', 'cut', 'push']
const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/**
 * 콜라주 보드 컴포저. 카메라는 보드에 거의 고정(레이아웃마다 살짝 밀어 들어감).
 * 레이아웃을 시드로 골라 hold초씩 머물고, 슬롯 사진은 interval마다 한 슬롯씩 순차로 갈아끼운다.
 * 비트가 있으면 교체 간격·머무름이 비트 배수, 첫 등장이 비트 위상에 맞는다.
 */
export function composeCollage(media: ComposeMedia[], opts: CollageOptions): Composition {
  const rng = createRng(opts.seed)
  const [W, H] = stageSize(opts.aspect)
  const beat = opts.beat
  const interval = beat ? quantizeToBeat(opts.interval ?? 0.9, beat) : (opts.interval ?? 0.9)
  const hold = beat ? quantizeToBeat(opts.hold ?? 6.4, beat) : (opts.hold ?? 6.4)
  const swapDuration = Math.min(0.38, interval * 0.45)
  const margin = Math.min(W, H) * 0.06
  const gutter = Math.min(W, H) * 0.025
  const boardW = W - margin * 2
  const boardH = H - margin * 2

  // 세로 화면이면 세로형 프리셋을 우선
  const presetPool =
    opts.aspect === '9:16'
      ? ['1', '2v', '3x1', '2x2', '1', '2v']
      : ['1', '2h', '2x2', '1x3', '1+2', '2+1', '1', '2h']
  const layouts: CollageStage['layouts'] = []
  const slots: Slot[] = []
  const keys: CameraKey[] = []
  const overviewZ = distanceForHeight(H, 1)
  const opening = 0.6 + phaseDelay(0.6, beat)
  let t = opening
  let consumed = 0
  let last = ''
  let li = 0
  const n = media.length
  const pick = (k: number) => ({
    kind: SWAP_KINDS[(k + opts.seed) % SWAP_KINDS.length],
    dir: DIRS[rng.int(0, DIRS.length - 1)],
  })

  while (consumed < n || li === 0) {
    const options = presetPool.filter((p) => p !== last)
    const preset = li === 0 ? '1' : rng.pick(options)
    last = preset
    const cells = COLLAGE_PRESETS[preset]
    const t0 = t
    const t1 = t + hold
    const layoutSlots: Slot[] = cells.map((c, i) => {
      const w = c[2] * boardW - gutter
      const h = c[3] * boardH - gutter
      const x = -boardW / 2 + c[0] * boardW + gutter / 2 + w / 2
      const y = boardH / 2 - c[1] * boardH - gutter / 2 - h / 2
      return {
        id: `col-${li}-${i}`,
        mediaId: '',
        mediaAspect: 1,
        x,
        y,
        z: 0.02 + li * 0.0006 + i * 0.0001,
        w,
        h,
        rotation: 0,
        frame: 'print',
        kenburns: {
          start: t0,
          end: t1,
          zoomFrom: 1.02,
          zoomTo: 1.12,
          panFrom: [0, 0],
          panTo: [rng.range(-0.03, 0.03), rng.range(-0.02, 0.02)],
        },
        appear: { kind: 'fade', t0: t0 + i * 0.09, duration: 0.22 },
        vanish: { t0: t1 - 0.22 + i * 0.05, duration: 0.2 },
        inkSeed: rng.int(1, 999),
      }
    })
    const used = scheduleSwaps({
      slots: layoutSlots,
      media,
      from: consumed,
      start: t0,
      end: t1,
      interval,
      stagger: 0.09,
      swapDuration,
      pick,
    })
    consumed += used
    slots.push(...layoutSlots)
    layouts.push({ t0, t1, preset })

    // 카메라: 레이아웃 동안 살짝 밀어 들어가고 드리프트, 레이아웃 전환 때 원위치
    const dx = rng.range(-0.15, 0.15)
    const dy = rng.range(-0.1, 0.1)
    keys.push({
      t: t0,
      x: 0,
      y: 0,
      z: overviewZ,
      lookX: 0,
      lookY: 0,
      lookZ: 0,
      roll: 0,
      ease: 'inOutSine',
    })
    keys.push({
      t: t1,
      x: dx,
      y: dy,
      z: overviewZ * 0.955,
      lookX: dx * 0.6,
      lookY: dy * 0.6,
      lookZ: 0,
      roll: 0,
      ease: 'inOutSine',
    })
    t = t1
    li++
    if (n === 0) break
    if (li > 60) break
  }
  const duration = t + 0.4
  keys.push({ ...keys[keys.length - 1], t: duration })

  return {
    version: 1,
    seed: opts.seed,
    stage: {
      kind: 'collage',
      width: W,
      height: H,
      paper: {
        ...paperDefaults,
        baseColor: '#eee4cf',
        stain: 0.25,
        fold: 0.2,
        seed: opts.seed % 97,
      },
      layouts,
    },
    slots,
    camera: keys,
    fov: FOV,
    duration,
    // 마커 = 교체 시각(첫 채움은 제외)
    markers: slots
      .flatMap((s) => (s.playlist ?? []).slice(1).map((p) => p.t0))
      .sort((a, b) => a - b),
    devices: {
      film: { grain: 0.14, vignette: 0.45, vignetteOffset: 0.25 },
      dof: null,
      halftone: { params: halftoneDefaults, strength: opts.halftoneStrength ?? 0 },
      ink: { ...inkRevealDefaults, edge: 0.1 },
    },
  }
}
