import { createHashRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { HomePage } from './HomePage'
import { LabPage } from '@/features/lab/LabPage'
import { StudioPage } from '@/features/studio/StudioPage'

// HashRouter: GitHub Pages는 SPA 리라이트를 지원하지 않으므로 해시 기반 라우팅을 사용한다.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'studio', element: <StudioPage /> },
      { path: 'lab/:device?', element: <LabPage /> },
    ],
  },
])
