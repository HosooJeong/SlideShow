import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { createRng } from '@/shared/utils/seededRandom'

/** 회색 노이즈(범프·거칠기용). 시드 고정 → 항상 같은 결. 캔버스가 없는 환경(테스트)에서는 null */
export function makeNoiseTexture(size: number, seed: number, octaves = 3): Texture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(size, size)
  const rng = createRng(seed)
  // 값 노이즈를 옥타브별로 합친다(작은 격자 → 선형 보간)
  const layers: { grid: Float32Array; n: number; amp: number }[] = []
  let amp = 1
  let n = 4
  for (let o = 0; o < octaves; o++) {
    const grid = new Float32Array((n + 1) * (n + 1))
    for (let i = 0; i < grid.length; i++) grid[i] = rng.next()
    layers.push({ grid, n, amp })
    n *= 2
    amp *= 0.5
  }
  const total = layers.reduce((s, l) => s + l.amp, 0)
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
      const c = Math.round((v / total) * 255)
      const k = (y * size + x) * 4
      img.data[k] = c
      img.data[k + 1] = c
      img.data[k + 2] = c
      img.data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

/** 책 옆면: 쌓인 종이 단면(가로 줄무늬) */
export function makePageEdgeTexture(seed: number): Texture | null {
  if (typeof document === 'undefined') return null
  const w = 16
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const rng = createRng(seed)
  for (let y = 0; y < h; y++) {
    const base = 236 + rng.range(-6, 6)
    const line = y % 3 === 0 ? -14 : 0
    const v = Math.round(base + line)
    ctx.fillStyle = `rgb(${v},${v - 2},${v - 6})`
    ctx.fillRect(0, y, w, 1)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}
