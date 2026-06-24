import { Routes, Route } from 'react-router-dom'
import { NovelsListPage } from './pages/NovelsListPage'
import { NovelDashboardPage } from './pages/NovelDashboardPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<NovelsListPage />} />
      <Route path="/novels/:novelId" element={<NovelDashboardPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
