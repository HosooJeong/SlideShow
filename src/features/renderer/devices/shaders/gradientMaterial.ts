import { Color, ShaderMaterial } from 'three'
import { noiseGlsl } from './noise.glsl'

/** 밝은 파스텔 그라데이션 배경 + 아주 약한 종이 결 */
export function createGradientMaterial(top: string, bottom: string) {
  return new ShaderMaterial({
    uniforms: { uTop: { value: new Color(top) }, uBottom: { value: new Color(bottom) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform vec3 uTop, uBottom;
      ${noiseGlsl}
      void main() {
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y + 0.08 * (fbm(vUv * 3.0, 3) - 0.5)));
        col += (fbm(vUv * vec2(60.0, 90.0), 2) - 0.5) * 0.02;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
}
