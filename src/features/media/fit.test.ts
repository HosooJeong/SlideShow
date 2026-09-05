import { describe, expect, it } from 'vitest'
import { classifyFile, fitWithin, formatDuration, isHeic, moveItem, normalizeOrder } from './fit'

describe('fitWithin', () => {
  it('작은 이미지는 확대하지 않는다', () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 })
  })
  it('가로가 긴 이미지를 비율 유지하며 줄인다', () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 })
  })
  it('세로가 긴 이미지를 비율 유지하며 줄인다', () => {
    expect(fitWithin(3000, 4000, 320)).toEqual({ width: 240, height: 320 })
  })
})

describe('normalizeOrder', () => {
  it('구멍 난 order를 0부터 연속으로 만든다', () => {
    const out = normalizeOrder([{ order: 3 }, { order: 7 }, { order: 8 }])
    expect(out.map((o) => o.order)).toEqual([0, 1, 2])
  })
  it('이미 맞는 항목은 같은 객체를 유지한다', () => {
    const a = { order: 0 }
    expect(normalizeOrder([a, { order: 5 }])[0]).toBe(a)
  })
})

describe('moveItem', () => {
  it('앞에서 뒤로 옮긴다', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })
  it('뒤에서 앞으로 옮긴다', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })
  it('범위를 벗어나면 복사본을 그대로 돌려준다', () => {
    const src = ['a', 'b']
    const out = moveItem(src, 0, 5)
    expect(out).toEqual(src)
    expect(out).not.toBe(src)
  })
})

describe('classifyFile', () => {
  it('MIME 타입으로 판별한다', () => {
    expect(classifyFile({ type: 'image/jpeg', name: 'x' })).toBe('image')
    expect(classifyFile({ type: 'video/mp4', name: 'x' })).toBe('video')
  })
  it('MIME이 비어 있으면 확장자로 판별한다', () => {
    expect(classifyFile({ type: '', name: 'IMG_0001.HEIC' })).toBe('image')
    expect(classifyFile({ type: '', name: 'clip.MOV' })).toBe('video')
  })
  it('모르는 파일은 null', () => {
    expect(classifyFile({ type: 'application/pdf', name: 'a.pdf' })).toBeNull()
  })
})

describe('isHeic', () => {
  it('타입 또는 확장자로 HEIC를 감지한다', () => {
    expect(isHeic({ type: 'image/heic', name: 'a' })).toBe(true)
    expect(isHeic({ type: '', name: 'a.heif' })).toBe(true)
    expect(isHeic({ type: 'image/jpeg', name: 'a.jpg' })).toBe(false)
  })
})

describe('formatDuration', () => {
  it('m:ss 형식', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(4.4)).toBe('0:04')
  })
})
