import type { IngestJob } from '../store'

export function IngestStatus({ jobs, onClear }: { jobs: IngestJob[]; onClear: () => void }) {
  if (jobs.length === 0) return null
  const done = jobs.filter((j) => j.status === 'done').length
  const errors = jobs.filter((j) => j.status === 'error')
  const active = jobs.length - done - errors.length

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <span>
          {active > 0 ? `처리 중 ${active}개 · ` : ''}
          완료 {done}/{jobs.length}
          {errors.length > 0 && <span className="text-red-400"> · 실패 {errors.length}</span>}
        </span>
        {active === 0 && (
          <button type="button" onClick={onClear} className="text-neutral-400 hover:text-white">
            닫기
          </button>
        )}
      </div>
      {active > 0 && (
        <div className="h-1 overflow-hidden rounded bg-neutral-800">
          <div
            className="h-full bg-amber-300 transition-all"
            style={{ width: `${((done + errors.length) / jobs.length) * 100}%` }}
          />
        </div>
      )}
      {errors.map((j) => (
        <div key={j.id} className="truncate text-xs text-red-400">
          {j.name}: {j.error}
        </div>
      ))}
    </div>
  )
}
