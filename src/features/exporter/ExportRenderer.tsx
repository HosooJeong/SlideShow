import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type RootState } from '@react-three/fiber'
import type { MediaItem } from '@/features/media/types'
import { clipTime } from '@/features/renderer/clip'
import { StageView } from '@/features/renderer/StageView'
import { useMediaTextures } from '@/features/renderer/textures'
import type { Composition } from '@/features/renderer/types'
import { ManualClock } from './manualClock'

export type FrameRenderer = {
  /** t 시점의 프레임을 동기 렌더하고 캔버스를 돌려준다. 영상 클립은 시크가 끝날 때까지 기다린다 */
  renderAt: (t: number) => Promise<HTMLCanvasElement>
}

/**
 * 화면 밖에 출력 해상도로 띄우는 내보내기용 렌더러. frameloop="never"라 우리가 advance()로만 그린다.
 */
export function ExportRenderer({
  composition,
  items,
  width,
  height,
  onReady,
}: {
  composition: Composition
  items: MediaItem[]
  width: number
  height: number
  onReady: (r: FrameRenderer) => void
}) {
  const clock = useMemo(() => new ManualClock(), [])
  const { textures, videos, loading } = useMediaTextures(items)
  const [state, setState] = useState<RootState | null>(null)
  const readyFired = useRef(false)

  useEffect(() => {
    if (loading || readyFired.current || !state) return
    readyFired.current = true
    const renderAt = async (t: number) => {
      clock.set(t)
      await Promise.all(
        composition.slots.map(async (slot) => {
          const video = videos.get(slot.mediaId)
          if (!video || !slot.clip) return
          const { videoTime } = clipTime(slot, t)
          if (Math.abs(video.currentTime - videoTime) <= 0.02) return
          await seekVideo(video, videoTime)
        }),
      )
      state.advance(performance.now(), true)
      return state.gl.domElement
    }
    onReady({ renderAt })
  }, [loading, state, composition, videos, clock, onReady])

  return (
    <div
      style={{ position: 'fixed', left: -100000, top: 0, width, height, pointerEvents: 'none' }}
      aria-hidden
      data-testid="export-canvas"
    >
      <Canvas
        frameloop="never"
        dpr={1}
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
        onCreated={setState}
      >
        <StageView composition={composition} textures={textures} videos={videos} clock={clock} />
      </Canvas>
    </div>
  )
}

function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      video.removeEventListener('seeked', finish)
      resolve()
    }
    video.addEventListener('seeked', finish, { once: true })
    video.pause()
    video.currentTime = time
    // 일부 브라우저는 같은 위치로 시크하면 이벤트가 오지 않는다
    setTimeout(finish, 400)
  })
}
