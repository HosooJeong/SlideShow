import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
} from 'three'
import type { RenderClock } from '../clock'
import type { DecorItem, DecorShape } from '../types'

const SHAPE_ID: Record<DecorShape, number> = {
  circle: 0,
  heart: 1,
  star: 2,
  sparkle: 3,
  tape: 4,
  ring: 5,
}

/**
 * 장식 레이어. 인스턴스 하나 = 스티커/테이프/컨페티 하나. 모양은 프래그먼트 SDF, 살랑거림·등장은 t의 함수(정점 셰이더).
 */
export function DecorLayer({ items, clock }: { items: DecorItem[]; clock: RenderClock }) {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new PlaneGeometry(1, 1), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aShape;
          attribute vec3 aColor;
          attribute float aOpacity;
          attribute vec3 aBob;     // amp, speed, phase
          attribute vec2 aWindow;  // t0, t1 (t1 < t0 이면 항상)
          uniform float uTime;
          varying vec2 vUv;
          varying float vShape;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vUv = uv;
            vShape = aShape;
            vColor = aColor;
            float appear = 1.0;
            if (aWindow.y > aWindow.x) {
              float inA = smoothstep(aWindow.x, aWindow.x + 0.3, uTime);
              float outA = 1.0 - smoothstep(aWindow.y - 0.25, aWindow.y, uTime);
              appear = inA * outA;
            }
            // 등장 때 살짝 튀어오르는 스케일
            float pop = 1.0 + 0.25 * (1.0 - appear) * step(0.001, appear);
            vec3 p = position * pop;
            vec4 world = instanceMatrix * vec4(p, 1.0);
            world.y += sin(uTime * aBob.y + aBob.z) * aBob.x;
            world.x += cos(uTime * aBob.y * 0.7 + aBob.z) * aBob.x * 0.5;
            vAlpha = aOpacity * appear;
            gl_Position = projectionMatrix * modelViewMatrix * world;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          varying vec2 vUv;
          varying float vShape;
          varying vec3 vColor;
          varying float vAlpha;

          float sdCircle(vec2 p, float r) { return length(p) - r; }
          float sdHeart(vec2 p) {
            p.y -= 0.15;
            p.x = abs(p.x);
            if (p.y + p.x > 1.0) return sqrt(dot(p - vec2(0.25, 0.75), p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
            return sqrt(min(dot(p - vec2(0.0, 1.0), p - vec2(0.0, 1.0)), dot(p - 0.5 * max(p.x + p.y, 0.0), p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
          }
          float sdStar(vec2 p, float r, float rf) {
            const vec2 k1 = vec2(0.809016994, -0.587785252);
            const vec2 k2 = vec2(-k1.x, k1.y);
            p.x = abs(p.x);
            p -= 2.0 * max(dot(k1, p), 0.0) * k1;
            p -= 2.0 * max(dot(k2, p), 0.0) * k2;
            p.x = abs(p.x);
            p.y -= r;
            vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1);
            float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
            return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
          }
          float sdSparkle(vec2 p) {
            // 4각 별: |x|^0.5 + |y|^0.5 형태
            float a = pow(abs(p.x), 0.55) + pow(abs(p.y), 0.55);
            return a - 0.72;
          }

          void main() {
            vec2 p = (vUv - 0.5) * 2.0;   // -1..1
            float d;
            vec3 col = vColor;
            float alpha = vAlpha;
            if (vShape < 0.5) {
              d = sdCircle(p, 0.85);
            } else if (vShape < 1.5) {
              d = sdHeart(p * 1.15 + vec2(0.0, 0.35)) ;
            } else if (vShape < 2.5) {
              d = sdStar(p, 0.85, 0.5);
            } else if (vShape < 3.5) {
              d = sdSparkle(p);
              col = mix(col, vec3(1.0), 0.35);
            } else if (vShape < 4.5) {
              // 마스킹테이프: 살짝 찢어진 끝 + 줄무늬 + 반투명
              float edge = 0.92 + 0.05 * sin(p.y * 22.0) ;
              d = max(abs(p.x) - edge, abs(p.y) - 0.85);
              float stripe = 0.5 + 0.5 * sin((p.x * 1.4 + p.y * 0.6) * 18.0);
              col = mix(col, vec3(1.0), 0.18 * stripe);
              alpha *= 0.82;
            } else {
              d = abs(sdCircle(p, 0.7)) - 0.14;
            }
            float aa = fwidth(d) * 1.2;
            float mask = 1.0 - smoothstep(-aa, aa, d);
            if (mask <= 0.002) discard;
            // 종이 스티커 느낌: 가장자리 살짝 밝게
            col += (1.0 - smoothstep(-0.2, 0.0, d)) * 0.03;
            gl_FragColor = vec4(col, alpha * mask);
          }
        `,
      }),
    [],
  )

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const n = items.length
    const shape = new Float32Array(n)
    const color = new Float32Array(n * 3)
    const opacity = new Float32Array(n)
    const bob = new Float32Array(n * 3)
    const win = new Float32Array(n * 2)
    const o = new Object3D()
    const c = new Color()
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z)
      o.rotation.set(0, 0, it.rotation)
      o.scale.set(it.size, it.size * it.aspect, 1)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      shape[i] = SHAPE_ID[it.shape]
      c.set(it.color)
      color[i * 3] = c.r
      color[i * 3 + 1] = c.g
      color[i * 3 + 2] = c.b
      opacity[i] = it.opacity
      bob[i * 3] = it.bob[0]
      bob[i * 3 + 1] = it.bob[1]
      bob[i * 3 + 2] = it.bob[2]
      win[i * 2] = it.window ? it.window.t0 : 1
      win[i * 2 + 1] = it.window ? it.window.t1 : 0
    })
    mesh.instanceMatrix.needsUpdate = true
    geometry.setAttribute('aShape', new InstancedBufferAttribute(shape, 1))
    geometry.setAttribute('aColor', new InstancedBufferAttribute(color, 3))
    geometry.setAttribute('aOpacity', new InstancedBufferAttribute(opacity, 1))
    geometry.setAttribute('aBob', new InstancedBufferAttribute(bob, 3))
    geometry.setAttribute('aWindow', new InstancedBufferAttribute(win, 2))
    mesh.count = n
    mesh.frustumCulled = false
  }, [items, geometry])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    material.uniforms.uTime.value = clock.read()
  })

  if (items.length === 0) return null
  return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, items.length)]} />
}
