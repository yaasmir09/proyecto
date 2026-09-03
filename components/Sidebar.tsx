import type { ViewKey } from '@/lib/permissions'

export const navigation: Array<{ title: ViewKey; label?: string; icon: string }> = [
  { title: 'Dashboard', icon: '◉' },
  { title: 'Cobranza', label: 'Préstamos', icon: '◌' },
  { title: 'Facturas', icon: '▤' },
  { title: 'Clientes', icon: '◎' },
  { title: 'Pagos', icon: '◍' },
  { title: 'Reportes', icon: '◐' },
  { title: 'Configuración', icon: '⚙' },
]

type SidebarProps = {
  activeView: ViewKey
  onSelect: (view: ViewKey) => void
  allowedViews: ViewKey[]
}

export function MobileNavigation({ activeView, onSelect, allowedViews }: SidebarProps) {
  return (
    <nav className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-2 shadow-soft lg:hidden">
      <div className="flex min-w-max gap-2">
        {navigation.filter((item) => allowedViews.includes(item.title)).map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => onSelect(item.title)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              activeView === item.title ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>{item.icon}</span>
            {item.label || item.title}
          </button>
        ))}
      </div>
    </nav>
  )
}

export default function Sidebar({ activeView, onSelect, allowedViews }: SidebarProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Préstamos</p>
            <h2 className="mt-2 text-xl font-semibold text-white">SmartCollect</h2>
          </div>
          <div className="rounded-2xl bg-brand-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
            Beta
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-300">
          <p className="text-slate-400">Estado</p>
          <p className="mt-2 text-lg font-semibold text-white">Operativo</p>
          <p className="mt-2 text-sm text-emerald-300">Sin incidencias</p>
        </div>
      </div>

      <nav className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 shadow-soft">
        <p className="mb-4 px-3 text-[11px] uppercase tracking-[0.32em] text-slate-500">Menú</p>
          <ul className="space-y-1">
          {navigation.filter((item) => allowedViews.includes(item.title)).map((item) => (
            <li key={item.title}>
              <button
                onClick={() => onSelect(item.title)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeView === item.title
                    ? 'bg-white/10 text-white shadow-soft'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}>
                <span className="text-base">{item.icon}</span>
                {item.label || item.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-brand-500/10 to-cyan-500/10 p-4 shadow-soft">
        <p className="text-sm font-semibold text-white">Recomendación</p>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Revisa los contratos con mayor riesgo y prioriza la comunicación para evitar retrasos de pago.
        </p>
      </div>
    </div>
  )
}
