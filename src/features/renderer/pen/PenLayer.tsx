import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import type { Group, Mesh } from 'three'
import type { RenderClock } from '../clock'
import { FONTS } from '../fonts'
import type { HandText, PenLayerData, PenStroke } from '../types'
import { clamp01 } from '@/shared/utils/easing'
import { buildRibbon, createPenMaterial } from './markerGeometry'

/** 펜 레이어: 마카 낙서·형광펜·손글씨. 모두 t의 함수로 그려지고, t1 이후 숨는다 */
export function PenLayer({ pen, clock }: { pen: PenLayerData; clock: RenderClock }) {
  return (
    <group>
      {pen.strokes.map((s) => (
        <StrokeMesh key={s.id} stroke={s} clock={clock} />
      ))}
      {pen.texts.map((t) => (
        <HandTextMesh key={t.id} item={t} clock={clock} />
      ))}
    </group>
  )
}

function StrokeMesh({ stroke, clock }: { stroke: PenStroke; clock: RenderClock }) {
  const ref = useRef<Mesh>(null)
  const geometry = useMemo(() => buildRibbon(stroke), [stroke])
  const seed = useMemo(() => hash(stroke.id), [stroke.id])
  const material = useMemo(() => createPenMaterial(stroke, seed), [stroke, seed])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const t = clock.read()
    const gone = stroke.t1 !== undefined && t >= stroke.t1
    const p = clamp01((t - stroke.t0) / Math.max(0.001, stroke.duration))
    m.visible = !gone && p > 0
    material.uniforms.uProgress.value = p
  })
  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      position={[0, 0, stroke.z]}
      renderOrder={stroke.kind === 'highlighter' ? 5 : 6}
      frustumCulled={false}
    />
  )
}

/**
 * 손글씨: 글자 단위로 왼쪽에서 오른쫁으로 드러난다. troika의 caretPositions(글자별 [left, right, bottom, top])로
 * 현재 글자까지의 오른쪽 경계를 구해 clipRect로 자른다. 글자 하나 안에서는 outCubic으로 쓸려 나간다.
 */
function HandTextMesh({ item, clock }: { item: HandText; clock: RenderClock }) {
  const groupRef = useRef<Group>(null)
  const ref = useRef<TroikaLike | null>(null)
  useFrame(() => {
    const g = groupRef.current
    const obj = ref.current
    if (!g || !obj) return
    const t = clock.read()
    const gone = item.t1 !== undefined && t >= item.t1
    const p = clamp01((t - item.t0) / Math.max(0.001, item.duration))
    g.visible = !gone && p > 0
    const info = obj.textRenderInfo
    if (!info || !info.caretPositions || !info.blockBounds) {
      obj.fillOpacity = 0
      return
    }
    obj.fillOpacity = 1
    const caret = info.caretPositions
    const n = item.text.length
    const stride = n > 0 ? caret.length / n : 4
    const [minX, minY, maxX, maxY] = info.blockBounds
    if (p >= 1) {
      obj.clipRect = [minX - 0.05, minY - 0.05, maxX + 0.05, maxY + 0.05]
      return
    }
    const idx = Math.min(n - 1, Math.floor(p * n))
    const frac = p * n - idx
    const eased = 1 - Math.pow(1 - frac, 3)
    const left = caret[idx * stride]
    const right = caret[idx * stride + 1]
    const edge = left + (right - left) * eased
    obj.clipRect = [minX - 0.05, minY - 0.05, edge, maxY + 0.05]
  })
  const anchorX = item.align
  return (
    <group ref={groupRef} position={[item.x, item.y, item.z]} rotation={[0, 0, item.rotation]}>
      <Text
        ref={ref as never}
        font={FONTS.pen}
        fontSize={item.fontSize}
        color={item.color}
        anchorX={anchorX}
        anchorY="middle"
        fillOpacity={0}
        // eslint-disable-next-line react/no-unknown-property
        depthOffset={-2}
      >
        {item.text}
      </Text>
    </group>
  )
}

type TroikaLike = {
  fillOpacity: number
  clipRect: [number, number, number, number] | null
  textRenderInfo?: { caretPositions?: Float32Array; blockBounds?: [number, number, number, number] }
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 37
}
