import type { Slot } from './types'

/**
 * 영상 시간 t에서 슬롯 클립이 보여줄 원본 영상 위치(초). 순수 함수.
 * 창(kenburns.start~end) 안에서는 재생(루프면 반복), 밖에서는 첫 프레임(clip.start)에 멈춘다.
 */
export function clipTime(slot: Slot, t: number): { videoTime: number; active: boolean } {
  const clip = slot.clip
  if (!clip) return { videoTime: 0, active: false }
  const { start, end } = slot.kenburns
  if (t < start || end <= start) return { videoTime: clip.start, active: false }
  if (t >= end) {
    const played = end - start
    const last = clip.loop ? played % clip.duration : Math.min(played, clip.duration)
    return { videoTime: clip.start + last, active: false }
  }
  const elapsed = t - start
  if (clip.loop) return { videoTime: clip.start + (elapsed % clip.duration), active: true }
  if (elapsed >= clip.duration) return { videoTime: clip.start + clip.duration, active: false }
  return { videoTime: clip.start + elapsed, active: true }
}

/** 컴포저용: 원본 길이와 창 길이로 클립 구간을 정한다 */
export function planClip(opts: {
  sourceDuration: number
  windowDuration: number
  maxSeconds: number
  volume: number
}): Slot['clip'] {
  const { sourceDuration, windowDuration, maxSeconds, volume } = opts
  if (!(sourceDuration > 0)) return undefined
  const duration = Math.max(0.5, Math.min(sourceDuration, maxSeconds, Math.max(windowDuration, 1)))
  // 첫 1초는 흔들리기 쉬우니 여유가 있으면 조금 뒤에서 시작
  const slack = sourceDuration - duration
  const start = slack > 2 ? Math.min(1, slack * 0.2) : 0
  return { start, duration, loop: true, volume }
}
