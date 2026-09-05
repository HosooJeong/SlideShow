import { Color, ShaderMaterial, Texture } from 'three'
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

      void main() {
        vec3 src = texture2D(uMap, vUv).rgb;
        float l = luma(src);
        // 인쇄 대비: 중간톤 압축
        float ink = pow(clamp(1.0 - l, 0.0, 1.0), uContrast);

        // 정방 셀 격자 (짧은 변 기준 uCells개), 회전
        vec2 p = vec2(vUv.x * uAspect, vUv.y) * uCells / min(uAspect, 1.0);
        float c = cos(uAngle), s = sin(uAngle);
        vec2 r = mat2(c, -s, s, c) * p;
        vec2 cell = fract(r) - 0.5;
        float d = length(cell) * 2.0;                // 0 중심 ~ 1.41 모서리
        // 셀 중심의 잉크량으로 도트 반지름 결정(셀 안은 균일해야 도트가 둥글다)
        vec2 cellCenterUv;
        {
          vec2 rc = (floor(r) + 0.5);
          vec2 pc = mat2(c, s, -s, c) * rc;       // 역회전
          cellCenterUv = vec2(pc.x / uAspect, pc.y) * min(uAspect, 1.0) / uCells;
        }
        vec3 cSrc = texture2D(uMap, clamp(cellCenterUv, 0.0, 1.0)).rgb;
        float cInk = pow(clamp(1.0 - luma(cSrc), 0.0, 1.0), uContrast);
        float radius = sqrt(cInk) * 1.15;            // 면적 비례. 1.15로 어두운 곳은 도트가 맞닿아 뭉침
        float aa = fwidth(d) * 1.2;
        float edge = aa + uBleed * 0.25;
        float dot_ = 1.0 - smoothstep(radius - edge, radius + edge, d);

        // 잉크 색: 검정과 (어긋난) 사진 색의 혼합. 어긋남은 컬러 프린지를 만든다.
        vec3 shifted = texture2D(uMap, vUv + vec2(uMis, -uMis * 0.5)).rgb;
        shifted = mix(shifted, vec3(luma(shifted)), uDesat);
        vec3 inkColor = mix(vec3(0.08, 0.07, 0.09), shifted * 0.55, uColorInk);
        vec3 printed = mix(uPaper, inkColor, dot_);

        // 밝은 영역엔 도트가 거의 없어 종이 그대로 → 원본을 살짝 비쳐 사진처럼 읽히게
        vec3 tinted = mix(src, vec3(l), uDesat) * uPaper / max(luma(uPaper), 0.001);
        printed = mix(tinted, printed, 0.85);

        // 사진 자체 질감: 종이 섬유가 잉크 위로 살짝
        float fiber = fbm(vUv * vec2(60.0, 90.0) * uAspect, 2) - 0.5;
        printed += fiber * 0.05;

        vec3 out_ = mix(src, printed, uStrength);
        gl_FragColor = vec4(out_, 1.0);
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
