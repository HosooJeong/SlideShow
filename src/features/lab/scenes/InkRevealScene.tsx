import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { useControls } from 'leva'
import {
  createInkRevealMaterial,
  inkRevealDefaults,
  updateInkRevealMaterial,
} from '@/features/renderer/devices/shaders/inkRevealMaterial'
import {
  createPaperMaterial,
  paperDefaults,
} from '@/features/renderer/devices/shaders/paperMaterial'
import { easings } from '@/shared/utils/easing'
import { useLabTextures } from '../useLabTextures'
import { readLabTime } from '../labClock'

const PAPER: [number, number] = [12, 7.2]

/** C1 잉크 번짐 등장 스파이크. 사진 2장이 시간차로 종이에 스며든다. progress는 t의 함수. */
export function InkRevealScene() {
  const ctl = useControls('잉크 번짐', {
    duration: { value: 3, min: 0.5, max: 6, step: 0.1, label: '등장 시간(s)' },
    hold: { value: 1.6, min: 0, max: 5, step: 0.1, label: '유지(s)' },
    stagger: { value: 0.8, min: 0, max: 3, step: 0.1, label: '시간차(s)' },
    scale: { value: inkRevealDefaults.scale, min: 0.5, max: 10, step: 0.1, label: '번짐 스케일' },
    feather: {
      value: inkRevealDefaults.feather,
      min: 0.005,
      max: 0.3,
      step: 0.005,
      label: '경계 부드러움',
    },
    edge: { value: inkRevealDefaults.edge, min: 0, max: 0.3, step: 0.005, label: '잉크 테두리' },
    inkDarkness: {
      value: inkRevealDefaults.inkDarkness,
      min: 0,
      max: 1,
      step: 0.01,
      label: '테두리 어둡기',
    },
    directional: {
      value: inkRevealDefaults.directional,
      min: 0,
      max: 1,
      step: 0.01,
      label: '위→아래 편향',
    },
    sepiaToColor: { value: inkRevealDefaults.sepiaToColor, label: '세피아→컬러' },
    seed: { value: inkRevealDefaults.seed, min: 1, max: 99, step: 1, label: '시드' },
  })

  const photos = useLabTextures(2)
  const paperMat = useMemo(() => createPaperMaterial(paperDefaults, PAPER), [])
  useEffect(() => () => paperMat.dispose(), [paperMat])

  const mats = useMemo(
    () =>
      photos.map((p, i) =>
        createInkRevealMaterial(p.texture, {
          ...inkRevealDefaults,
          seed: inkRevealDefaults.seed + i,
        }),
      ),
    [photos],
  )
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])

  useFrame(() => {
    const cycle = ctl.duration + ctl.hold + ctl.stagger * (mats.length - 1) + 0.6
    const t = readLabTime() % cycle
    mats.forEach((m, i) => {
      const local = t - i * ctl.stagger
      const raw = Math.min(1, Math.max(0, local / ctl.duration))
      // 처음엔 빨리 퍼지고 끝에서 천천히 마무리(잉크가 스며드는 느낌)
      const progress = easings.outCubic(raw)
      updateInkRevealMaterial(m, { ...ctl, seed: ctl.seed + i }, progress)
    })
  })

  const w = 4.2
  return (
    <>
      <color attach="background" args={['#111']} />
      <PerspectiveCamera makeDefault fov={36} position={[0, 0, 9.2]} />
      <mesh position={[0, 0, -0.01]} material={paperMat}>
        <planeGeometry args={PAPER} />
      </mesh>
      {photos.map((photo, i) => {
        const h = w / photo.aspect
        const x = (i - 0.5) * 5.2
        return (
          <mesh
            key={i}
            position={[x, 0, 0.01]}
            rotation={[0, 0, (i - 0.5) * -0.06]}
            material={mats[i]}
          >
            <planeGeometry args={[w, h]} />
          </mesh>
        )
      })}
    </>
  )
}
