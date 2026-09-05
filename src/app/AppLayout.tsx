import { NavLink, Outlet } from 'react-router-dom'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm transition ${
    isActive ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
  }`

export function AppLayout() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-neutral-800 px-4 py-2">
        <span className="font-semibold tracking-tight">SlideShow</span>
        <nav className="flex gap-1">
          <NavLink to="/" end className={linkClass}>
            홈
          </NavLink>
          <NavLink to="/studio" className={linkClass}>
            스튜디오
          </NavLink>
          <NavLink to="/player" className={linkClass}>
            플레이어
          </NavLink>
          <NavLink to="/lab" className={linkClass}>
            실험실
          </NavLink>
        </nav>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
