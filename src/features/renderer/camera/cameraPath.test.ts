import { describe, expect, it } from 'vitest'
import { buildVisitPath, pathDuration, sampleCamera, type CameraKey } from './cameraPath'

const key = (t: number, x: number, ease: CameraKey['ease'] = 'linear'): CameraKey => ({
  t,
  x,
  y: 0,
  z: 0,
  lookX: 0,
  lookY: 0,
  lookZ: 0,
  roll: 0,
  ease,
})

describe('sampleCamera', () => {
  const keys = [key(0, 0), key(2, 10), key(4, 20)]

  it('범위 밖은 양 끝 포즈로 고정한다', () => {
    expect(sampleCamera(keys, -1).x).toBe(0)
    expect(sampleCamera(keys, 99).x).toBe(20)
  })

  it('선형 이징이면 구간 안에서 선형 보간한다', () => {
    expect(sampleCamera(keys, 1).x).toBe(5)
    expect(sampleCamera(keys, 3).x).toBe(15)
  })

  it('키프레임 시각에서는 그 키의 값이다', () => {
    expect(sampleCamera(keys, 2).x).toBe(10)
  })

  it('inOutCubic은 중간 지점에서 절반, 양 끝에서 완만하다', () => {
    const k = [key(0, 0, 'inOutCubic'), key(1, 1)]
    expect(sampleCamera(k, 0.5).x).toBeCloseTo(0.5)
    expect(sampleCamera(k, 0.1).x).toBeLessThan(0.1)
    expect(sampleCamera(k, 0.9).x).toBeGreaterThan(0.9)
  })

  it('같은 입력은 항상 같은 결과다(결정성)', () => {
    expect(sampleCamera(keys, 1.234)).toEqual(sampleCamera(keys, 1.234))
  })

  it('빈 키프레임은 에러', () => {
    expect(() => sampleCamera([], 0)).toThrow()
  })
})

describe('buildVisitPath', () => {
  const path = buildVisitPath({
    overview: { x: 0, y: 0, z: 10, lookX: 0, lookY: 0 },
    targets: [
      { x: -2, y: 1, z: 0 },
      { x: 2, y: -1, z: 0, tilt: 0.1 },
    ],
    approach: 3,
    dwell: 2,
    travel: 1,
  })

  it('전체 보기로 시작하고 끝난다', () => {
    expect(path[0]).toMatchObject({ x: 0, y: 0, z: 10 })
    expect(path[path.length - 1]).toMatchObject({ x: 0, y: 0, z: 10 })
  })

  it('t는 단조 증가한다', () => {
    for (let i = 1; i < path.length; i++) expect(path[i].t).toBeGreaterThanOrEqual(path[i - 1].t)
  })

  it('총 길이 = 시작 머무름 + (이동+머무름)×대상 + 복귀 이동', () => {
    expect(pathDuration(path)).toBeCloseTo(2 * 0.6 + (1 + 2) * 2 + 1)
  })

  it('대상에 다가가면 approach 거리에서 대상을 바라본다', () => {
    const near = path.find((k) => k.lookX === -2)!
    expect(near.z).toBe(3)
    expect(near.lookZ).toBe(0)
  })

  it('tilt는 roll로 전달된다', () => {
    expect(path.find((k) => k.lookX === 2)!.roll).toBe(0.1)
  })
})
