import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial } from '@react-three/drei'
import { Group } from 'three'
import { clamp01, easings } from '@/shared/utils/easing'
import type { RenderClock } from '../clock'
import type { LensPass } from '../types'

/**
 * B1 유리 돋보기. 볼록 렌즈(눌린 구) + 금속 테. 투과 재질이 뒤의 지면을 굴절·확대한다.
 * 위치·크기는 t의 함수. 보이는 구간에서만 렌더(부모가 마운트를 제어).
 */
export function GlassLens({
  pass,
  clock,
  quality = 1,
}: {
  pass: LensPass
  clock: RenderClock
  quality?: number
}) {
  const ref = useRef<Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const t = clock.read()
    const u = clamp01((t - pass.t0) / pass.duration)
    const active = u > 0 && u < 1
    g.visible = active
    if (!active) return
    const move = easings.inOutSine(u)
    // 등장·퇴장 스케일
    const inOut = Math.min(clamp01(u / 0.18), clamp01((1 - u) / 0.18))
    const s = easings.outCubic(inOut)
    const x = pass.from[0] + (pass.to[0] - pass.from[0]) * move + Math.sin(u * Math.PI * 3.1) * 0.05
    const y =
      pass.from[1] + (pass.to[1] - pass.from[1]) * move + Math.sin(u * Math.PI * 2.3 + 0.7) * 0.04
    g.position.set(x, y, pass.height)
    g.scale.setScalar(Math.max(0.001, s))
    g.rotation.set(Math.sin(u * Math.PI * 2) * 0.06, Math.cos(u * Math.PI * 1.7) * 0.06, 0)
  })
  const r = pass.radius
  return (
    <group ref={ref} visible={false}>
      {/* 렌즈: 눌린 구. 두께가 굴절·확대를 만든다 */}
      <mesh scale={[r, r, r * 0.42]}>
        <sphereGeometry args={[1, 48, 32]} />
        <MeshTransmissionMaterial
          transmission={1}
          thickness={r * 0.8}
          ior={1.5}
          roughness={0.04}
          chromaticAberration={0.02}
          anisotropicBlur={0.05}
          distortion={0.05}
          distortionScale={0.4}
          temporalDistortion={0}
          samples={Math.max(2, Math.round(6 * quality))}
          resolution={Math.round(768 * quality)}
          backside={false}
          color="#fbf6ea"
          attenuationColor="#f2e6c8"
          attenuationDistance={2.5}
        />
      </mesh>
      {/* 금속 테: 렌즈 면(XY)에 놓인 고리 */}
      <mesh position={[0, 0, r * 0.05]}>
        <torusGeometry args={[r * 1.02, r * 0.045, 16, 96]} />
        <meshStandardMaterial color="#8a7a4e" metalness={0.9} roughness={0.35} />
      </mesh>
      {/* 손잡이 */}
      <mesh position={[r * 1.35, -r * 0.95, 0]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[r * 0.06, r * 0.075, r * 1.3, 16]} />
        <meshStandardMaterial color="#3b2a1e" roughness={0.6} />
      </mesh>
      <directionalLight position={[2, 3, 4]} intensity={1.4} />
      <ambientLight intensity={0.5} />
    </group>
  )
}
