import { describe, expect, it } from 'vitest'
import { createRng } from '@/shared/utils/seededRandom'
import { DOODLE_ICONS, DOODLE_SETS, DOODLES } from './doodles'
import { arrow, caption, circleAround, doodle, resetPenIds, wobble } from './pen'

const base = { color: '#f00', width: 0.05, z: 0.1, t0: 2, duration: 1 }

describe('doodles', () => {
  it('모든 아이콘은 단위 상자 안의 폴리라인 묶음이다', () => {
    for (const icon of DOODLE_ICONS) {
      const lines = DOODLES[icon]
      expect(lines.length).toBeGreaterThan(0)
      for (const line of lines) {
        expect(line.length).toBeGreaterThanOrEqual(2)
        for (const [x, y] of line) {
          expect(Math.abs(x)).toBeLessThanOrEqual(0.6)
          expect(Math.abs(y)).toBeLessThanOrEqual(0.6)
        }
      }
    }
  })
  it('테마 세트는 존재하는 아이콘만 가리킨다', () => {
    for (const set of Object.values(DOODLE_SETS))
      for (const icon of set) expect(DOODLES[icon]).toBeDefined()
  })
})

describe('pen helpers', () => {
  it('wobble은 결정적이고 진폭 안에 머문다', () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 1],
    ]
    const a = wobble(pts, createRng(3), 0.1)
    const b = wobble(pts, createRng(3), 0.1)
    expect(a).toEqual(b)
    a.forEach(([x, y], i) => {
      expect(Math.abs(x - pts[i][0])).toBeLessThanOrEqual(0.1)
      expect(Math.abs(y - pts[i][1])).toBeLessThanOrEqual(0.1)
    })
  })
  it('circleAround는 사진 바깥을 한 바퀴 남짓 돈다', () => {
    const s = circleAround(1, 2, 2, 1, createRng(1), base)
    expect(s.points.length).toBeGreaterThan(30)
    for (const [x, y] of s.points) {
      const inside = Math.abs(x - 1) < 1 && Math.abs(y - 2) < 0.5
      expect(inside).toBe(false)
    }
  })
  it('arrow는 몸통 뒤에 화살촉 두 획이 순서대로 그려진다', () => {
    const ss = arrow([0, 0], [2, 0], createRng(2), base)
    expect(ss.length).toBe(3)
    expect(ss[1].t0).toBeGreaterThan(ss[0].t0)
    expect(ss[2].t0).toBeGreaterThanOrEqual(ss[1].t0)
    expect(ss[1].points[1]).toEqual([2, 0])
  })
  it('doodle은 아이콘의 획을 크기·위치대로 옮기고 차례로 그린다', () => {
    const ss = doodle('heart', 5, 5, 1, 0, createRng(4), base)
    expect(ss.length).toBe(DOODLES.heart.length)
    for (const s of ss)
      for (const [x, y] of s.points) expect(Math.hypot(x - 5, y - 5)).toBeLessThan(0.8)
    const multi = doodle('sun', 0, 0, 1, 0.3, createRng(4), base)
    for (let i = 1; i < multi.length; i++) expect(multi[i].t0).toBeGreaterThan(multi[i - 1].t0)
  })
  it('caption은 글자 수에 비례해 쓰고, 형광펜은 글자 뒤(z 아래)에 늦게 그려진다', () => {
    resetPenIds()
    const c = caption('첫 생일 축하해!', 0, 0, {
      fontSize: 0.5,
      color: '#000',
      rotation: 0,
      align: 'center',
      z: 0.1,
      t0: 1,
      highlighter: { color: '#ff0', rng: createRng(9) },
    })
    expect(c.text.duration).toBeCloseTo('첫 생일 축하해!'.length * 0.11)
    expect(c.strokes.length).toBe(1)
    expect(c.strokes[0].kind).toBe('highlighter')
    expect(c.strokes[0].z).toBeLessThan(c.text.z)
    expect(c.strokes[0].t0).toBeGreaterThan(c.text.t0)
    expect(c.text.id).toBe('hand-0')
  })
})
