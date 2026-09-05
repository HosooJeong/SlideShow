import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { DepthOfField, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction, type DepthOfFieldEffect } from 'postprocessing'
import { Group, PerspectiveCamera as ThreeCamera, Vector3 } from 'three'
import { sampleCamera } from './camera/cameraPath'
import { createPaperMaterial, type PaperParams } from './devices/shaders/paperMaterial'
import { RuleMesh } from './RuleMesh'
import { SlotMesh } from './SlotMesh'
import { TextBlockMesh } from './TextBlockMesh'
import { FlashOverlay, StreamView } from './StreamView'
import type { RenderClock } from './clock'
import type { TextureMap, VideoMap } from './textures'
import type { Composition, NewspaperStage, Page } from './types'
import { clamp01, easings } from '@/shared/utils/easing'

/**
 * render(composition, t)의 실체. 시간은 clock에서 읽고, clock이 바뀔 때만 한 프레임 그린다.
 */
export function StageView({
  composition,
  textures,
  videos,
  clock,
}: {
  composition: Composition
  textures: TextureMap
  videos?: VideoMap
  clock: RenderClock
}) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => clock.subscribe(invalidate), [clock, invalidate])
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

  return (
    <>
      <color attach="background" args={['#0c0b0a']} />
      <PerspectiveCamera ref={camRef} makeDefault fov={composition.fov} position={[0, 0, 12]}>
        {stage.kind === 'stream' && (
          <FlashOverlay flashes={stage.flashes} fov={composition.fov} clock={clock} />
        )}
      </PerspectiveCamera>
      {stage.kind === 'stream' ? (
        <StreamView
          stage={stage}
          composition={composition}
          textures={textures}
          videos={videos}
          clock={clock}
        />
      ) : stage.kind === 'paper' ? (
        <>
          <PaperMesh params={stage.paper} w={stage.width} h={stage.height} />
          {composition.slots.map((slot) => {
            const texture = textures.get(slot.mediaId)
            return texture ? (
              <SlotMesh
                key={slot.id}
                slot={slot}
                texture={texture}
                devices={devices}
                clock={clock}
              />
            ) : null
          })}
        </>
      ) : (
        <NewspaperView
          stage={stage}
          composition={composition}
          textures={textures}
          videos={videos}
          clock={clock}
        />
      )}
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

function PaperMesh({
  params,
  w,
  h,
  x = 0,
  y = 0,
}: {
  params: PaperParams
  w: number
  h: number
  x?: number
  y?: number
}) {
  const mat = useMemo(() => createPaperMaterial(params, [w, h]), [params, w, h])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh position={[x, y, -0.01]} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

/**
 * 신문 무대. 오프닝 동안 1면이 회전·확대되며 날아와 착지한다(t의 함수).
 * 나머지 면은 오프닝이 끝나면 제자리에 있다.
 */
function NewspaperView({
  stage,
  composition,
  textures,
  videos,
  clock,
}: {
  stage: NewspaperStage
  composition: Composition
  textures: TextureMap
  videos?: VideoMap
  clock: RenderClock
}) {
  const frontRef = useRef<Group>(null)
  const restRef = useRef<Group>(null)
  const front = stage.pages[0]

  useFrame(() => {
    const t = clock.read()
    const d = stage.opening.duration
    const u = d > 0 ? easings.outCubic(clamp01(t / d)) : 1
    const g = frontRef.current
    if (g && front) {
      // 피벗 그룹이 1면 중심에 있으므로 회전·확대는 1면 중심을 축으로 일어난다
      const s = 0.04 + 0.96 * u
      g.position.set(front.x, front.y, (1 - u) * 5)
      g.scale.setScalar(s)
      g.rotation.z = (1 - u) * Math.PI * 4
    }
    if (restRef.current) restRef.current.visible = u >= 1
  })

  return (
    <>
      {front && (
        <group ref={frontRef} position={[front.x, front.y, 0]}>
          <group position={[-front.x, -front.y, 0]}>
            <PageView
              page={front}
              paper={stage.paper}
              composition={composition}
              textures={textures}
              videos={videos}
              clock={clock}
            />
          </group>
        </group>
      )}
      <group ref={restRef}>
        {stage.pages.slice(1).map((page) => (
          <PageView
            key={page.id}
            page={page}
            paper={stage.paper}
            composition={composition}
            textures={textures}
            videos={videos}
            clock={clock}
          />
        ))}
      </group>
    </>
  )
}

function PageView({
  page,
  paper,
  composition,
  textures,
  videos,
  clock,
}: {
  page: Page
  paper: PaperParams
  composition: Composition
  textures: TextureMap
  videos?: VideoMap
  clock: RenderClock
}) {
  return (
    <group>
      <PaperMesh
        params={{ ...paper, seed: paper.seed + page.x * 7 }}
        w={page.w}
        h={page.h}
        x={page.x}
        y={page.y}
      />
      {page.rules.map((r) => (
        <RuleMesh key={r.id} rule={r} clock={clock} />
      ))}
      {page.texts.map((tb) => (
        <TextBlockMesh key={tb.id} block={tb} clock={clock} />
      ))}
      {page.slots.map((slot) => {
        const texture = textures.get(slot.mediaId)
        return texture ? (
          <SlotMesh
            key={slot.id}
            slot={slot}
            texture={texture}
            video={videos?.get(slot.mediaId)}
            devices={composition.devices}
            clock={clock}
          />
        ) : null
      })}
    </group>
  )
}
