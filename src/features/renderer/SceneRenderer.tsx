import { Canvas } from '@react-three/fiber'
import { StageView } from './StageView'
import type { RenderClock } from './clock'
import type { TextureMap, VideoMap } from './textures'
import type { Composition } from './types'

/**
 * 렌더러 진입점. frameloop="demand": 자동으로 그리지 않고 clock이 바뀔 때만 그린다.
 * preserveDrawingBuffer는 내보내기(캔버스 캡처)를 위해 켠다.
 */
export function SceneRenderer({
  composition,
  textures,
  videos,
  clock,
  className,
}: {
  composition: Composition
  textures: TextureMap
  videos?: VideoMap
  clock: RenderClock
  className?: string
}) {
  return (
    <Canvas
      className={className}
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
    >
      <StageView composition={composition} textures={textures} videos={videos} clock={clock} />
    </Canvas>
  )
}
