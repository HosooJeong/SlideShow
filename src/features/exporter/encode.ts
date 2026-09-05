import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from 'mp4-muxer'
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from 'webm-muxer'

export type Container = 'mp4' | 'webm'

export type EncoderPlan = {
  container: Container
  videoCodec: string
  audioCodec: string | null
  mime: string
  ext: string
  notes: string[]
}

/** 지원되는 코덱 조합을 고른다. H.264+AAC(mp4) → H.264+Opus(mp4) → VP9+Opus(webm) */
export async function planEncoders(opts: {
  width: number
  height: number
  fps: number
  wantAudio: boolean
}): Promise<EncoderPlan | null> {
  if (typeof VideoEncoder === 'undefined') return null
  const { width, height, fps, wantAudio } = opts
  const notes: string[] = []
  const tryVideo = async (codec: string) =>
    (
      await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: bitrateFor(width, height),
        framerate: fps,
        ...(codec.startsWith('avc1') ? { avc: { format: 'avc' as const } } : {}),
      })
    ).supported === true
  const tryAudio = async (codec: string) =>
    typeof AudioEncoder !== 'undefined' &&
    (
      await AudioEncoder.isConfigSupported({
        codec,
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 160_000,
      })
    ).supported === true

  const avc = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028']
  let videoCodec: string | null = null
  for (const c of avc)
    if (await tryVideo(c)) {
      videoCodec = c
      break
    }

  if (videoCodec) {
    let audioCodec: string | null = null
    if (wantAudio) {
      if (await tryAudio('mp4a.40.2')) audioCodec = 'mp4a.40.2'
      else if (await tryAudio('opus')) {
        audioCodec = 'opus'
        notes.push(
          '이 브라우저는 AAC 인코딩을 지원하지 않아 Opus로 넣었어요. 일부 TV에서 소리가 안 날 수 있어요.',
        )
      } else notes.push('오디오 인코더를 지원하지 않아 소리 없이 내보내요.')
    }
    return { container: 'mp4', videoCodec, audioCodec, mime: 'video/mp4', ext: 'mp4', notes }
  }

  const vp9 = 'vp09.00.10.08'
  if (await tryVideo(vp9)) {
    notes.push(
      '이 브라우저는 H.264 인코딩을 지원하지 않아 WebM(VP9)으로 내보내요. Chrome/Edge에서 MP4를 만들 수 있어요.',
    )
    let audioCodec: string | null = null
    if (wantAudio) {
      if (await tryAudio('opus')) audioCodec = 'opus'
      else notes.push('오디오 인코더를 지원하지 않아 소리 없이 내보내요.')
    }
    return {
      container: 'webm',
      videoCodec: vp9,
      audioCodec,
      mime: 'video/webm',
      ext: 'webm',
      notes,
    }
  }
  return null
}

export function bitrateFor(width: number, height: number) {
  const px = width * height
  if (px >= 1920 * 1080) return 14_000_000
  if (px >= 1280 * 720) return 8_000_000
  return 5_000_000
}

type VideoMeta = EncodedVideoChunkMetadata | undefined
type AudioMeta = EncodedAudioChunkMetadata | undefined

/** 컨테이너 차이를 숨기는 얇은 래퍼 */
export class Muxing {
  private mp4: Mp4Muxer<Mp4Target> | null = null
  private webm: WebmMuxer<WebmTarget> | null = null

  constructor(plan: EncoderPlan, width: number, height: number, fps: number, audio: boolean) {
    if (plan.container === 'mp4') {
      this.mp4 = new Mp4Muxer({
        target: new Mp4Target(),
        video: { codec: 'avc', width, height, frameRate: fps },
        audio:
          audio && plan.audioCodec
            ? {
                codec: plan.audioCodec === 'opus' ? 'opus' : 'aac',
                numberOfChannels: 2,
                sampleRate: 48000,
              }
            : undefined,
        fastStart: 'in-memory',
      })
    } else {
      this.webm = new WebmMuxer({
        target: new WebmTarget(),
        video: { codec: 'V_VP9', width, height, frameRate: fps },
        audio:
          audio && plan.audioCodec
            ? { codec: 'A_OPUS', numberOfChannels: 2, sampleRate: 48000 }
            : undefined,
      })
    }
  }
  addVideo(chunk: EncodedVideoChunk, meta: VideoMeta) {
    this.mp4?.addVideoChunk(chunk, meta)
    this.webm?.addVideoChunk(chunk, meta)
  }
  addAudio(chunk: EncodedAudioChunk, meta: AudioMeta) {
    this.mp4?.addAudioChunk(chunk, meta)
    this.webm?.addAudioChunk(chunk, meta)
  }
  finalize(): ArrayBuffer {
    if (this.mp4) {
      this.mp4.finalize()
      return this.mp4.target.buffer as ArrayBuffer
    }
    this.webm!.finalize()
    return this.webm!.target.buffer as ArrayBuffer
  }
}

/** AudioBuffer를 AudioEncoder에 밀어 넣는다(f32-planar, 4096 프레임씩) */
export async function encodeAudioBuffer(buffer: AudioBuffer, codec: string, sink: Muxing) {
  const encoder = new AudioEncoder({
    output: (chunk, meta) => sink.addAudio(chunk, meta),
    error: (e) => console.error(e),
  })
  encoder.configure({ codec, sampleRate: buffer.sampleRate, numberOfChannels: 2, bitrate: 160_000 })
  const ch0 = buffer.getChannelData(0)
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0
  const CHUNK = 4096
  for (let i = 0; i < buffer.length; i += CHUNK) {
    const n = Math.min(CHUNK, buffer.length - i)
    const data = new Float32Array(n * 2)
    data.set(ch0.subarray(i, i + n), 0)
    data.set(ch1.subarray(i, i + n), n)
    const frame = new AudioData({
      format: 'f32-planar',
      sampleRate: buffer.sampleRate,
      numberOfFrames: n,
      numberOfChannels: 2,
      timestamp: Math.round((i / buffer.sampleRate) * 1e6),
      data,
    })
    encoder.encode(frame)
    frame.close()
    if (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0))
  }
  await encoder.flush()
  encoder.close()
}
