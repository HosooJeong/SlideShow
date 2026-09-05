import { create } from 'zustand'
import { getAllProjects, putProject } from '@/features/media/db'
import type { Project } from '@/features/media/types'

type ProjectState = {
  current: Project | null
  status: 'idle' | 'loading' | 'ready'
  /** 저장된 프로젝트를 불러오고, 없으면 기본 프로젝트를 만든다. */
  ensure: () => Promise<Project>
  update: (patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => Promise<void>
}

export function createDefaultProject(): Project {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: '우리 아이 첫 돌',
    theme: 'doljanchi',
    aspect: '16:9',
    seed: Math.floor(Math.random() * 2 ** 31),
    createdAt: now,
    updatedAt: now,
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  current: null,
  status: 'idle',

  async ensure() {
    const existing = get().current
    if (existing) return existing
    set({ status: 'loading' })
    const projects = await getAllProjects()
    let project = projects.sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (!project) {
      project = createDefaultProject()
      await putProject(project)
    }
    set({ current: project, status: 'ready' })
    return project
  },

  async update(patch) {
    const current = get().current
    if (!current) return
    const next = { ...current, ...patch, updatedAt: Date.now() }
    set({ current: next })
    await putProject(next)
  },
}))
