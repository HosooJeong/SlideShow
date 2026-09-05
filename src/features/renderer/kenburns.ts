import { clamp01, easings, lerp } from '@/shared/utils/easing'
import type { KenBurns } from './types'

/**
 * 사진을 슬롯에 cover로 맞추는 기본 uv 스케일.
 * 사진이 슬롯보다 가로로 길면 가로를 잘라내고(scaleX < 1), 반대면 세로를 잘라낸다.
 */
export function coverScale(mediaAspect: number, slotAspect: number): [number, number] {
  if (mediaAspect > slotAspect) return [slotAspect / mediaAspect, 1]
  return [1, mediaAspect / slotAspect]
}

/**
 * 시간 t의 켄번즈 uv 변환. 순수 함수.
 * 반환 scale은 cover 스케일에 줌을 곱한 값, offset은 줌 여유 안으로 클램프된다.
 */
export function kenburnsUv(
  kb: KenBurns,
  mediaAspect: number,
  slotAspect: number,
  t: number,
): { uvScale: [number, number]; uvOffset: [number, number] } {
  const span = kb.end - kb.start
  const u = span <= 0 ? 1 : easings.inOutSine(clamp01((t - kb.start) / span))
  const zoom = Math.max(1, lerp(kb.zoomFrom, kb.zoomTo, u))
  const [cx, cy] = coverScale(mediaAspect, slotAspect)
  const sx = cx / zoom
  const sy = cy / zoom
  // 보이는 영역이 [0,1]을 벗어나지 않도록 오프셋 한계
  const maxX = (1 - sx) / 2
  const maxY = (1 - sy) / 2
  const px = lerp(kb.panFrom[0], kb.panTo[0], u)
  const py = lerp(kb.panFrom[1], kb.panTo[1], u)
  return {
    uvScale: [sx, sy],
    uvOffset: [clampAbs(px, maxX), clampAbs(py, maxY)],
  }
}

/** 등장 진행도(0..1). kind가 none이면 항상 1 */
export function appearProgress(appear: { kind: string; t0: number; duration: number }, t: number) {
  if (appear.kind === 'none') return 1
  if (appear.duration <= 0) return t >= appear.t0 ? 1 : 0
  return easings.outCubic(clamp01((t - appear.t0) / appear.duration))
}

const clampAbs = (v: number, max: number) => Math.max(-max, Math.min(max, v))

/** 사라짐 진행도(0 = 보임, 1 = 완전히 사라짐) */
export function vanishProgress(vanish: { t0: number; duration: number } | undefined, t: number) {
  if (!vanish) return 0
  if (vanish.duration <= 0) return t >= vanish.t0 ? 1 : 0
  return easings.inOutSine(clamp01((t - vanish.t0) / vanish.duration))
}
