import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import type { RenderClock } from './clock'
import { FONTS } from './fonts'
import { appearProgress } from './kenburns'
import type { TextBlock } from './types'

/**
 * 신문 활자 블록. troika SDF 텍스트, 박스 안으로 클리핑. 등장은 fillOpacity로.
 * 박스 (x, y)는 좌상단, 앵커도 좌상단으로 맞춘다.
 */
export function TextBlockMesh({
  block,
  clock,
  z = 0.006,
}: {
  block: TextBlock
  clock: RenderClock
  z?: number
}) {
  // drei Text는 troika Text 객체를 노출한다. fillOpacity는 sync 없이도 다음 렌더에 반영된다.
  const ref = useRef<{ fillOpacity: number } | null>(null)
  useFrame(() => {
    if (ref.current) ref.current.fillOpacity = appearProgress(block.appear, clock.read())
  })
  const anchorX = block.align === 'center' ? 'center' : block.align === 'right' ? 'right' : 'left'
  const x =
    block.align === 'center'
      ? block.x + block.w / 2
      : block.align === 'right'
        ? block.x + block.w
        : block.x
  return (
    <Text
      ref={ref as never}
      font={FONTS[block.weight]}
      fontSize={block.fontSize}
      maxWidth={block.w}
      lineHeight={block.lineHeight}
      letterSpacing={block.letterSpacing ?? 0}
      textAlign={block.align}
      anchorX={anchorX}
      anchorY="top"
      color={block.color}
      position={[x, block.y, z]}
      clipRect={[
        anchorX === 'left' ? 0 : anchorX === 'center' ? -block.w / 2 : -block.w,
        -block.h,
        anchorX === 'left' ? block.w : anchorX === 'center' ? block.w / 2 : 0,
        0,
      ]}
      overflowWrap="break-word"
      whiteSpace="normal"
      fillOpacity={0}
      // eslint-disable-next-line react/no-unknown-property
      depthOffset={-1}
    >
      {block.text}
    </Text>
  )
}
