import { useEffect, useState } from 'react'

export function AboutPage() {
  const [logoSrc, setLogoSrc] = useState<string | null>(null)

  useEffect(() => {
    window.agentManager.getBrandingPath('janus-logo').then((path) => {
      if (path) setLogoSrc(path)
    })
  }, [])

  return (
    <div className="p-8 max-w-lg space-y-4">
      {logoSrc ? (
        <img src={logoSrc} alt="Janus" className="h-12 object-contain object-left" />
      ) : (
        <h2 className="text-2xl font-semibold">Janus</h2>
      )}
      <p className="text-sm text-zinc-500 leading-relaxed">
        Manage Skills, Rules, MCPs, Hooks, Sub-agents, and Tools across Cursor, Cline, Kilo,
        Antigravity, Devin, and Kiro. Local-first editing with personal Repo Bank backup.
      </p>
      <p className="text-xs text-zinc-600">MIT License · Armin Dashti</p>
      <div className="pt-2 border-t border-zinc-800 text-center space-y-1">
        <p className="text-sm font-medium text-zinc-300">Dashti Technologies LLC</p>
        <p className="text-xs text-zinc-500">Version 1.0.0</p>
      </div>
    </div>
  )
}
