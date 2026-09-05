import { Suspense } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { labDevices } from './devices'

export function LabPage() {
  const { device } = useParams()
  const current = labDevices.find((d) => d.id === device) ?? labDevices[0]

  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 border-r border-neutral-800 p-3">
        <h2 className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          장치
        </h2>
        <ul className="flex flex-col gap-0.5">
          {labDevices.map((d) => (
            <li key={d.id}>
              <NavLink
                to={`/lab/${d.id}`}
                className={({ isActive }) =>
                  `block rounded px-2 py-1.5 text-sm ${
                    isActive || (!device && d === current)
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`
                }
              >
                <span className="mr-2 font-mono text-xs text-neutral-500">{d.doc}</span>
                {d.title}
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>
      <div className="relative min-w-0 flex-1 bg-black">
        <Canvas
          key={current.id}
          dpr={[1, 2]}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          camera={{ position: [0, 0, 5], fov: 45 }}
        >
          <Suspense fallback={null}>
            <current.Scene />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}
