export type Timings = { dwell: number; travel: number }

export const DEFAULT_TIMINGS: Timings = { dwell: 3.0, travel: 1.3 }
const LIMITS = { dwell: [1.4, 7.0], travel: [0.8, 2.6] } as const

/**
 * 기본 타이밍으로 만든 영상 길이(baseDuration)를 목표 길이(target)에 맞추기 위한 dwell/travel.
 * 길이는 dwell·travel에 대략 선형이므로 비율로 늘리고, 너무 느리거나 빠르지 않게 클램프한다.
 * 정확히 맞지 않아도 음악은 영상 끝에서 페이드아웃되므로 근사로 충분하다.
 */
export function fitTimings(
  baseDuration: number,
  target: number,
  base: Timings = DEFAULT_TIMINGS,
): Timings {
  if (baseDuration <= 0 || target <= 0) return base
  const ratio = target / baseDuration
  const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.max(lo, Math.min(hi, v))
  return {
    dwell: clamp(base.dwell * ratio, LIMITS.dwell),
    travel: clamp(base.travel * Math.sqrt(ratio), LIMITS.travel),
  }
}
