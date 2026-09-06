import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { createRng } from '@/shared/utils/seededRandom'

/** 옥타브 값 노이즈 높이맵(0..1). 시드 고정 → 항상 같은 결 */
function heightNoise(size: number, seed: number, octaves: number, base = 4): Float32Array {
  const rng = createRng(seed)
  const layers: { grid: Float32Array; n: number; amp: number }[] = []
  let amp = 1
  let n = base
  for (let o = 0; o < octaves; o++) {
    const grid = new Float32Array((n + 1) * (n + 1))
    for (let i = 0; i < grid.length; i++) grid[i] = rng.next()
    layers.push({ grid, n, amp })
    n *= 2
    amp *= 0.5
  }
  const total = layers.reduce((s, l) => s + l.amp, 0)
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0
      for (const l of layers) {
        const fx = (x / size) * l.n
        const fy = (y / size) * l.n
        const ix = Math.floor(fx)
        const iy = Math.floor(fy)
        const tx = fx - ix
        const ty = fy - iy
        const g = (i: number, j: number) => l.grid[(j % l.n) * (l.n + 1) + (i % l.n)]
        const a = g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx
        const b = g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx
        v += (a * (1 - ty) + b * ty) * l.amp
      }
      out[y * size + x] = v / total
    }
  }
  return out
}

function canvasOf(size: number) {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  return ctx ? { canvas, ctx } : null
}

function grayTexture(h: Float32Array, size: number): Texture | null {
  const c = canvasOf(size)
  if (!c) return null
  const img = c.ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(h[i] * 255)
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  c.ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(c.canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

/** 높이맵 → 탄젠트 공간 노멀맵(유한 차분) */
function normalTexture(h: Float32Array, size: number, strength: number): Texture | null {
  const c = canvasOf(size)
  if (!c) return null
  const img = c.ctx.createImageData(size, size)
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const k = (y * size + x) * 4
      img.data[k] = Math.round((-dx / len) * 0.5 * 255 + 127.5)
      img.data[k + 1] = Math.round((dy / len) * 0.5 * 255 + 127.5)
      img.data[k + 2] = Math.round((1 / len) * 0.5 * 255 + 127.5)
      img.data[k + 3] = 255
    }
  }
  c.ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(c.canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

/** 회색 노이즈(범프·거칠기용) */
export function makeNoiseTexture(size: number, seed: number, octaves = 3): Texture | null {
  return grayTexture(heightNoise(size, seed, octaves), size)
}

/** 종이 섬유 노멀맵: 미세 노이즈 */
export function makePaperNormal(size: number, seed: number): Texture | null {
  const h = heightNoise(size, seed, 5, 16)
  return normalTexture(h, size, 1.6)
}

/** 리넨 직조 노멀맵: 가로·세로 실 + 불규칙 */
export function makeLinenNormal(size: number, seed: number, threads = 48): Texture | null {
  const noise = heightNoise(size, seed, 4, 8)
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * threads * Math.PI * 2
      const v = (y / size) * threads * Math.PI * 2
      // 평직: 가로 실과 세로 실이 번갈아 위로 올라온다
      const warp = Math.sin(u)
      const weft = Math.sin(v)
      const over = Math.sign(Math.sin(u / 2 + Math.PI / 2) * Math.sin(v / 2)) >= 0
      const weave = over ? warp * 0.5 + 0.5 : weft * 0.5 + 0.5
      h[y * size + x] = weave * 0.75 + noise[y * size + x] * 0.25
    }
  }
  return normalTexture(h, size, 2.2)
}

/** 책 옆면: 쌓인 종이 단면(가로 줄무늬) */
export function makePageEdgeTexture(seed: number): Texture | null {
  const w = 16
  const h = 256
  const c = canvasOf(w)
  if (!c) return null
  c.canvas.height = h
  const rng = createRng(seed)
  for (let y = 0; y < h; y++) {
    const base = 236 + rng.range(-6, 6)
    const line = y % 3 === 0 ? -14 : 0
    const v = Math.round(base + line)
    c.ctx.fillStyle = `rgb(${v},${v - 2},${v - 6})`
    c.ctx.fillRect(0, y, w, 1)
  }
  const tex = new CanvasTexture(c.canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

/** 창문 고보: 스포트라이트에 투영하는 창살 무늬(밝은 유리창 + 어두운 창살, 가장자리 부드럽게) */
export function makeWindowGobo(size = 512): Texture | null {
  const c = canvasOf(size)
  if (!c) return null
  const { ctx } = c
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  // 창 전체(둥근 가장자리, 부드러운 경계)
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.28,
    size / 2,
    size / 2,
    size * 0.5,
  )
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  // 창살: 세로 2 + 가로 1, 살짝 흐리게. 스포트라이트 map은 RGB만 쓰므로 검게 칠한다(알파 아님)
  ctx.filter = 'blur(5px)'
  const bar = size * 0.05
  ctx.fillStyle = 'rgba(0,0,0,0.9)'
  for (const fx of [0.34, 0.66]) ctx.fillRect(size * fx - bar / 2, 0, bar, size)
  ctx.fillRect(0, size * 0.52 - bar / 2, size, bar)
  ctx.filter = 'none'
  const tex = new CanvasTexture(c.canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}
