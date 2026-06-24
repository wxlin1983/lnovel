import { Routes, Route } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { NovelsListPage } from './pages/NovelsListPage'
import { NovelDashboardPage } from './pages/NovelDashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { ChapterPlanPage } from './pages/ChapterPlanPage'
import { ChapterProsePage } from './pages/ChapterProsePage'
import { modelsApi } from './api/models'

export default function App() {
  // Prefetched here so the list is already warm in the query cache by the time
  // the user opens Settings.
  useQuery({ queryKey: ['models', 'free'], queryFn: modelsApi.listFree, staleTime: 60 * 60 * 1000 })

  return (
    <Routes>
      <Route path="/" element={<NovelsListPage />} />
      <Route path="/novels/:novelId" element={<NovelDashboardPage />} />
      <Route path="/novels/:novelId/chapters/:chapterId/plan" element={<ChapterPlanPage />} />
      <Route path="/novels/:novelId/chapters/:chapterId/prose" element={<ChapterProsePage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
