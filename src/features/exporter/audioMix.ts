import { getBlob } from '@/features/media/db'
import type { MediaItem, ProjectMusic } from '@/features/media/types'
import type { Composition } from '@/features/renderer/types'
import { clipAudioSegments, musicAutomation } from './plan'

export const AUDIO_SAMPLE_RATE = 48000

/**
 * 배경 음악 + 클립 원음을 OfflineAudioContext로 믹스해 영상 길이의 스테레오 버퍼를 만든다.
 * 오디오가 전혀 없으면 null.
 */
export async function mixAudio(opts: {
  composition: Composition
  items: MediaItem[]
  music: ProjectMusic | undefined
  onWarn?: (msg: string) => void
}): Promise<AudioBuffer | null> {
  const { composition, items, music, onWarn } = opts
  const duration = composition.duration
  const length = Math.ceil(duration * AUDIO_SAMPLE_RATE)
  if (length <= 0) return null
  const ctx = new OfflineAudioContext(2, length, AUDIO_SAMPLE_RATE)
  let scheduled = 0

  if (music && music.duration > 0) {
    const blob = await getBlob(music.blobKey)
    if (blob) {
      try {
        const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        const pts = musicAutomation({
          end: duration,
          musicDuration: buffer.duration,
          fadeIn: music.fadeIn,
          fadeOut: music.fadeOut,
          volume: music.volume,
        })
        gain.gain.setValueAtTime(0, 0)
        for (const p of pts) gain.gain.linearRampToValueAtTime(p.v, p.t)
        src.connect(gain).connect(ctx.destination)
        src.start(0, 0, Math.min(buffer.duration, duration))
        scheduled++
      } catch {
        onWarn?.('배경 음악을 디코드할 수 없어 소리 없이 내보내요')
      }
    }
  }

  const byId = new Map(items.map((m) => [m.id, m]))
  const decoded = new Map<string, AudioBuffer | null>()
  for (const slot of composition.slots) {
    const segs = clipAudioSegments(slot)
    if (segs.length === 0) continue
    const item = byId.get(slot.mediaId)
    if (!item) continue
    if (!decoded.has(item.id)) {
      const blob = await getBlob(item.blobKey)
      let buf: AudioBuffer | null = null
      if (blob) {
        try {
          buf = await ctx.decodeAudioData(await blob.arrayBuffer())
        } catch {
          onWarn?.(`${item.name}의 소리를 읽을 수 없어 음소거로 내보내요`)
        }
      }
      decoded.set(item.id, buf)
    }
    const buf = decoded.get(item.id)
    if (!buf) continue
    for (const seg of segs) {
      const src = ctx.createBufferSource()
      src.buffer = buf
      const gain = ctx.createGain()
      const edge = Math.min(0.03, seg.duration / 4)
      gain.gain.setValueAtTime(0, seg.when)
      gain.gain.linearRampToValueAtTime(seg.volume, seg.when + edge)
      gain.gain.setValueAtTime(seg.volume, seg.when + seg.duration - edge)
      gain.gain.linearRampToValueAtTime(0, seg.when + seg.duration)
      src.connect(gain).connect(ctx.destination)
      src.start(seg.when, Math.min(seg.offset, Math.max(0, buf.duration - 0.01)), seg.duration)
      scheduled++
    }
  }

  if (scheduled === 0) return null
  return ctx.startRendering()
}
