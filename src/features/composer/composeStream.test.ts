import { describe, expect, it } from 'vitest'
import { composeStream } from './composeStream'
import { sampleCamera } from '@/features/renderer/camera/cameraPath'
import { distanceForHeight } from './composePaper'
import type { StreamStage } from '@/features/renderer/types'

const media = Array.from({ length: 7 }, (_, i) => ({
  id: `m${i}`,
  width: i % 2 ? 1600 : 900,
  height: i % 2 ? 1200 : 1600,
  ...(i === 3 ? { kind: 'video' as const, duration: 9 } : {}),
}))

describe('composeStream', () => {
  const comp = composeStream(media, { seed: 11, aspect: '16:9' })
  const stage = comp.stage as StreamStage

  it('스트림 무대이고 결정적이다', () => {
    expect(stage.kind).toBe('stream')
    expect(composeStream(media, { seed: 11, aspect: '16:9' })).toEqual(comp)
  })
  it('사진마다 슬롯 하나, 3D 방향을 가진다', () => {
    expect(comp.slots.length).toBe(media.length)
    expect(comp.slots.every((s) => s.orient && s.orient.length === 3)).toBe(true)
  })
  it('사진은 경로를 따라 앞으로(-z) 나아간다', () => {
    for (let i = 1; i < comp.slots.length; i++)
      expect(comp.slots[i].z).toBeLessThan(comp.slots[i - 1].z)
  })
  it('카메라 키는 촘촘하고 t가 단조 증가하며 끝이 duration이다', () => {
    expect(comp.camera.length).toBeGreaterThan(comp.duration * 10)
    for (let i = 1; i < comp.camera.length; i++)
      expect(comp.camera[i].t).toBeGreaterThanOrEqual(comp.camera[i - 1].t)
    expect(comp.camera[comp.camera.length - 1].t).toBeCloseTo(comp.duration)
  })
  it('머무는 동안 카메라는 사진 앞에서 사진을 바라본다', () => {
    const s = comp.slots[2]
    // 창 = [도착 - 이동, 도착 + 머무름 + 이동]. 머무름 중간 = 시작 + 이동 + 머무름/2
    const mid = s.kenburns.start + 1.3 + 2.3 / 2
    const pose = sampleCamera(comp.camera, mid)
    expect(pose.lookX).toBeCloseTo(s.x, 1)
    expect(pose.lookY).toBeCloseTo(s.y, 1)
    expect(pose.z).toBeGreaterThan(s.z)
    const dist = Math.hypot(pose.x - s.x, pose.y - s.y, pose.z - s.z)
    const approach = distanceForHeight(s.h, 0.66)
    expect(Math.abs(dist - approach)).toBeLessThan(0.35)
  })
  it('플래시는 영상 길이 안에 있고 오프닝 플래시가 있다', () => {
    expect(stage.flashes.some((f) => f.t === 0)).toBe(true)
    for (const f of stage.flashes) expect(f.t + f.duration).toBeLessThanOrEqual(comp.duration + 0.5)
  })
  it('영상 미디어에는 클립이 붙는다', () => {
    expect(comp.slots[3].clip).toBeDefined()
    expect(comp.slots[1].clip).toBeUndefined()
  })
  it('미디어가 없어도 만들어진다', () => {
    const empty = composeStream([], { seed: 1, aspect: '16:9' })
    expect(empty.slots).toEqual([])
    expect(empty.duration).toBeGreaterThan(0)
    expect(empty.camera.length).toBeGreaterThan(1)
  })
})
