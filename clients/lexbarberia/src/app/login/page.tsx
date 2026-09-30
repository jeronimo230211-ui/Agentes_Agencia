"use client"

import { useEffect, useState, Suspense } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const STORAGE_KEY = "lexbarberia_remember"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { username: u, password: p } = JSON.parse(saved)
        setUsername(u || "")
        setPassword(p || "")
      }
    } catch {
      // ignorar — localStorage puede fallar en modo privado
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, remember }),
    })

    setLoading(false)

    if (!res.ok) {
      setError("Usuario o contraseña incorrectos")
      return
    }

    try {
      if (remember) localStorage.setItem(STORAGE_KEY, JSON.stringify({ username, password }))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignorar
    }

    router.push(searchParams.get("from") || "/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <Image src="/logo.png" alt="Lex Barbería" width={280} height={147} priority className="w-48 h-auto mb-8" />

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4 rounded-xl border border-border bg-surface p-6">
        <div className="space-y-1">
          <Label className="text-xs">Usuario</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Contraseña</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-gold" />
          Recordar mis datos
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
