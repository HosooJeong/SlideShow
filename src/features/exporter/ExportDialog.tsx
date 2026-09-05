import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaItem, Project } from '@/features/media/types'
import type { Composition } from '@/features/renderer/types'
import { ExportRenderer, type FrameRenderer } from './ExportRenderer'
import { exportVideo, type ExportProgress } from './exportVideo'
import { resolutionFor, type ExportPreset } from './plan'

type Props = {
  project: Project
  composition: Composition
  items: MediaItem[]
  onClose: () => void
}

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; progress: ExportProgress }
  | { kind: 'done'; url: string; filename: string; size: number; notes: string[] }
  | { kind: 'error'; message: string }

const FPS = 30

export function ExportDialog({ project, composition, items, onClose }: Props) {
  const [preset, setPreset] = useState<ExportPreset>('1080p')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [mounted, setMounted] = useState(false)
  const rendererRef = useRef<FrameRenderer | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const { width, height } = resolutionFor(project.aspect, preset)
  const supported = typeof VideoEncoder !== 'undefined'

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (status.kind === 'done') URL.revokeObjectURL(status.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onReady = useCallback((r: FrameRenderer) => {
    rendererRef.current = r
  }, [])

  const start = async () => {
    setMounted(true)
    setStatus({
      kind: 'running',
      progress: { phase: 'prepare', frame: 0, totalFrames: 0, notes: [] },
    })
    // 렌더러가 준비될 때까지 대기(텍스처 로드)
    const started = performance.now()
    while (!rendererRef.current) {
      if (performance.now() - started > 30000) {
        setStatus({ kind: 'error', message: '내보내기 렌더러를 준비하지 못했어요' })
        return
      }
      await new Promise((r) => setTimeout(r, 50))
    }
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await exportVideo({
        composition,
        items,
        music: project.music,
        renderer: rendererRef.current,
        width,
        height,
        fps: FPS,
        signal: controller.signal,
        onProgress: (progress) => setStatus({ kind: 'running', progress }),
      })
      const filename = `${(project.title || 'slideshow').replace(/[\\/:*?"<>|]+/g, '_')}.${result.ext}`
      setStatus({
        kind: 'done',
        url: URL.createObjectURL(result.blob),
        filename,
        size: result.blob.size,
        notes: result.notes,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') setStatus({ kind: 'idle' })
      else setStatus({ kind: 'error', message: e instanceof Error ? e.message : '알 수 없는 오류' })
    } finally {
      setMounted(false)
      rendererRef.current = null
    }
  }

  const pct =
    status.kind === 'running' && status.progress.totalFrames > 0
      ? Math.round((status.progress.frame / status.progress.totalFrames) * 100)
      : 0
  const phaseLabel: Record<ExportProgress['phase'], string> = {
    prepare: '준비 중 (폰트·텍스처)',
    audio: '오디오 믹스 중',
    video: '프레임 인코딩 중',
    finalize: '파일 마무리 중',
    done: '완료',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal
      data-testid="export-dialog"
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-950 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">영상 내보내기</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {!supported && (
          <p className="mb-3 rounded border border-amber-700/50 bg-amber-900/20 p-3 text-sm text-amber-200">
            이 브라우저는 영상 인코딩(WebCodecs)을 지원하지 않아요. Chrome 또는 Edge에서 열어줘요.
          </p>
        )}

        {status.kind === 'idle' && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              해상도
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as ExportPreset)}
                className="rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-100"
                data-testid="export-preset"
              >
                <option value="1080p">
                  1080p ({resolutionFor(project.aspect, '1080p').width}×
                  {resolutionFor(project.aspect, '1080p').height})
                </option>
                <option value="720p">
                  720p ({resolutionFor(project.aspect, '720p').width}×
                  {resolutionFor(project.aspect, '720p').height})
                </option>
              </select>
            </label>
            <p className="text-xs text-neutral-500">
              {Math.round(composition.duration)}초 · {FPS}fps · MP4(H.264
              {project.music ? ' + AAC' : ''}). 인코딩 동안 이 탭을 그대로 두어줘요. 길이의 1~3배
              시간이 걸려요.
            </p>
            <button
              type="button"
              onClick={start}
              disabled={!supported}
              className="rounded-lg bg-amber-300 px-4 py-2 font-medium text-neutral-950 hover:bg-amber-200 disabled:opacity-50"
              data-testid="export-start"
            >
              내보내기 시작
            </button>
          </div>
        )}

        {status.kind === 'running' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span>{phaseLabel[status.progress.phase]}</span>
              <span
                className="font-mono tabular-nums text-neutral-400"
                data-testid="export-progress"
              >
                {status.progress.totalFrames > 0
                  ? `${status.progress.frame}/${status.progress.totalFrames} · ${pct}%`
                  : ''}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-neutral-800">
              <div className="h-full bg-amber-300 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="self-end rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              취소
            </button>
          </div>
        )}

        {status.kind === 'done' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">완료! {(status.size / (1024 * 1024)).toFixed(1)} MB</p>
            {status.notes.map((n, i) => (
              <p key={i} className="text-xs text-amber-200">
                {n}
              </p>
            ))}
            <a
              href={status.url}
              download={status.filename}
              className="rounded-lg bg-amber-300 px-4 py-2 text-center font-medium text-neutral-950 hover:bg-amber-200"
              data-testid="export-download"
            >
              {status.filename} 저장
            </a>
            <button
              type="button"
              onClick={() => setStatus({ kind: 'idle' })}
              className="text-sm text-neutral-400 hover:text-white"
            >
              다시 내보내기
            </button>
          </div>
        )}

        {status.kind === 'error' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-red-300" data-testid="export-error">
              {status.message}
            </p>
            <button
              type="button"
              onClick={() => setStatus({ kind: 'idle' })}
              className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              돌아가기
            </button>
          </div>
        )}
      </div>

      {mounted && (
        <ExportRenderer
          composition={composition}
          items={items}
          width={width}
          height={height}
          onReady={onReady}
        />
      )}
    </div>
  )
}
