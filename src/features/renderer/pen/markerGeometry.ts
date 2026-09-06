import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  MultiplyBlending,
  NormalBlending,
  ShaderMaterial,
  Vector3,
} from 'three'
import { noiseGlsl } from '../devices/shaders/noise.glsl'
import type { PenStroke } from '../types'

/**
 * 폴리라인 → 리본 지오메트리. Catmull-Rom으로 스무딩하고 진행도 aU(0..1), 폭 방향 aV(-1..1)를 넣는다.
 * 끝은 마카 촉처럼 가늘어진다. 렌더러는 uProgress까지만 그려서 "그려지는" 애니메이션을 만든다.
 */
export function buildRibbon(stroke: PenStroke): BufferGeometry {
  const pts = stroke.points
  const geo = new BufferGeometry()
  if (pts.length < 2) return geo
  const curve = new CatmullRomCurve3(
    pts.map(([x, y]) => new Vector3(x, y, 0)),
    false,
    'centripetal',
  )
  const length = curve.getLength()
  const n = Math.max(8, Math.min(600, Math.round(length / 0.015)))
  const positions: number[] = []
  const us: number[] = []
  const vs: number[] = []
  const indices: number[] = []
  const tangent = new Vector3()
  const p = new Vector3()
  const half = stroke.width / 2
  for (let i = 0; i <= n; i++) {
    const u = i / n
    curve.getPointAt(u, p)
    curve.getTangentAt(u, tangent)
    const nx = -tangent.y
    const ny = tangent.x
    // 끝 가늘어짐(양끝 6%), 중간은 살짝 두께 변화
    const taper = Math.min(1, u / 0.06, (1 - u) / 0.06)
    const w = half * (0.25 + 0.75 * Math.sqrt(Math.max(0, taper))) * (1 + 0.06 * Math.sin(u * 37))
    positions.push(p.x + nx * w, p.y + ny * w, 0, p.x - nx * w, p.y - ny * w, 0)
    us.push(u, u)
    vs.push(1, -1)
    if (i < n) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('aU', new Float32BufferAttribute(us, 1))
  geo.setAttribute('aV', new Float32BufferAttribute(vs, 1))
  geo.setIndex(indices)
  return geo
}

/** 마카·형광펜 재질. uProgress(0..1)까지 그려진다. 형광펜은 곱하기 블렌딩으로 종이 위에 스민다 */
export function createPenMaterial(stroke: PenStroke, seed: number) {
  const highlighter = stroke.kind === 'highlighter'
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: highlighter ? MultiplyBlending : NormalBlending,
    // 곱하기 블렌딩은 premultipliedAlpha가 필요하다: 형광펜은 알파 대신 "흰색과 섞은 색"을 낸다
    premultipliedAlpha: highlighter,
    uniforms: {
      uProgress: { value: 0 },
      uColor: { value: new Color(stroke.color) },
      uOpacity: { value: stroke.opacity },
      uSeed: { value: seed },
      uHighlighter: { value: highlighter ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aU;
      attribute float aV;
      varying float vU;
      varying float vV;
      void main() {
        vU = aU;
        vV = aV;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vU;
      varying float vV;
      uniform float uProgress, uOpacity, uSeed, uHighlighter;
      uniform vec3 uColor;
      ${noiseGlsl}
      void main() {
        // 그려지는 앞머리: 부드러운 끝
        float front = 1.0 - smoothstep(uProgress - 0.006, uProgress, vU);
        if (front <= 0.0) discard;
        float edge = 1.0 - smoothstep(0.62, 1.0, abs(vV));
        // 마카 결: 진행 방향 줄무늬 + 잉크 얼룩
        float streak = fbm(vec2(vU * 70.0 + uSeed, vV * 2.5), 3);
        float blot = fbm(vec2(vU * 9.0 + uSeed * 3.0, vV * 1.5 + uSeed), 2);
        float ink = 0.8 + 0.2 * streak + 0.12 * (blot - 0.5);
        vec3 col = uColor;
        if (uHighlighter > 0.5) {
          // 형광펜: 가운데는 연하고 가장자리가 살짝 진하다(겹침)
          float body = mix(0.72, 1.0, smoothstep(0.2, 0.95, abs(vV)));
          col = mix(vec3(1.0), uColor, body * ink);
          // 곱하기: 결과 = 배경 × 출력색. 가장자리·앞머리는 흰색(=변화 없음)으로 섞는다
          gl_FragColor = vec4(mix(vec3(1.0), col, edge * front * uOpacity), 1.0);
        } else {
          // 마카: 가장자리가 살짝 진하고 안쪽에 결
          float dark = 1.0 - 0.14 * (1.0 - abs(vV)) * streak;
          gl_FragColor = vec4(col * dark, uOpacity * edge * front * clamp(ink, 0.6, 1.0));
        }
      }
    `,
  })
}
