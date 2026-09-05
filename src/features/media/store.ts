import { create } from 'zustand'
import { deleteMedia, getBlob, getMediaByProject, putBlob, putMedia, putMediaBatch } from './db'
import { moveItem, normalizeOrder } from './fit'
import { ingestFile, UnsupportedFileError } from './ingest'
import type { MediaItem } from './types'

export type IngestJob = {
  id: string
  name: string
  status: 'pending' | 'processing' | 'done' | 'error'
  error?: string
}

type MediaState = {
  projectId: string | null
  items: MediaItem[]
  /** id → 썸네일 object URL */
  thumbUrls: Record<string, string>
  jobs: IngestJob[]
  status: 'idle' | 'loading' | 'ready'

  load: (projectId: string) => Promise<void>
  addFiles: (files: Iterable<File>) => Promise<void>
  remove: (id: string) => Promise<void>
  reorder: (fromId: string, toId: string) => Promise<void>
  clearFinishedJobs: () => void
}

const CONCURRENCY = 2

export const useMediaStore = create<MediaState>((set, get) => ({
  projectId: null,
  items: [],
  thumbUrls: {},
  jobs: [],
  status: 'idle',

  async load(projectId) {
    set({ status: 'loading', projectId })
    const items = await getMediaByProject(projectId)
    const thumbUrls: Record<string, string> = {}
    await Promise.all(
      items.map(async (item) => {
        const blob = await getBlob(item.thumbKey)
        if (blob) thumbUrls[item.id] = URL.createObjectURL(blob)
      }),
    )
    // 이전 프로젝트의 URL 정리
    Object.values(get().thumbUrls).forEach(URL.revokeObjectURL)
    set({ items, thumbUrls, status: 'ready' })
  },

  async addFiles(files) {
    const { projectId } = get()
    if (!projectId) throw new Error('프로젝트가 아직 준비되지 않았어요')

    const list = Array.from(files)
    const jobs: IngestJob[] = list.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      status: 'pending',
    }))
    set((s) => ({ jobs: [...s.jobs, ...jobs] }))

    const setJob = (id: string, patch: Partial<IngestJob>) =>
      set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }))

    // 선택한 순서를 유지하기 위해 order를 미리 배정한다. 완료 순서는 동시 처리 때문에 뒤섞일 수 있다.
    const baseOrder = get().items.length
    let cursor = 0
    const worker = async () => {
      while (cursor < list.length) {
        const i = cursor++
        const file = list[i]
        const job = jobs[i]
        setJob(job.id, { status: 'processing' })
        try {
          const { item, displayBlob, thumbBlob } = await ingestFile(file)
          await Promise.all([putBlob(item.blobKey, displayBlob), putBlob(item.thumbKey, thumbBlob)])
          const full: MediaItem = { ...item, projectId, order: baseOrder + i }
          await putMedia(full)
          set((s) => ({
            items: [...s.items, full].sort((a, b) => a.order - b.order),
            thumbUrls: { ...s.thumbUrls, [full.id]: URL.createObjectURL(thumbBlob) },
          }))
          setJob(job.id, { status: 'done' })
        } catch (err) {
          const message =
            err instanceof UnsupportedFileError
              ? '지원하지 않는 형식'
              : err instanceof Error
                ? err.message
                : '알 수 없는 오류'
          setJob(job.id, { status: 'error', error: message })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker))

    // 실패한 파일이 남긴 order 구멍을 메운다.
    const { items } = get()
    const normalized = normalizeOrder(items)
    if (normalized.some((m, i) => m !== items[i])) {
      set({ items: normalized })
      await putMediaBatch(normalized.filter((m, i) => m !== items[i]))
    }
  },

  async remove(id) {
    const { items, thumbUrls } = get()
    const target = items.find((m) => m.id === id)
    if (!target) return
    const before = new Map(items.map((m) => [m.id, m.order]))
    const rest = normalizeOrder(items.filter((m) => m.id !== id))
    const { [id]: removedUrl, ...restUrls } = thumbUrls
    if (removedUrl) URL.revokeObjectURL(removedUrl)
    set({ items: rest, thumbUrls: restUrls })
    await deleteMedia(target)
    await putMediaBatch(rest.filter((m) => before.get(m.id) !== m.order))
  },

  async reorder(fromId, toId) {
    const { items } = get()
    const from = items.findIndex((m) => m.id === fromId)
    const to = items.findIndex((m) => m.id === toId)
    if (from < 0 || to < 0 || from === to) return
    const before = new Map(items.map((m) => [m.id, m.order]))
    const next = normalizeOrder(moveItem(items, from, to))
    set({ items: next })
    await putMediaBatch(next.filter((m) => before.get(m.id) !== m.order))
  },

  clearFinishedJobs() {
    set((s) => ({
      jobs: s.jobs.filter((j) => j.status === 'pending' || j.status === 'processing'),
    }))
  },
}))
