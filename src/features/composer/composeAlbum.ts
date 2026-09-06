import type { CameraKey } from '@/features/renderer/camera/cameraPath'
import { halftoneDefaults } from '@/features/renderer/devices/shaders/halftoneMaterial'
import { inkRevealDefaults } from '@/features/renderer/devices/shaders/inkRevealMaterial'
import type {
  AlbumShot,
  AlbumShotKind,
  AlbumStage,
  Composition,
  HandText,
  LeafAttach,
  PenStroke,
  Slot,
  TextBlock,
} from '@/features/renderer/types'
import type { Project } from '@/features/media/types'
import { caption as penCaption, doodle, resetPenIds } from './pen'
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
  /** 샷 길이 배율 전 기본(초) */
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

/** 페이지 레이아웃 프리셋 */
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
type Vec3 = [number, number, number]

/**
 * 포토북 컴포저. 페이지를 넘기지 않는다: 스프레드마다 짜인 구도의 샷 2~3개를 컷으로 잇고,
 * 다음 스프레드로 컷(라이트리크). 사진은 페이지에 인쇄된 것처럼 고정되고 카메라만 천천히 움직인다.
 */
export function composeAlbum(media: ComposeMedia[], opts: AlbumOptions): Composition {
  const rng = createRng(opts.seed)
  const pace = PACE_SCALE[opts.pace ?? 'normal']
  const beat = opts.beat
  const q = (x: number) => (beat ? quantizeToBeat(x, beat) : x)
  const name = opts.name?.trim() || '우리 아기'
  const date = opts.date || ''
  const base = (opts.dwell ?? 3.4) * pace
  const media_ = media.slice()

  const slots: Slot[] = []
  const texts: TextBlock[] = []
  resetPenIds()
  const pendingCaps: { text: string; attach: LeafAttach; px: number; py: number }[] = []
  const penStrokes: PenStroke[] = []
  const penTexts: HandText[] = []
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

  // 잎 0 앞면 = 제목 페이지(사진 1장 작게 + 이름·날짜)
  const titleAttach: LeafAttach = { leaf: 0, side: 'front' }
  const first = media_.shift()
  const titleSlots: Slot[] = []
  if (first) {
    const cell: Cell = { x: PAGE_W / 2, y: 0.34, w: PAGE_W * 0.42, h: PAGE_H * 0.42 }
    titleSlots.push(mkSlot('al-title', first, cell, titleAttach, 'contain'))
  }
  const noAppear = { kind: 'none', t0: 0, duration: 0 } as const
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
      appear: noAppear,
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
      appear: noAppear,
      attach: titleAttach,
    },
  )
  slots.push(...titleSlots)

  // 나머지 사진을 스프레드(왼·오른 페이지)에 배분
  const presetPool: PagePreset[] = ['hero', 'solo', 'grid4', 'duoV', 'duoH', 'trio']
  let leaf = 0
  let lastPreset: PagePreset | null = null
  const spreads: { left: PagePlan; right: PagePlan }[] = []
  let captionIdx = 0
  const captions = ['소중한 하루', '오늘의 주인공', '작은 손, 큰 웃음', '함께한 순간', '기억할게']
  while (media_.length > 0) {
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
        // 손글씨 캡션(펜 레이어). 시각은 샷이 정해진 뒤 스프레드 창으로 채운다
        pendingCaps.push({
          text: captions[captionIdx++],
          attach,
          px: PAGE_W / 2,
          py: preset === 'solo' ? -0.78 : -PAGE_H / 2 + MARGIN + 0.3,
        })
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

  // ---- 샷 리스트 + 카메라 ----
  const keys: CameraKey[] = []
  const shots: AlbumShot[] = []
  const flashes: AlbumStage['flashes'] = []
  const markers: number[] = []
  const zPage = COVER_TH + leaves * LEAF_TH + 0.0015
  const key = (t: number, pos: Vec3, look: Vec3, roll = 0, ease: CameraKey['ease'] = 'inOutSine') =>
    keys.push({
      t,
      x: pos[0],
      y: pos[1],
      z: pos[2],
      lookX: look[0],
      lookY: look[1],
      lookZ: look[2],
      roll,
      ease,
    })
  const worldOf = (s: Slot): Vec3 =>
    s.attach?.side === 'back' ? [-PAGE_W + s.x, s.y, zPage] : [s.x, s.y, zPage]

  type Pose = { pos: Vec3; look: Vec3; roll?: number }
  type ShotPlan = {
    kind: AlbumShotKind
    from: Pose
    to: Pose
    dof: AlbumShot['dof']
    dur: number
  }

  /** 구도 프리셋. side = ±1(카메라가 어느 쪽에서 보나) */
  const threeQuarter = (side: number): ShotPlan => {
    // 틸트 약 23°: 사진이 사다리꼴로 보이지 않게 위에서 내려본다
    const pos: Vec3 = [side * 0.9, -2.05, 4.75]
    const look: Vec3 = [side * 0.2, -0.05, zPage]
    return {
      kind: 'threeQuarter',
      from: { pos, look },
      to: { pos: [pos[0] - side * 0.2, pos[1] + 0.15, pos[2] - 0.28], look },
      dof: { focusRange: 1.7, bokehScale: 2.2 },
      dur: q(base),
    }
  }
  const flatLay = (): ShotPlan => {
    const r0 = rng.range(-0.05, 0.05)
    return {
      kind: 'flatLay',
      from: { pos: [0.2, -0.45, 6.3], look: [0.15, -0.1, zPage], roll: r0 },
      to: { pos: [0.05, -0.3, 5.75], look: [0.05, -0.05, zPage], roll: r0 * 0.4 },
      dof: { focusRange: 3.2, bokehScale: 1.3 },
      dur: q(base * 0.95),
    }
  }
  const detail = (s: Slot): ShotPlan => {
    const c = worldOf(s)
    const d = distanceForHeight(Math.max(s.h, s.w / 1.6) * 1.15, 0.78)
    // 디테일은 거의 정면(3~10°). 입체감은 심도로만
    const tilt = rng.range(0.05, 0.18)
    const dx = rng.range(-0.2, 0.2)
    const pos: Vec3 = [c[0] + dx, c[1] - d * Math.sin(tilt), c[2] + d * Math.cos(tilt)]
    const slide = rng.range(-0.2, 0.2)
    return {
      kind: 'detail',
      from: { pos, look: c },
      to: {
        pos: [pos[0] + slide, pos[1] + 0.06, pos[2] - 0.05],
        look: [c[0] + slide * 0.35, c[1] + 0.02, c[2]],
      },
      dof: { focusRange: 0.55, bokehScale: 3.4 },
      dur: q(base * 0.85),
    }
  }
  const pageFocus = (page: number): ShotPlan => {
    // page = -1 왼쪽, +1 오른쪽. 반대편에서 살짝 비스듬히
    // 틸트 약 22°
    const pos: Vec3 = [page * 1.3, -1.5, 3.7]
    const look: Vec3 = [page * 1.45, -0.05, zPage]
    return {
      kind: 'pageFocus',
      from: { pos, look },
      to: { pos: [pos[0] + page * 0.15, pos[1] + 0.2, pos[2] - 0.15], look },
      dof: { focusRange: 1.3, bokehScale: 2.4 },
      dur: q(base * 0.9),
    }
  }

  // 샷 0: 닫힌 책 → 표지 열림 → 3/4 뷰로 이어지는 한 샷(컷 없음)
  const openT0 = q(0.9 * pace)
  const openDur = 1.7
  const closedPos: Vec3 = [PAGE_W * 0.5 + 2.0, -2.3, 4.3]
  const closedLook: Vec3 = [PAGE_W * 0.5, 0, 0.15]
  key(0, closedPos, closedLook)
  key(openT0, [closedPos[0] - 0.15, closedPos[1] + 0.1, closedPos[2] + 0.05], closedLook)
  const firstTq = threeQuarter(1)
  let t = openT0 + openDur
  key(t, firstTq.from.pos, firstTq.from.look)
  // 제목 스프레드에 머무름
  const titleHold = q(base * 0.9)
  key(t + titleHold, firstTq.to.pos, firstTq.to.look)
  shots.push({
    t0: 0,
    t1: t + titleHold,
    spread: 0,
    kind: 'cover',
    dof: { focusRange: 1.7, bokehScale: 2.0 },
  })
  t += titleHold

  let side = 1
  spreads.forEach((sp, i) => {
    const spread = i + 1
    side = -side
    const all = [...sp.left.slots, ...sp.right.slots]
    const picks = rng.shuffle(all).slice(0, Math.min(2, all.length))
    // 스프레드마다 도입 1 + 디테일 1~2 + 마무리 1
    const intro: ShotPlan =
      rng.next() < 0.6 ? threeQuarter(side) : pageFocus(sp.left.slots.length ? -1 : 1)
    const outro: ShotPlan = rng.next() < 0.6 ? flatLay() : threeQuarter(-side)
    const plan: ShotPlan[] = [intro, ...picks.map((s) => detail(s)), outro]
    plan.forEach((sh, j) => {
      const isCut = true
      if (isCut) {
        // 컷: 같은 t에 키 둘. 스프레드 첫 샷은 라이트리크
        if (j === 0) {
          flashes.push({ t: t - 0.06, duration: 0.55, strength: 0.85 })
          markers.push(t)
        }
      }
      key(t, sh.from.pos, sh.from.look, sh.from.roll ?? 0)
      key(t + sh.dur, sh.to.pos, sh.to.look, sh.to.roll ?? 0)
      shots.push({ t0: t, t1: t + sh.dur, spread, kind: sh.kind, dof: sh.dof })
      t += sh.dur
    })
  })
  // 엔딩: 마지막 스프레드 플랫레이에서 천천히 물러나며 어두워지지 않고 끝
  const endDur = q(base * 0.8)
  const lastSpread = spreads.length
  flashes.push({ t: t - 0.06, duration: 0.55, strength: 0.7 })
  key(t, [0.1, -1.2, 6.2], [0.05, -0.2, zPage], 0.02)
  key(t + endDur, [0.05, -1.6, 7.0], [0.05, -0.25, zPage], 0)
  shots.push({
    t0: t,
    t1: t + endDur,
    spread: lastSpread,
    kind: 'flatLay',
    dof: { focusRange: 3.5, bokehScale: 1.2 },
  })
  t += endDur
  const duration = t

  // 손글씨 캡션: 해당 스프레드가 보이는 창에서 쓰고, 컷에서 사라진다
  for (const pc of pendingCaps) {
    const spread = pc.attach.side === 'back' ? pc.attach.leaf + 1 : pc.attach.leaf
    const win = shots.filter((sh) => sh.spread === spread)
    if (win.length === 0) continue
    const w0 = Math.min(...win.map((sh) => sh.t0))
    const w1 = Math.max(...win.map((sh) => sh.t1))
    const wx = pc.attach.side === 'back' ? -PAGE_W + pc.px : pc.px
    const c = penCaption(pc.text, wx, pc.py, {
      fontSize: 0.115,
      color: '#4a423c',
      rotation: rng.range(-0.02, 0.02),
      align: 'center',
      z: zPage + 0.003,
      t0: w0 + 0.9,
      t1: w1,
      perChar: 0.12,
    })
    penTexts.push(c.text)
    if (rng.next() < 0.4) {
      const icon = rng.pick(['heart', 'star', 'sparkle'] as const)
      penStrokes.push(
        ...doodle(
          icon,
          wx + pc.text.length * 0.115 * 0.3 + 0.2,
          pc.py + 0.02,
          0.16,
          rng.range(-0.3, 0.3),
          rng,
          {
            color: '#c96b7b',
            width: 0.016,
            z: zPage + 0.003,
            t0: w0 + 0.9 + c.text.duration + 0.2,
            duration: 0.5,
            t1: w1,
          },
        ),
      )
    }
  }

  // 소품: 컵(오른쪽 위), 낱장 인화지(왼쪽 아래)
  const prints: AlbumStage['props']['prints'] = []
  media.slice(-2).forEach((m, i) => {
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
      table: { color: '#bdb7ae' },
      leaves,
      opening: { t0: openT0, duration: openDur },
      shots,
      flashes,
      texts,
      props: { cup: { x: PAGE_W + 1.35, y: 1.25, rotation: rng.range(-0.6, 0.6) }, prints },
      light: { key: '#fff1dc', fill: '#dfe6f2', intensity: 1.0, gobo: true },
    },
    slots,
    camera: keys,
    fov: FOV,
    duration,
    markers,
    pen: { strokes: penStrokes, texts: penTexts },
    handheld: { amp: 0.012, rot: 0.0022, freq: 0.37 },
    devices: {
      film: { grain: 0.03, vignette: 0.26, vignetteOffset: 0.28 },
      dof: { enabled: true, focusRange: 1.7, bokehScale: 2.2 },
      halftone: { params: halftoneDefaults, strength: 0 },
      ink: { ...inkRevealDefaults, edge: 0.1 },
    },
  }
}
