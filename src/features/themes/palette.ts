import type { Project } from '@/features/media/types'

/** 테마별 밝은 파스텔 팔레트. 배경 그라데이션, 장식(스티커·테이프·컨페티), 종이색 */
export type Palette = {
  /** 콜라주 배경 그라데이션(위→아래) */
  background: [string, string]
  /** 컨페티·스티커 색 */
  accents: string[]
  /** 마스킹테이프 색 */
  tapes: string[]
  /** 사진 흰 테두리 */
  frame: string
  /** 신문 종이색(밝게) */
  paper: string
  /** 스트림 무대 배경·먼지 */
  stream: { background: string; dust: string[] }
}

export const PALETTES: Record<Project['theme'], Palette> = {
  doljanchi: {
    background: ['#fff4e8', '#e8f4ff'],
    accents: ['#ffb3c6', '#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff', '#fdffb6', '#ffafcc'],
    tapes: ['#ffc8dd', '#a0e7e5', '#fbe7a1', '#cdb4db'],
    frame: '#ffffff',
    paper: '#f8f1e6',
    stream: { background: '#1c1733', dust: ['#ffd6e7', '#fff1b8', '#c7f9ff', '#e2d6ff'] },
  },
  birthday: {
    background: ['#fff0f6', '#fff8d6'],
    accents: ['#ff8fab', '#ffd166', '#06d6a0', '#4cc9f0', '#b388eb', '#ff9f1c'],
    tapes: ['#ffb3d9', '#ffe08a', '#a3e4d7', '#c8b6ff'],
    frame: '#ffffff',
    paper: '#fbf4ea',
    stream: { background: '#1a1a2e', dust: ['#ffd166', '#ff8fab', '#4cc9f0', '#b388eb'] },
  },
  wedding: {
    background: ['#fbf7f2', '#f1ece6'],
    accents: ['#e8c1c5', '#d4b483', '#c9d6c2', '#f3e9dc', '#b5c7d3'],
    tapes: ['#efd9d1', '#e6dcc3', '#d3dfd8'],
    frame: '#fffaf5',
    paper: '#f7f1e8',
    stream: { background: '#171417', dust: ['#f3e9dc', '#e8c1c5', '#d4b483'] },
  },
  travel: {
    background: ['#eaf6ff', '#fff6e0'],
    accents: ['#48bfe3', '#ffca3a', '#8ac926', '#ff924c', '#6a4c93'],
    tapes: ['#bde0fe', '#ffe066', '#c6f1d6'],
    frame: '#ffffff',
    paper: '#f4efe4',
    stream: { background: '#101820', dust: ['#ffca3a', '#48bfe3', '#ffffff'] },
  },
}

export function paletteFor(theme: Project['theme'] | undefined): Palette {
  return PALETTES[theme ?? 'doljanchi']
}

/** 진행 속도 배율. 머무름·교체 간격에 곱한다 */
export const PACE_SCALE: Record<'slow' | 'normal' | 'fast', number> = {
  slow: 1.35,
  normal: 1,
  fast: 0.75,
}
