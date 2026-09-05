import { PerspectiveCamera, Text } from '@react-three/drei'
import { useControls } from 'leva'
import { FONTS } from '@/features/renderer/fonts'

/** E1 한글 SDF 텍스트 스파이크. 제호·헤드라인·본문(양쪽 정렬, 박스 클리핑) */
export function TextScene() {
  const ctl = useControls('활자', {
    headline: { value: '하늘, 첫 돌을 맞다', label: '헤드라인' },
    headlineSize: { value: 0.56, min: 0.2, max: 1.2, step: 0.01, label: '헤드라인 크기' },
    bodySize: { value: 0.16, min: 0.08, max: 0.4, step: 0.005, label: '본문 크기' },
    lineHeight: { value: 1.6, min: 1, max: 2.2, step: 0.05, label: '행간' },
    letterSpacing: { value: 0, min: -0.05, max: 0.1, step: 0.005, label: '자간' },
    color: { value: '#2b2521', label: '잉크색' },
  })
  const body =
    '2025년 9월 5일, 세상에 도착한 하늘은 그날부터 온 집안의 뉴스가 되었다. 첫 미소, 첫 뒤집기, 첫 걸음까지 하루하루가 헤드라인이었다. 가족들은 이 작은 존재가 만들어낸 변화를 한목소리로 이야기한다. 밤잠은 줄었지만 웃음은 몇 배로 늘었다는 것이 공통된 증언이다.'
  const left = -3.2
  return (
    <>
      <color attach="background" args={['#111']} />
      <PerspectiveCamera makeDefault fov={36} position={[0, 0, 7.5]} />
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[7.2, 5.2]} />
        <meshBasicMaterial color="#efe6d2" />
      </mesh>
      <Text
        font={FONTS.bold}
        fontSize={0.78}
        anchorX="center"
        anchorY="top"
        position={[0, 2.35, 0.01]}
        color={ctl.color}
        letterSpacing={0.02}
      >
        하늘 일보
      </Text>
      <mesh position={[0, 1.42, 0.01]}>
        <planeGeometry args={[6.4, 0.035]} />
        <meshBasicMaterial color={ctl.color} />
      </mesh>
      <Text
        font={FONTS.regular}
        fontSize={0.15}
        anchorX="center"
        anchorY="top"
        position={[0, 1.33, 0.01]}
        color="#5a514a"
      >
        2026년 9월 5일 · 특별호 · 가격: 미소 한 번 · 날씨: 온 가족 맑음
      </Text>
      <Text
        font={FONTS.bold}
        fontSize={ctl.headlineSize}
        maxWidth={6.4}
        lineHeight={1.2}
        anchorX="left"
        anchorY="top"
        position={[left, 0.95, 0.01]}
        color={ctl.color}
        letterSpacing={ctl.letterSpacing}
      >
        {ctl.headline}
      </Text>
      <Text
        font={FONTS.regular}
        fontSize={ctl.bodySize}
        maxWidth={3.05}
        lineHeight={ctl.lineHeight}
        textAlign="justify"
        anchorX="left"
        anchorY="top"
        position={[left, 0.05, 0.01]}
        color={ctl.color}
        clipRect={[0, -2.3, 3.05, 0]}
        letterSpacing={ctl.letterSpacing}
      >
        {body}
      </Text>
      <Text
        font={FONTS.regular}
        fontSize={ctl.bodySize}
        maxWidth={3.05}
        lineHeight={ctl.lineHeight}
        textAlign="justify"
        anchorX="left"
        anchorY="top"
        position={[left + 3.35, 0.05, 0.01]}
        color={ctl.color}
        clipRect={[0, -2.3, 3.05, 0]}
        letterSpacing={ctl.letterSpacing}
      >
        {body}
      </Text>
    </>
  )
}
