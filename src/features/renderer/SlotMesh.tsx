import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshBasicMaterial, type Texture } from 'three'
import {
  createLivingPhotoMaterial,
  setLivingPhotoUniforms,
} from './devices/shaders/livingPhotoMaterial'
import { appearProgress, kenburnsUv } from './kenburns'
import type { RenderClock } from './clock'
import type { Devices, Slot } from './types'

const BORDER = 0.06

export function SlotMesh({
  slot,
  texture,
  devices,
  clock,
}: {
  slot: Slot
  texture: Texture
  devices: Devices
  clock: RenderClock
}) {
  const material = useMemo(
    () =>
      createLivingPhotoMaterial(
        texture,
        slot.w / slot.h,
        devices.halftone.params,
        devices.halftone.strength,
        { ...devices.ink, seed: slot.inkSeed },
      ),
    [texture, slot.w, slot.h, slot.inkSeed, devices.halftone, devices.ink],
  )
  useEffect(() => () => material.dispose(), [material])

  const frameMat = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    const t = clock.read()
    const progress = appearProgress(slot.appear, t)
    const kb = kenburnsUv(slot.kenburns, slot.mediaAspect, slot.w / slot.h, t)
    setLivingPhotoUniforms(material, { ...kb, progress })
    if (frameMat.current) {
      // 테두리는 사진보다 살짝 늦게 또렷해진다
      frameMat.current.opacity = Math.max(0, Math.min(1, (progress - 0.15) / 0.6))
    }
  })

  return (
    <group position={[slot.x, slot.y, slot.z]} rotation={[0, 0, slot.rotation]}>
      {slot.frame === 'print' && (
        <mesh>
          <planeGeometry args={[slot.w + BORDER * 2, slot.h + BORDER * 2]} />
          <meshBasicMaterial ref={frameMat} color="#fbf7ee" transparent opacity={0} />
        </mesh>
      )}
      <mesh position={[0, 0, 0.003]} material={material}>
        <planeGeometry args={[slot.w, slot.h]} />
      </mesh>
    </group>
  )
}
