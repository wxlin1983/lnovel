import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { NovelsListPage } from './pages/NovelsListPage'
import { NovelLayout } from './pages/novel/NovelLayout'
import { PlanningStudio } from './pages/novel/PlanningStudio'
import { WorldTab } from './pages/novel/WorldTab'
import { ChaptersTab } from './pages/novel/ChaptersTab'
import { FullTextTab } from './pages/novel/FullTextTab'
import { SettingsPage } from './pages/SettingsPage'
import { ChapterPlanPage } from './pages/ChapterPlanPage'
import { ChapterProsePage } from './pages/ChapterProsePage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<NovelsListPage />} />
        <Route path="/novels/:novelId" element={<NovelLayout />}>
          <Route index element={<PlanningStudio />} />
          <Route path="world" element={<WorldTab />} />
          <Route path="chapters" element={<ChaptersTab />} />
          <Route path="fulltext" element={<FullTextTab />} />
        </Route>
        <Route path="/novels/:novelId/chapters/:chapterId/plan" element={<ChapterPlanPage />} />
        <Route path="/novels/:novelId/chapters/:chapterId/prose" element={<ChapterProsePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
