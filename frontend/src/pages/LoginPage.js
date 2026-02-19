import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      toast.success('Successfully logged in')
      navigate('/dashboard')
    } catch (error) {
      toast.error(error.message || 'Failed to login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" data-testid="login-page">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800" data-testid="login-card">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-black text-blue-500" style={{ fontFamily: 'Chivo, sans-serif' }} data-testid="login-title">
            THERU FLEET
          </CardTitle>
          <CardDescription className="text-slate-400">
            Sign in to access your ad network dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm text-slate-400">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@theru.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200"
                required
                data-testid="email-input"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm text-slate-400">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200"
                required
                data-testid="password-input"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-slate-950 rounded-md border border-slate-800">
            <p className="text-xs text-slate-500 mb-2">Demo Credentials:</p>
            <p className="text-xs text-slate-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              Admin: admin@theru.com / admin123<br />
              Customer: customer@theru.com / customer123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
