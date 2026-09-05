import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">사진이 살아 움직이는 기념일 영상</h1>
      <p className="text-neutral-400">
        사진과 영상을 올리면 마법 신문처럼 카메라가 무대를 여행하는 영상이 자동으로 만들어져요.
        파일은 브라우저 밖으로 나가지 않아요.
      </p>
      <div className="flex items-center gap-4">
        <Link
          to="/studio"
          className="rounded-lg bg-amber-300 px-5 py-2.5 font-medium text-neutral-950 hover:bg-amber-200"
        >
          시작하기
        </Link>
        <Link className="text-sm text-neutral-400 underline hover:text-white" to="/lab">
          연출 장치 실험실
        </Link>
      </div>
    </section>
  )
}
