import { Color, ShaderMaterial, Texture } from 'three'
import { halftoneGlsl } from './halftone.glsl'
import { noiseGlsl } from './noise.glsl'

export type HalftoneParams = {
  /** 사진 짧은 변 기준 도트 개수. 클수록 잘다 */
  cells: number
  /** 스크린 각도(도). 신문은 45° 근처 */
  angle: number
  /** 색 잉크의 어긋남(사진 폭 대비 비율). 컬러 프린지 */
  misregister: number
  /** 0 = 원본, 1 = 완전 하프톤 */
  strength: number
  /** 도트 가장자리 번짐 */
  bleed: number
  /** 잉크에 사진 색을 얹는 정도. 0 = 흑백 인쇄, 1 = 컬러 인쇄 */
  colorInk: number
  /** 채도 감소 */
  desaturate: number
  /** 대비(감마) — 인쇄는 중간톤이 뭉개진다 */
  contrast: number
  paperColor: string
}

export const halftoneDefaults: HalftoneParams = {
  cells: 70,
  angle: 45,
  misregister: 0.002,
  strength: 0.8,
  bleed: 0.3,
  colorInk: 0.55,
  desaturate: 0.3,
  contrast: 1.25,
  paperColor: '#f1e8d3',
}

/**
 * B3 하프톤 인쇄 룩. 밝기 기반 K 도트 스크린 하나에 사진 색을 잉크 색으로 얹는다(듀오톤 인쇄 느낌).
 * CMY 3중 스크린은 화면 크기에서 모아레·무지개 앨리어싱이 심해 채택하지 않았다.
 * 도트 가장자리는 fwidth로 화면 해상도에 맞춰 안티앨리어싱한다.
 */
export function createHalftoneMaterial(map: Texture, params: HalftoneParams, aspect: number) {
  const material = new ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uAspect: { value: aspect },
      uCells: { value: params.cells },
      uAngle: { value: (params.angle * Math.PI) / 180 },
      uMis: { value: params.misregister },
      uStrength: { value: params.strength },
      uBleed: { value: params.bleed },
      uColorInk: { value: params.colorInk },
      uDesat: { value: params.desaturate },
      uContrast: { value: params.contrast },
      uPaper: { value: new Color(params.paperColor) },
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
      uniform float uAspect, uCells, uAngle, uMis, uStrength, uBleed, uColorInk, uDesat, uContrast;
      uniform vec3 uPaper;
      ${noiseGlsl}
      ${halftoneGlsl}

      void main() {
        vec3 src = texture2D(uMap, vUv).rgb;
        HalftoneParams hp = HalftoneParams(uCells, uAngle, uMis, uBleed, uColorInk, uDesat, uContrast, uPaper);
        vec3 printed = halftonePrint(uMap, vUv, uAspect, hp);
        gl_FragColor = vec4(mix(src, printed, uStrength), 1.0);
      }
    `,
  })
  return material
}

export function updateHalftoneMaterial(material: ShaderMaterial, params: HalftoneParams) {
  const u = material.uniforms
  u.uCells.value = params.cells
  u.uAngle.value = (params.angle * Math.PI) / 180
  u.uMis.value = params.misregister
  u.uStrength.value = params.strength
  u.uBleed.value = params.bleed
  u.uColorInk.value = params.colorInk
  u.uDesat.value = params.desaturate
  u.uContrast.value = params.contrast
  ;(u.uPaper.value as Color).set(params.paperColor)
}
