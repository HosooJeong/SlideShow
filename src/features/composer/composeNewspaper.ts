import { pathDuration, type CameraKey } from '@/features/renderer/camera/cameraPath'
import { halftoneDefaults } from '@/features/renderer/devices/shaders/halftoneMaterial'
import { inkRevealDefaults } from '@/features/renderer/devices/shaders/inkRevealMaterial'
import { paperDefaults } from '@/features/renderer/devices/shaders/paperMaterial'
import type {
  Appear,
  Composition,
  CurlSheet,
  LensPass,
  Page,
  ParticleTransition,
  Rule,
  Slot,
  TextBlock,
} from '@/features/renderer/types'
import { createRng, type Rng } from '@/shared/utils/seededRandom'
import { distanceForHeight, FOV } from './composePaper'
import { planClip } from '@/features/renderer/clip'
import { phaseDelay, quantizeTimings, quantizeToBeat, type BeatOpts } from './beatSync'
import { doljanchiCopy, fillCopy, type CopyPool, type CopyVars } from './copy/doljanchi'

export type ComposeMedia = {
  id: string
  width: number
  height: number
  kind?: 'image' | 'video'
  /** 영상 길이(초) */
  duration?: number
}

export type NewspaperOptions = {
  seed: number
  aspect: '16:9' | '9:16' | '1:1'
  name?: string
  date?: string
  dwell?: number
  travel?: number
  halftoneStrength?: number
  copy?: CopyPool
  /** 영상 클립: 최대 길이(초)와 볼륨(0 = 음소거) */
  clips?: { maxSeconds: number; volume: number }
  /** 비트 동기: 이동+머무름을 비트 정수배로, 첫 도착을 비트 위상에 */
  beat?: BeatOpts
}

// 페이지: 세로 3:4 신문. 무대 단위
const PAGE_W = 7.2
const PAGE_H = 9.6
const MARGIN = 0.45
const GAP = 0.9 // 페이지 사이 간격
const INK = '#2b2521'
const INK_SOFT = '#5a514a'

type Ctx = {
  clips: { maxSeconds: number; volume: number }
  media: Map<string, ComposeMedia>
  rng: Rng
  vars: CopyVars
  copy: CopyPool
  travel: number
  strength: number
  pick: <K extends keyof CopyPool>(key: K) => string
}

/**
 * 마법 신문 컴포저. 1면(제호·헤드라인·메인 사진·기사·광고) + 사진 면들(프리셋) + 엔딩.
 * 페이지는 가로로 나열되고 카메라가 면을 넘어가며 훑는다. 같은 입력이면 같은 결과.
 */
export function composeNewspaper(media: ComposeMedia[], opts: NewspaperOptions): Composition {
  const rng = createRng(opts.seed)
  const copy = opts.copy ?? doljanchiCopy
  const vars: CopyVars = {
    name: opts.name?.trim() || '우리 아기',
    date: opts.date || '어느 좋은 날',
  }
  const beat = opts.beat
  const travel = opts.travel ?? 1.3
  const dwell = beat
    ? quantizeTimings({ dwell: opts.dwell ?? 2.4, travel }, 60 / beat.period).dwell
    : (opts.dwell ?? 2.4)
  const q = (x: number) => quantizeToBeat(x, beat)
  const used = new Map<string, Set<number>>()
  const pick: Ctx['pick'] = (key) => {
    const list = copy[key] as readonly string[]
    const seen = used.get(key) ?? new Set<number>()
    if (seen.size >= list.length) seen.clear()
    let i = rng.int(0, list.length - 1)
    while (seen.has(i)) i = (i + 1) % list.length
    seen.add(i)
    used.set(key, seen)
    return fillCopy(list[i], vars)
  }
  const ctx: Ctx = {
    rng,
    vars,
    copy,
    travel,
    strength: opts.halftoneStrength ?? 0.6,
    pick,
    clips: opts.clips ?? { maxSeconds: 4, volume: 0 },
    media: new Map(media.map((m) => [m.id, m])),
  }

  // 미디어를 면에 배분: 1면 1장, 이후 프리셋(1·3·3)
  const queue = media.slice()
  const pages: Page[] = []
  const front = buildFrontPage(ctx, queue.splice(0, 1)[0], pages.length)
  pages.push(front)
  const presets: PresetKind[] = ['trio', 'mixed', 'hero']
  let last: PresetKind | null = null
  while (queue.length > 0) {
    const options = presets.filter((p) => p !== last && presetCount(p) <= Math.max(1, queue.length))
    const preset = options.length ? rng.pick(options) : 'hero'
    const take = Math.min(presetCount(preset), queue.length)
    pages.push(buildPhotoPage(ctx, queue.splice(0, take), pages.length, preset))
    last = preset
  }
  addEnding(ctx, pages[pages.length - 1])

  // 페이지를 가로로 배치
  const totalW = pages.length * PAGE_W + (pages.length - 1) * GAP
  pages.forEach((p, i) => {
    const px = -totalW / 2 + PAGE_W / 2 + i * (PAGE_W + GAP)
    offsetPage(p, px, 0)
  })

  // 카메라: 오프닝(1면 전체) → 면마다 [전체 → 관심 지점들] → 마지막 면 전체
  const hold0 = beat ? q(1.4) : 1.4
  const opening = 1.8 + phaseDelay(1.8 + hold0 + travel, beat)
  const markers: number[] = []
  const overviewZ = distanceForHeight(PAGE_H * 1.06, 1)
  const keys: CameraKey[] = []
  const transitions: ParticleTransition[] = []
  const lenses: LensPass[] = []
  const sheets: CurlSheet[] = []
  let t = opening
  const push = (
    x: number,
    y: number,
    z: number,
    lookX: number,
    lookY: number,
    roll: number,
    at: number,
  ) => keys.push({ t: at, x, y, z, lookX, lookY, lookZ: 0, roll, ease: 'inOutCubic' })

  pages.forEach((page, pi) => {
    // 면 전체 보기
    const travelStart = t
    if (pi !== 0) t += beat ? q(travel * 1.2) : travel * 1.2
    push(page.x, page.y, overviewZ, page.x, page.y, 0, t)
    const pageArrive = t
    // 면 넘김: 이 면을 덮고 있던 백지가 카메라 도착에 맞춰 모서리부터 벗겨진다(페이지 컬)
    if (pi !== 0) {
      sheets.push({
        id: `sheet-${pi}`,
        pageId: page.id,
        t0: pageArrive - 0.7,
        duration: 1.25,
        corner: pi % 2 === 1 ? 'tr' : 'br',
        radius: 0.55,
      })
    }
    // 면 넘김: 앞 면의 마지막 사진이 입자로 흩어져 이 면의 첫 사진으로 모인다
    if (pi !== 0) {
      const prev = pages[pi - 1]
      const fromSlot = prev.slots[prev.slots.length - 1]
      const toSlot = page.slots[0]
      if (fromSlot && toSlot) {
        const duration = travel * 1.2 + 0.5
        transitions.push({
          id: `tr-${pi}`,
          fromSlotId: fromSlot.id,
          toSlotId: toSlot.id,
          t0: travelStart - 0.25,
          duration,
          count: 22000,
          spread: 2.6,
          seed: opts.seed + pi * 31,
        })
        fromSlot.vanish = { t0: travelStart - 0.25, duration: duration * 0.45 }
      }
    }
    t += pi === 0 ? hold0 : beat ? q(1.0) : 1.0
    push(page.x, page.y, overviewZ, page.x, page.y, 0, t)

    for (const poi of pointsOfInterest(page)) {
      t += travel
      markers.push(t)
      const z = distanceForHeight(poi.h, poi.fill)
      push(poi.x, poi.y, z, poi.x, poi.y, poi.roll, t)
      if (pi === 0 && poi.lens) {
        // 헤드라인·알림판 위를 유리 돋보기가 왼쪽에서 오른쪽으로 훑는다
        lenses.push({
          id: `lens-${pi}-${lenses.length}`,
          t0: t + 0.15,
          duration: (poi.dwell ?? dwell) - 0.3,
          from: [poi.lens[0], poi.lens[1]],
          to: [poi.lens[2], poi.lens[3]],
          radius: poi.lens[4],
          height: 0.42,
        })
      }
      const poiDwell =
        poi.dwell !== undefined
          ? beat
            ? quantizeTimings({ dwell: poi.dwell, travel }, 60 / beat.period).dwell
            : poi.dwell
          : dwell
      poi.dwell = poiDwell
      t += poiDwell
      push(poi.x + 0.06, poi.y - 0.03, z - 0.1, poi.x, poi.y, poi.roll, t)
      if (poi.slot) {
        poi.slot.appear = {
          kind: 'ink',
          t0: t - (poi.dwell ?? dwell) - travel * 0.9,
          duration: travel * 0.9 + 0.7,
        }
        poi.slot.kenburns.start = t - (poi.dwell ?? dwell) - travel
        poi.slot.kenburns.end = t + travel
        const m = ctx.media.get(poi.slot.mediaId)
        if (m?.kind === 'video') {
          poi.slot.clip = planClip({
            sourceDuration: m.duration ?? 0,
            windowDuration: poi.slot.kenburns.end - poi.slot.kenburns.start,
            maxSeconds: ctx.clips.maxSeconds,
            volume: ctx.clips.volume,
          })
        }
      }
    }
    t += beat ? q(travel) : travel
    push(page.x, page.y, overviewZ, page.x, page.y, 0, t)
    t += beat ? q(0.8) : 0.8
    push(page.x, page.y, overviewZ, page.x, page.y, 0, t)

    // 사진은 면 전체 보기에 도착하면 차례로 스며든다(빈 틀이 보이지 않게). 입자가 모이는 사진은 모이는 순간 나타난다
    page.slots.forEach((s, i) => {
      const tr = transitions.find((x) => x.toSlotId === s.id)
      s.appear = tr
        ? { kind: 'fade', t0: tr.t0 + tr.duration - 0.2, duration: 0.25 }
        : { kind: 'ink', t0: pageArrive + 0.25 + i * 0.35, duration: 1.4 }
    })
    // 텍스트·선은 면 전체 보기에 도착할 때 페이드 인. 1면은 날아오는 동안 이미 인쇄된 상태
    const fade: Appear =
      pi === 0
        ? { kind: 'none', t0: 0, duration: 0 }
        : { kind: 'fade', t0: pageArrive - 0.4, duration: 0.9 }
    page.texts.forEach((tb) => (tb.appear = fade))
    page.rules.forEach((r) => (r.appear = fade))
  })

  const slots = pages.flatMap((p) => p.slots)
  return {
    version: 1,
    seed: opts.seed,
    stage: {
      kind: 'newspaper',
      pages,
      paper: { ...paperDefaults, baseColor: '#efe6d2', seed: opts.seed % 97 },
      opening: { duration: opening },
      transitions,
      lenses,
      sheets,
    },
    slots,
    camera: keys,
    fov: FOV,
    duration: pathDuration(keys),
    markers,
    devices: {
      film: { grain: 0.16, vignette: 0.5, vignetteOffset: 0.25 },
      dof: { enabled: true, focusRange: 1.4, bokehScale: 3 },
      halftone: {
        params: { ...halftoneDefaults, cells: 160, colorInk: 0.6 },
        strength: ctx.strength,
      },
      ink: { ...inkRevealDefaults, edge: 0.13 },
    },
  }
}

// ---------- 페이지 빌더 ----------

type PresetKind = 'hero' | 'trio' | 'mixed'
const presetCount = (p: PresetKind) => (p === 'hero' ? 1 : 3)

type Poi = {
  x: number
  y: number
  h: number
  fill: number
  roll: number
  dwell?: number
  slot?: Slot
  /** 돋보기 경로 [x0, y0, x1, y1, radius] */
  lens?: [number, number, number, number, number]
}

function blankPage(index: number): Page {
  return { id: `page-${index}`, x: 0, y: 0, w: PAGE_W, h: PAGE_H, slots: [], texts: [], rules: [] }
}

const none: Appear = { kind: 'none', t0: 0, duration: 0 }

function text(
  page: Page,
  id: string,
  str: string,
  box: { x: number; y: number; w: number; h: number },
  style: Partial<
    Pick<TextBlock, 'fontSize' | 'weight' | 'align' | 'color' | 'lineHeight' | 'letterSpacing'>
  > = {},
) {
  const tb: TextBlock = {
    id: `${page.id}-${id}`,
    text: str,
    ...box,
    fontSize: style.fontSize ?? 0.2,
    weight: style.weight ?? 'regular',
    align: style.align ?? 'left',
    color: style.color ?? INK,
    lineHeight: style.lineHeight ?? 1.5,
    letterSpacing: style.letterSpacing,
    appear: none,
  }
  page.texts.push(tb)
  return tb
}

function rule(page: Page, id: string, x: number, y: number, w: number, h: number, color = INK) {
  const r: Rule = { id: `${page.id}-${id}`, x, y, w, h, color, appear: none }
  page.rules.push(r)
  return r
}

function slot(
  ctx: Ctx,
  page: Page,
  m: ComposeMedia,
  box: { x: number; y: number; w: number; h: number },
  i: number,
): Slot {
  const { rng } = ctx
  const mediaAspect = m.width / m.height || 1
  const zoomIn = rng.next() < 0.6
  const a = rng.range(1.0, 1.05)
  const b = rng.range(1.1, 1.18)
  const pan = () => [rng.range(-0.05, 0.05), rng.range(-0.03, 0.03)] as [number, number]
  const s: Slot = {
    id: `${page.id}-slot-${i}`,
    mediaId: m.id,
    mediaAspect,
    x: box.x + box.w / 2,
    y: box.y - box.h / 2,
    z: 0.01,
    w: box.w,
    h: box.h,
    rotation: (rng.range(-0.8, 0.8) * Math.PI) / 180,
    frame: 'none',
    kenburns: {
      start: 0,
      end: 0,
      zoomFrom: zoomIn ? a : b,
      zoomTo: zoomIn ? b : a,
      panFrom: pan(),
      panTo: pan(),
    },
    appear: { kind: 'ink', t0: 0, duration: 1 },
    inkSeed: rng.int(1, 999),
  }
  page.slots.push(s)
  // 사진 테두리 선(신문 사진의 얇은 먹선)
  const bw = 0.02
  rule(page, `frame-${i}-t`, box.x - bw, box.y + bw, box.w + bw * 2, bw, INK)
  rule(page, `frame-${i}-b`, box.x - bw, box.y - box.h, box.w + bw * 2, bw, INK)
  rule(page, `frame-${i}-l`, box.x - bw, box.y + bw, bw, box.h + bw * 2, INK)
  rule(page, `frame-${i}-r`, box.x + box.w, box.y + bw, bw, box.h + bw * 2, INK)
  return s
}

/** 사진 비율을 폭에 맞춰 높이 계산, 최대 높이 제한 */
const fitH = (aspect: number, w: number, maxH: number) => Math.min(maxH, w / Math.max(0.5, aspect))

function buildFrontPage(ctx: Ctx, m: ComposeMedia | undefined, index: number): Page {
  const page = blankPage(index)
  const { pick, vars } = ctx
  const left = -PAGE_W / 2 + MARGIN
  const innerW = PAGE_W - MARGIN * 2
  let y = PAGE_H / 2 - MARGIN

  // 제호
  text(
    page,
    'masthead',
    pick('masthead'),
    { x: left, y, w: innerW, h: 1.1 },
    { fontSize: 0.78, weight: 'bold', align: 'center', lineHeight: 1.15, letterSpacing: 0.02 },
  )
  y -= 1.05
  rule(page, 'r1', left, y, innerW, 0.035)
  y -= 0.09
  text(
    page,
    'sub',
    `${vars.date}   ·   ${pick('mastheadSub')}   ·   ${pick('price')}   ·   ${pick('weather')}`,
    { x: left, y, w: innerW, h: 0.3 },
    { fontSize: 0.15, align: 'center', color: INK_SOFT, lineHeight: 1.3 },
  )
  y -= 0.32
  rule(page, 'r2', left, y, innerW, 0.012)
  y -= 0.22

  // 헤드라인·부제
  text(
    page,
    'headline',
    pick('headline'),
    { x: left, y, w: innerW, h: 1.5 },
    { fontSize: 0.56, weight: 'bold', lineHeight: 1.2 },
  )
  y -= 1.35
  text(
    page,
    'subhead',
    pick('subhead'),
    { x: left, y, w: innerW, h: 0.4 },
    { fontSize: 0.22, color: INK_SOFT, lineHeight: 1.4 },
  )
  y -= 0.5
  rule(page, 'r3', left, y, innerW, 0.012, INK_SOFT)
  y -= 0.2

  // 메인 사진(왼쪽) + 기사 칼럼(오른쪽)
  const photoW = innerW * 0.6
  const colX = left + photoW + 0.28
  const colW = innerW - photoW - 0.28
  const bodyTop = y
  let photoH = 0
  if (m) {
    photoH = fitH(m.width / m.height, photoW, 4.2)
    const s = slot(ctx, page, m, { x: left, y, w: photoW, h: photoH }, 0)
    text(
      page,
      'caption',
      pick('caption'),
      { x: left, y: y - photoH - 0.1, w: photoW, h: 0.3 },
      { fontSize: 0.16, color: INK_SOFT, lineHeight: 1.3 },
    )
    void s
  }
  const colH = (photoH || 3.6) + 0.4
  text(
    page,
    'body1',
    `${pick('body')}\n\n${pick('body')}`,
    { x: colX, y: bodyTop, w: colW, h: colH },
    { fontSize: 0.16, align: 'justify', lineHeight: 1.6 },
  )
  y = bodyTop - colH - 0.2
  rule(page, 'r4', left, y, innerW, 0.012, INK_SOFT)
  y -= 0.18

  // 하단: 기사 2열 + 광고 박스
  const bottomH = y - (-PAGE_H / 2 + MARGIN)
  const adW = innerW * 0.34
  const bodyW = innerW - adW - 0.28
  text(
    page,
    'body2',
    `${pick('body')} ${pick('body')}`,
    { x: left, y, w: bodyW, h: bottomH },
    { fontSize: 0.16, align: 'justify', lineHeight: 1.6 },
  )
  const adX = left + bodyW + 0.28
  rule(page, 'ad-t', adX, y, adW, 0.025)
  rule(page, 'ad-b', adX, y - bottomH, adW, 0.025)
  rule(page, 'ad-l', adX, y, 0.025, bottomH)
  rule(page, 'ad-r', adX + adW - 0.025, y, 0.025, bottomH)
  text(
    page,
    'ad-title',
    '알림판',
    { x: adX + 0.15, y: y - 0.15, w: adW - 0.3, h: 0.4 },
    { fontSize: 0.22, weight: 'bold', align: 'center', lineHeight: 1.2 },
  )
  text(
    page,
    'ad',
    `${pick('ad')}\n\n${pick('ad')}\n\n${pick('ad')}`,
    { x: adX + 0.15, y: y - 0.6, w: adW - 0.3, h: bottomH - 0.75 },
    { fontSize: 0.15, lineHeight: 1.5, color: INK_SOFT },
  )
  return page
}

function buildPhotoPage(ctx: Ctx, items: ComposeMedia[], index: number, preset: PresetKind): Page {
  const page = blankPage(index)
  const { pick } = ctx
  const left = -PAGE_W / 2 + MARGIN
  const innerW = PAGE_W - MARGIN * 2
  let y = PAGE_H / 2 - MARGIN

  // 면 머리: 섹션명 + 쪽번호
  text(
    page,
    'section',
    `${index + 1}면  ·  ${pick('subhead')}`,
    { x: left, y, w: innerW, h: 0.3 },
    { fontSize: 0.15, color: INK_SOFT, lineHeight: 1.3 },
  )
  y -= 0.3
  rule(page, 'r0', left, y, innerW, 0.02)
  y -= 0.25

  if (preset === 'hero' || items.length === 1) {
    const m = items[0]
    const h = fitH(m.width / m.height, innerW, PAGE_H * 0.5)
    slot(ctx, page, m, { x: left, y, w: innerW, h }, 0)
    y -= h + 0.1
    text(
      page,
      'cap0',
      pick('caption'),
      { x: left, y, w: innerW, h: 0.3 },
      { fontSize: 0.16, color: INK_SOFT, lineHeight: 1.3 },
    )
    y -= 0.45
    text(
      page,
      'head',
      pick('headline'),
      { x: left, y, w: innerW, h: 0.8 },
      { fontSize: 0.38, weight: 'bold', lineHeight: 1.2 },
    )
    y -= 0.9
  } else if (preset === 'trio') {
    const gap = 0.22
    const w = (innerW - gap * 2) / 3
    const h = 3.0
    items.slice(0, 3).forEach((m, i) => {
      slot(ctx, page, m, { x: left + i * (w + gap), y, w, h }, i)
      text(
        page,
        `cap${i}`,
        pick('caption'),
        { x: left + i * (w + gap), y: y - h - 0.08, w, h: 0.3 },
        { fontSize: 0.14, color: INK_SOFT, lineHeight: 1.3 },
      )
    })
    y -= h + 0.55
    text(
      page,
      'head',
      pick('headline'),
      { x: left, y, w: innerW, h: 0.8 },
      { fontSize: 0.36, weight: 'bold', lineHeight: 1.2 },
    )
    y -= 0.85
  } else {
    // mixed: 큰 사진 왼쪽, 작은 사진 2장 오른쪽 세로
    const gap = 0.22
    const bigW = innerW * 0.62
    const smallW = innerW - bigW - gap
    const bigH = 4.4
    slot(ctx, page, items[0], { x: left, y, w: bigW, h: bigH }, 0)
    const smallH = (bigH - gap) / 2
    items.slice(1, 3).forEach((m, i) => {
      slot(
        ctx,
        page,
        m,
        { x: left + bigW + gap, y: y - i * (smallH + gap), w: smallW, h: smallH },
        i + 1,
      )
    })
    y -= bigH + 0.1
    text(
      page,
      'cap0',
      `${pick('caption')}  ·  ${pick('caption')}`,
      { x: left, y, w: innerW, h: 0.3 },
      { fontSize: 0.15, color: INK_SOFT, lineHeight: 1.3 },
    )
    y -= 0.5
    text(
      page,
      'head',
      pick('headline'),
      { x: left, y, w: innerW, h: 0.8 },
      { fontSize: 0.36, weight: 'bold', lineHeight: 1.2 },
    )
    y -= 0.85
  }

  // 남은 공간: 2열 기사
  const bottom = -PAGE_H / 2 + MARGIN
  const colH = y - bottom
  if (colH > 0.8) {
    const gap = 0.28
    const w = (innerW - gap) / 2
    text(
      page,
      'colA',
      `${pick('body')} ${pick('body')}`,
      { x: left, y, w, h: colH },
      { fontSize: 0.16, align: 'justify', lineHeight: 1.6 },
    )
    text(
      page,
      'colB',
      `${pick('body')} ${pick('body')}`,
      { x: left + w + gap, y, w, h: colH },
      { fontSize: 0.16, align: 'justify', lineHeight: 1.6 },
    )
    rule(page, 'colrule', left + w + gap / 2 - 0.006, y, 0.012, colH, INK_SOFT)
  }
  return page
}

function addEnding(ctx: Ctx, page: Page) {
  const { pick } = ctx
  const left = -PAGE_W / 2 + MARGIN
  const innerW = PAGE_W - MARGIN * 2
  const y = -PAGE_H / 2 + MARGIN + 0.95
  // 마지막 면 하단 기사 칼럼을 덮는 박스
  rule(page, 'end-bg', left - 0.05, y + 0.05, innerW + 0.1, 1.05, '#efe6d2')
  rule(page, 'end-t', left, y, innerW, 0.03)
  text(
    page,
    'ending',
    pick('ending'),
    { x: left, y: y - 0.12, w: innerW, h: 0.5 },
    { fontSize: 0.3, weight: 'bold', align: 'center', lineHeight: 1.2 },
  )
  text(
    page,
    'credits',
    `${pick('credits')}  ·  ${pick('credits')}  ·  ${pick('credits')}`,
    { x: left, y: y - 0.62, w: innerW, h: 0.3 },
    { fontSize: 0.14, align: 'center', color: INK_SOFT, lineHeight: 1.3 },
  )
}

function offsetPage(page: Page, dx: number, dy: number) {
  page.x += dx
  page.y += dy
  page.slots.forEach((s) => {
    s.x += dx
    s.y += dy
  })
  page.texts.forEach((t) => {
    t.x += dx
    t.y += dy
  })
  page.rules.forEach((r) => {
    r.x += dx
    r.y += dy
  })
}

/** 카메라가 들를 지점: 1면은 헤드라인 → 사진 → 알림판, 사진 면은 사진들 */
function pointsOfInterest(page: Page): Poi[] {
  const pois: Poi[] = []
  const headline = page.texts.find((t) => t.id.endsWith('-headline'))
  if (headline)
    pois.push({
      x: headline.x + headline.w / 2,
      y: headline.y - 0.9,
      h: 2.6,
      fill: 0.9,
      roll: 0,
      dwell: 2.2,
      lens: [
        headline.x + 0.9,
        headline.y - 0.35,
        headline.x + headline.w - 0.9,
        headline.y - 0.45,
        0.62,
      ],
    })
  for (const s of page.slots)
    pois.push({ x: s.x, y: s.y, h: s.h, fill: 0.7, roll: s.rotation * 0.3, slot: s })
  const ad = page.texts.find((t) => t.id.endsWith('-ad'))
  if (ad)
    pois.push({
      x: ad.x + ad.w / 2,
      y: ad.y - ad.h / 2 + 0.2,
      h: ad.h + 0.8,
      fill: 0.85,
      roll: 0.02,
      dwell: 2.4,
      lens: [ad.x + ad.w / 2, ad.y - 0.35, ad.x + ad.w / 2, ad.y - ad.h + 0.5, 0.5],
    })
  return pois
}

export const NEWSPAPER_PAGE = { w: PAGE_W, h: PAGE_H, gap: GAP }
