type HeaderProps = {
  onViewReports: () => void
  onNewReport: () => void
}

export default function Header({ onViewReports, onNewReport }: HeaderProps) {
  return (
    <header className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-soft backdrop-blur-xl sm:p-5 lg:rounded-[1.5rem]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-sm text-brand-200">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            En tiempo real
          </div>
          <h1 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight text-white sm:text-3xl">
            Gestión de cobranza inteligente
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Monitorea la cobranza, controla pagos pendientes y optimiza la recuperación con un sistema diseñado para equipos modernos.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-3">
          <button
            onClick={onViewReports}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 sm:px-4"
          >
            Ver informes
          </button>
          <button
            onClick={onNewReport}
            className="rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 sm:px-4"
          >
            + Nuevo reporte
          </button>
        </div>
      </div>
    </header>
  )
}
