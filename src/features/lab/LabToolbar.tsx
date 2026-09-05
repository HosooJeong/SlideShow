import { useLabClock } from './labClock'

export function LabToolbar() {
  const { t, playing, speed, range, seek, setPlaying, setSpeed, reset } = useLabClock()
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 border-t border-neutral-800 bg-neutral-950/85 px-3 py-2 text-sm backdrop-blur">
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        className="w-16 rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700"
        data-testid="lab-play"
      >
        {playing ? '정지' : '재생'}
      </button>
      <button
        type="button"
        onClick={reset}
        className="rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700"
      >
        ⟲
      </button>
      <input
        type="range"
        min={0}
        max={range}
        step={0.01}
        value={t}
        onChange={(e) => seek(Number(e.target.value))}
        className="flex-1 accent-amber-300"
        aria-label="시간 스크럽"
        data-testid="lab-time"
      />
      <span className="w-16 text-right font-mono tabular-nums text-neutral-300">
        {t.toFixed(2)}s
      </span>
      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className="rounded bg-neutral-800 px-1 py-1"
        aria-label="재생 속도"
      >
        {[0.25, 0.5, 1, 2].map((v) => (
          <option key={v} value={v}>
            {v}×
          </option>
        ))}
      </select>
    </div>
  )
}
