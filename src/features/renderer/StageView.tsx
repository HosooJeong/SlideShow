import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import {
  Bloom,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  N8AO,
  Noise,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction, type DepthOfFieldEffect, ToneMappingMode } from 'postprocessing'
import { Group, PerspectiveCamera as ThreeCamera, Vector2, Vector3 } from 'three'
import { sampleCamera } from './camera/cameraPath'
import { createPaperMaterial, type PaperParams } from './devices/shaders/paperMaterial'
import { createGradientMaterial } from './devices/shaders/gradientMaterial'
import { RuleMesh } from './RuleMesh'
import { SlotMesh } from './SlotMesh'
import { TextBlockMesh } from './TextBlockMesh'
import { FlashOverlay, StreamView } from './StreamView'
import { CollageView } from './CollageView'
import { AlbumView } from './album/AlbumView'
import { ParticleTransitionMesh } from './devices/ParticleTransitionMesh'
import { GlassLens } from './devices/GlassLens'
import { CurlSheet } from './devices/CurlSheet'
import { DecorLayer } from './devices/DecorLayer'
import { PenLayer } from './pen/PenLayer'
import type { RenderClock } from './clock'
import type { TextureMap, VideoMap } from './textures'
import type { Composition, LensPass, NewspaperStage, Page } from './types'
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
    const t = clock.read()
    const pose = sampleCamera(composition.camera, t)
    let roll = pose.roll
    cam.position.set(pose.x, pose.y, pose.z)
    look.current.set(pose.lookX, pose.lookY, pose.lookZ)
    // 핸드헬드: 서로 무리수 비의 사인파 합(t의 함수, 결정적). 위치는 살짝, 시선은 더 살짝
    const hh = composition.handheld
    if (hh) {
      const w = hh.freq * Math.PI * 2
      const nx =
        Math.sin(t * w) * 0.6 +
        Math.sin(t * w * 1.73 + 1.3) * 0.3 +
        Math.sin(t * w * 3.1 + 0.4) * 0.1
      const ny =
        Math.sin(t * w * 0.87 + 2.1) * 0.6 +
        Math.sin(t * w * 2.21 + 0.7) * 0.3 +
        Math.sin(t * w * 3.7) * 0.1
      const nz = Math.sin(t * w * 0.63 + 0.9) * 0.5 + Math.sin(t * w * 1.91 + 2.6) * 0.3
      cam.position.x += nx * hh.amp
      cam.position.y += ny * hh.amp
      cam.position.z += nz * hh.amp * 0.5
      look.current.x += nx * hh.amp * 0.35
      look.current.y += ny * hh.amp * 0.35
      roll += Math.sin(t * w * 0.71 + 1.7) * hh.rot
    }
    up.current.set(Math.sin(roll), Math.cos(roll), 0)
    cam.up.copy(up.current)
    cam.lookAt(look.current)
    const dof = dofRef.current
    if (dof) {
      dof.target = look.current
      if (composition.stage.kind === 'album') {
        // 샷별 심도
        let shot = composition.stage.shots[0]
        for (const sh of composition.stage.shots) if (t >= sh.t0) shot = sh
        if (shot) {
          dof.bokehScale = shot.dof.bokehScale
          dof.cocMaterial.worldFocusRange = shot.dof.focusRange
        }
      }
    }
  })
  const caOffset = useMemo(() => new Vector2(0.0006, 0.0004), [])

  const { stage, devices } = composition

  return (
    <>
      <color attach="background" args={['#0c0b0a']} />
      <PerspectiveCamera ref={camRef} makeDefault fov={composition.fov} position={[0, 0, 12]}>
        {(stage.kind === 'stream' || stage.kind === 'album') && (
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
      ) : stage.kind === 'collage' ? (
        <CollageView
          stage={stage}
          composition={composition}
          textures={textures}
          videos={videos}
          clock={clock}
        />
      ) : stage.kind === 'album' ? (
        <AlbumView stage={stage} composition={composition} textures={textures} clock={clock} />
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
      {composition.decor && composition.decor.length > 0 && (
        <DecorLayer items={composition.decor} clock={clock} />
      )}
      {composition.pen && <PenLayer pen={composition.pen} clock={clock} />}
      <EffectComposer multisampling={0}>
        {stage.kind === 'album' ? (
          <N8AO aoRadius={0.35} intensity={2.6} distanceFalloff={0.7} quality="medium" />
        ) : (
          <></>
        )}
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
        {stage.kind === 'album' ? (
          <Bloom luminanceThreshold={0.96} luminanceSmoothing={0.2} intensity={0.16} mipmapBlur />
        ) : (
          <></>
        )}
        {stage.kind === 'album' ? <ToneMapping mode={ToneMappingMode.ACES_FILMIC} /> : <></>}
        {stage.kind === 'album' ? (
          <ChromaticAberration offset={caOffset} radialModulation modulationOffset={0.35} />
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

  // 책상: 어두운 크라프트 결의 배경판. 면 밖 여백이 검게 비지 않게
  const deskMat = useMemo(
    () =>
      createGradientMaterial(
        '#2b2521',
        '#161211',
        { kind: 'kraft', color: '#3a312a', scale: 30, strength: 0.7 },
        1,
      ),
    [],
  )
  useEffect(() => () => deskMat.dispose(), [deskMat])
  return (
    <>
      <mesh position={[0, 0, -0.6]} material={deskMat}>
        <planeGeometry args={[400, 400]} />
      </mesh>
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
      {stage.sheets?.map((sheet) => {
        const page = stage.pages.find((p) => p.id === sheet.pageId)
        return page ? (
          <CurlSheet
            key={sheet.id}
            sheet={sheet}
            page={page}
            clock={clock}
            paperColor={stage.paper.baseColor}
          />
        ) : null
      })}
      {stage.lenses?.map((lens) => (
        <LensGate key={lens.id} pass={lens} clock={clock} />
      ))}
      {stage.transitions?.map((tr) => {
        const from = composition.slots.find((s) => s.id === tr.fromSlotId)
        const to = composition.slots.find((s) => s.id === tr.toSlotId)
        const mapA = from && textures.get(from.mediaId)
        const mapB = to && textures.get(to.mediaId)
        return from && to && mapA && mapB ? (
          <ParticleTransitionMesh
            key={tr.id}
            transition={tr}
            from={from}
            to={to}
            mapA={mapA}
            mapB={mapB}
            clock={clock}
          />
        ) : null
      })}
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
            textures={textures}
          />
        ) : null
      })}
    </group>
  )
}

/** 렌즈가 보이는 구간(여유 포함)에서만 투과 재질을 마운트한다(FBO 비용 절약) */
function LensGate({ pass, clock }: { pass: LensPass; clock: RenderClock }) {
  const [mounted, setMounted] = useState(false)
  useFrame(() => {
    const t = clock.read()
    const on = t >= pass.t0 - 0.3 && t <= pass.t0 + pass.duration + 0.3
    if (on !== mounted) setMounted(on)
  })
  return mounted ? <GlassLens pass={pass} clock={clock} /> : null
}
