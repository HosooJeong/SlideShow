import { describe, expect, it } from 'vitest'
import { createRng } from './seededRandom'

describe('createRng', () => {
  it('같은 시드는 같은 수열을 낸다', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('다른 시드는 다른 수열을 낸다', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })

  it('값은 [0, 1) 범위다', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int는 양 끝을 포함한다', () => {
    const rng = createRng(3)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) seen.add(rng.int(0, 2))
    expect([...seen].sort()).toEqual([0, 1, 2])
  })

  it('weighted는 가중치 0인 항목을 고르지 않는다', () => {
    const rng = createRng(9)
    for (let i = 0; i < 200; i++) {
      expect(rng.weighted(['a', 'b', 'c'], [1, 0, 1])).not.toBe('b')
    }
  })

  it('shuffle은 원본을 바꾸지 않고 같은 원소를 유지한다', () => {
    const src = [1, 2, 3, 4, 5]
    const out = createRng(5).shuffle(src)
    expect(src).toEqual([1, 2, 3, 4, 5])
    expect(out.slice().sort()).toEqual(src)
  })
})
