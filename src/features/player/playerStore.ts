import { create } from 'zustand'
import type { RenderClock } from '@/features/renderer/clock'

type PlayerState = {
  t: number
  duration: number
  playing: boolean
  speed: number
  setDuration: (d: number) => void
  seek: (t: number) => void
  play: () => void
  pause: () => void
  toggle: () => void
  setSpeed: (s: number) => void
  /** rAF 루프가 호출. 끝에 닿으면 멈춘다 */
  advance: (dt: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  t: 0,
  duration: 0,
  playing: false,
  speed: 1,
  setDuration: (duration) => set((s) => ({ duration, t: Math.min(s.t, duration) })),
  seek: (t) => set((s) => ({ t: Math.max(0, Math.min(s.duration, t)) })),
  play: () => set((s) => (s.t >= s.duration ? { playing: true, t: 0 } : { playing: true })),
  pause: () => set({ playing: false }),
  toggle: () => (get().playing ? get().pause() : get().play()),
  setSpeed: (speed) => set({ speed }),
  advance: (dt) =>
    set((s) => {
      if (!s.playing) return s
      const next = s.t + dt * s.speed
      if (next >= s.duration) return { t: s.duration, playing: false }
      return { t: next }
    }),
}))

/** 렌더러용 시계 어댑터. t가 바뀔 때만 알린다 */
export const playerClock: RenderClock = {
  read: () => usePlayerStore.getState().t,
  subscribe: (cb) => {
    let prev = usePlayerStore.getState().t
    return usePlayerStore.subscribe((s) => {
      if (s.t !== prev) {
        prev = s.t
        cb()
      }
    })
  },
}
