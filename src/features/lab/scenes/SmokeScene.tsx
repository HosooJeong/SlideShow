import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'

/** 렌더러가 살아 있는지 확인하는 최소 씬. 실제 장치가 들어오면 삭제한다. */
export function SmokeScene() {
  const mesh = useRef<Mesh>(null)
  useFrame((_, dt) => {
    if (!mesh.current) return
    mesh.current.rotation.x += dt * 0.4
    mesh.current.rotation.y += dt * 0.6
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
