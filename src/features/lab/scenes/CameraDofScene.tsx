import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { DepthOfField, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useControls, folder } from 'leva'
import type { DepthOfFieldEffect } from 'postprocessing'
import { Group, MathUtils, PerspectiveCamera as ThreeCamera, Vector3 } from 'three'
import { buildVisitPath, pathDuration, sampleCamera } from '@/features/renderer/camera/cameraPath'
import { createRng } from '@/shared/utils/seededRandom'
import { useLabTextures } from '../useLabTextures'
import { readLabTime } from '../labClock'

/**
 * A1 3D 카메라 + DOF, B2 필름 룩(그레인·비네트) 스파이크.
 * 종이 위에 흩어진 사진들을 카메라가 차례로 방문한다. 카메라 포즈는 t의 순수 함수.
 */
export function CameraDofScene() {
  const ctl = useControls({
    카메라: folder({
      photoCount: { value: 5, min: 1, max: 6, step: 1, label: '사진 수' },
      approach: { value: 3.2, min: 1, max: 6, step: 0.1, label: '근접 거리' },
      dwell: { value: 2.2, min: 0.5, max: 5, step: 0.1, label: '머무름(s)' },
      travel: { value: 1.4, min: 0.3, max: 4, step: 0.1, label: '이동(s)' },
      drift: { value: 0.15, min: 0, max: 0.6, step: 0.01, label: '드리프트' },
      handheld: { value: 0.012, min: 0, max: 0.05, step: 0.001, label: '핸드헬드 흔들림' },
      seed: { value: 7, min: 1, max: 999, step: 1, label: '시드' },
    }),
    DOF: folder({
      dofEnabled: { value: true, label: '켜기' },
      focusRange: { value: 0.9, min: 0.05, max: 5, step: 0.05, label: '초점 범위' },
      bokehScale: { value: 4, min: 0, max: 12, step: 0.1, label: '보케 크기' },
    }),
    필름: folder({
      grain: { value: 0.18, min: 0, max: 0.6, step: 0.01, label: '그레인' },
      vignette: { value: 0.55, min: 0, max: 1, step: 0.01, label: '비네트' },
      vignetteOffset: { value: 0.25, min: 0, max: 1, step: 0.01, label: '비네트 오프셋' },
    }),
  })

  const photos = useLabTextures(ctl.photoCount)

  // 종이 위 사진 배치: 시드 랜덤으로 흩뿌림
  const layout = useMemo(() => {
    const rng = createRng(ctl.seed)
    return Array.from({ length: ctl.photoCount }, (_, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      return {
        x: (col - 1) * 3.2 + rng.range(-0.5, 0.5),
        y: (0.5 - row) * 2.6 + rng.range(-0.4, 0.4),
        z: 0.02 + i * 0.002,
        tilt: MathUtils.degToRad(rng.range(-9, 9)),
        width: rng.range(2.0, 2.6),
      }
    })
  }, [ctl.photoCount, ctl.seed])

  const path = useMemo(
    () =>
      buildVisitPath({
        overview: { x: 0, y: 0, z: 9.5, lookX: 0, lookY: 0 },
        targets: layout.map((p) => ({ x: p.x, y: p.y, z: p.z, tilt: p.tilt * 0.35 })),
        approach: ctl.approach,
        dwell: ctl.dwell,
        travel: ctl.travel,
        drift: ctl.drift,
      }),
    [layout, ctl.approach, ctl.dwell, ctl.travel, ctl.drift],
  )
  const duration = pathDuration(path)

  const camRef = useRef<ThreeCamera>(null)
  const dofRef = useRef<DepthOfFieldEffect>(null)
  const focusTarget = useRef(new Vector3())
  const look = useRef(new Vector3())
  const up = useRef(new Vector3())

  useFrame(() => {
    const cam = camRef.current
    if (!cam) return
    const t = readLabTime() % duration
    const pose = sampleCamera(path, t)
    // 핸드헬드: 두 주파수의 사인을 섞은 결정적 흔들림
    const hx = Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.1 + 1.3) * 0.4
    const hy = Math.cos(t * 1.3 + 0.7) * 0.6 + Math.sin(t * 2.7) * 0.4
    cam.position.set(pose.x + hx * ctl.handheld, pose.y + hy * ctl.handheld, pose.z)
    look.current.set(pose.lookX, pose.lookY, pose.lookZ)
    up.current.set(Math.sin(pose.roll), Math.cos(pose.roll), 0)
    cam.up.copy(up.current)
    cam.lookAt(look.current)
    focusTarget.current.copy(look.current)
    if (dofRef.current) dofRef.current.target = focusTarget.current
  })

  return (
    <>
      <color attach="background" args={['#111']} />
      <PerspectiveCamera ref={camRef} makeDefault fov={38} position={[0, 0, 9.5]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 8]} intensity={1.6} />

      {/* 종이 */}
      <mesh position={[0, 0, -0.01]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#efe4cc" roughness={0.95} />
      </mesh>

      {photos.map((photo, i) => {
        const p = layout[i]
        if (!p) return null
        const h = p.width / photo.aspect
        return (
          <Photo key={i} x={p.x} y={p.y} z={p.z} tilt={p.tilt} w={p.width} h={h} photo={photo} />
        )
      })}

      <EffectComposer multisampling={0}>
        {ctl.dofEnabled ? (
          <DepthOfField
            ref={dofRef}
            worldFocusRange={ctl.focusRange}
            bokehScale={ctl.bokehScale}
            target={[0, 0, 0]}
          />
        ) : (
          <></>
        )}
        <Noise opacity={ctl.grain} blendFunction={BlendFunction.SOFT_LIGHT} />
        <Vignette eskil={false} offset={ctl.vignetteOffset} darkness={ctl.vignette} />
      </EffectComposer>
    </>
  )
}

function Photo({
  x,
  y,
  z,
  tilt,
  w,
  h,
  photo,
}: {
  x: number
  y: number
  z: number
  tilt: number
  w: number
  h: number
  photo: ReturnType<typeof useLabTextures>[number]
}) {
  const group = useRef<Group>(null)
  const border = 0.08
  return (
    <group ref={group} position={[x, y, z]} rotation={[0, 0, tilt]}>
      {/* 흰 테두리(인쇄 사진 느낌) */}
      <mesh position={[0, 0, 0]} castShadow>
        <planeGeometry args={[w + border * 2, h + border * 2]} />
        <meshStandardMaterial color="#fbf8f1" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={photo.texture} toneMapped={false} />
      </mesh>
    </group>
  )
}
