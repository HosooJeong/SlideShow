import { useEffect, useMemo } from 'react'
import { PerspectiveCamera } from '@react-three/drei'
import { useControls } from 'leva'
import { halftoneDefaults } from '@/features/renderer/devices/shaders/halftoneMaterial'
import { inkRevealDefaults } from '@/features/renderer/devices/shaders/inkRevealMaterial'
import {
  createLivingPhotoMaterial,
  setLivingPhotoSwap,
  setLivingPhotoUniforms,
} from '@/features/renderer/devices/shaders/livingPhotoMaterial'
import { coverScale } from '@/features/renderer/kenburns'
import { useLabTextures } from '../useLabTextures'

/** 플레이리스트 전환 셰이더 검증: 종류·방향·진행도를 직접 조절 */
export function SwapScene() {
  const ctl = useControls('전환', {
    kind: { value: 'wipe', options: ['wipe', 'push', 'flip', 'cut'] },
    mix: { value: 0.5, min: 0, max: 1, step: 0.01 },
    dirX: { value: 1, min: -1, max: 1, step: 1 },
    dirY: { value: 0, min: -1, max: 1, step: 1 },
    halftone: { value: 0, min: 0, max: 1, step: 0.05 },
  })
  const photos = useLabTextures(2)
  const w = 6.4
  const h = 3.6
  const material = useMemo(
    () =>
      photos[0]
        ? createLivingPhotoMaterial(
            photos[0].texture,
            w / h,
            halftoneDefaults,
            0,
            inkRevealDefaults,
          )
        : null,
    [photos],
  )
  useEffect(() => () => material?.dispose(), [material])
  useEffect(() => {
    if (!material || photos.length < 2) return
    material.uniforms.uHtStrength.value = ctl.halftone
    const covA = coverScale(photos[0].aspect, w / h)
    const covB = coverScale(photos[1].aspect, w / h)
    setLivingPhotoUniforms(material, { uvScale: covA, uvOffset: [0, 0], progress: 1 })
    setLivingPhotoSwap(material, {
      mapA: photos[0].texture,
      mapB: photos[1].texture,
      uvB: { uvScale: covB, uvOffset: [0, 0] },
      mix: ctl.mix,
      kind: ctl.kind as 'wipe' | 'push' | 'flip' | 'cut',
      dir: [ctl.dirX, ctl.dirY],
    })
  }, [material, photos, ctl])
  return (
    <>
      <color attach="background" args={['#111']} />
      <PerspectiveCamera makeDefault fov={36} position={[0, 0, 7]} />
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[8, 5]} />
        <meshBasicMaterial color="#efe6d2" />
      </mesh>
      {material && (
        <mesh material={material}>
          <planeGeometry args={[w, h]} />
        </mesh>
      )}
    </>
  )
}
