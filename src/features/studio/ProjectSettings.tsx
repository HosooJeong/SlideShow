import { useRef, useState } from 'react'
import { ingestMusic, isAudioFile } from '@/features/audio/musicIngest'
import { formatDuration } from '@/features/media/fit'
import type { Project } from '@/features/media/types'

type Props = {
  project: Project
  onChange: (patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => void
}

/** 프로젝트 설정: 제목·아이 이름·날짜·비율·음악 */
export function ProjectSettings({ project, onChange }: Props) {
  const musicInput = useRef<HTMLInputElement>(null)
  const [musicError, setMusicError] = useState<string | null>(null)
  const [musicBusy, setMusicBusy] = useState(false)

  const onMusicFile = async (file: File | undefined) => {
    if (!file) return
    setMusicError(null)
    if (!isAudioFile(file)) {
      setMusicError('음악 파일(mp3, m4a, wav)만 올릴 수 있어요')
      return
    }
    setMusicBusy(true)
    try {
      const music = await ingestMusic(file)
      onChange({ music })
    } catch (e) {
      setMusicError(e instanceof Error ? e.message : '음악을 읽을 수 없어요')
    } finally {
      setMusicBusy(false)
    }
  }

  const field =
    'rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-100 focus:border-amber-300 focus:outline-none'
  const label = 'flex flex-col gap-1 text-xs text-neutral-400'

  return (
    <section
      className="grid gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 md:grid-cols-[1fr_1fr]"
      data-testid="project-settings"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          영상 제목
          <input
            className={field}
            value={project.title}
            onChange={(e) => onChange({ title: e.target.value })}
            data-testid="set-title"
          />
        </label>
        <label className={label}>
          아이 이름 (신문 제호·헤드라인에 들어가요)
          <input
            className={field}
            value={project.subjectName ?? ''}
            placeholder="예: 하늘"
            onChange={(e) => onChange({ subjectName: e.target.value })}
            data-testid="set-name"
          />
        </label>
        <label className={label}>
          기념일
          <input
            type="date"
            className={field}
            value={project.date ?? ''}
            onChange={(e) => onChange({ date: e.target.value || undefined })}
            data-testid="set-date"
          />
        </label>
        <label className={label}>
          영상 클립 소리
          <select
            className={field}
            value={project.clips?.audio ?? 'mute'}
            onChange={(e) =>
              onChange({
                clips: {
                  maxSeconds: project.clips?.maxSeconds ?? 4,
                  audio: e.target.value as 'mute' | 'original',
                },
              })
            }
            data-testid="set-clip-audio"
          >
            <option value="mute">음소거 (배경 음악만)</option>
            <option value="original">원음 재생</option>
          </select>
        </label>
        <label className={label}>
          클립당 최대 길이 (초)
          <input
            type="number"
            min={1}
            max={15}
            step={0.5}
            className={field}
            value={project.clips?.maxSeconds ?? 4}
            onChange={(e) =>
              onChange({
                clips: {
                  audio: project.clips?.audio ?? 'mute',
                  maxSeconds: Math.max(1, Math.min(15, Number(e.target.value) || 4)),
                },
              })
            }
            data-testid="set-clip-seconds"
          />
        </label>
        <label className={label}>
          화면 비율
          <select
            className={field}
            value={project.aspect}
            onChange={(e) => onChange({ aspect: e.target.value as Project['aspect'] })}
            data-testid="set-aspect"
          >
            <option value="16:9">16:9 (TV·빔프로젠터)</option>
            <option value="9:16">9:16 (세로)</option>
            <option value="1:1">1:1</option>
          </select>
        </label>
        <label className={label}>
          테마(색감·장식)
          <select
            className={field}
            value={project.theme}
            onChange={(e) => onChange({ theme: e.target.value as Project['theme'] })}
            data-testid="set-theme"
          >
            <option value="doljanchi">돌잔치 (파스텔)</option>
            <option value="birthday">생일 (비비드)</option>
            <option value="wedding">결혼 (차분한 톤)</option>
            <option value="travel">여행 (하늘·노랑)</option>
          </select>
        </label>
        <label className={label}>
          진행 속도
          <select
            className={field}
            value={project.pace ?? 'normal'}
            onChange={(e) => onChange({ pace: e.target.value as NonNullable<Project['pace']> })}
            data-testid="set-pace"
          >
            <option value="slow">느리게 (여유롭게)</option>
            <option value="normal">보통</option>
            <option value="fast">빠르게</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-neutral-400">배경 음악</span>
        {project.music ? (
          <div className="flex flex-col gap-2 rounded border border-neutral-700 bg-neutral-900 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate" data-testid="music-name">
                ♪ {project.music.name}
              </span>
              <span className="shrink-0 font-mono text-xs text-neutral-400">
                {formatDuration(project.music.duration)}
              </span>
            </div>
            <label className="flex items-center gap-2 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={project.music.fitDuration}
                onChange={(e) =>
                  onChange({ music: { ...project.music!, fitDuration: e.target.checked } })
                }
                data-testid="music-fit"
              />
              영상 길이를 음악에 맞추기
            </label>
            {project.music.beats && project.music.beats.bpm > 0 && (
              <label className="flex items-center gap-2 text-xs text-neutral-400">
                <input
                  type="checkbox"
                  checked={project.music.syncBeats ?? false}
                  onChange={(e) =>
                    onChange({ music: { ...project.music!, syncBeats: e.target.checked } })
                  }
                  data-testid="music-sync-beats"
                />
                컷을 비트에 맞추기{' '}
                <span className="font-mono">
                  ({Math.round(project.music.beats.bpm)} BPM
                  {project.music.beats.confidence < 0.15 ? ' · 신뢰도 낮음' : ''})
                </span>
              </label>
            )}
            <label className="flex items-center gap-2 text-xs text-neutral-400">
              볼륨
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={project.music.volume}
                onChange={(e) =>
                  onChange({ music: { ...project.music!, volume: Number(e.target.value) } })
                }
                className="flex-1 accent-amber-300"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => musicInput.current?.click()}
                className="rounded bg-neutral-800 px-2.5 py-1 text-xs hover:bg-neutral-700"
              >
                바꾸기
              </button>
              <button
                type="button"
                onClick={() => onChange({ music: undefined })}
                className="rounded bg-neutral-800 px-2.5 py-1 text-xs hover:bg-red-700"
                data-testid="music-remove"
              >
                제거
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => musicInput.current?.click()}
            disabled={musicBusy}
            className="rounded border border-dashed border-neutral-700 px-3 py-4 text-sm text-neutral-300 hover:border-neutral-500 disabled:opacity-50"
            data-testid="music-add"
          >
            {musicBusy ? '읽는 중…' : '음악 파일 추가 (mp3 · m4a · wav)'}
          </button>
        )}
        {musicError && <p className="text-xs text-red-400">{musicError}</p>}
        <p className="text-xs text-neutral-500">
          내장 곡은 아직 없어요. 사용 권한이 있는 음악을 올려줘요.
        </p>
        <input
          ref={musicInput}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav"
          className="hidden"
          data-testid="music-input"
          onChange={(e) => {
            void onMusicFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </section>
  )
}
