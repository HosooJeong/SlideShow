import { clamp01, easings, lerp, type EasingName } from '@/shared/utils/easing'

/** 카메라 키프레임. 다음 키까지 `ease`로 보간한다. */
export type CameraKey = {
  t: number
  x: number
  y: number
  z: number
  /** 바라보는 지점 */
  lookX: number
  lookY: number
  lookZ: number
  /** 롤(라디안) */
  roll: number
  ease: EasingName
}

export type CameraPose = Omit<CameraKey, 't' | 'ease'>

/**
 * 시간 t에서의 카메라 포즈. 키프레임은 t 오름차순이어야 한다.
 * 순수 함수: 같은 (keys, t)면 항상 같은 결과 → 재생·시크·내보내기가 일치한다.
 */
export function sampleCamera(keys: readonly CameraKey[], t: number): CameraPose {
  if (keys.length === 0) throw new Error('카메라 키프레임이 없어요')
  if (t <= keys[0].t) return strip(keys[0])
  const last = keys[keys.length - 1]
  if (t >= last.t) return strip(last)

  // 이진 탐색으로 t를 포함하는 구간 찾기
  let lo = 0
  let hi = keys.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (keys[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = keys[lo]
  const b = keys[hi]
  const span = b.t - a.t
  const u = span <= 0 ? 1 : easings[a.ease](clamp01((t - a.t) / span))
  return {
    x: lerp(a.x, b.x, u),
    y: lerp(a.y, b.y, u),
    z: lerp(a.z, b.z, u),
    lookX: lerp(a.lookX, b.lookX, u),
    lookY: lerp(a.lookY, b.lookY, u),
    lookZ: lerp(a.lookZ, b.lookZ, u),
    roll: lerp(a.roll, b.roll, u),
  }
}

function strip(k: CameraKey): CameraPose {
  const { t: _t, ease: _e, ...pose } = k
  return pose
}

/**
 * "전체 보기 → 슬롯1 근접 → 슬롯2 근접 → … → 전체 보기" 형태의 방문 경로를 만든다.
 * 각 목표 지점에 `dwell`초 머무르고, 이동에 `travel`초를 쓴다.
 */
export function buildVisitPath(opts: {
  overview: { x: number; y: number; z: number; lookX: number; lookY: number }
  targets: { x: number; y: number; z: number; tilt?: number }[]
  /** 대상에 다가갔을 때 카메라와 대상 사이 거리 */
  approach: number
  dwell: number
  travel: number
  /** 머무는 동안의 미세 드리프트(월드 단위) */
  drift?: number
  ease?: EasingName
}): CameraKey[] {
  const { overview, targets, approach, dwell, travel, drift = 0, ease = 'inOutCubic' } = opts
  const keys: CameraKey[] = []
  let t = 0
  const push = (pose: CameraPose, at: number) => keys.push({ ...pose, t: at, ease })

  const overviewPose: CameraPose = {
    x: overview.x,
    y: overview.y,
    z: overview.z,
    lookX: overview.lookX,
    lookY: overview.lookY,
    lookZ: 0,
    roll: 0,
  }
  push(overviewPose, t)
  t += dwell * 0.6

  targets.forEach((target, i) => {
    const roll = target.tilt ?? 0
    const near: CameraPose = {
      x: target.x,
      y: target.y,
      z: target.z + approach,
      lookX: target.x,
      lookY: target.y,
      lookZ: target.z,
      roll,
    }
    t += travel
    push(near, t)
    t += dwell
    // 머무는 끝에 살짝 드리프트해 정지 화면처럼 보이지 않게 한다.
    const dir = i % 2 === 0 ? 1 : -1
    push({ ...near, x: near.x + drift * dir, y: near.y + drift * 0.5, z: near.z - drift }, t)
  })

  t += travel
  push(overviewPose, t)
  return keys
}

export function pathDuration(keys: readonly CameraKey[]) {
  return keys.length ? keys[keys.length - 1].t : 0
}
