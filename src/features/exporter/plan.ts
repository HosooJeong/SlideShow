import type { Composition, Slot } from '@/features/renderer/types'

export type ExportPreset = '1080p' | '720p'

export function resolutionFor(aspect: '16:9' | '9:16' | '1:1', preset: ExportPreset) {
  const long = preset === '1080p' ? 1920 : 1280
  const short = preset === '1080p' ? 1080 : 720
  if (aspect === '9:16') return { width: short, height: long }
  if (aspect === '1:1') return { width: short, height: short }
  return { width: long, height: short }
}

/** 전체 프레임 수. 마지막 프레임까지 포함 */
export function frameCount(duration: number, fps: number) {
  return Math.max(1, Math.ceil(duration * fps))
}

export type ClipSegment = { when: number; offset: number; duration: number; volume: number }

/**
 * 클립 원음이 들릴 구간들(영상 시간 기준). 켄번즈 창 안에서 clip.duration마다 반복되는 루프를 그대로 따른다.
 */
export function clipAudioSegments(slot: Slot): ClipSegment[] {
  const clip = slot.clip
  if (!clip || clip.volume <= 0) return []
  const { start, end } = slot.kenburns
  const out: ClipSegment[] = []
  if (!clip.loop) {
    out.push({
      when: start,
      offset: clip.start,
      duration: Math.min(clip.duration, end - start),
      volume: clip.volume,
    })
    return out
  }
  for (let when = start; when < end - 0.01; when += clip.duration) {
    out.push({
      when,
      offset: clip.start,
      duration: Math.min(clip.duration, end - when),
      volume: clip.volume,
    })
  }
  return out
}

/** 음악 게인 자동화 포인트(시간, 값). OfflineAudioContext의 AudioParam에 그대로 얹는다 */
export function musicAutomation(opts: {
  end: number
  musicDuration: number
  fadeIn: number
  fadeOut: number
  volume: number
}): { t: number; v: number }[] {
  const stop = Math.min(opts.end, opts.musicDuration)
  if (stop <= 0) return []
  const fi = Math.min(opts.fadeIn, stop / 2)
  const fo = Math.min(opts.fadeOut, stop / 2)
  const pts = [
    { t: 0, v: 0 },
    { t: fi, v: opts.volume },
    { t: stop - fo, v: opts.volume },
    { t: stop, v: 0 },
  ]
  // 단조 증가 시간 보장
  return pts.filter((p, i) => i === 0 || p.t >= pts[i - 1].t)
}

export function hasAudio(composition: Composition, music: { duration: number } | undefined) {
  if (music && music.duration > 0) return true
  return composition.slots.some((s) => s.clip && s.clip.volume > 0)
}
