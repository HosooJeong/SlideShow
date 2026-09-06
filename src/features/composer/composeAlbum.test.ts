import { describe, expect, it } from 'vitest'
import { composeAlbum, PAGE_H, PAGE_W } from './composeAlbum'
import type { AlbumStage } from '@/features/renderer/types'

const media = Array.from({ length: 11 }, (_, i) => ({
  id: `m${i}`,
  width: i % 2 ? 1200 : 1600,
  height: i % 2 ? 1600 : 1200,
}))

describe('composeAlbum', () => {
  const comp = composeAlbum(media, {
    seed: 7,
    aspect: '16:9',
    name: '하늘',
    date: '2026년 9월 6일',
  })
  const stage = comp.stage as AlbumStage

  it('결정적: 같은 입력이면 같은 결과', () => {
    const again = composeAlbum(media, {
      seed: 7,
      aspect: '16:9',
      name: '하늘',
      date: '2026년 9월 6일',
    })
    expect(again).toEqual(comp)
  })
  it('모든 사진이 한 번씩 쓰이고, 잎 부착 정보가 유효하다', () => {
    expect(comp.slots.map((s) => s.mediaId).sort()).toEqual(media.map((m) => m.id).sort())
    for (const s of comp.slots) {
      expect(s.attach).toBeDefined()
      expect(s.attach!.leaf).toBeGreaterThanOrEqual(0)
      expect(s.attach!.leaf).toBeLessThan(stage.leaves)
      // 페이지 로컬 좌표 안에 있다(여백 포함)
      expect(s.x - s.w / 2).toBeGreaterThanOrEqual(0)
      expect(s.x + s.w / 2).toBeLessThanOrEqual(PAGE_W + 1e-6)
      expect(Math.abs(s.y) + s.h / 2).toBeLessThanOrEqual(PAGE_H / 2 + 1e-6)
    }
  })
  it('제목 페이지는 잎 0 앞면, 샷은 빈틈없이 이어지고 스프레드는 단조 증가한다', () => {
    expect(comp.slots[0].attach).toEqual({ leaf: 0, side: 'front' })
    expect(stage.shots[0].kind).toBe('cover')
    expect(stage.shots[0].spread).toBe(0)
    for (let i = 1; i < stage.shots.length; i++) {
      expect(stage.shots[i].t0).toBeCloseTo(stage.shots[i - 1].t1)
      expect(stage.shots[i].spread).toBeGreaterThanOrEqual(stage.shots[i - 1].spread)
      expect(stage.shots[i].spread).toBeLessThan(stage.leaves)
    }
    expect(stage.shots[stage.shots.length - 1].t1).toBeCloseTo(comp.duration)
  })
  it('스프레드가 바뀌는 컷마다 라이트리크 플래시와 마커가 있다', () => {
    const cuts = stage.shots.filter((s, i) => i > 0 && s.spread !== stage.shots[i - 1].spread)
    expect(comp.markers!.length).toBe(cuts.length)
    for (const c of cuts) expect(stage.flashes.some((f) => Math.abs(f.t - c.t0) < 0.2)).toBe(true)
    expect(stage.shots[1].t0).toBeGreaterThan(stage.opening.t0 + stage.opening.duration)
  })
  it('카메라 키는 단조 증가하고 끝이 duration이며 항상 테이블 위(z>0)에 있다', () => {
    for (let i = 1; i < comp.camera.length; i++)
      expect(comp.camera[i].t).toBeGreaterThanOrEqual(comp.camera[i - 1].t)
    expect(comp.camera[comp.camera.length - 1].t).toBeCloseTo(comp.duration)
    for (const k of comp.camera) expect(k.z).toBeGreaterThan(0.5)
  })
  it('사진 샷의 카메라 틸트는 30° 이하다(사진이 사다리꼴로 보이지 않게)', () => {
    const afterCover = stage.shots[1].t0
    for (const k of comp.camera) {
      if (k.t < afterCover) continue
      const dx = k.lookX - k.x
      const dy = k.lookY - k.y
      const dz = k.lookZ - k.z
      const tilt = Math.atan2(Math.hypot(dx, dy), -dz) * (180 / Math.PI)
      expect(tilt).toBeLessThanOrEqual(30)
    }
  })
  it('속도 느리게면 더 길다', () => {
    const slow = composeAlbum(media, { seed: 7, aspect: '16:9', pace: 'slow' })
    expect(slow.duration).toBeGreaterThan(comp.duration)
  })
  it('사진 1장이어도 만들어진다', () => {
    const one = composeAlbum(media.slice(0, 1), { seed: 1, aspect: '16:9' })
    expect(one.slots.length).toBe(1)
    expect((one.stage as AlbumStage).leaves).toBeGreaterThanOrEqual(1)
    expect(one.duration).toBeGreaterThan(3)
  })
})
