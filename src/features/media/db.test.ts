import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
  deleteMedia,
  getBlob,
  getMediaByProject,
  putBlob,
  putMedia,
  putMediaBatch,
  resetDBForTests,
} from './db'
import type { MediaItem } from './types'

function item(id: string, order: number, projectId = 'p1'): MediaItem {
  return {
    id,
    projectId,
    kind: 'image',
    name: `${id}.jpg`,
    mimeType: 'image/webp',
    blobKey: `${id}/display`,
    thumbKey: `${id}/thumb`,
    width: 100,
    height: 100,
    size: 10,
    order,
    createdAt: 0,
  }
}

describe('media db', () => {
  beforeEach(() => {
    indexedDB = new IDBFactory()
    resetDBForTests()
  })

  it('프로젝트별로 order 순서대로 돌려준다', async () => {
    await putMediaBatch([item('b', 1), item('a', 0), item('z', 0, 'other')])
    const list = await getMediaByProject('p1')
    expect(list.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('삭제하면 미디어와 Blob이 함께 사라진다', async () => {
    const m = item('a', 0)
    await putMedia(m)
    await putBlob(m.blobKey, new Blob(['x']))
    await putBlob(m.thumbKey, new Blob(['y']))
    await deleteMedia(m)
    expect(await getMediaByProject('p1')).toEqual([])
    expect(await getBlob(m.blobKey)).toBeUndefined()
    expect(await getBlob(m.thumbKey)).toBeUndefined()
  })
})
