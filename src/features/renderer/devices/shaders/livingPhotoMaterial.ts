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
    // 사진 평면은 깊이를 쓰지 않는다: 보이지 않는(알파 0) 슬롯이 다른 슬롯을 가리는 일을 막는다
    depthWrite: false,
    uniforms: {
      uMap: { value: map },
      uAspect: { value: planeAspect },
      uUvOffset: { value: new Vector2(0, 0) },
      uUvScale: { value: new Vector2(1, 1) },
      uProgress: { value: 1 },
      uFog: { value: 0 },
      uFogColor: { value: new Color('#0c0b0a') },
      // 플레이리스트 전환: B(들어오는 사진)
      uMapB: { value: map },
      uUvOffsetB: { value: new Vector2(0, 0) },
      uUvScaleB: { value: new Vector2(1, 1) },
      uMix: { value: 0 },
      uKind: { value: 0 },
      uDir: { value: new Vector2(1, 0) },
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
      uniform float uAspect, uProgress, uHtStrength, uFog, uMix, uKind;
      uniform vec3 uFogColor;
      uniform sampler2D uMapB;
      uniform vec2 uUvOffsetB, uUvScaleB, uDir;
      uniform vec2 uUvOffset, uUvScale;
      uniform float uHtCells, uHtAngle, uHtMis, uHtBleed, uHtColorInk, uHtDesat, uHtContrast;
      uniform vec3 uHtPaper;
      uniform float uInkScale, uInkFeather, uInkEdge, uInkDark, uInkDir, uInkSepia, uInkSeed;
      ${noiseGlsl}
      ${halftoneGlsl}
      ${inkRevealGlsl}

      vec3 shade(sampler2D map, vec2 uv) {
        vec3 src = texture2D(map, uv).rgb;
        if (uHtStrength > 0.001) {
          HalftoneParams hp = HalftoneParams(uHtCells, uHtAngle, uHtMis, uHtBleed, uHtColorInk, uHtDesat, uHtContrast, uHtPaper);
          return mix(src, halftonePrint(map, uv, uAspect, hp), uHtStrength);
        }
        return src;
      }

      // 전환: 0 wipe, 1 push, 2 flip, 3 cut. 반환 rgb + 알파(플립 가장자리 등 비는 곳은 0)
      vec4 swapMix(vec2 suv, vec2 uvA, vec2 uvB) {
        if (uMix <= 0.0) return vec4(shade(uMap, uvA), 1.0);
        if (uMix >= 1.0) return vec4(shade(uMapB, uvB), 1.0);
        vec2 d = uDir;
        float nrm = abs(d.x) + abs(d.y) + 1e-5;
        if (uKind < 0.5) {
          // 와이프: 방향으로 진행하는 선. 선 근처에 얇은 그림자
          float c = dot(suv - 0.5, d) / nrm + 0.5;
          float edge = smoothstep(uMix - 0.012, uMix + 0.012, c);   // 1 = 아직 A
          vec3 col = mix(shade(uMapB, uvB), shade(uMap, uvA), edge);
          float shadow = (1.0 - smoothstep(0.0, 0.05, c - uMix)) * step(uMix, c);
          col *= 1.0 - shadow * 0.35;
          return vec4(col, 1.0);
        } else if (uKind < 1.5) {
          // 푸시: A가 밀려 나가고 B가 같은 방향에서 들어온다(슬롯 uv 이동)
          vec2 shiftA = suv - d * uMix;
          vec2 shiftB = suv - d * (uMix - 1.0);
          bool inA = all(greaterThanEqual(shiftA, vec2(0.0))) && all(lessThanEqual(shiftA, vec2(1.0)));
          // 슬롯 uv 이동을 사진 uv에 반영: 켄번즈 스케일은 유지하고 오프셋만 평행이동
          vec2 a = (shiftA - 0.5) * uUvScale + 0.5 + uUvOffset;
          vec2 b = (shiftB - 0.5) * uUvScaleB + 0.5 + uUvOffsetB;
          vec3 col = inA ? shade(uMap, clamp(a, 0.001, 0.999)) : shade(uMapB, clamp(b, 0.001, 0.999));
          // 경계 그림자
          float c = dot(suv - 0.5, d) / nrm + 0.5;
          float k = 1.0 - smoothstep(0.0, 0.06, abs(c - (1.0 - uMix)));
          col *= 1.0 - k * 0.3;
          return vec4(col, 1.0);
        } else if (uKind < 2.5) {
          // 플립: 가로로 눌렸다가 B로 펴진다. 눌린 동안 어둡게
          float sx = abs(cos(3.14159 * uMix));
          float x = (suv.x - 0.5) / max(sx, 0.02) + 0.5;
          if (x < 0.0 || x > 1.0) return vec4(0.0);
          vec2 s2 = vec2(x, suv.y);
          vec3 col = uMix < 0.5
            ? shade(uMap, clamp((s2 - 0.5) * uUvScale + 0.5 + uUvOffset, 0.001, 0.999))
            : shade(uMapB, clamp((s2 - 0.5) * uUvScaleB + 0.5 + uUvOffsetB, 0.001, 0.999));
          col *= 0.55 + 0.45 * sx;
          return vec4(col, 1.0);
        }
        // 컷: 즉시 B, 첫 순간 하얗게 번쩍
        vec3 col = shade(uMapB, uvB);
        col = mix(col, vec3(1.0), (1.0 - uMix) * 0.7);
        return vec4(col, 1.0);
      }

      void main() {
        // 켄번즈: 중심 기준 스케일 + 오프셋 (A: 현재/나가는 사진, B: 들어오는 사진)
        vec2 uvA = clamp((vUv - 0.5) * uUvScale + 0.5 + uUvOffset, 0.001, 0.999);
        vec2 uvB = clamp((vUv - 0.5) * uUvScaleB + 0.5 + uUvOffsetB, 0.001, 0.999);
        vec4 sw = swapMix(vUv, uvA, uvB);
        vec3 col = sw.rgb;

        // 잉크 등장은 슬롯 좌표(vUv) 기준 — 사진이 움직여도 번짐 모양은 종이에 고정
        float field = inkField(vUv, uInkScale, uInkDir, uInkSeed);
        vec2 m = inkMask(field, uProgress, uInkFeather, uInkEdge);
        col = sepiaMix(col, uProgress, uInkSepia);
        col = mix(col, col * vec3(0.25, 0.22, 0.28), m.y * uInkDark);
        col = mix(col, uFogColor, uFog);
        gl_FragColor = vec4(col, m.x * (1.0 - uFog) * sw.a);
      }
    `,
  })
  return material
}

const SWAP_KIND = { wipe: 0, push: 1, flip: 2, cut: 3 } as const

/** 플레이리스트 전환 상태. mix 0이면 A만 보인다 */
export function setLivingPhotoSwap(
  material: ShaderMaterial,
  swap: {
    mapA: Texture
    mapB: Texture
    uvB: { uvScale: [number, number]; uvOffset: [number, number] }
    mix: number
    kind: keyof typeof SWAP_KIND
    dir: [number, number]
  },
) {
  const u = material.uniforms
  if (u.uMap.value !== swap.mapA) u.uMap.value = swap.mapA
  if (u.uMapB.value !== swap.mapB) u.uMapB.value = swap.mapB
  ;(u.uUvScaleB.value as Vector2).set(swap.uvB.uvScale[0], swap.uvB.uvScale[1])
  ;(u.uUvOffsetB.value as Vector2).set(swap.uvB.uvOffset[0], swap.uvB.uvOffset[1])
  u.uMix.value = swap.mix
  u.uKind.value = SWAP_KIND[swap.kind]
  ;(u.uDir.value as Vector2).set(swap.dir[0], swap.dir[1])
}

export function setLivingPhotoUniforms(material: ShaderMaterial, u: LivingPhotoUniforms) {
  ;(material.uniforms.uUvOffset.value as Vector2).set(u.uvOffset[0], u.uvOffset[1])
  ;(material.uniforms.uUvScale.value as Vector2).set(u.uvScale[0], u.uvScale[1])
  material.uniforms.uProgress.value = u.progress
}

/** 거리 안개(0 = 없음, 1 = 배경색에 완전히 묻힘) */
export function setLivingPhotoFog(material: ShaderMaterial, fog: number, color?: string) {
  material.uniforms.uFog.value = fog
  if (color) (material.uniforms.uFogColor.value as Color).set(color)
}

export function setLivingPhotoHalftoneStrength(material: ShaderMaterial, strength: number) {
  material.uniforms.uHtStrength.value = strength
}
