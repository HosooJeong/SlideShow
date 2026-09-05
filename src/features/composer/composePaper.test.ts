import { describe, expect, it } from 'vitest'
import { composePaper, stageSize } from './composePaper'
import { sampleCamera } from '@/features/renderer/camera/cameraPath'

const media = Array.from({ length: 10 }, (_, i) => ({
  id: `m${i}`,
  width: i % 3 === 0 ? 900 : 1600,
  height: i % 3 === 0 ? 1600 : 1200,
}))

describe('composePaper', () => {
  const comp = composePaper(media, { seed: 42, aspect: '16:9' })

  it('결정적이다', () => {
    expect(composePaper(media, { seed: 42, aspect: '16:9' })).toEqual(comp)
  })

  it('시드가 다르면 배치가 다르다', () => {
    const other = composePaper(media, { seed: 43, aspect: '16:9' })
    expect(other.slots.map((s) => s.x)).not.toEqual(comp.slots.map((s) => s.x))
  })

  it('모든 미디어가 슬롯 하나씩을 가진다', () => {
    expect(comp.slots.map((s) => s.mediaId)).toEqual(media.map((m) => m.id))
  })

  it('슬롯은 종이 안에 들어간다', () => {
    const [W, H] = stageSize('16:9')
    for (const s of comp.slots) {
      const r = Math.hypot(s.w, s.h) / 2
      expect(Math.abs(s.x) + r).toBeLessThanOrEqual((W * 1.15) / 2)
      expect(Math.abs(s.y) + r).toBeLessThanOrEqual((H * 1.15) / 2)
    }
  })

  it('세로 사진은 세로 슬롯을 받는다', () => {
    expect(comp.slots[0].h).toBeGreaterThan(comp.slots[0].w)
    expect(comp.slots[1].w).toBeGreaterThan(comp.slots[1].h)
  })

  it('등장은 카메라가 도착하기 전에 시작해 도착 직후 끝난다', () => {
    comp.slots.forEach((s, i) => {
      const arrive = comp.camera[1 + i * 2].t
      expect(s.appear.t0).toBeLessThan(arrive)
      expect(s.appear.t0 + s.appear.duration).toBeGreaterThan(arrive)
      expect(s.appear.t0 + s.appear.duration).toBeLessThanOrEqual(comp.duration)
    })
  })

  it('카메라는 각 슬롯을 정면에서 바라본다', () => {
    comp.slots.forEach((s, i) => {
      const pose = sampleCamera(comp.camera, comp.camera[1 + i * 2].t)
      expect(pose.lookX).toBeCloseTo(s.x)
      expect(pose.lookY).toBeCloseTo(s.y)
      expect(pose.z).toBeGreaterThan(s.z)
    })
  })

  it('길이는 대략 슬롯 수 × (머무름+이동)', () => {
    expect(comp.duration).toBeGreaterThan(10 * (2.4 + 1.3))
    expect(comp.duration).toBeLessThan(10 * (2.4 + 1.3) + 5)
  })

  it('9:16도 만들어진다', () => {
    const v = composePaper(media.slice(0, 4), { seed: 1, aspect: '9:16' })
    expect(v.stage.height).toBeGreaterThan(v.stage.width)
  })

  it('미디어가 없어도 깨지지 않는다', () => {
    const empty = composePaper([], { seed: 1, aspect: '16:9' })
    expect(empty.slots).toEqual([])
    expect(empty.duration).toBeGreaterThan(0)
  })
})
