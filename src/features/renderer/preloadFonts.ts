import { preloadFont } from 'troika-three-text'
import { FONTS } from './fonts'
import type { Composition } from './types'

const loaded = new Set<string>()

/** 컴포지션에 등장하는 글자들의 SDF 글리프를 미리 만들어 첫 렌더 지연을 줄인다 */
export function preloadCompositionFonts(composition: Composition) {
  const byWeight: Record<'regular' | 'bold' | 'pen', Set<string>> = {
    regular: new Set(),
    bold: new Set(),
    pen: new Set(),
  }
  if (composition.stage.kind === 'newspaper') {
    for (const page of composition.stage.pages) {
      for (const tb of page.texts) for (const ch of tb.text) byWeight[tb.weight].add(ch)
    }
  }
  if (composition.stage.kind === 'album') {
    for (const tb of composition.stage.texts) for (const ch of tb.text) byWeight[tb.weight].add(ch)
    if (composition.stage.cover.title)
      for (const ch of composition.stage.cover.title) byWeight.bold.add(ch)
  }
  for (const ht of composition.pen?.texts ?? []) for (const ch of ht.text) byWeight.pen.add(ch)
  const jobs: Promise<void>[] = []
  for (const weight of ['regular', 'bold', 'pen'] as const) {
    const chars = [...byWeight[weight]].join('')
    const key = `${weight}:${chars}`
    if (!chars || loaded.has(key)) continue
    loaded.add(key)
    jobs.push(
      new Promise((resolve) =>
        preloadFont({ font: FONTS[weight], characters: chars }, () => resolve()),
      ),
    )
  }
  return Promise.all(jobs).then(() => undefined)
}
