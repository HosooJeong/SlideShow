import { useEffect, useRef } from 'react'
import { getBlob } from '@/features/media/db'
import type { ProjectMusic } from '@/features/media/types'
import { usePlayerStore } from '@/features/player/playerStore'
import { AudioEngine } from './audioEngine'
import { musicGain } from './envelope'

/**
 * 플레이어 상태(t, playing)에 음악을 동기화한다.
 * 재생 시작·시크 시 해당 t에서 다시 시작하고, 매 t 변화마다 엔벌로프 게인을 적용한다.
 */
export function useMusicSync(music: ProjectMusic | undefined, end: number, muted: boolean) {
  const engine = useRef<AudioEngine | null>(null)

  useEffect(() => {
    if (!music) return
    const eng = new AudioEngine()
    engine.current = eng
    let cancelled = false
    getBlob(music.blobKey).then(async (blob) => {
      if (!blob || cancelled) return
      await eng.load(blob)
      if (cancelled) return
      const s = usePlayerStore.getState()
      if (s.playing) void eng.start(s.t)
    })
    return () => {
      cancelled = true
      eng.dispose()
      engine.current = null
    }
  }, [music?.blobKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!music) return
    let prev = usePlayerStore.getState()
    return usePlayerStore.subscribe((s) => {
      const eng = engine.current
      if (!eng?.ready) {
        prev = s
        return
      }
      if (s.playing !== prev.playing) {
        if (s.playing) void eng.start(s.t)
        else eng.stop()
      } else if (s.playing && Math.abs(s.t - eng.position()) > 0.25) {
        // 시크 또는 드리프트: 다시 맞춘다
        void eng.start(s.t)
      }
      if (s.playing) {
        const g = muted
          ? 0
          : musicGain(s.t, {
              end,
              musicDuration: music.duration,
              fadeIn: music.fadeIn,
              fadeOut: music.fadeOut,
              volume: music.volume,
            })
        eng.setGain(g)
      }
      prev = s
    })
  }, [music, end, muted])
}
