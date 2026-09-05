import { usePlayerStore } from './playerStore'
import { formatDuration } from '@/features/media/fit'

export function PlayerControls({
  onShuffle,
  onFullscreen,
  halftone,
  onHalftone,
  stageKind,
  onStageKind,
  music,
}: {
  onShuffle: () => void
  onFullscreen: () => void
  halftone: boolean
  onHalftone: (v: boolean) => void
  stageKind: 'newspaper' | 'paper'
  onStageKind: (v: 'newspaper' | 'paper') => void
  music: { name: string; muted: boolean; onMuted: (v: boolean) => void } | null
}) {
  const { t, duration, playing, toggle, seek } = usePlayerStore()
  return (
    <div className="flex flex-col gap-2" data-testid="player-controls">
      <input
        type="range"
        min={0}
        max={Math.max(0.01, duration)}
        step={0.01}
        value={t}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="재생 위치"
        data-testid="player-seek"
        className="w-full accent-amber-300"
      />
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={toggle}
          className="w-20 rounded bg-amber-300 px-3 py-1.5 font-medium text-neutral-950 hover:bg-amber-200"
          data-testid="player-toggle"
        >
          {playing ? '일시정지' : '재생'}
        </button>
        <span className="font-mono tabular-nums text-neutral-300" data-testid="player-time">
          {formatDuration(t)} / {formatDuration(duration)}
        </span>
        {music && (
          <button
            type="button"
            onClick={() => music.onMuted(!music.muted)}
            className="max-w-48 truncate rounded bg-neutral-800 px-2.5 py-1.5 text-neutral-300 hover:bg-neutral-700"
            title={music.name}
            data-testid="player-mute"
          >
            {music.muted ? '🔇' : '♪'} {music.name}
          </button>
        )}
        <span className="flex-1" />
        <select
          value={stageKind}
          onChange={(e) => onStageKind(e.target.value as 'newspaper' | 'paper')}
          className="rounded bg-neutral-800 px-2 py-1.5 text-neutral-200"
          aria-label="무대"
          data-testid="player-stage-kind"
        >
          <option value="newspaper">마법 신문</option>
          <option value="paper">종이 위 사진</option>
        </select>
        <label className="flex items-center gap-1.5 text-neutral-400">
          <input
            type="checkbox"
            checked={halftone}
            onChange={(e) => onHalftone(e.target.checked)}
          />
          인쇄 룩
        </label>
        <button
          type="button"
          onClick={onShuffle}
          className="rounded bg-neutral-800 px-3 py-1.5 hover:bg-neutral-700"
          data-testid="player-shuffle"
        >
          다시 섞기
        </button>
        <button
          type="button"
          onClick={onFullscreen}
          className="rounded bg-neutral-800 px-3 py-1.5 hover:bg-neutral-700"
        >
          전체화면
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Space 재생/정지 · ←/→ 5초 이동 · Home 처음으로 · F 전체화면
      </p>
    </div>
  )
}
