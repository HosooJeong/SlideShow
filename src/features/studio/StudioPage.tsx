import { useEffect } from 'react'
import { useProjectStore } from '@/features/project/store'
import { useMediaStore } from '@/features/media/store'
import { Dropzone } from '@/features/media/components/Dropzone'
import { MediaGrid } from '@/features/media/components/MediaGrid'
import { IngestStatus } from '@/features/media/components/IngestStatus'
import { formatBytes } from '@/features/media/fit'

export function StudioPage() {
  const project = useProjectStore((s) => s.current)
  const ensureProject = useProjectStore((s) => s.ensure)
  const { items, thumbUrls, jobs, status, load, addFiles, remove, reorder, clearFinishedJobs } =
    useMediaStore()

  useEffect(() => {
    ensureProject().then((p) => load(p.id))
  }, [ensureProject, load])

  const ready = status === 'ready' && project !== null
  const totalBytes = items.reduce((s, m) => s + m.size, 0)
  const videoCount = items.filter((m) => m.kind === 'video').length

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{project?.title ?? '불러오는 중…'}</h1>
          <p className="text-sm text-neutral-500">
            {items.length > 0
              ? `${items.length}개 (사진 ${items.length - videoCount} · 영상 ${videoCount}) · ${formatBytes(totalBytes)}`
              : '아직 미디어가 없어요. 사진과 영상을 추가해 시작해요.'}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <Dropzone onFiles={addFiles} disabled={!ready} />
      ) : (
        <Dropzone onFiles={addFiles} disabled={!ready} compact />
      )}

      <IngestStatus jobs={jobs} onClear={clearFinishedJobs} />

      {items.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-xs text-neutral-500">
            끌어서 순서를 바꿀 수 있어요. 순서는 영상에서 등장하는 차례가 돼요.
          </p>
          <MediaGrid items={items} thumbUrls={thumbUrls} onReorder={reorder} onRemove={remove} />
        </section>
      )}
    </div>
  )
}
