import { ShaderMaterial, Texture } from 'three'
import { noiseGlsl } from './noise.glsl'

export type InkRevealParams = {
  /** 노이즈 스케일(작을수록 큰 덩어리로 번짐) */
  scale: number
  /** 경계 부드러움 */
  feather: number
  /** 잉크 테두리 두께 */
  edge: number
  /** 잉크 테두리 어둡기 */
  inkDarkness: number
  /** 번짐 방향 편향: 0 = 중심에서, 1 = 위에서 아래로 */
  directional: number
  /** 세피아에서 컬러로 함께 전환할지 */
  sepiaToColor: boolean
  seed: number
}

export const inkRevealDefaults: InkRevealParams = {
  scale: 3.2,
  feather: 0.08,
  edge: 0.09,
  inkDarkness: 0.55,
  directional: 0.35,
  sepiaToColor: true,
  seed: 11,
}

/**
 * C1 잉크 번짐 등장. progress(0→1)에 따라 FBM 노이즈 마스크 임계값이 내려가며 사진이 종이에 스며든다.
 * 경계에는 어두운 잉크 테두리. progress는 t의 함수로 외부에서 준다(결정적).
 */
export function createInkRevealMaterial(map: Texture, params: InkRevealParams) {
  const material = new ShaderMaterial({
    transparent: true,
    uniforms: {
      uMap: { value: map },
      uProgress: { value: 0 },
      uScale: { value: params.scale },
      uFeather: { value: params.feather },
      uEdge: { value: params.edge },
      uInk: { value: params.inkDarkness },
      uDir: { value: params.directional },
      uSepia: { value: params.sepiaToColor ? 1 : 0 },
      uSeed: { value: params.seed },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uMap;
      uniform float uProgress, uScale, uFeather, uEdge, uInk, uDir, uSepia, uSeed;
      ${noiseGlsl}

      void main() {
        vec2 s = vec2(uSeed * 3.1, uSeed * 1.7);
        // 번짐 필드: 노이즈 + 중심/상단 편향. 값이 낮은 곳이 먼저 드러난다.
        float n = fbm(vUv * uScale + s, 5);
        float radial = length(vUv - 0.5) * 1.2;
        float topdown = vUv.y;                       // 아래(uv.y=0)가 먼저? → 위에서 아래로 번지도록 1-y
        float bias = mix(radial, 1.0 - topdown, uDir);
        float field = mix(n, bias, 0.45);            // 0..1
        // progress가 커질수록 임계값이 올라가 더 넓은 영역이 드러남. 여유 범위로 끝에서 완전 공개.
        float th = uProgress * (1.0 + uFeather + uEdge) - uFeather;
        float reveal = smoothstep(th - uFeather, th + uFeather, field);   // 1 = 아직 안 보임
        float alpha = 1.0 - reveal;
        // 경계 잉크 테두리: 임계 근처 밴드
        float band = 1.0 - smoothstep(0.0, uEdge, abs(field - th));
        band *= step(0.001, uProgress) * step(uProgress, 0.999);

        vec3 col = texture2D(uMap, vUv).rgb;
        // 세피아 → 컬러: 드러난 직후엔 세피아, progress 후반에 컬러로
        float l = luma(col);
        vec3 sepia = vec3(l) * vec3(1.05, 0.9, 0.7);
        float colorMix = smoothstep(0.55, 1.0, uProgress);
        col = mix(col, mix(sepia, col, colorMix), uSepia);
        // 잉크 테두리 어둡게 + 번진 잉크의 살짝 푸른 기
        col = mix(col, col * vec3(0.25, 0.22, 0.28), band * uInk);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  })
  return material
}

export function updateInkRevealMaterial(
  material: ShaderMaterial,
  params: InkRevealParams,
  progress: number,
) {
  const u = material.uniforms
  u.uProgress.value = progress
  u.uScale.value = params.scale
  u.uFeather.value = params.feather
  u.uEdge.value = params.edge
  u.uInk.value = params.inkDarkness
  u.uDir.value = params.directional
  u.uSepia.value = params.sepiaToColor ? 1 : 0
  u.uSeed.value = params.seed
}
