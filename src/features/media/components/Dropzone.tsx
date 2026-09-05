import { useCallback, useRef, useState, type DragEvent } from 'react'

type Props = {
  onFiles: (files: File[]) => void
  disabled?: boolean
  compact?: boolean
}

const ACCEPT = 'image/*,video/*,.heic,.heif,.mov,.mp4,.webm'

export function Dropzone({ onFiles, disabled, compact }: Props) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return
      onFiles(Array.from(list))
    },
    [onFiles],
  )

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (disabled) return
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="사진과 영상 추가"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition ${
        compact ? 'px-4 py-6' : 'px-6 py-14'
      } ${
        over
          ? 'border-amber-300 bg-amber-300/10'
          : 'border-neutral-700 bg-neutral-900/40 hover:border-neutral-500'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span className={compact ? 'text-sm' : 'text-lg'}>
        사진·영상을 여기에 끌어다 놓거나 <span className="underline">파일 선택</span>
      </span>
      {!compact && (
        <span className="text-xs text-neutral-500">
          JPG · PNG · WEBP · HEIC · MP4 · MOV — 파일은 브라우저 밖으로 나가지 않아요
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
