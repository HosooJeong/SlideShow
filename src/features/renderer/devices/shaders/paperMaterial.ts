import { Color, ShaderMaterial, Vector2 } from 'three'
import { noiseGlsl } from './noise.glsl'

export type PaperParams = {
  baseColor: string
  grain: number
  stain: number
  fold: number
  vignette: number
  seed: number
}

export const paperDefaults: PaperParams = {
  baseColor: '#efe4cc',
  grain: 0.12,
  stain: 0.35,
  fold: 0.5,
  vignette: 0.35,
  seed: 3,
}

/**
 * B3 절차적 종이. 섬유 그레인 + 얼룩(저주파 FBM) + 접힌 자국 + 비네트.
 * 텍스처 에셋 없이 셰이더만으로 만든다. `uSize`는 평면의 월드 크기(비율 보정용).
 */
export function createPaperMaterial(params: PaperParams, size: [number, number]) {
  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(params.baseColor) },
      uGrain: { value: params.grain },
      uStain: { value: params.stain },
      uFold: { value: params.fold },
      uVignette: { value: params.vignette },
      uSeed: { value: params.seed },
      uSize: { value: new Vector2(size[0], size[1]) },
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
      uniform vec3 uColor;
      uniform float uGrain, uStain, uFold, uVignette, uSeed;
      uniform vec2 uSize;
      ${noiseGlsl}

      void main() {
        vec2 p = vUv * uSize;            // 월드 단위 좌표 → 비율 왜곡 없음
        vec2 s = vec2(uSeed * 13.7, uSeed * 7.3);

        // 섬유: 고주파, 방향성 살짝(가로로 길게)
        float fiber = fbm(p * vec2(38.0, 60.0) + s, 3) - 0.5;
        // 얼룩: 저주파, 가장자리로 갈수록 진하게
        float stain = fbm(p * 0.55 + s * 0.3, 5);
        stain = smoothstep(0.35, 0.8, stain);
        // 접힌 자국: 가로/세로 중앙선 근처의 좁은 밴드 + 흔들림
        float wob = (fbm(p * 1.5 + s, 2) - 0.5) * 0.02;
        float foldH = 1.0 - smoothstep(0.0, 0.012, abs(vUv.y - 0.5 + wob));
        float foldV = 1.0 - smoothstep(0.0, 0.010, abs(vUv.x - 0.5 - wob));
        float fold = max(foldH, foldV * 0.7);
        // 비네트
        vec2 d = vUv - 0.5;
        float vig = smoothstep(0.35, 0.95, length(d) * 1.35);

        vec3 col = uColor;
        col += fiber * uGrain;
        col *= 1.0 - stain * uStain * 0.22;          // 누런 얼룩은 어둡게+따뜻하게
        col.b -= stain * uStain * 0.05;
        col *= 1.0 - fold * uFold * 0.10;
        col *= 1.0 - vig * uVignette * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
  return material
}

export function updatePaperMaterial(material: ShaderMaterial, params: PaperParams) {
  const u = material.uniforms
  ;(u.uColor.value as Color).set(params.baseColor)
  u.uGrain.value = params.grain
  u.uStain.value = params.stain
  u.uFold.value = params.fold
  u.uVignette.value = params.vignette
  u.uSeed.value = params.seed
}
