export type EasingName = 'linear' | 'inOutCubic' | 'inOutQuint' | 'outCubic' | 'inOutSine'

export const easings: Record<EasingName, (x: number) => number> = {
  linear: (x) => x,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
