import { ShaderMaterial, Texture } from 'three'
import { inkRevealGlsl } from './inkReveal.glsl'
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
      ${inkRevealGlsl}

      void main() {
        float field = inkField(vUv, uScale, uDir, uSeed);
        vec2 m = inkMask(field, uProgress, uFeather, uEdge);
        vec3 col = texture2D(uMap, vUv).rgb;
        col = sepiaMix(col, uProgress, uSepia);
        col = mix(col, col * vec3(0.25, 0.22, 0.28), m.y * uInk);
        gl_FragColor = vec4(col, m.x);
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
