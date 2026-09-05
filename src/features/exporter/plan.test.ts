import { describe, expect, it } from 'vitest'
import { clipAudioSegments, frameCount, musicAutomation, resolutionFor } from './plan'
import type { Slot } from '@/features/renderer/types'

describe('resolutionFor', () => {
  it('비율별 해상도', () => {
    expect(resolutionFor('16:9', '1080p')).toEqual({ width: 1920, height: 1080 })
    expect(resolutionFor('9:16', '1080p')).toEqual({ width: 1080, height: 1920 })
    expect(resolutionFor('1:1', '720p')).toEqual({ width: 720, height: 720 })
  })
})

describe('frameCount', () => {
  it('올림', () => {
    expect(frameCount(10, 30)).toBe(300)
    expect(frameCount(10.01, 30)).toBe(301)
  })
})

describe('clipAudioSegments', () => {
  const base: Slot = {
    id: 's',
    mediaId: 'm',
    mediaAspect: 1,
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    h: 1,
    rotation: 0,
    frame: 'none',
    kenburns: { start: 10, end: 17, zoomFrom: 1, zoomTo: 1, panFrom: [0, 0], panTo: [0, 0] },
    appear: { kind: 'none', t0: 0, duration: 0 },
    inkSeed: 1,
    clip: { start: 1, duration: 3, loop: true, volume: 0.9 },
  }
  it('루프 구간을 창 끝까지 잘라 나열한다', () => {
    const segs = clipAudioSegments(base)
    expect(segs.map((s) => s.when)).toEqual([10, 13, 16])
    expect(segs[2].duration).toBeCloseTo(1)
    expect(segs.every((s) => s.offset === 1 && s.volume === 0.9)).toBe(true)
  })
  it('음소거면 없음', () => {
    expect(clipAudioSegments({ ...base, clip: { ...base.clip!, volume: 0 } })).toEqual([])
  })
  it('루프 아니면 한 구간', () => {
    expect(clipAudioSegments({ ...base, clip: { ...base.clip!, loop: false } })).toHaveLength(1)
  })
})

describe('musicAutomation', () => {
  it('페이드 인/아웃 포인트', () => {
    expect(
      musicAutomation({ end: 30, musicDuration: 60, fadeIn: 2, fadeOut: 4, volume: 0.8 }),
    ).toEqual([
      { t: 0, v: 0 },
      { t: 2, v: 0.8 },
      { t: 26, v: 0.8 },
      { t: 30, v: 0 },
    ])
  })
  it('짧은 음악은 음악 끝 기준', () => {
    const pts = musicAutomation({ end: 30, musicDuration: 10, fadeIn: 2, fadeOut: 4, volume: 1 })
    expect(pts[pts.length - 1].t).toBe(10)
  })
  it('페이드가 길이보다 길면 절반으로 눌러 시간이 역행하지 않는다', () => {
    const pts = musicAutomation({ end: 4, musicDuration: 4, fadeIn: 10, fadeOut: 10, volume: 1 })
    for (let i = 1; i < pts.length; i++) expect(pts[i].t).toBeGreaterThanOrEqual(pts[i - 1].t)
  })
})
