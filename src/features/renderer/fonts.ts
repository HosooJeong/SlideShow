/** 번들된 한글 세리프 폰트(Noto Serif KR, OFL, KS X 1001 서브셋). troika SDF 텍스트용 */
const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export const FONTS = {
  regular: `${base}fonts/NotoSerifKR-Regular-ksx1001.ttf`,
  bold: `${base}fonts/NotoSerifKR-Bold-ksx1001.ttf`,
} as const

export type FontWeight = keyof typeof FONTS
