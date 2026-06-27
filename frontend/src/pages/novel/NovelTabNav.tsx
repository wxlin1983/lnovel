import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface NovelTabNavProps {
  novelId: string
}

const TABS = [
  { to: '', label: '規劃室', end: true },
  { to: 'world', label: '世界觀', end: false },
  { to: 'chapters', label: '章節', end: false },
  { to: 'fulltext', label: '全文', end: false },
]

export function NovelTabNav({ novelId }: NovelTabNavProps) {
  return (
    <nav className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <NavLink
          key={tab.label}
          to={`/novels/${novelId}/${tab.to}`}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              'relative -mb-px inline-flex items-center px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'border-b-2 border-primary text-foreground'
                : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
