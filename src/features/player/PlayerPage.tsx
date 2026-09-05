import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { composePaper } from '@/features/composer/composePaper'
import { composeNewspaper } from '@/features/composer/composeNewspaper'
import { fitTimings } from '@/features/composer/fitDuration'
import { useMusicSync } from '@/features/audio/useMusicSync'
import { preloadCompositionFonts } from '@/features/renderer/preloadFonts'
import { useMediaStore } from '@/features/media/store'
import { useProjectStore } from '@/features/project/store'
import { SceneRenderer } from '@/features/renderer/SceneRenderer'
import { useMediaTextures } from '@/features/renderer/textures'
import { PlayerControls } from './PlayerControls'
import { playerClock, usePlayerStore } from './playerStore'
import { usePlaybackLoop } from './usePlaybackLoop'

export function PlayerPage() {
  const project = useProjectStore((s) => s.current)
  const ensureProject = useProjectStore((s) => s.ensure)
  const updateProject = useProjectStore((s) => s.update)
  const { items, status, load } = useMediaStore()
  const [halftone, setHalftone] = useState(true)
  const [stageKind, setStageKind] = useState<'newspaper' | 'paper'>('newspaper')
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    ensureProject().then((p) => {
      if (useMediaStore.getState().projectId !== p.id) load(p.id)
    })
  }, [ensureProject, load])

  const composition = useMemo(() => {
    if (!project) return null
    const base = {
      seed: project.seed,
      aspect: project.aspect,
      halftoneStrength: halftone ? 0.5 : 0,
    }
    if (stageKind === 'paper') return composePaper(items, base)
    const opts = {
      ...base,
      name: project.subjectName,
      date: formatKoreanDate(project.date ?? new Date().toISOString()),
    }
    const first = composeNewspaper(items, opts)
    // 음악 길이에 맞추기: 기본 타이밍으로 만든 길이를 기준으로 dwell/travel을 조정해 한 번 더 만든다
    if (project.music?.fitDuration && project.music.duration > 0) {
      return composeNewspaper(items, {
        ...opts,
        ...fitTimings(first.duration, project.music.duration),
      })
    }
    return first
  }, [project, items, halftone, stageKind])
  useEffect(() => {
    if (composition) void preloadCompositionFonts(composition)
  }, [composition])
  useMusicSync(project?.music, composition?.duration ?? 0, muted)
  const { textures, loading } = useMediaTextures(items)

  const setDuration = usePlayerStore((s) => s.setDuration)
  useEffect(() => {
    if (composition) setDuration(composition.duration)
  }, [composition, setDuration])
  // 페이지를 떠나면 정지
  useEffect(() => () => usePlayerStore.getState().pause(), [])
  usePlaybackLoop()

  const shuffle = useCallback(() => {
    usePlayerStore.getState().seek(0)
    void updateProject({ seed: Math.floor(Math.random() * 2 ** 31) })
  }, [updateProject])

  const stageRef = useRef<HTMLDivElement>(null)
  const fullscreen = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
      const s = usePlayerStore.getState()
      if (e.code === 'Space') {
        e.preventDefault()
        s.toggle()
      } else if (e.key === 'ArrowRight') s.seek(s.t + 5)
      else if (e.key === 'ArrowLeft') s.seek(s.t - 5)
      else if (e.key === 'Home') s.seek(0)
      else if (e.key.toLowerCase() === 'f') fullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const aspectRatio =
    project?.aspect === '9:16' ? '9 / 16' : project?.aspect === '1:1' ? '1 / 1' : '16 / 9'

  if (status === 'ready' && items.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
        <p className="text-neutral-400">아직 미디어가 없어요. 스튜디오에서 사진을 먼저 올려줘요.</p>
        <Link
          to="/studio"
          className="rounded-lg bg-amber-300 px-4 py-2 font-medium text-neutral-950"
        >
          스튜디오로
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
      <div
        ref={stageRef}
        className="relative w-full overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio }}
        data-testid="player-stage"
      >
        {composition && (
          <SceneRenderer composition={composition} textures={textures} clock={playerClock} />
        )}
        {(loading || status !== 'ready') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-neutral-300">
            불러오는 중…
          </div>
        )}
      </div>
      <PlayerControls
        onShuffle={shuffle}
        onFullscreen={fullscreen}
        halftone={halftone}
        onHalftone={setHalftone}
        stageKind={stageKind}
        onStageKind={setStageKind}
        music={project?.music ? { name: project.music.name, muted, onMuted: setMuted } : null}
      />
    </div>
  )
}

function formatKoreanDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}
