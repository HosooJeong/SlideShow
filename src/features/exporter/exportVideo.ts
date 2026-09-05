import type { MediaItem, ProjectMusic } from '@/features/media/types'
import { preloadCompositionFonts } from '@/features/renderer/preloadFonts'
import type { Composition } from '@/features/renderer/types'
import { mixAudio } from './audioMix'
import { bitrateFor, encodeAudioBuffer, Muxing, planEncoders } from './encode'
import type { FrameRenderer } from './ExportRenderer'
import { frameCount, hasAudio } from './plan'

export type ExportProgress = {
  phase: 'prepare' | 'audio' | 'video' | 'finalize' | 'done'
  frame: number
  totalFrames: number
  notes: string[]
}

export type ExportResult = { blob: Blob; ext: string; notes: string[] }

/**
 * 프레임을 t=0부터 순서대로 그려 인코딩하고, 오디오를 믹스해 하나의 파일로 묶는다.
 * 렌더러는 t의 순수 함수이므로 재생과 같은 그림이 나온다.
 */
export async function exportVideo(opts: {
  composition: Composition
  items: MediaItem[]
  music: ProjectMusic | undefined
  renderer: FrameRenderer
  width: number
  height: number
  fps: number
  signal?: AbortSignal
  onProgress: (p: ExportProgress) => void
}): Promise<ExportResult> {
  const { composition, items, music, renderer, width, height, fps, signal, onProgress } = opts
  const total = frameCount(composition.duration, fps)
  const notes: string[] = []
  const report = (phase: ExportProgress['phase'], frame: number) =>
    onProgress({ phase, frame, totalFrames: total, notes: [...notes] })
  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException('내보내기를 취소했어요', 'AbortError')
  }

  report('prepare', 0)
  const wantAudio = hasAudio(composition, music)
  const plan = await planEncoders({ width, height, fps, wantAudio })
  if (!plan)
    throw new Error(
      '이 브라우저는 영상 인코딩(WebCodecs)을 지원하지 않아요. Chrome 또는 Edge에서 열어줘요.',
    )
  notes.push(...plan.notes)

  await preloadCompositionFonts(composition)
  // 워밍업: 각 면의 활자가 처음 보이는 시점을 한 번씩 그려 SDF 글리프를 준비한다
  const warm = new Set<number>([0, Math.min(composition.duration, 2.5)])
  if (composition.stage.kind === 'newspaper') {
    for (const p of composition.stage.pages)
      for (const tb of p.texts)
        warm.add(Math.min(composition.duration, tb.appear.t0 + tb.appear.duration + 0.1))
  }
  for (const t of warm) {
    await renderer.renderAt(t)
    await new Promise((r) => setTimeout(r, 120))
  }
  throwIfAborted()

  // 오디오 믹스(있을 때만)
  let audioBuffer: AudioBuffer | null = null
  if (wantAudio && plan.audioCodec) {
    report('audio', 0)
    audioBuffer = await mixAudio({ composition, items, music, onWarn: (m) => notes.push(m) })
  }
  throwIfAborted()

  const sink = new Muxing(plan, width, height, fps, audioBuffer !== null)

  let encodeError: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => sink.addVideo(chunk, meta),
    error: (e) => {
      encodeError = e instanceof Error ? e : new Error(String(e))
    },
  })
  encoder.configure({
    codec: plan.videoCodec,
    width,
    height,
    bitrate: bitrateFor(width, height),
    framerate: fps,
    latencyMode: 'quality',
    ...(plan.videoCodec.startsWith('avc1') ? { avc: { format: 'avc' as const } } : {}),
  })

  const frameUs = Math.round(1e6 / fps)
  const keyEvery = fps * 2
  try {
    for (let i = 0; i < total; i++) {
      throwIfAborted()
      if (encodeError) throw encodeError
      const t = Math.min(composition.duration, i / fps)
      const canvas = await renderer.renderAt(t)
      const frame = new VideoFrame(canvas, { timestamp: i * frameUs, duration: frameUs })
      encoder.encode(frame, { keyFrame: i % keyEvery === 0 })
      frame.close()
      // 인코더 큐가 밀리면 잠깐 양보
      while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4))
      if (i % 3 === 0) report('video', i + 1)
    }
    report('video', total)
    await encoder.flush()
    encoder.close()

    if (audioBuffer && plan.audioCodec) {
      report('finalize', total)
      await encodeAudioBuffer(audioBuffer, plan.audioCodec, sink)
    }
    report('finalize', total)
    const buffer = sink.finalize()
    report('done', total)
    return { blob: new Blob([buffer], { type: plan.mime }), ext: plan.ext, notes }
  } catch (e) {
    try {
      if (encoder.state !== 'closed') encoder.close()
    } catch {
      /* ignore */
    }
    throw e
  }
}
