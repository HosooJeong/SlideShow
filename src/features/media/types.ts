export type MediaKind = 'image' | 'video'

export type MediaItem = {
  id: string
  projectId: string
  kind: MediaKind
  name: string
  mimeType: string
  /** 표시용 원본(이미지는 최대 2048px로 리사이즈, 영상은 원본) Blob 키 */
  blobKey: string
  /** 썸네일(최대 320px) Blob 키 */
  thumbKey: string
  width: number
  height: number
  /** 영상 길이(초). 이미지는 undefined */
  duration?: number
  /** EXIF 촬영 시각(ISO). 없으면 undefined */
  takenAt?: string
  /** 원본 파일 크기(bytes) */
  size: number
  /** 라이브러리 내 순서. 0부터 연속 */
  order: number
  createdAt: number
}

export type Project = {
  id: string
  title: string
  date?: string
  theme: 'doljanchi' | 'birthday' | 'wedding' | 'travel'
  aspect: '16:9' | '9:16' | '1:1'
  seed: number
  /** 신문 문구에 쓰는 주인공 이름 */
  subjectName?: string
  music?: ProjectMusic
  createdAt: number
  updatedAt: number
}

export type ProjectMusic = {
  blobKey: string
  name: string
  /** 초 */
  duration: number
  /** 0~1 */
  volume: number
  fadeIn: number
  fadeOut: number
  /** 영상 길이를 음악 길이에 맞출지 */
  fitDuration: boolean
}
