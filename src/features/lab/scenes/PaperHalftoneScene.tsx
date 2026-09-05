import { useEffect, useMemo } from 'react'
import { PerspectiveCamera } from '@react-three/drei'
import { useControls, folder } from 'leva'
import {
  createHalftoneMaterial,
  halftoneDefaults,
  updateHalftoneMaterial,
} from '@/features/renderer/devices/shaders/halftoneMaterial'
import {
  createPaperMaterial,
  paperDefaults,
  updatePaperMaterial,
} from '@/features/renderer/devices/shaders/paperMaterial'
import { useLabTextures } from '../useLabTextures'

const PAPER: [number, number] = [12, 7.2]

/** B3 종이 + 하프톤 인쇄 룩 스파이크. 정면 카메라, 사진 3장 비교(원본 / 하프톤 / 강한 하프톤). */
export function PaperHalftoneScene() {
  const paper = useControls('종이', {
    baseColor: { value: paperDefaults.baseColor, label: '색' },
    grain: { value: paperDefaults.grain, min: 0, max: 0.4, step: 0.01, label: '섬유 그레인' },
    stain: { value: paperDefaults.stain, min: 0, max: 1, step: 0.01, label: '얼룩' },
    fold: { value: paperDefaults.fold, min: 0, max: 1, step: 0.01, label: '접힌 자국' },
    vignette: { value: paperDefaults.vignette, min: 0, max: 1, step: 0.01, label: '비네트' },
    seed: { value: paperDefaults.seed, min: 1, max: 99, step: 1, label: '시드' },
  })
  const ht = useControls({
    하프톤: folder({
      cells: { value: halftoneDefaults.cells, min: 20, max: 300, step: 1, label: '도트 밀도' },
      angle: { value: halftoneDefaults.angle, min: 0, max: 90, step: 1, label: '각도' },
      misregister: {
        value: halftoneDefaults.misregister,
        min: 0,
        max: 0.01,
        step: 0.0005,
        label: '색 어긋남',
      },
      strength: { value: halftoneDefaults.strength, min: 0, max: 1, step: 0.01, label: '강도' },
      bleed: { value: halftoneDefaults.bleed, min: 0, max: 1, step: 0.01, label: '잉크 번짐' },
      colorInk: {
        value: halftoneDefaults.colorInk,
        min: 0,
        max: 1,
        step: 0.01,
        label: '컬러 잉크',
      },
      desaturate: { value: halftoneDefaults.desaturate, min: 0, max: 1, step: 0.01, label: '탈색' },
      contrast: {
        value: halftoneDefaults.contrast,
        min: 0.5,
        max: 3,
        step: 0.05,
        label: '인쇄 대비',
      },
      paperColor: { value: halftoneDefaults.paperColor, label: '종이색' },
    }),
  })

  const photos = useLabTextures(3)

  const paperMat = useMemo(() => createPaperMaterial(paperDefaults, PAPER), [])
  useEffect(() => updatePaperMaterial(paperMat, paper), [paperMat, paper])
  useEffect(() => () => paperMat.dispose(), [paperMat])

  const mats = useMemo(
    () => photos.map((p) => createHalftoneMaterial(p.texture, halftoneDefaults, p.aspect)),
    [photos],
  )
  useEffect(() => {
    mats.forEach((m, i) =>
      updateHalftoneMaterial(m, {
        ...ht,
        // 왼쪽: 원본, 가운데: 설정값, 오른쪽: 설정값보다 강하게
        strength: i === 0 ? 0 : i === 1 ? ht.strength : Math.min(1, ht.strength + 0.25),
      }),
    )
  }, [mats, ht])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])

  const w = 3.2
  return (
    <>
      <color attach="background" args={['#111']} />
      <PerspectiveCamera makeDefault fov={36} position={[0, 0, 9.2]} />
      <mesh position={[0, 0, -0.01]} material={paperMat}>
        <planeGeometry args={PAPER} />
      </mesh>
      {photos.map((photo, i) => {
        const h = w / photo.aspect
        const x = (i - 1) * 3.7
        const tilt = (i - 1) * 0.04
        return (
          <group key={i} position={[x, 0, 0.01]} rotation={[0, 0, tilt]}>
            <mesh>
              <planeGeometry args={[w + 0.16, h + 0.16]} />
              <meshBasicMaterial color="#f6efe0" />
            </mesh>
            <mesh position={[0, 0, 0.004]} material={mats[i]}>
              <planeGeometry args={[w, h]} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}
