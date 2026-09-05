import { describe, expect, it } from 'vitest'
import { clipTime, planClip } from './clip'
import type { Slot } from './types'

const slot = (clip: Slot['clip'], start = 10, end = 14): Slot => ({
  id: 's',
  mediaId: 'm',
  mediaAspect: 1.5,
  x: 0,
  y: 0,
  z: 0,
  w: 1,
  h: 1,
  rotation: 0,
  frame: 'none',
  kenburns: { start, end, zoomFrom: 1, zoomTo: 1, panFrom: [0, 0], panTo: [0, 0] },
  appear: { kind: 'none', t0: 0, duration: 0 },
  inkSeed: 1,
  clip,
})

describe('clipTime', () => {
  const s = slot({ start: 2, duration: 3, loop: true, volume: 0 })

  it('창 이전엔 첫 프레임에 멈춘다', () => {
    expect(clipTime(s, 5)).toEqual({ videoTime: 2, active: false })
  })
  it('창 안에서는 경과 시간만큼 진행한다', () => {
    expect(clipTime(s, 11)).toEqual({ videoTime: 3, active: true })
  })
  it('루프면 길이로 나눈 나머지', () => {
    expect(clipTime(s, 13.5).videoTime).toBeCloseTo(2 + 0.5)
  })
  it('창 이후엔 마지막 프레임에 멈춘다', () => {
    const r = clipTime(s, 20)
    expect(r.active).toBe(false)
    expect(r.videoTime).toBeCloseTo(2 + (4 % 3))
  })
  it('루프가 아니면 길이에서 멈춘다', () => {
    const n = slot({ start: 0, duration: 2, loop: false, volume: 0 })
    expect(clipTime(n, 13)).toEqual({ videoTime: 2, active: false })
  })
  it('클립이 없으면 비활성', () => {
    expect(clipTime(slot(undefined), 11)).toEqual({ videoTime: 0, active: false })
  })
})

describe('planClip', () => {
  it('원본·창·최대 중 가장 짧은 길이로 잡는다', () => {
    expect(
      planClip({ sourceDuration: 30, windowDuration: 5, maxSeconds: 4, volume: 0 })?.duration,
    ).toBe(4)
    expect(
      planClip({ sourceDuration: 2, windowDuration: 5, maxSeconds: 4, volume: 0 })?.duration,
    ).toBe(2)
  })
  it('여유가 있으면 첫 1초를 피해 시작한다', () => {
    expect(
      planClip({ sourceDuration: 30, windowDuration: 5, maxSeconds: 4, volume: 0 })?.start,
    ).toBe(1)
    expect(
      planClip({ sourceDuration: 4, windowDuration: 5, maxSeconds: 4, volume: 0 })?.start,
    ).toBe(0)
  })
  it('길이를 모르면 클립 없음', () => {
    expect(
      planClip({ sourceDuration: 0, windowDuration: 5, maxSeconds: 4, volume: 0 }),
    ).toBeUndefined()
  })
})
