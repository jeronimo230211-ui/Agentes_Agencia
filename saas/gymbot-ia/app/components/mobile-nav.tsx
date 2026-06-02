'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export function MobileNav() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, { passive: true, once: true })
    return () => window.removeEventListener('scroll', close)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2A2D2C] text-[#8B8F8D] transition-colors duration-150 hover:border-[#A8FF3E]/30 hover:text-[#F2F0EB] md:hidden"
        aria-label={open ? 'Cerrar menu' : 'Abrir menu'}
        aria-expanded={open}
      >
        {open ? (
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
            <path d="M3.5 3.5l10 10M13.5 3.5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
            <path d="M2.5 4.5h12M2.5 8.5h12M2.5 12.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-0 top-[65px] z-40 border-b border-[#2A2D2C] bg-[#0D0F0E] px-5 py-3 md:hidden">
          <nav className="flex flex-col gap-0.5">
            {[
              { href: '#como-funciona', label: 'Como funciona' },
              { href: '#precios', label: 'Precios' },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm text-[#8B8F8D] transition-colors duration-150 hover:bg-[#141716] hover:text-[#F2F0EB]"
              >
                {label}
              </a>
            ))}
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-sm text-[#8B8F8D] transition-colors duration-150 hover:bg-[#141716] hover:text-[#F2F0EB]"
            >
              Mi panel
            </Link>
          </nav>
        </div>
      )}
    </>
  )
}
