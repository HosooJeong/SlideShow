/**
 * 시드 기반 결정적 난수 (mulberry32).
 * 같은 시드 → 같은 수열. 컴포저의 "다시 섞기"는 시드만 바꾼다.
 */
export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    /** [0, 1) */
    next,
    /** [min, max) */
    range: (min: number, max: number) => min + next() * (max - min),
    /** [min, max] 정수 */
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    /** 가중 선택. weights 길이는 items와 같아야 한다. */
    weighted: <T>(items: readonly T[], weights: readonly number[]): T => {
      const total = weights.reduce((s, w) => s + w, 0)
      let r = next() * total
      for (let i = 0; i < items.length; i++) {
        r -= weights[i]
        if (r < 0) return items[i]
      }
      return items[items.length - 1]
    },
    shuffle: <T>(items: readonly T[]): T[] => {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
  }
}

export type Rng = ReturnType<typeof createRng>
