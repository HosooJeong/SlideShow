import { create } from 'zustand'

/**
 * 실험실 공용 시계. 씬은 clock.getElapsedTime() 대신 이 t를 쓴다.
 * 렌더러의 원칙(플레이어/내보내기가 t를 주입)을 실험실에서 미리 따르고, 스크럽으로 특정 순간을 고정해 볼 수 있다.
 */
type LabClock = {
  t: number
  playing: boolean
  speed: number
  /** 스크럽 슬라이더 최대값(초) */
  range: number
  tick: (dt: number) => void
  seek: (t: number) => void
  setPlaying: (playing: boolean) => void
  setSpeed: (speed: number) => void
  reset: () => void
}

export const useLabClock = create<LabClock>((set) => ({
  t: 0,
  playing: true,
  speed: 1,
  range: 30,
  tick: (dt) => set((s) => (s.playing ? { t: (s.t + dt * s.speed) % s.range } : s)),
  seek: (t) => set({ t, playing: false }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  reset: () => set({ t: 0 }),
}))

/** useFrame 안에서 현재 t를 읽을 때 (구독 없이) */
export const readLabTime = () => useLabClock.getState().t
