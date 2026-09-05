import type { RenderClock } from '@/features/renderer/clock'

/** 내보내기용 시계. set(t)로만 움직이고, 재생 상태는 항상 false(영상은 시크로 정확히 맞춤) */
export class ManualClock implements RenderClock {
  private t = 0
  private subs = new Set<() => void>()
  read = () => this.t
  isPlaying = () => false
  subscribe = (cb: () => void) => {
    this.subs.add(cb)
    return () => void this.subs.delete(cb)
  }
  set(t: number) {
    this.t = t
    this.subs.forEach((cb) => cb())
  }
}
