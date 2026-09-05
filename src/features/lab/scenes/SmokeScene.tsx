import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { readLabTime } from '../labClock'

/** 렌더러가 살아 있는지 확인하는 최소 씬. 실제 장치가 들어오면 삭제한다. */
export function SmokeScene() {
  const mesh = useRef<Mesh>(null)
  useFrame(() => {
    if (!mesh.current) return
    const t = readLabTime()
    mesh.current.rotation.x = t * 0.4
    mesh.current.rotation.y = t * 0.6
  })
  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <mesh ref={mesh}>
        <boxGeometry args={[1.6, 1, 0.05]} />
        <meshStandardMaterial color="#f3ead8" />
      </mesh>
    </>
  )
}
