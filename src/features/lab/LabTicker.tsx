import { useFrame } from '@react-three/fiber'
import { useLabClock } from './labClock'

/** Canvas 안에서 프레임마다 실험실 시계를 진행시킨다. */
export function LabTicker() {
  const tick = useLabClock((s) => s.tick)
  useFrame((_, dt) => tick(Math.min(dt, 0.1)))
  return null
}
