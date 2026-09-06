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
  it('제목 페이지는 잎 0 앞면, 마지막 잎은 넘기지 않는다', () => {
    expect(comp.slots[0].attach).toEqual({ leaf: 0, side: 'front' })
    expect(stage.turns.length).toBe(stage.leaves - 1)
    stage.turns.forEach((tr, i) => expect(tr.leaf).toBe(i))
    for (let i = 1; i < stage.turns.length; i++)
      expect(stage.turns[i].t0).toBeGreaterThan(stage.turns[i - 1].t0 + stage.turns[i - 1].duration)
  })
  it('표지 열림 뒤에 첫 넘김이 오고, 마커는 넘김 시각이다', () => {
    expect(stage.turns[0].t0).toBeGreaterThan(stage.opening.t0 + stage.opening.duration)
    expect(comp.markers).toEqual(stage.turns.map((t) => t.t0))
  })
  it('카메라 키는 단조 증가하고 끝이 duration이며 항상 테이블 위(z>0)에 있다', () => {
    for (let i = 1; i < comp.camera.length; i++)
      expect(comp.camera[i].t).toBeGreaterThanOrEqual(comp.camera[i - 1].t)
    expect(comp.camera[comp.camera.length - 1].t).toBeCloseTo(comp.duration)
    for (const k of comp.camera) expect(k.z).toBeGreaterThan(0.5)
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
