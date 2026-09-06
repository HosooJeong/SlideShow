import type { HandText, PenStroke } from '@/features/renderer/types'
import type { Rng } from '@/shared/utils/seededRandom'
import { DOODLES, type DoodleIcon } from './doodles'

type Pt = [number, number]

/** 폴리라인에 손 떨림을 더한다(시드 결정적). amp는 무대 단위 */
export function wobble(points: Pt[], rng: Rng, amp: number): Pt[] {
  return points.map(([x, y]) => [x + rng.range(-amp, amp), y + rng.range(-amp, amp)])
}

let counter = 0
const nextId = (prefix: string) => `${prefix}-${counter++}`
/** 테스트·결정성: 컴포저 시작 시 id 카운터를 리셋한다 */
export function resetPenIds() {
  counter = 0
}

type StrokeOpts = {
  color: string
  width: number
  z: number
  t0: number
  duration: number
  t1?: number
  opacity?: number
  kind?: PenStroke['kind']
}

export function stroke(points: Pt[], o: StrokeOpts): PenStroke {
  return {
    id: nextId('pen'),
    kind: o.kind ?? 'marker',
    points,
    width: o.width,
    color: o.color,
    opacity: o.opacity ?? (o.kind === 'highlighter' ? 0.8 : 0.92),
    z: o.z,
    t0: o.t0,
    duration: o.duration,
    t1: o.t1,
  }
}

/** 사진 둘레를 한 바퀴 남짓 두르는 타원 낙서(끝이 살짝 겹친다) */
export function circleAround(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rng: Rng,
  o: StrokeOpts,
): PenStroke {
  // 네 모서리가 타원 안에 들어와야 사진을 가리지 않는다: 반지름 = 반폭 × 1.4 + 여유
  const rx = (w / 2) * 1.4 + 0.08 + rng.range(0, 0.06)
  const ry = (h / 2) * 1.4 + 0.08 + rng.range(0, 0.06)
  const from = rng.range(0, Math.PI * 2)
  const n = 40
  const turns = 1.12
  const pts: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const a = from + (i / n) * Math.PI * 2 * turns
    // 손으로 그리면 원이 조금 눌린다
    const squash = 1 + 0.03 * Math.sin(a * 2 + from)
    pts.push([cx + Math.cos(a) * rx * squash, cy + Math.sin(a) * ry])
  }
  return stroke(wobble(pts, rng, 0.012), o)
}

/** 살짝 물결치는 밑줄 */
export function underline(x0: number, x1: number, y: number, rng: Rng, o: StrokeOpts): PenStroke {
  const n = 10
  const pts: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    pts.push([x0 + (x1 - x0) * u, y + Math.sin(u * Math.PI * 2.2 + 0.4) * 0.012 - u * 0.01])
  }
  return stroke(wobble(pts, rng, 0.006), o)
}

/** 화살표: 살짝 굽은 몸통 + 화살촉 두 획 */
export function arrow(from: Pt, to: Pt, rng: Rng, o: StrokeOpts): PenStroke[] {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const bend = rng.range(-0.18, 0.18) * len
  const shaft: Pt[] = []
  for (let i = 0; i <= 8; i++) {
    const u = i / 8
    const s = Math.sin(u * Math.PI) * bend
    shaft.push([from[0] + dx * u + nx * s, from[1] + dy * u + ny * s])
  }
  const ux = dx / len
  const uy = dy / len
  const hs = Math.min(0.22, len * 0.28)
  const head1: Pt[] = [
    [to[0] - ux * hs - nx * hs * 0.7, to[1] - uy * hs - ny * hs * 0.7],
    [to[0], to[1]],
  ]
  const head2: Pt[] = [
    [to[0] - ux * hs + nx * hs * 0.7, to[1] - uy * hs + ny * hs * 0.7],
    [to[0], to[1]],
  ]
  const d = o.duration
  return [
    stroke(wobble(shaft, rng, 0.008), { ...o, duration: d * 0.7 }),
    stroke(head1, { ...o, t0: o.t0 + d * 0.7, duration: d * 0.15 }),
    stroke(head2, { ...o, t0: o.t0 + d * 0.85, duration: d * 0.15 }),
  ]
}

/** 아이콘 낙서: 단위 상자 폴리라인을 크기·회전·위치로 옮기고 획을 차례로 그린다 */
export function doodle(
  icon: DoodleIcon,
  x: number,
  y: number,
  size: number,
  rotation: number,
  rng: Rng,
  o: StrokeOpts,
): PenStroke[] {
  const lines = DOODLES[icon]
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const total = lines.reduce((s, l) => s + pathLength(l), 0) || 1
  let t = o.t0
  return lines.map((line) => {
    const pts: Pt[] = line.map(([px, py]) => {
      const sx = px * size
      const sy = py * size
      return [x + sx * cos - sy * sin, y + sx * sin + sy * cos]
    })
    const dur = Math.max(0.12, (pathLength(line) / total) * o.duration)
    const s = stroke(wobble(pts, rng, size * 0.012), { ...o, t0: t, duration: dur })
    t += dur * 0.9
    return s
  })
}

function pathLength(line: Pt[]) {
  let s = 0
  for (let i = 1; i < line.length; i++)
    s += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])
  return s
}

/** 손글씨 캡션(사인펜) + 선택적 형광펜 밑줄 강조 */
export function caption(
  text: string,
  x: number,
  y: number,
  o: {
    fontSize: number
    color: string
    rotation: number
    align: HandText['align']
    z: number
    t0: number
    t1?: number
    /** 글자당 쓰는 시간(초) */
    perChar?: number
    highlighter?: { color: string; rng: Rng }
  },
): { text: HandText; strokes: PenStroke[] } {
  const perChar = o.perChar ?? 0.11
  const duration = Math.max(0.5, text.length * perChar)
  const hand: HandText = {
    id: nextId('hand'),
    text,
    x,
    y,
    z: o.z,
    fontSize: o.fontSize,
    color: o.color,
    rotation: o.rotation,
    align: o.align,
    t0: o.t0,
    duration,
    t1: o.t1,
  }
  const strokes: PenStroke[] = []
  if (o.highlighter) {
    // 폰트 폭은 대략 글자당 fontSize의 0.52(한글 손글씨 기준)
    const w = text.length * o.fontSize * 0.52 + o.fontSize * 0.3
    const left = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2
    const cos = Math.cos(o.rotation)
    const sin = Math.sin(o.rotation)
    const local: Pt[] = [
      [left - o.fontSize * 0.1, y - o.fontSize * 0.08],
      [left + w * 0.5, y - o.fontSize * 0.06],
      [left + w + o.fontSize * 0.1, y - o.fontSize * 0.1],
    ]
    const pts: Pt[] = local.map(([px, py]) => {
      const dx = px - x
      const dy = py - y
      return [x + dx * cos - dy * sin, y + dx * sin + dy * cos]
    })
    strokes.push(
      stroke(wobble(pts, o.highlighter.rng, 0.01), {
        kind: 'highlighter',
        color: o.highlighter.color,
        width: o.fontSize * 0.75,
        z: o.z - 0.004,
        t0: o.t0 + duration * 0.4,
        duration: 0.45,
        t1: o.t1,
      }),
    )
  }
  return { text: hand, strokes }
}

/** 테마별 손글씨 문구 풀 */
export const HAND_PHRASES: Record<string, string[]> = {
  doljanchi: [
    '첫 생일 축하해!',
    '오늘의 주인공',
    '무럭무럭 자라렴',
    '사랑해 우리 아기',
    '한 살이 되었어요',
    '돌잡이 뭐 잡을까?',
    '세상에서 가장 예쁜',
    '웃음이 한가득',
    '오늘도 사랑해',
  ],
  birthday: ['생일 축하해!', '오늘은 네 날', '소원 빌어!', '케이크 먼저', '최고의 하루'],
  wedding: ['우리 결혼했어요', '오늘부터 하나', '평생 함께', '가장 빛나는 날', '사랑을 약속해'],
  travel: ['떠나자!', '여기 좋다', '바람이 좋아', '다음엔 어디로?', '오늘의 하늘'],
}
