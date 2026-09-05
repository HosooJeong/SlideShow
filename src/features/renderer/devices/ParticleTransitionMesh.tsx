import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  Float32BufferAttribute,
  NormalBlending,
  Points,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
} from 'three'
import { clamp01 } from '@/shared/utils/easing'
import { createRng } from '@/shared/utils/seededRandom'
import type { RenderClock } from '../clock'
import { coverScale } from '../kenburns'
import type { ParticleTransition, Slot } from '../types'

/**
 * C2 파티클 분해·재조합. 입자 위치·색은 정점 셰이더에서 (uv, seed, progress)로 계산한다.
 * progress는 t의 함수(clock)로만 들어오므로 재생·시크·내보내기가 같은 그림을 낸다.
 */
export function ParticleTransitionMesh({
  transition,
  from,
  to,
  mapA,
  mapB,
  clock,
}: {
  transition: ParticleTransition
  from: Slot
  to: Slot
  mapA: Texture
  mapB: Texture
  clock: RenderClock
}) {
  const ref = useRef<Points>(null)

  const geometry = useMemo(() => {
    const n = transition.count
    const rng = createRng(transition.seed)
    // 정방에 가까운 격자: 두 슬롯의 같은 격자 칸을 잇는다
    const cols = Math.max(1, Math.round(Math.sqrt(n * (from.w / from.h))))
    const rows = Math.max(1, Math.ceil(n / cols))
    const total = cols * rows
    const uvA = new Float32Array(total * 2)
    const uvB = new Float32Array(total * 2)
    const seed = new Float32Array(total)
    const pos = new Float32Array(total * 3) // 셰이더가 덮어쓰지만 바운딩용으로 채운다
    let k = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = (c + 0.5) / cols
        const v = (r + 0.5) / rows
        const j = rng.range(-0.4, 0.4)
        uvA[k * 2] = u + j / cols
        uvA[k * 2 + 1] = v + j / rows
        uvB[k * 2] = u
        uvB[k * 2 + 1] = v
        seed[k] = rng.next()
        pos[k * 3] = from.x
        pos[k * 3 + 1] = from.y
        pos[k * 3 + 2] = from.z
        k++
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('aUvA', new Float32BufferAttribute(uvA, 2))
    g.setAttribute('aUvB', new Float32BufferAttribute(uvB, 2))
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1))
    // 두 슬롯을 모두 감싸는 넉넉한 바운딩(절두체 컬링 방지)
    g.computeBoundingSphere()
    if (g.boundingSphere) {
      g.boundingSphere.center.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2)
      g.boundingSphere.radius =
        Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / 2 + transition.spread * 2 + 5
    }
    return g
  }, [transition, from, to])

  const material = useMemo(() => {
    const covA = coverScale(from.mediaAspect, from.w / from.h)
    const covB = coverScale(to.mediaAspect, to.w / to.h)
    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uProgress: { value: 0 },
        uMapA: { value: mapA },
        uMapB: { value: mapB },
        uCovA: { value: new Vector2(covA[0], covA[1]) },
        uCovB: { value: new Vector2(covB[0], covB[1]) },
        uCenterA: { value: new Vector3(from.x, from.y, from.z + 0.02) },
        uCenterB: { value: new Vector3(to.x, to.y, to.z + 0.02) },
        uSizeA: { value: new Vector2(from.w, from.h) },
        uSizeB: { value: new Vector2(to.w, to.h) },
        uRotA: { value: from.rotation },
        uRotB: { value: to.rotation },
        uSpread: { value: transition.spread },
        uPointSize: { value: 0 },
        uPixelRatio: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec2 aUvA;
        attribute vec2 aUvB;
        attribute float aSeed;
        uniform float uProgress, uRotA, uRotB, uSpread, uPointSize, uPixelRatio;
        uniform vec3 uCenterA, uCenterB;
        uniform vec2 uSizeA, uSizeB, uCovA, uCovB;
        uniform sampler2D uMapA, uMapB;
        varying vec3 vColor;
        varying float vAlpha;

        vec3 slotPoint(vec2 uv, vec3 c, vec2 size, float rot) {
          vec2 p = (uv - 0.5) * size;
          float cs = cos(rot), sn = sin(rot);
          return c + vec3(p.x * cs - p.y * sn, p.x * sn + p.y * cs, 0.0);
        }

        void main() {
          // 출발 사진의 왼쪽·아래부터 먼저 흩어지고(시드로 흔들림), 도착은 같은 순서로 모인다
          float delay = 0.4 * clamp(0.55 * (1.0 - aUvA.y) + 0.25 * aUvA.x + 0.2 * aSeed, 0.0, 1.0);
          float p = clamp((uProgress - delay) / 0.6, 0.0, 1.0);
          float e = p * p * (3.0 - 2.0 * p);

          vec3 A = slotPoint(aUvA, uCenterA, uSizeA, uRotA);
          vec3 B = slotPoint(aUvB, uCenterB, uSizeB, uRotB);
          // 중간 제어점: 두 사진 사이 위쪽으로 부풀고, 시드로 흩어짐. 카메라 쪽(+z)으로도 살짝
          vec3 mid = mix(A, B, 0.5) + vec3(
            (aSeed - 0.5) * uSpread,
            (fract(aSeed * 7.31) - 0.2) * uSpread * 0.9 + uSpread * 0.35,
            uSpread * (0.12 + 0.22 * fract(aSeed * 3.17))
          );
          vec3 pos = mix(mix(A, mid, e), mix(mid, B, e), e);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          float flight = 1.0 - abs(e - 0.5) * 2.0;          // 0 양끝, 1 비행 중
          gl_PointSize = min(uPointSize * uPixelRatio * (1.0 - 0.45 * flight) / max(0.3, -mv.z), 18.0 * uPixelRatio);

          vec3 cA = texture2D(uMapA, (aUvA - 0.5) * uCovA + 0.5).rgb;
          vec3 cB = texture2D(uMapB, (aUvB - 0.5) * uCovB + 0.5).rgb;
          vColor = mix(cA, cB, smoothstep(0.4, 0.6, e));
          // 아직 출발 안 했거나 도착한 입자는 사진 자체가 대신 보이므로 숨긴다
          vAlpha = (p <= 0.001 || p >= 0.999) ? 0.0 : 1.0;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d) * 2.0;
          float a = (1.0 - smoothstep(0.7, 1.0, r)) * vAlpha;
          if (a <= 0.01) discard;
          gl_FragColor = vec4(vColor, a * 0.95);
        }
      `,
    })
  }, [from, to, mapA, mapB, transition.spread])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state) => {
    const t = clock.read()
    const u = clamp01((t - transition.t0) / transition.duration)
    const active = u > 0 && u < 1
    if (ref.current) ref.current.visible = active
    if (!active) return
    material.uniforms.uProgress.value = u
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio()
    // 입자 크기: 슬롯 격자 한 칸이 화면에서 차지하는 크기에 비례(카메라 거리는 셰이더에서 나눔)
    const cell = from.w / Math.sqrt(transition.count * (from.w / from.h))
    const focal =
      state.size.height /
      (2 * Math.tan((((state.camera as { fov?: number }).fov ?? 38) / 2) * (Math.PI / 180)))
    material.uniforms.uPointSize.value = cell * focal * 1.6
  })

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}
