import type { CameraKey } from '@/features/renderer/camera/cameraPath'
import { halftoneDefaults } from '@/features/renderer/devices/shaders/halftoneMaterial'
import { inkRevealDefaults } from '@/features/renderer/devices/shaders/inkRevealMaterial'
import type {
  AlbumStage,
  Composition,
  LeafAttach,
  Slot,
  TextBlock,
} from '@/features/renderer/types'
import type { Project } from '@/features/media/types'
import { createRng, type Rng } from '@/shared/utils/seededRandom'
import { PACE_SCALE } from '@/features/themes/palette'
import { quantizeToBeat, type BeatOpts } from './beatSync'
import type { ComposeMedia } from './composePaper'
import { distanceForHeight, FOV } from './composePaper'

export type AlbumOptions = {
  seed: number
  aspect: '16:9' | '9:16' | '1:1'
  name?: string
  date?: string
  beat?: BeatOpts
  theme?: Project['theme']
  pace?: Project['pace']
  /** 사진 앞 머무름(초, 속도 배율 전) */
  dwell?: number
}

/** 페이지 크기: 가로형 12x10인치 포토북 느낌 */
export const PAGE_W = 3.0
export const PAGE_H = 2.4
const LEAF_TH = 0.006
const COVER_TH = 0.028
const OVERHANG = 0.06
const MARGIN = 0.17
const GUTTER = 0.1

/** 페이지 레이아웃 프리셋: 셀 [px0, py0, w, h] (페이지 로컬, 여백 제외 영역의 비율) */
type PagePreset = 'hero' | 'solo' | 'grid4' | 'duoV' | 'duoH' | 'trio' | 'blank'
const PRESET_COUNT: Record<PagePreset, number> = {
  hero: 1,
  solo: 1,
  grid4: 4,
  duoV: 2,
  duoH: 2,
  trio: 3,
  blank: 0,
}

type Cell = { x: number; y: number; w: number; h: number }

/** 여백 안쪽 영역을 프리셋대로 나눈 셀들(페이지 로컬 좌표, 중심 기준) */
function cells(preset: PagePreset, rng: Rng): Cell[] {
  const iw = PAGE_W - MARGIN * 2
  const ih = PAGE_H - MARGIN * 2
  const x0 = MARGIN
  const y0 = PAGE_H / 2 - MARGIN
  const g = GUTTER
  const at = (fx: number, fy: number, fw: number, fh: number): Cell => {
    const w = fw * iw - (fw < 1 ? g / 2 : 0)
    const h = fh * ih - (fh < 1 ? g / 2 : 0)
    const left = x0 + fx * iw + (fx > 0 ? g / 2 : 0)
    const top = y0 - fy * ih - (fy > 0 ? g / 2 : 0)
    return { x: left + w / 2, y: top - h / 2, w, h }
  }
  switch (preset) {
    case 'hero':
      return [at(0, 0, 1, 1)]
    case 'solo': {
      // 작은 사진 하나를 여백 넉넉히, 살짝 위로
      const w = iw * rng.range(0.6, 0.72)
      const h = ih * 0.66
      return [{ x: PAGE_W / 2, y: 0.12, w, h }]
    }
    case 'grid4':
      return [
        at(0, 0, 0.5, 0.5),
        at(0.5, 0, 0.5, 0.5),
        at(0, 0.5, 0.5, 0.5),
        at(0.5, 0.5, 0.5, 0.5),
      ]
    case 'duoV':
      return [at(0, 0, 0.5, 1), at(0.5, 0, 0.5, 1)]
    case 'duoH':
      return [at(0, 0, 1, 0.5), at(0, 0.5, 1, 0.5)]
    case 'trio':
      return [at(0, 0, 0.6, 1), at(0.6, 0, 0.4, 0.5), at(0.6, 0.5, 0.4, 0.5)]
    default:
      return []
  }
}

type PagePlan = { preset: PagePreset; attach: LeafAttach; slots: Slot[]; caption?: TextBlock }

/**
 * 포토북 컴포저. 표지가 열리고, 스프레드마다 전체 → 사진 근접 1~2회 → 페이지 넘김.
 * 사진은 페이지에 인쇄된 것처럼 고정되고 카메라가 움직인다(켄번즈 없음).
 */
export function composeAlbum(media: ComposeMedia[], opts: AlbumOptions): Composition {
  const rng = createRng(opts.seed)
  const pace = PACE_SCALE[opts.pace ?? 'normal']
  const beat = opts.beat
  const q = (x: number) => (beat ? quantizeToBeat(x, beat) : x)
  const name = opts.name?.trim() || '우리 아기'
  const date = opts.date || ''
  const dwell = q((opts.dwell ?? 2.2) * pace)
  const overviewHold = q(2.4 * pace)
  const travel = q(1.4 * Math.sqrt(pace))
  const turnDur = 1.5
  const media_ = media.slice()

  // 잎 0 앞면 = 제목 페이지(사진 1장 작게)
  const pages: PagePlan[] = []
  const slots: Slot[] = []
  const texts: TextBlock[] = []
  const mkSlot = (
    id: string,
    m: ComposeMedia,
    cell: Cell,
    attach: LeafAttach,
    fit: 'cover' | 'contain',
  ): Slot => {
    const asp = m.width / m.height
    let { w, h } = cell
    if (fit === 'contain') {
      if (asp > w / h) h = w / asp
      else w = h * asp
    }
    return {
      id,
      mediaId: m.id,
      mediaAspect: asp,
      x: cell.x,
      y: cell.y,
      z: 0,
      w,
      h,
      rotation: 0,
      frame: 'none',
      kenburns: { start: 0, end: 1, zoomFrom: 1, zoomTo: 1, panFrom: [0, 0], panTo: [0, 0] },
      appear: { kind: 'none', t0: 0, duration: 0 },
      inkSeed: 0,
      attach,
    }
  }

  const titleAttach: LeafAttach = { leaf: 0, side: 'front' }
  const first = media_.shift()
  const titleSlots: Slot[] = []
  if (first) {
    const cell: Cell = { x: PAGE_W / 2, y: 0.34, w: PAGE_W * 0.42, h: PAGE_H * 0.42 }
    titleSlots.push(mkSlot('al-title', first, cell, titleAttach, 'contain'))
  }
  texts.push(
    {
      id: 'al-name',
      text: name,
      x: MARGIN,
      y: -0.36,
      w: PAGE_W - MARGIN * 2,
      h: 0.4,
      fontSize: 0.2,
      weight: 'bold',
      align: 'center',
      color: '#3a3532',
      lineHeight: 1.2,
      letterSpacing: 0.02,
      appear: { kind: 'none', t0: 0, duration: 0 },
      attach: titleAttach,
    },
    {
      id: 'al-date',
      text: date || '첫 번째 생일',
      x: MARGIN,
      y: -0.72,
      w: PAGE_W - MARGIN * 2,
      h: 0.2,
      fontSize: 0.075,
      weight: 'regular',
      align: 'center',
      color: '#8a837c',
      lineHeight: 1.3,
      letterSpacing: 0.12,
      appear: { kind: 'none', t0: 0, duration: 0 },
      attach: titleAttach,
    },
  )
  pages.push({ preset: 'solo', attach: titleAttach, slots: titleSlots })
  slots.push(...titleSlots)

  // 나머지 사진을 스프레드(왼·오른 페이지)에 배분
  const presetPool: PagePreset[] = ['hero', 'solo', 'grid4', 'duoV', 'duoH', 'trio']
  let leaf = 0
  let lastPreset: PagePreset | null = null
  const spreads: { left: PagePlan; right: PagePlan }[] = []
  let captionIdx = 0
  const captions = ['소중한 하루', '오늘의 주인공', '작은 손, 큰 웃음', '함께한 순간', '기억할게']
  while (media_.length > 0) {
    // 스프레드 s+1: 왼쪽 = 잎 leaf 뒷면, 오른쪽 = 잎 leaf+1 앞면
    const mk = (attach: LeafAttach, allowBlank: boolean): PagePlan => {
      const remaining = media_.length
      let options = presetPool.filter((p) => PRESET_COUNT[p] <= remaining && p !== lastPreset)
      if (allowBlank && remaining >= 2 && rng.next() < 0.2) options = ['blank']
      if (options.length === 0) options = remaining >= 1 ? ['solo'] : ['blank']
      const preset = rng.pick(options)
      lastPreset = preset
      const cs = cells(preset, rng)
      const plan: PagePlan = { preset, attach, slots: [] }
      cs.forEach((c, i) => {
        const m = media_.shift()
        if (!m) return
        const fit = preset === 'solo' || preset === 'hero' ? 'contain' : 'cover'
        plan.slots.push(mkSlot(`al-${attach.leaf}${attach.side[0]}-${i}`, m, c, attach, fit))
      })
      if ((preset === 'solo' || preset === 'blank') && captionIdx < captions.length) {
        const cap: TextBlock = {
          id: `al-cap-${attach.leaf}${attach.side[0]}`,
          text: captions[captionIdx++],
          x: MARGIN,
          y: preset === 'solo' ? -0.78 : -PAGE_H / 2 + MARGIN + 0.25,
          w: PAGE_W - MARGIN * 2,
          h: 0.2,
          fontSize: 0.065,
          weight: 'regular',
          align: 'center',
          color: '#8a837c',
          lineHeight: 1.3,
          letterSpacing: 0.1,
          appear: { kind: 'none', t0: 0, duration: 0 },
          attach,
        }
        plan.caption = cap
        texts.push(cap)
      }
      return plan
    }
    const left = mk({ leaf, side: 'back' }, true)
    const right = mk({ leaf: leaf + 1, side: 'front' }, left.preset !== 'blank')
    spreads.push({ left, right })
    slots.push(...left.slots, ...right.slots)
    leaf++
    if (leaf > 40) break
  }
  const leaves = leaf + 1

  // ---- 타임라인 + 카메라 ----
  const keys: CameraKey[] = []
  const markers: number[] = []
  const blockTop = COVER_TH + leaves * LEAF_TH + 0.0015
  const zPage = blockTop
  const push = (
    t: number,
    pos: [number, number, number],
    look: [number, number, number],
    ease: CameraKey['ease'] = 'inOutCubic',
  ) =>
    keys.push({
      t,
      x: pos[0],
      y: pos[1],
      z: pos[2],
      lookX: look[0],
      lookY: look[1],
      lookZ: look[2],
      roll: 0,
      ease,
    })

  // 닫힌 책: 3/4 위에서
  const closedPos: [number, number, number] = [PAGE_W * 0.5 + 2.2, -3.4, 3.4]
  const closedLook: [number, number, number] = [PAGE_W * 0.5, 0, 0.15]
  let t = 0
  push(0, closedPos, closedLook)
  const openT0 = q(0.9 * pace)
  const openDur = 1.7
  push(openT0, [closedPos[0] - 0.2, closedPos[1] + 0.1, closedPos[2] + 0.1], closedLook)
  // 열리는 동안 카메라가 스프레드 전체 뷰로 이동
  const overview = (side: number): [[number, number, number], [number, number, number]] => [
    [side * 0.9, -3.9, 4.3],
    [side * 0.15, -0.15, zPage],
  ]
  const turnView: [[number, number, number], [number, number, number]] = [
    [0.4, -3.2, 4.9],
    [0, 0.1, zPage + 0.3],
  ]
  t = openT0 + openDur
  let side = 1
  push(t, ...overview(side))
  // 제목 페이지 머무름 + 살짝 드리프트
  t += overviewHold
  push(t, [overview(side)[0][0] - 0.25, -3.8, 4.25], overview(side)[1])

  const turns: AlbumStage['turns'] = []
  const worldOf = (s: Slot): [number, number, number] =>
    s.attach?.side === 'back' ? [-PAGE_W + s.x, s.y, zPage] : [s.x, s.y, zPage]

  spreads.forEach((sp, i) => {
    // 페이지 넘김: 잎 i가 앞으로 넘어간다
    const preTravel = q(1.0 * Math.sqrt(pace))
    push(t + preTravel, ...turnView)
    const turnT0 = t + preTravel + 0.3
    turns.push({ leaf: i, t0: turnT0, duration: turnDur })
    markers.push(turnT0)
    t = turnT0 + turnDur
    side = -side
    // 도착: 전체 뷰
    push(t + travel, ...overview(side))
    t += travel + overviewHold
    push(t, [overview(side)[0][0] + side * -0.2, -3.85, 4.28], overview(side)[1])
    // 근접 방문: 스프레드 사진 중 1~2장
    const all = [...sp.left.slots, ...sp.right.slots]
    const visits = all.length <= 1 ? all : rng.shuffle(all).slice(0, Math.min(2, all.length))
    for (const s of visits) {
      const c = worldOf(s)
      const d = distanceForHeight(Math.max(s.h, s.w / 1.78) * 1.1, 0.72)
      const tilt = rng.range(0.42, 0.6)
      const dx = rng.range(-0.25, 0.25)
      const pos: [number, number, number] = [
        c[0] + dx,
        c[1] - d * Math.sin(tilt),
        c[2] + d * Math.cos(tilt),
      ]
      push(t + travel, pos, c)
      t += travel + dwell
      const drift = rng.range(-0.12, 0.12)
      push(t, [pos[0] + drift, pos[1] + 0.05, pos[2] - 0.06], [c[0] + drift * 0.3, c[1], c[2]])
    }
  })
  // 엔딩: 전체 뷰로 물러나며 끝
  const endTravel = q(1.6 * Math.sqrt(pace))
  push(t + endTravel, [side * 0.5, -4.3, 4.9], [0, -0.1, zPage])
  t += endTravel + q(1.6 * pace)
  push(t, [side * 0.7, -4.4, 5.0], [0, -0.1, zPage])
  const duration = t

  // 소품: 컵(오른쪽 위), 낱장 인화지(왼쪽 아래)
  const prints: AlbumStage['props']['prints'] = []
  const loose = media.slice(-2)
  loose.forEach((m, i) => {
    const asp = m.width / m.height
    const h = 0.95
    prints.push({
      mediaId: m.id,
      mediaAspect: asp,
      x: -PAGE_W - 1.15 + i * 0.22,
      y: -1.05 - i * 0.28,
      w: h * asp,
      h,
      rotation: rng.range(-0.35, -0.12) + i * 0.3,
    })
  })

  return {
    version: 1,
    seed: opts.seed,
    stage: {
      kind: 'album',
      page: { w: PAGE_W, h: PAGE_H, thickness: LEAF_TH, color: '#f7f4ee' },
      cover: { color: '#e6dfd2', thickness: COVER_TH, overhang: OVERHANG, title: name },
      table: { color: '#d8d5d0' },
      leaves,
      opening: { t0: openT0, duration: openDur },
      turns,
      texts,
      props: { cup: { x: PAGE_W + 1.35, y: 1.25, rotation: rng.range(-0.6, 0.6) }, prints },
      light: { key: '#fff2e2', fill: '#dfe6f2', intensity: 2.3 },
    },
    slots,
    camera: keys,
    fov: FOV,
    duration,
    markers,
    devices: {
      film: { grain: 0.035, vignette: 0.22, vignetteOffset: 0.3 },
      dof: { enabled: true, focusRange: 1.1, bokehScale: 2.6 },
      halftone: { params: halftoneDefaults, strength: 0 },
      ink: { ...inkRevealDefaults, edge: 0.1 },
    },
  }
}
