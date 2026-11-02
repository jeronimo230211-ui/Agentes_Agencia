'use client'
import Image from 'next/image'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-brand" />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    const redirect = searchParams.get('redirect') || '/dashboard'
    router.push(redirect)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-bg-brand flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo — variante blanca real del sistema de Marta, se lee directo
            sobre el fondo de marca (ya no necesita la base blanca que usaba
            /logo.png, con texto navy). */}
        <div className="text-center mb-8">
          <Image src="/brand/europartners-horizontal-blanco.svg" alt="Europartners" width={200} height={35} priority className="mx-auto" />
          <p className="text-white/50 text-sm mt-3">Sistema de Operaciones</p>
        </div>

        {/* Form */}
        <div className="bg-bg-surface rounded-2xl shadow-xl p-8">
          <h2 className="text-text-heading font-display text-lg font-bold mb-1">Bienvenido de nuevo</h2>
          <p className="text-text-muted text-sm mb-6">
            Inicia sesión para gestionar cotizaciones, catálogo y despachos.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-bg-surface w-full border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
                placeholder="deisy@europartners.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-bg-surface w-full border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus-ring pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 bg-action-primary text-on-action-primary hover:bg-action-primary-hover"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'Entrando...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Europartners International · Panama City
        </p>
      </div>
    </div>
  )
}
