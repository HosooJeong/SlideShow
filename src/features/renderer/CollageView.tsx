import { useEffect, useMemo } from 'react'
import { createPaperMaterial } from './devices/shaders/paperMaterial'
import { createGradientMaterial } from './devices/shaders/gradientMaterial'
import { SlotMesh } from './SlotMesh'
import type { RenderClock } from './clock'
import type { TextureMap, VideoMap } from './textures'
import type { CollageStage, Composition } from './types'

/** 콜라주 보드: 종이 보드 위 레이아웃 슬롯들. 사진은 플레이리스트로 순차 교체된다 */
export function CollageView({
  stage,
  composition,
  textures,
  videos,
  clock,
}: {
  stage: CollageStage
  composition: Composition
  textures: TextureMap
  videos?: VideoMap
  clock: RenderClock
}) {
  const bg = stage.background
  const boardMat = useMemo(
    () =>
      bg
        ? createGradientMaterial(bg[0], bg[1])
        : createPaperMaterial(stage.paper, [stage.width * 1.3, stage.height * 1.3]),
    [bg, stage.paper, stage.width, stage.height],
  )
  useEffect(() => () => boardMat.dispose(), [boardMat])
  return (
    <>
      <color attach="background" args={[bg ? bg[1] : '#0c0b0a']} />
      <mesh position={[0, 0, -0.01]} material={boardMat}>
        <planeGeometry args={[stage.width * 1.3, stage.height * 1.3]} />
      </mesh>
      {composition.slots.map((slot) => {
        const first = slot.playlist?.[0]?.mediaId ?? slot.mediaId
        const texture = textures.get(first)
        return texture ? (
          <group key={slot.id}>
            {/* 얕은 그림자 */}
            <mesh position={[slot.x + 0.05, slot.y - 0.06, slot.z - 0.005]}>
              <planeGeometry args={[slot.w + 0.14, slot.h + 0.14]} />
              <meshBasicMaterial color="#000" transparent opacity={0.12} depthWrite={false} />
            </mesh>
            <SlotMesh
              slot={slot}
              texture={texture}
              video={videos?.get(first)}
              devices={composition.devices}
              clock={clock}
              textures={textures}
            />
          </group>
        ) : null
      })}
    </>
  )
}
