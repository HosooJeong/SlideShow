import { describe, expect, it } from 'vitest'
import { appearProgress, coverScale, kenburnsUv } from './kenburns'

describe('coverScale', () => {
  it('가로로 긴 사진을 정방 슬롯에: 가로를 잘라낸다', () => {
    expect(coverScale(2, 1)).toEqual([0.5, 1])
  })
  it('세로로 긴 사진을 가로 슬롯에: 세로를 잘라낸다', () => {
    const [sx, sy] = coverScale(0.5, 1.5)
    expect(sx).toBe(1)
    expect(sy).toBeCloseTo(1 / 3)
  })
  it('비율이 같으면 그대로', () => {
    expect(coverScale(1.5, 1.5)).toEqual([1, 1])
  })
})

describe('kenburnsUv', () => {
  const kb = {
    start: 0,
    end: 2,
    zoomFrom: 1,
    zoomTo: 1.25,
    panFrom: [0, 0] as [number, number],
    panTo: [0.5, 0.5] as [number, number],
  }

  it('시작 시점엔 줌 1, 오프셋 0', () => {
    const r = kenburnsUv(kb, 1, 1, 0)
    expect(r.uvScale).toEqual([1, 1])
    expect(r.uvOffset).toEqual([0, 0])
  })

  it('끝 시점 스케일은 1/zoomTo', () => {
    const r = kenburnsUv(kb, 1, 1, 2)
    expect(r.uvScale[0]).toBeCloseTo(0.8)
  })

  it('오프셋은 보이는 영역이 [0,1]을 벗어나지 않게 클램프된다', () => {
    const r = kenburnsUv(kb, 1, 1, 2)
    const max = (1 - 0.8) / 2
    expect(r.uvOffset[0]).toBeCloseTo(max)
    expect(r.uvOffset[1]).toBeCloseTo(max)
  })

  it('범위 밖 t는 양 끝으로 고정', () => {
    expect(kenburnsUv(kb, 1, 1, -5)).toEqual(kenburnsUv(kb, 1, 1, 0))
    expect(kenburnsUv(kb, 1, 1, 50)).toEqual(kenburnsUv(kb, 1, 1, 2))
  })
})

describe('appearProgress', () => {
  it('none은 항상 1', () => {
    expect(appearProgress({ kind: 'none', t0: 5, duration: 1 }, 0)).toBe(1)
  })
  it('ink는 t0 이전 0, t0+duration 이후 1', () => {
    const a = { kind: 'ink', t0: 2, duration: 1 }
    expect(appearProgress(a, 1)).toBe(0)
    expect(appearProgress(a, 3)).toBe(1)
    expect(appearProgress(a, 2.5)).toBeGreaterThan(0.5)
  })
})
