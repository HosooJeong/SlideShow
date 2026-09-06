import { Color, ShaderMaterial } from 'three'
import { noiseGlsl } from './noise.glsl'
import type { BoardPattern } from '../../types'

const PATTERN_ID: Record<BoardPattern['kind'], number> = {
  dots: 1,
  gingham: 2,
  grid: 3,
  kraft: 4,
  stripes: 5,
}

/**
 * 밝은 파스텔 그라데이션 배경 + 아주 약한 종이 결 + 선택적 문구 패턴(도트·깅엄·모눈·크라프트·줄무늬).
 * aspect = 보드 가로/세로(패턴이 찌그러지지 않게).
 */
export function createGradientMaterial(
  top: string,
  bottom: string,
  pattern?: BoardPattern,
  aspect = 16 / 9,
) {
  return new ShaderMaterial({
    uniforms: {
      uTop: { value: new Color(top) },
      uBottom: { value: new Color(bottom) },
      uPattern: { value: pattern ? PATTERN_ID[pattern.kind] : 0 },
      uPatternColor: { value: new Color(pattern?.color ?? '#ffffff') },
      uScale: { value: pattern?.scale ?? 24 },
      uStrength: { value: pattern?.strength ?? 0 },
      uAspect: { value: aspect },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform vec3 uTop, uBottom, uPatternColor;
      uniform float uPattern, uScale, uStrength, uAspect;
      ${noiseGlsl}
      float lineMask(float x, float width) {
        float d = abs(fract(x) - 0.5);
        return 1.0 - smoothstep(width, width + 0.02, 0.5 - d);
      }
      void main() {
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y + 0.08 * (fbm(vUv * 3.0, 3) - 0.5)));
        col += (fbm(vUv * vec2(60.0, 90.0), 2) - 0.5) * 0.02;
        vec2 p = vec2(vUv.x * uAspect, vUv.y) * uScale;
        float mask = 0.0;
        // 손으로 찍은 듯 살짝 흔들린 격자
        vec2 jitter = (vec2(fbm(p * 0.35, 2), fbm(p * 0.35 + 7.3, 2)) - 0.5) * 0.08;
        p += jitter;
        if (uPattern < 0.5) {
          mask = 0.0;
        } else if (uPattern < 1.5) {
          // 도트: 격자 중심의 작은 원
          vec2 c = fract(p) - 0.5;
          mask = 1.0 - smoothstep(0.16, 0.2, length(c));
        } else if (uPattern < 2.5) {
          // 깅엄: 가로·세로 띠가 겹치는 곳이 더 진하다
          float sx = step(0.5, fract(p.x * 0.5));
          float sy = step(0.5, fract(p.y * 0.5));
          mask = 0.55 * sx + 0.55 * sy;
        } else if (uPattern < 3.5) {
          // 모눈
          mask = max(lineMask(p.x, 0.47), lineMask(p.y, 0.47));
        } else if (uPattern < 4.5) {
          // 크라프트지: 얼룩 + 섬유
          float mottle = fbm(p * 0.25, 4);
          float fiber = fbm(vec2(p.x * 3.0, p.y * 0.4), 3);
          mask = 0.6 + 0.5 * (mottle - 0.5) + 0.25 * (fiber - 0.5);
        } else {
          // 대각 줄무늬
          mask = lineMask((p.x + p.y) * 0.5, 0.42);
        }
        col = mix(col, uPatternColor, clamp(mask, 0.0, 1.0) * uStrength);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
}
