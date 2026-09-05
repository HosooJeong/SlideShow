import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three'
import { clamp01, easings } from '@/shared/utils/easing'
import type { RenderClock } from '../clock'
import type { CurlSheet as CurlSheetSpec, Page } from '../types'
import { noiseGlsl } from './shaders/noise.glsl'

/**
 * C4 페이지 컬. 면을 덮은 백지 한 장이 모서리부터 원통에 감기듯 말리며 벗겨진다.
 * 정점 셰이더: 모서리에서 대각선 방향으로 진행하는 축을 기준으로, 축을 지난 부분을 반지름 R 원통에 감는다.
 * progress는 t의 함수. 뒷면은 어둡게, 앞면은 종이 질감.
 */
export function CurlSheet({
  sheet,
  page,
  clock,
  paperColor,
}: {
  sheet: CurlSheetSpec
  page: Page
  clock: RenderClock
  paperColor: string
}) {
  const ref = useRef<Mesh>(null)
  const geometry = useMemo(() => new PlaneGeometry(page.w, page.h, 48, 64), [page.w, page.h])
  const corner = useMemo(() => {
    const sx = sheet.corner.includes('r') ? 1 : -1
    const sy = sheet.corner.startsWith('t') ? 1 : -1
    return new Vector2((sx * page.w) / 2, (sy * page.h) / 2)
  }, [sheet.corner, page.w, page.h])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: DoubleSide,
        transparent: true,
        uniforms: {
          uProgress: { value: 0 },
          uCorner: { value: corner.clone() },
          uDir: {
            value: new Vector2(
              -Math.sign(corner.x) * page.w,
              -Math.sign(corner.y) * page.h,
            ).normalize(),
          },
          uDiag: { value: Math.hypot(page.w, page.h) },
          uRadius: { value: sheet.radius },
          uColor: { value: new Color(paperColor) },
          uSize: { value: new Vector2(page.w, page.h) },
        },
        vertexShader: /* glsl */ `
          uniform float uProgress, uDiag, uRadius;
          uniform vec2 uCorner, uDir;
          varying vec2 vUv;
          varying float vBack;
          varying float vShade;
          void main() {
            vUv = uv;
            // 모서리에서 대각선 방향으로 axis만큼 진행한 선. 그 선보다 모서리 쪽(뒤)에 있는 점을 원통에 감는다
            float axis = uProgress * (uDiag + uRadius * 3.14159) - uRadius * 3.14159;
            float p = dot(position.xy - uCorner, uDir);   // 모서리로부터의 진행 거리
            float s = axis - p;                           // 축을 넘은 깊이(>0이면 말림)
            vec3 pos = position;
            vBack = 0.0;
            vShade = 0.0;
            if (s > 0.0) {
              float ang = s / uRadius;
              if (ang < 3.14159) {
                pos.xy = position.xy + uDir * (s - uRadius * sin(ang));
                pos.z = uRadius * (1.0 - cos(ang));
                vShade = sin(ang);
                vBack = step(1.5708, ang);
              } else {
                // 완전히 뒤집혀 축 너머로 눕는다
                pos.xy = position.xy + uDir * (s + (s - uRadius * 3.14159));
                pos.z = uRadius * 2.0;
                vBack = 1.0;
              }
            }
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform vec3 uColor;
          uniform vec2 uSize;
          varying vec2 vUv;
          varying float vBack;
          varying float vShade;
          ${noiseGlsl}
          void main() {
            vec2 p = vUv * uSize;
            float fiber = fbm(p * vec2(40.0, 62.0), 3) - 0.5;
            // 앞면: 종이 + 아주 희미한 뒷면 인쇄 비침. 뒷면: 어두운 회색빛 종이
            vec3 front = uColor + fiber * 0.1;
            float ghost = smoothstep(0.62, 0.7, fbm(p * 1.7 + 3.0, 4)) * 0.06;
            front -= ghost;
            vec3 back = uColor * 0.72 + fiber * 0.06;
            vec3 col = mix(front, back, vBack);
            // 원통에 감긴 부분의 음영(하이라이트→그림자)
            col *= 1.0 - vShade * 0.28;
            col += (1.0 - vBack) * vShade * 0.12;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [corner, page.w, page.h, sheet.radius, paperColor],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const t = clock.read()
    const raw = clamp01((t - sheet.t0) / sheet.duration)
    const m = ref.current
    if (!m) return
    // 끝나면 사라지고, 시작 전엔 그대로 덮는다
    m.visible = t < sheet.t0 + sheet.duration
    material.uniforms.uProgress.value = easings.inOutCubic(raw)
  })

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      position={[page.x, page.y, 0.035]}
      frustumCulled={false}
    />
  )
}
