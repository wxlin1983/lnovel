import { Routes, Route } from 'react-router-dom'
import { NovelsListPage } from './pages/NovelsListPage'
import { NovelDashboardPage } from './pages/NovelDashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { ChapterPlanPage } from './pages/ChapterPlanPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<NovelsListPage />} />
      <Route path="/novels/:novelId" element={<NovelDashboardPage />} />
      <Route path="/novels/:novelId/chapters/:chapterId/plan" element={<ChapterPlanPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
