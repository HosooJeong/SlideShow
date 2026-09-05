import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { MeshBasicMaterial } from 'three'
import type { RenderClock } from './clock'
import { appearProgress } from './kenburns'
import type { Rule } from './types'

/** 구분선·박스 테두리. (x, y)는 좌상단 */
export function RuleMesh({
  rule,
  clock,
  z = 0.005,
}: {
  rule: Rule
  clock: RenderClock
  z?: number
}) {
  const mat = useRef<MeshBasicMaterial>(null)
  useFrame(() => {
    if (mat.current) mat.current.opacity = appearProgress(rule.appear, clock.read())
  })
  return (
    <mesh position={[rule.x + rule.w / 2, rule.y - rule.h / 2, z]}>
      <planeGeometry args={[rule.w, rule.h]} />
      <meshBasicMaterial ref={mat} color={rule.color} transparent opacity={0} />
    </mesh>
  )
}
