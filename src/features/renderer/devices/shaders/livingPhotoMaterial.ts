import { Color, ShaderMaterial, Texture, Vector2 } from 'three'
import { halftoneGlsl } from './halftone.glsl'
import type { HalftoneParams } from './halftoneMaterial'
import { inkRevealGlsl } from './inkReveal.glsl'
import type { InkRevealParams } from './inkRevealMaterial'
import { noiseGlsl } from './noise.glsl'

/**
 * 슬롯에 들어가는 "살아있는 사진" 재질.
 * - 켄번즈: uv를 (offset, scale)로 변환. 값은 외부(순수 함수 kenburnsUv)에서 t로 계산해 넘긴다.
 * - 하프톤 인쇄 룩(강도 0이면 원본)
 * - 잉크 번짐 등장(progress) + 세피아→컬러
 * 모든 시간 의존 값은 uniform으로만 들어오므로 재질 자체는 상태가 없다.
 */
export type LivingPhotoUniforms = {
  uvOffset: [number, number]
  uvScale: [number, number]
  progress: number
}

export function createLivingPhotoMaterial(
  map: Texture,
  planeAspect: number,
  halftone: HalftoneParams,
  halftoneStrength: number,
  ink: InkRevealParams,
) {
  const material = new ShaderMaterial({
    transparent: true,
    uniforms: {
      uMap: { value: map },
      uAspect: { value: planeAspect },
      uUvOffset: { value: new Vector2(0, 0) },
      uUvScale: { value: new Vector2(1, 1) },
      uProgress: { value: 1 },
      uHtStrength: { value: halftoneStrength },
      uHtCells: { value: halftone.cells },
      uHtAngle: { value: (halftone.angle * Math.PI) / 180 },
      uHtMis: { value: halftone.misregister },
      uHtBleed: { value: halftone.bleed },
      uHtColorInk: { value: halftone.colorInk },
      uHtDesat: { value: halftone.desaturate },
      uHtContrast: { value: halftone.contrast },
      uHtPaper: { value: new Color(halftone.paperColor) },
      uInkScale: { value: ink.scale },
      uInkFeather: { value: ink.feather },
      uInkEdge: { value: ink.edge },
      uInkDark: { value: ink.inkDarkness },
      uInkDir: { value: ink.directional },
      uInkSepia: { value: ink.sepiaToColor ? 1 : 0 },
      uInkSeed: { value: ink.seed },
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
      uniform float uAspect, uProgress, uHtStrength;
      uniform vec2 uUvOffset, uUvScale;
      uniform float uHtCells, uHtAngle, uHtMis, uHtBleed, uHtColorInk, uHtDesat, uHtContrast;
      uniform vec3 uHtPaper;
      uniform float uInkScale, uInkFeather, uInkEdge, uInkDark, uInkDir, uInkSepia, uInkSeed;
      ${noiseGlsl}
      ${halftoneGlsl}
      ${inkRevealGlsl}

      void main() {
        // 켄번즈: 중심 기준 스케일 + 오프셋
        vec2 uv = (vUv - 0.5) * uUvScale + 0.5 + uUvOffset;
        uv = clamp(uv, 0.001, 0.999);

        vec3 src = texture2D(uMap, uv).rgb;
        vec3 col = src;
        if (uHtStrength > 0.001) {
          HalftoneParams hp = HalftoneParams(uHtCells, uHtAngle, uHtMis, uHtBleed, uHtColorInk, uHtDesat, uHtContrast, uHtPaper);
          col = mix(src, halftonePrint(uMap, uv, uAspect, hp), uHtStrength);
        }

        // 잉크 등장은 슬롯 좌표(vUv) 기준 — 사진이 움직여도 번짐 모양은 종이에 고정
        float field = inkField(vUv, uInkScale, uInkDir, uInkSeed);
        vec2 m = inkMask(field, uProgress, uInkFeather, uInkEdge);
        col = sepiaMix(col, uProgress, uInkSepia);
        col = mix(col, col * vec3(0.25, 0.22, 0.28), m.y * uInkDark);
        gl_FragColor = vec4(col, m.x);
      }
    `,
  })
  return material
}

export function setLivingPhotoUniforms(material: ShaderMaterial, u: LivingPhotoUniforms) {
  ;(material.uniforms.uUvOffset.value as Vector2).set(u.uvOffset[0], u.uvOffset[1])
  ;(material.uniforms.uUvScale.value as Vector2).set(u.uvScale[0], u.uvScale[1])
  material.uniforms.uProgress.value = u.progress
}

export function setLivingPhotoHalftoneStrength(material: ShaderMaterial, strength: number) {
  material.uniforms.uHtStrength.value = strength
}
