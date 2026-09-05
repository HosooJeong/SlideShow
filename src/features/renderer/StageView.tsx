import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { DepthOfField, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction, type DepthOfFieldEffect } from 'postprocessing'
import { PerspectiveCamera as ThreeCamera, Vector3 } from 'three'
import { sampleCamera } from './camera/cameraPath'
import { createPaperMaterial } from './devices/shaders/paperMaterial'
import { SlotMesh } from './SlotMesh'
import type { RenderClock } from './clock'
import type { TextureMap } from './textures'
import type { Composition } from './types'

/**
 * render(composition, t)의 실체. 시간은 clock에서 읽고, clock이 바뀔 때만 한 프레임 그린다.
 */
export function StageView({
  composition,
  textures,
  clock,
}: {
  composition: Composition
  textures: TextureMap
  clock: RenderClock
}) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => clock.subscribe(invalidate), [clock, invalidate])
  // 컴포지션이나 텍스처가 바뀌면 한 번 그린다
  useEffect(() => void invalidate(), [composition, textures, invalidate])

  const camRef = useRef<ThreeCamera>(null)
  const dofRef = useRef<DepthOfFieldEffect>(null)
  const look = useRef(new Vector3())
  const up = useRef(new Vector3())

  useFrame(() => {
    const cam = camRef.current
    if (!cam) return
    const pose = sampleCamera(composition.camera, clock.read())
    cam.position.set(pose.x, pose.y, pose.z)
    look.current.set(pose.lookX, pose.lookY, pose.lookZ)
    up.current.set(Math.sin(pose.roll), Math.cos(pose.roll), 0)
    cam.up.copy(up.current)
    cam.lookAt(look.current)
    if (dofRef.current) dofRef.current.target = look.current
  })

  const { stage, devices } = composition
  const paperMat = useMemo(
    () => createPaperMaterial(stage.paper, [stage.width, stage.height]),
    [stage.paper, stage.width, stage.height],
  )
  useEffect(() => () => paperMat.dispose(), [paperMat])

  return (
    <>
      <color attach="background" args={['#0c0b0a']} />
      <PerspectiveCamera ref={camRef} makeDefault fov={composition.fov} position={[0, 0, 12]} />
      <mesh position={[0, 0, -0.01]} material={paperMat}>
        <planeGeometry args={[stage.width, stage.height]} />
      </mesh>
      {composition.slots.map((slot) => {
        const texture = textures.get(slot.mediaId)
        if (!texture) return null
        return (
          <SlotMesh key={slot.id} slot={slot} texture={texture} devices={devices} clock={clock} />
        )
      })}
      <EffectComposer multisampling={0}>
        {devices.dof?.enabled ? (
          <DepthOfField
            ref={dofRef}
            worldFocusRange={devices.dof.focusRange}
            bokehScale={devices.dof.bokehScale}
            target={[0, 0, 0]}
          />
        ) : (
          <></>
        )}
        <Noise opacity={devices.film.grain} blendFunction={BlendFunction.SOFT_LIGHT} />
        <Vignette
          eskil={false}
          offset={devices.film.vignetteOffset}
          darkness={devices.film.vignette}
        />
      </EffectComposer>
    </>
  )
}
