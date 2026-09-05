import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  MeshBasicMaterial,
  Points,
} from 'three'
import { SlotMesh } from './SlotMesh'
import type { RenderClock } from './clock'
import type { TextureMap, VideoMap } from './textures'
import type { Composition, StreamStage } from './types'
import { createRng } from '@/shared/utils/seededRandom'

/** 연속 스트림 무대: 어둠 + 안개 + 떠다니는 먼지 속을 사진들이 지나간다 */
export function StreamView({
  stage,
  composition,
  textures,
  videos,
  clock,
}: {
  stage: StreamStage
  composition: Composition
  textures: TextureMap
  videos?: VideoMap
  clock: RenderClock
}) {
  return (
    <>
      <color attach="background" args={[stage.background]} />
      <fog attach="fog" args={[stage.background, stage.fog.near, stage.fog.far]} />
      <Dust dust={stage.dust} clock={clock} />
      {composition.slots.map((slot) => {
        const texture = textures.get(slot.mediaId)
        return texture ? (
          <SlotMesh
            key={slot.id}
            slot={slot}
            texture={texture}
            video={videos?.get(slot.mediaId)}
            devices={composition.devices}
            clock={clock}
            fog={{ ...stage.fog, color: stage.background }}
          />
        ) : null
      })}
    </>
  )
}

/** 시드 고정 먼지 입자. 위치는 t의 함수로 살짝 떠다닌다 */
function Dust({ dust, clock }: { dust: StreamStage['dust']; clock: RenderClock }) {
  const ref = useRef<Group>(null)
  const geometry = useMemo(() => {
    const rng = createRng(dust.seed + 7)
    const pos = new Float32Array(dust.count * 3)
    for (let i = 0; i < dust.count; i++) {
      const a = rng.range(0, Math.PI * 2)
      const r = Math.sqrt(rng.next()) * dust.radius
      pos[i * 3] = dust.center[0] + Math.cos(a) * r
      pos[i * 3 + 1] = dust.center[1] + Math.sin(a) * r
      pos[i * 3 + 2] = dust.center[2] + rng.range(-dust.length / 2, dust.length / 2)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    return g
  }, [dust])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(() => {
    const t = clock.read()
    if (!ref.current) return
    ref.current.position.set(Math.sin(t * 0.21) * 0.25, Math.sin(t * 0.17 + 1.0) * 0.2, 0)
    ref.current.rotation.z = Math.sin(t * 0.05) * 0.02
  })
  return (
    <group ref={ref}>
      <points geometry={geometry}>
        <pointsMaterial
          color="#d9c9a8"
          size={0.045}
          sizeAttenuation
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </points>
    </group>
  )
}

/**
 * 카메라 앞에 붙는 화이트 플래시. 밝기는 t의 함수(플래시 목록에서 계산). 카메라의 자식으로 넣는다.
 */
export function FlashOverlay({
  flashes,
  fov,
  clock,
}: {
  flashes: StreamStage['flashes']
  fov: number
  clock: RenderClock
}) {
  const mat = useRef<MeshBasicMaterial>(null)
  const meshRef = useRef<Points | null>(null)
  const dist = 0.5
  const h = 2 * dist * Math.tan((fov / 2) * (Math.PI / 180)) * 1.2
  useFrame((state) => {
    if (!mat.current) return
    const t = clock.read()
    let a = 0
    for (const f of flashes) {
      const u = (t - f.t) / f.duration
      if (u >= 0 && u <= 1) a = Math.max(a, f.strength * Math.pow(1 - u, 2.2))
    }
    mat.current.opacity = a
    // 화면 비율에 맞춰 폭 갱신
    const aspect = state.size.width / Math.max(1, state.size.height)
    const m = meshRef.current as unknown as {
      scale: { set: (x: number, y: number, z: number) => void }
    } | null
    m?.scale.set(h * aspect, h, 1)
  })
  return (
    <mesh ref={meshRef as never} position={[0, 0, -dist]} renderOrder={999}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={mat}
        color={new Color('#fff6e8')}
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}
