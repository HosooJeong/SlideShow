import { useEffect } from 'react'
import { usePlayerStore } from './playerStore'

/** 재생 중일 때 rAF로 t를 진행시킨다. 탭이 숨겨지면 rAF가 멈추므로 dt를 제한한다 */
export function usePlaybackLoop() {
  const playing = usePlayerStore((s) => s.playing)
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      usePlayerStore.getState().advance(dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])
}
