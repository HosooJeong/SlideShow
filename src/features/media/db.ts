import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { MediaItem, Project } from './types'

interface SlideshowDB extends DBSchema {
  projects: { key: string; value: Project }
  media: {
    key: string
    value: MediaItem
    indexes: { byProject: string }
  }
  blobs: { key: string; value: Blob }
}

const DB_NAME = 'slideshow'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<SlideshowDB>> | null = null

export function getDB() {
  dbPromise ??= openDB<SlideshowDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('projects', { keyPath: 'id' })
      const media = db.createObjectStore('media', { keyPath: 'id' })
      media.createIndex('byProject', 'projectId')
      db.createObjectStore('blobs')
    },
  })
  return dbPromise
}

/** 테스트용: 연결 캐시를 버린다. */
export function resetDBForTests() {
  dbPromise = null
}

// ---- projects ----

export async function getAllProjects() {
  return (await getDB()).getAll('projects')
}

export async function putProject(project: Project) {
  await (await getDB()).put('projects', project)
}

// ---- media ----

export async function getMediaByProject(projectId: string) {
  const items = await (await getDB()).getAllFromIndex('media', 'byProject', projectId)
  return items.sort((a, b) => a.order - b.order)
}

export async function putMedia(item: MediaItem) {
  await (await getDB()).put('media', item)
}

export async function putMediaBatch(items: MediaItem[]) {
  const db = await getDB()
  const tx = db.transaction('media', 'readwrite')
  await Promise.all([...items.map((m) => tx.store.put(m)), tx.done])
}

/** 미디어와 그에 딸린 Blob을 함께 지운다. */
export async function deleteMedia(item: MediaItem) {
  const db = await getDB()
  const tx = db.transaction(['media', 'blobs'], 'readwrite')
  await Promise.all([
    tx.objectStore('media').delete(item.id),
    tx.objectStore('blobs').delete(item.blobKey),
    tx.objectStore('blobs').delete(item.thumbKey),
    tx.done,
  ])
}

// ---- blobs ----

export async function putBlob(key: string, blob: Blob) {
  await (await getDB()).put('blobs', blob, key)
}

export async function getBlob(key: string) {
  return (await getDB()).get('blobs', key)
}
