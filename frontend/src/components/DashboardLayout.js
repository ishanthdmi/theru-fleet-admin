import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { 
  LayoutDashboard, 
  Smartphone, 
  Users, 
  Megaphone, 
  Building2, 
  BarChart3, 
  LogOut 
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DashboardLayout({ children }) {
  const { user, userRole, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const adminNavItems = [
    { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { path: '/devices', label: 'Devices', icon: Smartphone },
    { path: '/drivers', label: 'Drivers', icon: Users },
    { path: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { path: '/clients', label: 'Clients', icon: Building2 },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 }
  ]

  const customerNavItems = [
    { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { path: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 }
  ]

  const navItems = userRole === 'admin' ? adminNavItems : customerNavItems

  return (
    <div className="min-h-screen bg-slate-950" data-testid="dashboard-layout">
      <div className="flex">
        <aside className="w-60 min-h-screen bg-slate-900 border-r border-slate-800 fixed left-0 top-0 bottom-0" data-testid="sidebar">
          <div className="p-6">
            <h1 className="text-xl font-black text-blue-500" style={{ fontFamily: 'Chivo, sans-serif' }} data-testid="app-title">
              THERU FLEET
            </h1>
            <p className="text-xs text-slate-500 mt-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>AD NETWORK</p>
          </div>

          <nav className="px-3 space-y-1" data-testid="nav-menu">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-link-${item.label.toLowerCase()}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-blue-400 border border-slate-700'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800">
            <div className="px-4 py-2 mb-2">
              <p className="text-xs text-slate-500">Signed in as</p>
              <p className="text-sm text-slate-300 truncate" data-testid="user-email">{user?.email}</p>
              <p className="text-xs text-blue-400 uppercase mt-1" data-testid="user-role">{userRole}</p>
            </div>
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="w-full justify-start text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              data-testid="sign-out-btn"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </aside>

        <main className="ml-60 flex-1 p-8" data-testid="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
