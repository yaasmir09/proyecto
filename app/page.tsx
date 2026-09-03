'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import { MobileNavigation } from '@/components/Sidebar'
import { ACTION_KEYS, canAccessView, canUseAction, DEFAULT_ACTIONS, DEFAULT_PERMISSIONS, VIEW_KEYS, type ActionKey, type ActionMatrix, type PermissionMatrix, type RoleKey, type ViewKey } from '@/lib/permissions'

type DashboardStats = {
  clientes: number
  facturas: number
  pagos: number
  vencidas: number
}

type ClientRow = {
  id: number
  nombre: string
  email: string
  telefono: string
  identificacion: string
  empresa: string
  estado: string
}

type InvoiceRow = {
  id: number
  cliente_id: number
  numero_factura: string
  monto: number
  total_pagado?: number
  saldo_pendiente?: number
  fecha_emision: string
  fecha_vencimiento: string
  estado: string
  cliente: string
}

type PaymentRow = {
  id: number
  factura_id?: number | null
  prestamo_id?: number | null
  cuota_id?: number | null
  numero_factura?: string
  monto: number
  metodo: string
  fecha_pago: string
}

type InstallmentRow = {
  id: number
  prestamo_id: number
  numero_cuota: number
  fecha_vencimiento: string
  capital: number
  interes: number
  monto_cuota: number
  saldo_pendiente: number
  estado: string
  fecha_pago?: string
  monto_pagado?: number
}

type LoanRow = {
  id: number
  cliente_id: number
  cliente_nombre: string
  identificacion?: string
  telefono?: string
  monto_original: number
  saldo_pendiente: number
  cuotas_totales: number
  cuotas_pagadas: number
  frecuencia: string
  tasa: number
  fecha_inicio: string
  fecha_proximo_pago?: string
  estado: string
}

type SeguimientoRow = {
  id: number
  cliente: string
  tipo: string
  comentario: string
  estado: string
  fecha: string
}

type UsuarioRow = {
  id: number
  nombre: string
  email: string
  rol: string
}

type ReportType = 'general' | 'clientes' | 'vencidas' | 'pagos' | 'riesgo'

type GenericRow = Record<string, unknown>
type ChartEntry = { label: string; value: number }

type AuthUser = {
  email: string
  role: string
}

type ThemeMode = 'dark' | 'light'

const defaultStats: DashboardStats = {
  clientes: 0,
  facturas: 0,
  pagos: 0,
  vencidas: 0,
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function escapeHtml(value: string | number | boolean) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function generateInvoiceNumber(existingCount: number) {
  return `FAC-${String(Math.max(1, existingCount + 1)).padStart(4, '0')}`
}

function sanitizeLetters(value: string) {
  return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, '')
}

function sanitizeDigits(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function formatContractRules(value: string) {
  const lines = value
    .split(/\n+|(?=\d+\.\s+)/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return '1. \n2. \n3. '
  }

  return lines
    .map((line, index) => {
      const cleanLine = line.replace(/^\d+\.\s*/, '').trim()
      return `${index + 1}. ${cleanLine}`
    })
    .join('\n')
}

function formatIdentificacion(value: string) {
  const raw = value.toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (!raw) return ''

  const lastLetter = /[A-Z]$/.test(raw) ? raw.slice(-1) : ''
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 13)

  let formatted = digits.slice(0, 3)
  if (digits.length > 3) formatted += `-${digits.slice(3, 9)}`
  if (digits.length > 9) formatted += `-${digits.slice(9, 13)}`
  if (lastLetter) formatted += lastLetter

  return formatted
}

const FIXED_INTEREST_RATE = 12

function getPeriodsPerYear(frecuencia: string) {
  if (frecuencia === 'semanal') return 52
  if (frecuencia === 'quincenal') return 24
  return 12
}

function buildContractPlanPreview({ monto, cuotas, frecuencia, tasa, fechaLimite }: { monto: number; cuotas: number; frecuencia: string; tasa: number; fechaLimite: string }) {
  const principal = Number(monto) || 0
  const installments = Math.max(1, Number(cuotas) || 1)
  const annualRate = Number.isFinite(tasa) && tasa > 0 ? Number(tasa) : FIXED_INTEREST_RATE
  const periodRate = annualRate / 100 / getPeriodsPerYear(frecuencia)
  const cuotaFija = principal > 0 && periodRate > 0
    ? principal * ((periodRate * Math.pow(1 + periodRate, installments)) / (Math.pow(1 + periodRate, installments) - 1))
    : principal / installments

  let saldo = principal
  const schedule: Array<{ num: number; fecha: string; monto: number; interes: number; principal: number; saldoPendiente: number }> = []
  let current = new Date(fechaLimite || new Date().toISOString().slice(0, 10))

  for (let i = 1; i <= installments; i++) {
    const step = frecuencia === 'semanal' ? 7 : frecuencia === 'quincenal' ? 14 : 30
    current = new Date(current)
    current.setDate(current.getDate() + step)

    const interes = Number((saldo * periodRate).toFixed(2))
    const capital = Number((cuotaFija - interes).toFixed(2))
    const saldoNuevo = Number((saldo - capital).toFixed(2))

    schedule.push({
      num: i,
      fecha: current.toISOString().slice(0, 10),
      monto: Number(cuotaFija.toFixed(2)),
      interes,
      principal: capital,
      saldoPendiente: Number(saldoNuevo.toFixed(2)),
    })

    saldo = saldoNuevo
  }

  const totalInterest = Number(schedule.reduce((sum, row) => sum + row.interes, 0).toFixed(2))
  const totalPayable = Number((principal + totalInterest).toFixed(2))

  return {
    adjustedRate: annualRate,
    totalInterest,
    totalPayable,
    installmentAmount: Number(cuotaFija.toFixed(2)),
    schedule,
  }
}

function statusBadge(status: string) {
  const classes = {
    vencida: 'bg-rose-500/10 text-rose-300',
    revision: 'bg-sky-500/10 text-sky-300',
    activa: 'bg-emerald-500/10 text-emerald-300',
    pagada: 'bg-amber-400/10 text-amber-300',
  }
  return classes[status.toLowerCase() as keyof typeof classes] || 'bg-slate-500/10 text-slate-300'
}

function clientStatusBadge(status: string) {
  const classes = {
    activo: 'bg-emerald-500/15 text-emerald-300',
    riesgo: 'bg-amber-500/15 text-amber-300',
    inactivo: 'bg-slate-500/15 text-slate-300',
  }
  return classes[status.toLowerCase() as keyof typeof classes] || 'bg-slate-500/15 text-slate-300'
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'analista', label: 'Analista' },
  { value: 'operador', label: 'Operador' },
]

function getRoleLabel(role: string) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label || role
}

function normalizeRole(role: unknown): RoleKey {
  const normalized = String(role || '').toLowerCase()
  return ROLE_OPTIONS.some((option) => option.value === normalized) ? normalized as RoleKey : 'operador'
}

function formatReportRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(' | '))
}

const REPORT_TITLES: Record<ReportType, string> = {
  general: 'Resumen general',
  clientes: 'Clientes por cartera',
  vencidas: 'Facturas vencidas',
  pagos: 'Pagos por mes',
  riesgo: 'Riesgo de cartera',
}

const PERMISSIONS_STORAGE_KEY = 'smartcollect-permissions-v2'

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [message, setMessage] = useState('')
  const [stats, setStats] = useState<DashboardStats>(defaultStats)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [pagos, setPagos] = useState<PaymentRow[]>([])
  const [seguimientos, setSeguimientos] = useState<SeguimientoRow[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [reports, setReports] = useState<Record<string, { title: string; rows: GenericRow[] }>>({})
  const [backups, setBackups] = useState<string[]>([])
  const [selectedBackup, setSelectedBackup] = useState<string>('')
  const [customReports, setCustomReports] = useState<Array<{ id: number; title: string; summary: string; createdAt: string }>>([])
  const [activeView, setActiveView] = useState<ViewKey>('Dashboard')
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('general')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<PermissionMatrix>(DEFAULT_PERMISSIONS)
  const [actions, setActions] = useState<ActionMatrix>(DEFAULT_ACTIONS)
  const [themeMode, setThemeMode] = useState<ThemeMode>('light')
  const [contracts, setContracts] = useState<Array<{ id: number; numero_contrato: string; cliente_id: number; cliente: string; identificacion: string; telefono: string }>>([])
  const [contractSearch, setContractSearch] = useState('')
  const [cobranzaSearch, setCobranzaSearch] = useState('')
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [pagosSearch, setPagosSearch] = useState('')
  const [pagoClienteSearch, setPagoClienteSearch] = useState('')
  const [selectedPagoClienteId, setSelectedPagoClienteId] = useState('')
  const [editingClientId, setEditingClientId] = useState<number | null>(null)
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null)
  const [editingPagoId, setEditingPagoId] = useState<number | null>(null)
  const [editingUsuarioId, setEditingUsuarioId] = useState<number | null>(null)
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null)
  const [loanInstallments, setLoanInstallments] = useState<InstallmentRow[]>([])
  const [paymentInstallments, setPaymentInstallments] = useState<InstallmentRow[]>([])
  const [selectedLoan, setSelectedLoan] = useState<LoanRow | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null)
  const [authForm, setAuthForm] = useState({ email: 'admin@smartcollect.com', password: '123456' })
  const [clientForm, setClientForm] = useState({ nombre: '', email: '', telefono: '', identificacion: '', empresa: '', estado: 'activo' })
  const [invoiceForm, setInvoiceForm] = useState({ cliente_id: '', numero_factura: generateInvoiceNumber(0), monto: '', fecha_emision: '', fecha_vencimiento: '', estado: 'activa' })
  const [contractForm, setContractForm] = useState({ cliente_id: '', cliente_nombre: '', cliente_identificacion: '', cliente_telefono: '', monto: '', cuotas: '1', frecuencia: 'mensual', tasa: '12', fecha_inicio: new Date().toISOString().slice(0, 16), fecha_limite_pago: new Date().toISOString().slice(0, 16), reglas: '1. El cliente debe pagar en las fechas indicadas.\n2. El pago atrasado genera interés según la tasa acordada.\n3. El cliente acepta la firma del contratista y del cliente.\n4. El pago debe realizarse según la frecuencia acordada y la fecha establecida.\n5. Cualquier atraso generará interés sobre el saldo pendiente.\n6. La empresa podrá realizar seguimiento y recordatorios por medio telefónico o escrito.\n7. El cliente acepta la información y condiciones del préstamo de manera voluntaria.' })
  const [pagoForm, setPagoForm] = useState({ factura_id: '', prestamo_id: '', cuota_id: '', monto: '', metodo: 'transferencia', fecha_pago: new Date().toISOString().slice(0, 10) })
  const [seguimientoForm, setSeguimientoForm] = useState({ cliente_id: '', tipo: 'llamada', comentario: '', estado: 'pendiente', fecha: '' })
  const [usuarioForm, setUsuarioForm] = useState({ nombre: '', email: '', password: '123456', rol: 'operador' })
  const [loanForm, setLoanForm] = useState({ cuotas_totales: '', frecuencia: 'mensual', tasa: '12' })

  useEffect(() => {
    const storedTheme = sessionStorage.getItem('smartcollect-theme')
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setThemeMode(storedTheme)
    }

    const stored = sessionStorage.getItem('smartcollect-auth')
    const storedUser = sessionStorage.getItem('smartcollect-auth-user')
    if (stored) {
      setLoggedIn(true)
    }
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setAuthUser({ ...user, role: normalizeRole(user.role || user.rol) })
      } catch {
        setAuthUser(null)
      }
    }
    const storedPermissions = localStorage.getItem(PERMISSIONS_STORAGE_KEY)
    if (storedPermissions) {
      try {
        const storedData = JSON.parse(storedPermissions)
        setPermissions(Object.fromEntries(Object.entries(DEFAULT_PERMISSIONS).map(([role, defaults]) => [role, { ...defaults, ...(storedData.views?.[role] || storedData[role] || {}) }])) as PermissionMatrix)
        setActions(Object.fromEntries(Object.entries(DEFAULT_ACTIONS).map(([role, defaults]) => [role, { ...defaults, ...(storedData.actions?.[role] || {}) }])) as ActionMatrix)
      } catch {
        setPermissions(DEFAULT_PERMISSIONS)
      }
    }
    void loadData()
  }, [])

  useEffect(() => {
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify({ views: permissions, actions }))
  }, [permissions, actions])

  useEffect(() => {
    document.body.classList.toggle('theme-light', themeMode === 'light')
    document.body.classList.toggle('theme-dark', themeMode === 'dark')
    sessionStorage.setItem('smartcollect-theme', themeMode)
  }, [themeMode])

  useEffect(() => {
    if (backups.length > 0) {
      setSelectedBackup((current) => (current && backups.includes(current) ? current : backups[0]))
    } else {
      setSelectedBackup('')
    }
  }, [backups])

  useEffect(() => {
    if (authUser && !canAccessView(permissions, authUser.role, activeView)) {
      const fallbackView = VIEW_KEYS.find((view) => canAccessView(permissions, authUser.role, view)) || 'Dashboard'
      setActiveView(fallbackView)
    }
  }, [activeView, authUser, permissions])

  function resetClientForm() {
    setClientForm({ nombre: '', email: '', telefono: '', identificacion: '', empresa: '', estado: 'activo' })
    setEditingClientId(null)
  }

  function resetInvoiceForm() {
    setInvoiceForm({ cliente_id: '', numero_factura: generateInvoiceNumber(invoices.length + 1), monto: '', fecha_emision: '', fecha_vencimiento: '', estado: 'activa' })
    setEditingInvoiceId(null)
  }

  function resetContractForm() {
    setContractForm({
      cliente_id: '',
      cliente_nombre: '',
      cliente_identificacion: '',
      cliente_telefono: '',
      monto: '',
      cuotas: '1',
      frecuencia: 'mensual',
      tasa: '12',
      fecha_inicio: new Date().toISOString().slice(0, 16),
      fecha_limite_pago: new Date().toISOString().slice(0, 16),
      reglas: '1. El cliente debe pagar en las fechas indicadas.\n2. El pago atrasado genera interés según la tasa acordada.\n3. El cliente acepta la firma del contratista y del cliente.\n4. El pago debe realizarse según la frecuencia acordada y la fecha establecida.\n5. Cualquier atraso generará interés sobre el saldo pendiente.\n6. La empresa podrá realizar seguimiento y recordatorios por medio telefónico o escrito.\n7. El cliente acepta la información y condiciones del préstamo de manera voluntaria.',
    })
    setContractSearch('')
  }

  function resetPagoForm() {
    setPagoForm({ factura_id: '', prestamo_id: '', cuota_id: '', monto: '', metodo: 'transferencia', fecha_pago: new Date().toISOString().slice(0, 10) })
    setEditingPagoId(null)
    setPaymentInstallments([])
  }

  function resetUsuarioForm() {
    setUsuarioForm({ nombre: '', email: '', password: '123456', rol: 'operador' })
    setEditingUsuarioId(null)
  }

  function resetLoanForm() {
    setLoanForm({ cuotas_totales: '', frecuencia: 'mensual', tasa: '12' })
    setEditingLoanId(null)
    setSelectedLoan(null)
    setLoanInstallments([])
  }

  function recalculateLoanInstallments(
    saldoPendiente: number,
    nuevasCuotas: number,
    frecuencia: string,
    tasa: number,
    fechaInicio: string
  ) {
    const principal = saldoPendiente
    const periodRate = tasa / 100 / getPeriodsPerYear(frecuencia)
    const cuotaFija =
      principal > 0 && periodRate > 0
        ? principal * ((periodRate * Math.pow(1 + periodRate, nuevasCuotas)) / (Math.pow(1 + periodRate, nuevasCuotas) - 1))
        : principal / nuevasCuotas

    let saldo = principal
    const schedule: InstallmentRow[] = []
    let current = new Date(fechaInicio)

    for (let i = 1; i <= nuevasCuotas; i++) {
      const step = frecuencia === 'semanal' ? 7 : frecuencia === 'quincenal' ? 14 : 30
      current = new Date(current)
      current.setDate(current.getDate() + step)

      const interes = Number((saldo * periodRate).toFixed(2))
      const capital = Number((cuotaFija - interes).toFixed(2))
      const saldoNuevo = Number((saldo - capital).toFixed(2))

      schedule.push({
        id: 0,
        prestamo_id: selectedLoan?.id || 0,
        numero_cuota: i,
        fecha_vencimiento: current.toISOString().slice(0, 10),
        capital,
        interes,
        monto_cuota: Number(cuotaFija.toFixed(2)),
        saldo_pendiente: saldoNuevo,
        estado: 'pendiente',
      } as InstallmentRow)

      saldo = saldoNuevo
    }

    return schedule
  }

  async function handleUpdateLoan(e: FormEvent) {
    e.preventDefault()
    if (!can('prestamos.gestionar')) return

    if (!editingLoanId || !selectedLoan) {
      setMessage('Error: Préstamo no seleccionado')
      return
    }

    const nuevasCuotas = Number(loanForm.cuotas_totales)
    if (!nuevasCuotas || nuevasCuotas <= 0) {
      setMessage('Ingresa un número válido de cuotas')
      return
    }

    try {
      const newInstallments = recalculateLoanInstallments(
        selectedLoan.saldo_pendiente,
        nuevasCuotas,
        loanForm.frecuencia,
        Number(loanForm.tasa),
        selectedLoan.fecha_inicio
      )

      const res = await fetch(`/api/prestamos/${editingLoanId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuotas_totales: nuevasCuotas,
          frecuencia: loanForm.frecuencia,
          tasa: Number(loanForm.tasa),
          cuotas_data: newInstallments,
        }),
      })

      const data = await res.json()
      if (data.ok) {
        setMessage('Préstamo actualizado correctamente')
        await loadData()
        resetLoanForm()
      } else {
        setMessage(data.error || 'No se pudo actualizar el préstamo')
      }
    } catch (error) {
      console.error('Error al actualizar préstamo:', error)
      setMessage('Error al actualizar préstamo')
    }
  }

  function startEditClient(client: ClientRow) {
    setEditingClientId(client.id)
    setClientForm({
      nombre: client.nombre,
      email: client.email,
      telefono: client.telefono || '',
      identificacion: client.identificacion || '',
      empresa: client.empresa,
      estado: client.estado,
    })
    setActiveView('Clientes')
  }

  function startEditInvoice(invoice: InvoiceRow) {
    setEditingInvoiceId(invoice.id)
    setSelectedInvoice(invoice)
    setInvoiceForm({
      cliente_id: String(invoice.cliente_id),
      numero_factura: invoice.numero_factura,
      monto: String(invoice.monto),
      fecha_emision: invoice.fecha_emision,
      fecha_vencimiento: invoice.fecha_vencimiento,
      estado: invoice.estado,
    })
    setActiveView('Cobranza')
  }

  function startEditPago(pago: PaymentRow) {
    setEditingPagoId(pago.id)
    setPagoForm({
      factura_id: pago.factura_id ? String(pago.factura_id) : '',
      prestamo_id: pago.prestamo_id ? String(pago.prestamo_id) : '',
      cuota_id: pago.cuota_id ? String(pago.cuota_id) : '',
      monto: String(pago.monto),
      metodo: pago.metodo,
      fecha_pago: pago.fecha_pago,
    })
    setActiveView('Pagos')
  }

  function startEditUsuario(user: UsuarioRow) {
    setEditingUsuarioId(user.id)
    setUsuarioForm({
      nombre: user.nombre,
      email: user.email,
      password: '',
      rol: user.rol,
    })
    setActiveView('Configuración')
  }

  async function startEditLoan(loan: LoanRow) {
    setEditingLoanId(loan.id)
    setSelectedLoan(loan)
    const res = await fetch(`/api/prestamos/${loan.id}`)
    const data = await res.json()
    if (Array.isArray(data?.cuotas)) {
      setLoanInstallments(data.cuotas)
    }
    setActiveView('Cobranza')
  }

  async function handleDeleteLoan(id: number) {
    const ok = confirm('¿Eliminar este préstamo y sus cuotas? Esta acción no se puede deshacer.')
    if (!ok) return

    const res = await fetch(`/api/prestamos/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) {
      setMessage('Préstamo eliminado correctamente')
      await loadData()
    } else {
      setMessage(data.error || 'No se pudo eliminar el préstamo')
    }
  }

  async function autoLoadNextInstallment(prestamoId: number) {
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`)
      const data = await res.json()
      const cuotas = Array.isArray(data?.cuotas) ? data.cuotas.filter((cuota: InstallmentRow) => cuota.estado === 'pendiente') : []
      setPaymentInstallments(cuotas)

      if (cuotas.length > 0) {
        const cuota = cuotas[0]
        setPagoForm((prev) => ({
          ...prev,
          prestamo_id: String(prestamoId),
          cuota_id: String(cuota.id),
          monto: String(cuota.monto_cuota),
        }))
        setMessage(`Cuota pendiente cargada: ${formatCurrency(cuota.monto_cuota)}`)
      } else {
        setPagoForm((prev) => ({ ...prev, prestamo_id: String(prestamoId), cuota_id: '', monto: '' }))
        setMessage('No hay cuotas pendientes para este préstamo')
      }
    } catch (error) {
      console.error('Error al cargar cuota pendiente:', error)
    }
  }

  async function loadLoanPaymentInstallments(prestamoId: number) {
    if (!prestamoId) {
      setPaymentInstallments([])
      return
    }

    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`)
      const data = await res.json()
      const cuotas = Array.isArray(data?.cuotas) ? data.cuotas.filter((cuota: InstallmentRow) => cuota.estado === 'pendiente') : []
      setPaymentInstallments(cuotas)
      if (cuotas.length > 0) {
        const first = cuotas[0]
        setPagoForm((prev) => ({ ...prev, prestamo_id: String(prestamoId), cuota_id: String(first.id), monto: String(first.monto_cuota) }))
      }
    } catch (error) {
      console.error('Error al cargar cuotas del préstamo:', error)
    }
  }

  async function loadData() {
    try {
      const [dashboardRes, clientesRes, facturasRes, pagosRes, seguimientosRes, usuariosRes, generalRes, clientesRepRes, vencidasRepRes, pagosRepRes, riesgoRepRes, contratosRes, prestamosRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/clientes'),
        fetch('/api/facturas'),
        fetch('/api/pagos'),
        fetch('/api/seguimientos'),
        fetch('/api/usuarios'),
        fetch('/api/reportes?tipo=general'),
        fetch('/api/reportes?tipo=clientes'),
        fetch('/api/reportes?tipo=vencidas'),
        fetch('/api/reportes?tipo=pagos'),
        fetch('/api/reportes?tipo=riesgo'),
        fetch('/api/contratos'),
        fetch('/api/prestamos'),
      ])

      const dashboardData = await dashboardRes.json()
      const clientesData = await clientesRes.json()
      const facturasData = await facturasRes.json()
      const pagosData = await pagosRes.json()
      const seguimientosData = await seguimientosRes.json()
      const usuariosData = await usuariosRes.json()
      const generalData = await generalRes.json()
      const clientesRepData = await clientesRepRes.json()
      const vencidasRepData = await vencidasRepRes.json()
      const pagosRepData = await pagosRepRes.json()
      const riesgoRepData = await riesgoRepRes.json()
      const contratosData = await contratosRes.json()
      const prestamosData = await prestamosRes.json()

      if (dashboardData?.stats) setStats(dashboardData.stats)
      if (Array.isArray(clientesData?.clientes)) setClients(clientesData.clientes)
      if (Array.isArray(facturasData?.facturas)) setInvoices(facturasData.facturas)
      if (Array.isArray(contratosData?.contratos)) setContracts(contratosData.contratos)
      if (Array.isArray(pagosData?.pagos)) setPagos(pagosData.pagos)
      if (Array.isArray(seguimientosData?.seguimientos)) setSeguimientos(seguimientosData.seguimientos)
      if (Array.isArray(usuariosData?.usuarios)) setUsuarios(usuariosData.usuarios)
      if (Array.isArray(prestamosData?.prestamos)) setLoans(prestamosData.prestamos)

      setReports({
        general: generalData?.report,
        clientes: clientesRepData?.report,
        vencidas: vencidasRepData?.report,
        pagos: pagosRepData?.report,
        riesgo: riesgoRepData?.report,
      })

      const backupsRes = await fetch('/api/db/backup')
      const backupsData = await backupsRes.json()
      if (Array.isArray(backupsData?.backups)) setBackups(backupsData.backups)
    } catch (error) {
      console.error(error)
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()

    if (authForm.email === 'admin@smartcollect.com' && authForm.password === '123456') {
      const user = { email: authForm.email, role: 'admin' as RoleKey }
      sessionStorage.setItem('smartcollect-auth', 'true')
      sessionStorage.setItem('smartcollect-auth-user', JSON.stringify(user))
      setLoggedIn(true)
      setAuthUser(user)
      setMessage('Sesión iniciada correctamente')
      return
    }

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: authForm.email, password: authForm.password }),
      })
      const data = await res.json()

      if (data?.ok && data?.user) {
        const user = { email: data.user.email, role: normalizeRole(data.user.rol) }
        sessionStorage.setItem('smartcollect-auth', 'true')
        sessionStorage.setItem('smartcollect-auth-user', JSON.stringify(user))
        setLoggedIn(true)
        setAuthUser(user)
        setMessage('Sesión iniciada correctamente')
      } else {
        setMessage('Credenciales inválidas. Usa admin@smartcollect.com / 123456 o un usuario registrado.')
      }
    } catch (error) {
      setMessage('No se pudo validar el usuario')
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('smartcollect-auth')
    sessionStorage.removeItem('smartcollect-auth-user')
    setLoggedIn(false)
    setAuthUser(null)
    setMessage('Sesión cerrada')
  }

  async function handleCreateClient(e: FormEvent) {
    e.preventDefault()
    if (!can('clientes.gestionar')) return
    const method = editingClientId ? 'PATCH' : 'POST'
    const url = editingClientId ? `/api/clientes/${editingClientId}` : '/api/clientes'
    const payload = {
      ...clientForm,
      nombre: sanitizeLetters(clientForm.nombre),
      identificacion: formatIdentificacion(clientForm.identificacion),
      telefono: sanitizeDigits(clientForm.telefono),
    }

    if (payload.nombre.trim().length < 2) {
      setMessage('El nombre debe tener al menos 2 letras válidas.')
      return
    }

    if (payload.identificacion && !/^[0-9]{3}-[0-9]{6}-[0-9]{4}[A-Za-z]$/.test(payload.identificacion)) {
      setMessage('La identificación debe tener formato 000-000000-0000X')
      return
    }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.ok) {
      setMessage(editingClientId ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente')
      resetClientForm()
      await loadData()
    } else {
      setMessage(data.error || 'No se pudo guardar el cliente')
    }
  }

  async function handleDeleteClient(id: number) {
    const ok = confirm('¿Desea eliminar este cliente? Esta acción no se puede deshacer.')
    if (!ok) return
    const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) {
      setClients((prev) => prev.filter((c) => Number(c.id) !== Number(id)))
      setMessage('Cliente eliminado correctamente')
      await loadData()
    } else {
      setMessage(data.error || 'No se pudo eliminar el cliente')
    }
  }

  async function handleCreateInvoice(e: FormEvent) {
    e.preventDefault()
    if (!can('facturas.gestionar')) return
    const method = editingInvoiceId ? 'PATCH' : 'POST'
    const url = editingInvoiceId ? `/api/facturas/${editingInvoiceId}` : '/api/facturas'
    const payload = {
      ...invoiceForm,
      numero_factura: editingInvoiceId ? invoiceForm.numero_factura : (invoiceForm.numero_factura || generateInvoiceNumber(invoices.length + 1)),
      fecha_emision: invoiceForm.fecha_emision === '' ? null : invoiceForm.fecha_emision,
      fecha_vencimiento: invoiceForm.fecha_vencimiento === '' ? null : invoiceForm.fecha_vencimiento,
    }
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.ok) {
      setMessage(editingInvoiceId ? 'Factura actualizada correctamente' : 'Factura creada correctamente')
      resetInvoiceForm()
      await loadData()
    } else {
      setMessage(data.error || 'No se pudo guardar la factura')
    }
  }

  async function handleDeleteInvoice(id: number) {
    const ok = confirm('¿Eliminar factura? Esta acción eliminará la factura de la base de datos.')
    if (!ok) return
    const res = await fetch(`/api/facturas/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) {
      setInvoices((prev) => prev.filter((f) => Number(f.id) !== Number(id)))
      setMessage(data.deuda_limpiada ? 'Factura eliminada y deuda del cliente limpiada correctamente' : 'Factura eliminada correctamente')
      await loadData()
    } else {
      setMessage(data.error || 'No se pudo eliminar la factura')
    }
  }

  async function handleCreatePago(e: FormEvent) {
    e.preventDefault()
    if (!can('pagos.gestionar')) return
    const method = editingPagoId ? 'PATCH' : 'POST'
    const url = editingPagoId ? `/api/pagos/${editingPagoId}` : '/api/pagos'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pagoForm) })
    const data = await res.json()
    if (data.ok) {
      const selectedInvoice = invoices.find((invoice) => String(invoice.id) === String(pagoForm.factura_id))
      const paymentAmount = Number(pagoForm.monto || 0)
      const invoiceAmount = Number(selectedInvoice?.monto || 0)
      const nextStatus = paymentAmount >= invoiceAmount ? 'pagada' : 'revision'

      setInvoices((prev) => prev.map((invoice) => (String(invoice.id) === String(pagoForm.factura_id) ? { ...invoice, estado: nextStatus } : invoice)))
      setActiveView('Cobranza')
      setMessage(editingPagoId ? 'Pago actualizado correctamente' : 'Pago registrado correctamente')
      resetPagoForm()
      await loadData()
    } else {
      setMessage(data.error || 'No se pudo guardar el pago')
    }
  }

  async function handleDeletePago(id: number) {
    const ok = confirm('¿Confirmar eliminación del pago? Esta acción no se puede deshacer.')
    if (!ok) return
    const res = await fetch(`/api/pagos/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) {
      setPagos((prev) => prev.filter((p) => Number(p.id) !== Number(id)))
      setMessage('Pago eliminado correctamente')
      await loadData()
    } else {
      setMessage(data.error || 'No se pudo eliminar el pago')
    }
  }

  async function handleCreateSeguimiento(e: FormEvent) {
    e.preventDefault()
    if (!can('seguimientos.gestionar')) return
    const res = await fetch('/api/seguimientos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(seguimientoForm) })
    const data = await res.json()
    if (data.ok) {
      setMessage('Seguimiento creado correctamente')
      setSeguimientoForm({ cliente_id: '', tipo: 'llamada', comentario: '', estado: 'pendiente', fecha: '' })
      await loadData()
    } else {
      setMessage(data.error || 'No se pudo crear el seguimiento')
    }
  }

  async function handleCreateUsuario(e: FormEvent) {
    e.preventDefault()
    if (!can('usuarios.gestionar')) return
    const method = editingUsuarioId ? 'PATCH' : 'POST'
    const url = editingUsuarioId ? `/api/usuarios/${editingUsuarioId}` : '/api/usuarios'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(usuarioForm) })
    const data = await res.json()
    if (data.ok) {
      setMessage(editingUsuarioId ? 'Usuario actualizado correctamente' : 'Usuario registrado correctamente')
      resetUsuarioForm()
      await loadData()
    } else {
      setMessage(data.error || 'No se pudo guardar el usuario')
    }
  }

  async function handleCreateContract(e: FormEvent) {
    e.preventDefault()
    if (!can('prestamos.gestionar')) return

    const payload = {
      cliente_id: Number(contractForm.cliente_id),
      monto: Number(contractForm.monto),
      cuotas: Number(contractForm.cuotas),
      frecuencia: contractForm.frecuencia,
      tasa: Number(contractForm.tasa),
      fecha_inicio: contractForm.fecha_inicio || new Date().toISOString().slice(0, 16),
      fecha_limite_pago: contractForm.fecha_limite_pago || contractForm.fecha_inicio || new Date().toISOString().slice(0, 16),
      reglas: contractForm.reglas || '',
    }

    const selectedContractClient = clients.find((client) => Number(client.id) === payload.cliente_id)
    if (!payload.cliente_id || !payload.monto || payload.cuotas <= 0 || !contractForm.cliente_nombre || !selectedContractClient) {
      void loadData()
      setMessage('Debe seleccionar un cliente válido y actualizado para generar el contrato.')
      return
    }

    try {
      const invoiceRes = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: payload.cliente_id,
          monto: payload.monto,
          fecha_emision: new Date(payload.fecha_inicio).toISOString(),
          fecha_vencimiento: new Date(payload.fecha_limite_pago || payload.fecha_inicio).toISOString(),
          estado: 'activa',
        }),
      })

      const invoiceData = await invoiceRes.json()
      if (!invoiceRes.ok || !invoiceData.ok) {
        setMessage(invoiceData.error || 'No se pudo crear la factura asociada al contrato')
        return
      }

      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok && data.ok) {
        setMessage(`Factura y contrato guardados: ${data.archivo}`)
        resetContractForm()
        await loadData()
      } else {
        setMessage(data.error || 'No se pudo generar el contrato')
      }
    } catch (error) {
      setMessage((error as Error).message || 'No se pudo terminar la generación del contrato')
    }
  }

  async function handleDeleteUsuario(id: number) {
    const ok = confirm('¿Eliminar usuario? Esta acción no se puede deshacer.')
    if (!ok) return
    const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) {
      setMessage('Usuario eliminado correctamente')
      await loadData()
    } else {
      setMessage(data.error || 'No se pudo eliminar el usuario')
    }
  }

  async function handleBackup() {
    if (!can('backups.gestionar')) return
    const res = await fetch('/api/db/backup', { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      setMessage(`Respaldo creado: ${data.file}`)
      await loadData()
      return data.file as string
    }
    setMessage(data.error || 'No se pudo crear el respaldo')
    return null
  }

  async function handleCreateReport() {
    if (!can('reportes.exportar')) return
    const report = {
      id: Date.now(),
      title: `Reporte ${new Date().toLocaleDateString('es-ES')}`,
      summary: `Clientes: ${stats.clientes} • Facturas: ${stats.facturas} • Vencidas: ${stats.vencidas}`,
      createdAt: new Date().toLocaleString('es-ES'),
    }

    setCustomReports((prev) => [report, ...prev].slice(0, 5))
    setSelectedReportType('general')
    setActiveView('Reportes')
    setMessage('Reporte generado correctamente')
  }

  function getExportRows(): GenericRow[] {
    const rows: GenericRow[] = Array.isArray(reports[selectedReportType]?.rows) ? reports[selectedReportType].rows : []
    if (rows.length > 0) return rows

    switch (selectedReportType) {
      case 'clientes':
        return clients.map((client) => ({ nombre: client.nombre, empresa: client.empresa || '—', estado: client.estado, facturas: 0 }))
      case 'vencidas':
        return invoices.filter((invoice) => invoice.estado === 'vencida').map((invoice) => ({ numero_factura: invoice.numero_factura, cliente: invoice.cliente, monto: invoice.monto, fecha_vencimiento: invoice.fecha_vencimiento }))
      case 'pagos':
        return pagos.map((item) => ({ numero_factura: item.numero_factura, monto: item.monto, metodo: item.metodo, fecha_pago: item.fecha_pago }))
      case 'riesgo':
        return clients.filter((client) => client.estado === 'riesgo').map((client) => ({ nombre: client.nombre, empresa: client.empresa || '—', estado: client.estado }))
      case 'general':
      default:
        return [{ clientes: stats.clientes, facturas: stats.facturas, pagos: stats.pagos, vencidas: stats.vencidas }]
    }
  }

  function handleExportExcel() {
    if (!can('reportes.exportar')) return
    const rows = getExportRows()
    if (rows.length === 0) {
      setMessage('No hay datos para exportar')
      return
    }

    const headers = Array.from(new Set(rows.flatMap((row: Record<string, unknown>) => Object.keys(row))))
    const formatValue = (value: unknown) => {
      if (value === null || value === undefined || value === '') return '—'
      if (typeof value === 'number') return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)
      return String(value)
    }
    const escapeHtml = (value: string | number | boolean) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

    const title = REPORT_TITLES[selectedReportType]
    const generatedAt = new Date().toLocaleString('es-ES')

    const htmlTable = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
            h1 { margin: 0 0 6px; font-size: 24px; color: #0f172a; }
            .meta { color: #64748b; font-size: 12px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #0f172a; color: white; padding: 10px; text-align: left; }
            td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <div class="meta">Generado: ${escapeHtml(generatedAt)} · Aplicación de cobranza inteligente</div>
          <table>
            <thead>
              <tr>${headers.map((header) => `<th>${escapeHtml(String(header))}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map((row: GenericRow) => `<tr>${headers.map((header) => `<td>${escapeHtml(formatValue(row[String(header)]))}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `

    const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedReportType}.xls`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setMessage('Exportación de Excel lista para abrir')
  }

  function handleExportPdf() {
    if (!can('reportes.exportar')) return
    const rows = getExportRows()
    const title = REPORT_TITLES[selectedReportType]
    const generatedAt = new Date().toLocaleString('es-ES')
    const content = rows.length === 0
      ? '<p class="empty">No hay datos disponibles para este reporte.</p>'
      : `
        <table>
          <thead>
            <tr>
              ${Object.keys(rows[0]).map((key) => `<th>${escapeHtml(String(key))}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row: GenericRow) => `<tr>${Object.entries(row).map(([_, value]) => `<td>${escapeHtml(String(value ?? '—'))}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      `

    const printWindow = window.open('', '_blank', 'width=1100,height=900')
    if (!printWindow) {
      setMessage('El navegador bloqueó la ventana de impresión')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>${title}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #ffffff; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            .meta { color: #64748b; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
            th { background: #0f172a; color: white; padding: 8px 10px; text-align: left; }
            td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background: #f8fafc; }
            .empty { color: #64748b; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <div class="meta">Generado: ${generatedAt} · Cobranza inteligente</div>
          </div>
          ${content}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 300)
    setMessage('Vista de impresión lista para exportar a PDF')
  }

  async function handleRestore(fileNameOverride?: string) {
    if (!can('backups.gestionar')) return
    let targetBackup: string | undefined = fileNameOverride || selectedBackup || backups[0]

    if (!targetBackup) {
      targetBackup = await handleBackup() ?? undefined
    }

    if (!targetBackup) {
      setMessage('No hay respaldos disponibles')
      return
    }

    const res = await fetch('/api/db/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: targetBackup }) })
    const data = await res.json()
    if (data.ok) {
      setMessage(`Base de datos restaurada desde ${targetBackup}`)
      await loadData()
    } else {
      setMessage(data.error || 'No se pudo restaurar la base de datos')
    }
  }

  const recovery = stats.facturas > 0 ? Math.round(((stats.facturas - stats.vencidas) / stats.facturas) * 100) : 0
  const pending = Math.max(0, stats.facturas - stats.vencidas)
  const can = (action: ActionKey) => canUseAction(actions, authUser?.role, action)
  const canManageUsers = can('usuarios.gestionar')
  const canManageBackups = can('backups.gestionar')
  const allowedViews = VIEW_KEYS.filter((view) => canAccessView(permissions, authUser?.role, view))
  const canManagePermissions = authUser?.role === 'admin'

  function handleViewSelect(view: ViewKey) {
    if (canAccessView(permissions, authUser?.role, view)) setActiveView(view)
  }

  function togglePermission(role: RoleKey, view: ViewKey) {
    if (!canManagePermissions || (role === 'admin' && view === 'Configuración')) return
    setPermissions((current) => ({
      ...current,
      [role]: { ...current[role], [view]: !current[role][view] },
    }))
  }

  function toggleAction(role: RoleKey, action: ActionKey) {
    if (!canManagePermissions || role === 'admin') return
    setActions((current) => ({ ...current, [role]: { ...current[role], [action]: !current[role][action] } }))
  }
  const currentReportRows: GenericRow[] = Array.isArray(reports[selectedReportType]?.rows) ? reports[selectedReportType].rows : []
  const chartData: ChartEntry[] = (() => {
    if (!currentReportRows.length) return []
    switch (selectedReportType) {
      case 'general': {
        const first = currentReportRows[0] as Record<string, unknown>
        return Object.entries(first)
          .filter(([, value]) => typeof value === 'number')
          .map(([key, value]) => ({ label: key, value: Number(value) }))
      }
      case 'clientes':
        return currentReportRows.map((row: any) => ({ label: row.nombre, value: Number(row.facturas || 0) }))
      case 'vencidas':
        return currentReportRows.map((row: any) => ({ label: row.numero_factura, value: Number(row.monto || 0) }))
      case 'pagos':
        return currentReportRows.map((row: any) => ({ label: row.periodo, value: Number(row.total || 0) }))
      case 'riesgo':
        return currentReportRows.map((row: any) => ({ label: row.nombre, value: Number(row.total || 0) }))
      default:
        return []
    }
  })()

  function renderDashboardView() {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.25rem] bg-slate-900/80 p-4">
            <p className="text-sm text-slate-400">Clientes</p>
            <p className="mt-2 text-3xl font-semibold text-white">{stats.clientes}</p>
          </div>
          <div className="rounded-[1.25rem] bg-slate-900/80 p-4">
            <p className="text-sm text-slate-400">Facturas</p>
            <p className="mt-2 text-3xl font-semibold text-white">{stats.facturas}</p>
          </div>
          <div className="rounded-[1.25rem] bg-slate-900/80 p-4">
            <p className="text-sm text-slate-400">Pagos</p>
            <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(stats.pagos)}</p>
          </div>
          <div className="rounded-[1.25rem] bg-slate-900/80 p-4">
            <p className="text-sm text-slate-400">Vencidas</p>
            <p className="mt-2 text-3xl font-semibold text-white">{stats.vencidas}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Resumen operativo</h3>
                <p className="mt-2 text-sm text-slate-400">Monitorea recuperación, cartera y prioridad del día.</p>
              </div>
              <button onClick={() => setActiveView('Cobranza')} className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Ir a préstamos</button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[1.25rem] border border-brand-500/20 bg-brand-500/10 p-4">
                <p className="text-sm text-slate-400">Recuperación</p>
                <p className="mt-3 text-3xl font-semibold text-white">{recovery}%</p>
                <p className="mt-2 text-sm text-slate-300">Tasa de cobranza efectiva del período.</p>
              </div>
              <div className="rounded-[1.25rem] bg-slate-900/80 p-4">
                <p className="text-sm text-slate-400">Pendientes</p>
                <p className="mt-3 text-3xl font-semibold text-white">{pending}</p>
                <p className="mt-2 text-sm text-slate-300">Casos que requieren seguimiento.</p>
              </div>
            </div>

            <div className="table-scroll mt-6 rounded-[1.5rem] border border-white/10 bg-slate-900/80">
              <table className="min-w-[620px] border-separate border-spacing-0 text-left">
                <thead className="bg-slate-950/80 text-slate-400">
                  <tr>
                    <th className="px-6 py-4 text-sm uppercase tracking-[0.24em]">Factura</th>
                    <th className="px-6 py-4 text-sm uppercase tracking-[0.24em]">Cliente</th>
                    <th className="px-6 py-4 text-sm uppercase tracking-[0.24em]">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 5).map((invoice) => (
                    <tr key={invoice.id} className="border-t border-white/5 transition hover:bg-white/5">
                      <td className="px-6 py-4 text-sm text-slate-100">{invoice.numero_factura}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{invoice.cliente}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusBadge(invoice.estado)}`}>
                          {invoice.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
              <h3 className="text-lg font-semibold text-white">Acciones rápidas</h3>
              <div className="mt-4 space-y-3">
                <button onClick={() => setActiveView('Clientes')} className="flex w-full items-center justify-between rounded-[1.25rem] bg-slate-900/80 px-4 py-3 text-left text-sm text-slate-200">
                  <span>Gestionar clientes</span>
                  <span className="text-brand-300">→</span>
                </button>
                <button onClick={() => setActiveView('Pagos')} className="flex w-full items-center justify-between rounded-[1.25rem] bg-slate-900/80 px-4 py-3 text-left text-sm text-slate-200">
                  <span>Registrar pago</span>
                  <span className="text-brand-300">→</span>
                </button>
                <button onClick={() => setActiveView('Reportes')} className="flex w-full items-center justify-between rounded-[1.25rem] bg-slate-900/80 px-4 py-3 text-left text-sm text-slate-200">
                  <span>Ver reportes</span>
                  <span className="text-brand-300">→</span>
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
              <h3 className="text-lg font-semibold text-white">Seguimiento</h3>
              <div className="mt-4 space-y-3">
                {seguimientos.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-[1.25rem] bg-slate-900/80 p-4 text-sm text-slate-300">
                    <p className="font-semibold text-white">{item.tipo}</p>
                    <p className="mt-1">{item.comentario}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">{item.estado} • {item.fecha}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderCobranzaView() {
    const normalizedCobranzaSearch = cobranzaSearch.trim().toLowerCase()
    const filteredCobranzaInvoices = invoices.filter((invoice) => {
      if (!normalizedCobranzaSearch) return true
      const haystack = `${invoice.numero_factura} ${invoice.cliente} ${invoice.estado} ${invoice.fecha_vencimiento}`.toLowerCase()
      return haystack.includes(normalizedCobranzaSearch)
    })
    const filteredCobranzaLoans = loans.filter((loan) => {
      if (!normalizedCobranzaSearch) return false
      if (loan.estado.toLowerCase() !== 'activo' || Number(loan.saldo_pendiente || 0) <= 0) return false
      const haystack = `${loan.cliente_id} ${loan.cliente_nombre} ${loan.estado} ${loan.frecuencia} ${loan.tasa}`.toLowerCase()
      return haystack.includes(normalizedCobranzaSearch)
    })

    const contractCandidates = contractSearch.trim()
      ? [
          ...clients
            .filter((client) => {
              const query = normalizeSearchText(contractSearch)
              const haystack = normalizeSearchText(`${client.id} ${client.nombre} ${client.identificacion || ''} ${client.email}`)
              return haystack.includes(query)
            })
            .map((client) => ({
              id: client.id,
              cliente_id: client.id,
              cliente: client.nombre,
              identificacion: client.identificacion || '',
              telefono: client.telefono || '',
              numero_contrato: '',
            })),
          ...contracts.filter((contract) => {
            const query = normalizeSearchText(contractSearch)
            const haystack = normalizeSearchText(`${contract.numero_contrato} ${contract.cliente} ${contract.cliente_id} ${contract.identificacion || ''}`)
            return haystack.includes(query)
          }),
        ].filter((candidate, index, candidates) => candidates.findIndex((item) => item.cliente_id === candidate.cliente_id) === index)
      : []

    const contractPlanPreview = buildContractPlanPreview({
      monto: Number(contractForm.monto || 0),
      cuotas: Number(contractForm.cuotas || 1),
      frecuencia: contractForm.frecuencia,
      tasa: Number(contractForm.tasa || 12),
      fechaLimite: contractForm.fecha_inicio || new Date().toISOString().slice(0, 10),
    })

    return (
      <div className="space-y-6">
        <div className="min-w-0 rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-soft sm:p-6">
          <h2 className="text-2xl font-semibold text-white">Préstamos</h2>
          <p className="mt-2 text-sm text-slate-400">Visualiza y administra las facturas con mayor prioridad.</p>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
          <div className="rounded-[1.5rem] border border-brand-500/30 bg-brand-500/5 p-4">
            <h3 className="text-lg font-semibold text-white">Generar contrato PDF</h3>
            <p className="mt-2 text-xs text-slate-300">Busca por ID, nombre o número de contrato. Al seleccionar, se completan automáticamente los datos del cliente.</p>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                placeholder="Buscar cliente por ID, nombre o número de contrato"
                value={contractSearch}
                onChange={(e) => setContractSearch(e.target.value)}
              />
              {contractSearch.trim() && (
                <div className="relative z-20 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-soft">
                  {contractCandidates.length === 0 && (
                    <p className="px-3 py-2 text-sm text-amber-300">No encontramos clientes o contratos con esa búsqueda.</p>
                  )}
                  {contractCandidates.slice(0, 5).map((contract) => (
                    (() => {
                      const activeLoans = loans.filter((loan) => Number(loan.cliente_id) === Number(contract.cliente_id) && loan.estado.toLowerCase() === 'activo')
                      return (
                        <button
                          key={contract.id}
                          type="button"
                          onClick={() => {
                            const selectedClient = clients.find((client) => Number(client.id) === Number(contract.cliente_id))
                            setContractForm({
                              cliente_id: String(contract.cliente_id),
                              cliente_nombre: contract.cliente,
                              cliente_identificacion: contract.identificacion || selectedClient?.identificacion || '',
                              cliente_telefono: contract.telefono || selectedClient?.telefono || '',
                              monto: contractForm.monto,
                              cuotas: contractForm.cuotas,
                              frecuencia: contractForm.frecuencia,
                              tasa: contractForm.tasa,
                              fecha_inicio: contractForm.fecha_inicio,
                              fecha_limite_pago: contractForm.fecha_limite_pago,
                              reglas: contractForm.reglas,
                            })
                            setContractSearch(contract.cliente)
                          }}
                          className="flex w-full items-center justify-between gap-4 rounded-xl border border-transparent px-3 py-2 text-left text-sm text-slate-200 hover:border-brand-500/40 hover:bg-slate-800"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{contract.cliente}</span>
                            <span className={`mt-1 block text-xs ${activeLoans.length > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                              {activeLoans.length > 0
                                ? `${activeLoans.length} préstamo(s) activo(s) • Saldo ${formatCurrency(activeLoans.reduce((total, loan) => total + Number(loan.saldo_pendiente || 0), 0))}`
                                : 'Sin préstamos activos'}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-slate-400">ID #{contract.cliente_id}{contract.numero_contrato ? ` • ${contract.numero_contrato}` : ''}</span>
                        </button>
                      )
                    })()
                  ))}
                </div>
              )}
            </div>
            <form onSubmit={handleCreateContract} className="mt-4 space-y-3">
              <select className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" value={contractForm.cliente_id} onChange={(e) => {
                const selected = clients.find((client) => Number(client.id) === Number(e.target.value))
                setContractForm({
                  ...contractForm,
                  cliente_id: e.target.value,
                  cliente_nombre: selected?.nombre || '',
                  cliente_identificacion: selected?.identificacion || '',
                  cliente_telefono: selected?.telefono || '',
                })
              }} required>
                <option value="">Selecciona cliente</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.identificacion || 'Sin ID'} • {client.nombre} • {client.telefono || 'Sin teléfono'}</option>)}
              </select>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Nombre</label>
                  <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" value={contractForm.cliente_nombre} onChange={(e) => setContractForm({ ...contractForm, cliente_nombre: sanitizeLetters(e.target.value) })} placeholder="Nombre completo" readOnly={Boolean(contractForm.cliente_id)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Identificación</label>
                  <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" value={contractForm.cliente_identificacion} onChange={(e) => setContractForm({ ...contractForm, cliente_identificacion: formatIdentificacion(e.target.value) })} placeholder="000-000000-0000X" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Teléfono</label>
                  <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" value={contractForm.cliente_telefono} onChange={(e) => setContractForm({ ...contractForm, cliente_telefono: sanitizeDigits(e.target.value).slice(0, 15) })} placeholder="Número telefónico" />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Monto</label>
                  <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" type="number" min="1" placeholder="Monto prestado" value={contractForm.monto} onChange={(e) => setContractForm({ ...contractForm, monto: e.target.value })} required />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Cuotas</label>
                  <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" type="number" min="1" placeholder="Cuotas" value={contractForm.cuotas} onChange={(e) => setContractForm({ ...contractForm, cuotas: e.target.value })} required />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Frecuencia</label>
                  <select className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" value={contractForm.frecuencia} onChange={(e) => setContractForm({ ...contractForm, frecuencia: e.target.value })}>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Tasa anual</label>
                  <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" type="number" min="0" step="0.01" placeholder="Tasa anual %" value={contractForm.tasa} onChange={(e) => setContractForm({ ...contractForm, tasa: e.target.value })} required />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Fecha y hora de inicio</label>
                  <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" type="datetime-local" value={contractForm.fecha_inicio} onChange={(e) => {
                    const nextDate = e.target.value
                    setContractForm({
                      ...contractForm,
                      fecha_inicio: nextDate,
                      fecha_limite_pago: nextDate,
                    })
                  }} required />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Reglas del contrato</label>
                <textarea rows={7} className="w-full resize-y rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" placeholder="1. ...\n2. ...\n3. ..." value={contractForm.reglas} onChange={(e) => setContractForm({ ...contractForm, reglas: formatContractRules(e.target.value) })} required />
              </div>

              <div className="rounded-[1.5rem] border border-brand-500/30 bg-brand-500/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-white">Plan de cuotas</h4>
                  <span className="rounded-full border border-cyan-400/50 bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-300">Tasa fija: {contractPlanPreview.adjustedRate}%</span>
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-900/80 p-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Monto</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(Number(contractForm.monto || 0))}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/80 p-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Cuotas</p>
                    <p className="mt-1 text-lg font-semibold text-white">{contractForm.cuotas || 1}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/80 p-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Interés total</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(contractPlanPreview.totalInterest)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/80 p-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Total a pagar</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(contractPlanPreview.totalPayable)}</p>
                  </div>
                </div>

                <div className="table-scroll rounded-2xl border border-white/10 bg-slate-900/80">
                  <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                    <thead className="bg-slate-950/80 text-slate-400">
                      <tr>
                        <th className="px-3 py-2">N°</th>
                        <th className="px-3 py-2">Fecha de vencimiento</th>
                        <th className="px-3 py-2">Capital</th>
                        <th className="px-3 py-2">Interés</th>
                        <th className="px-3 py-2">Total de cuotas</th>
                        <th className="px-3 py-2">Saldo pendiente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractPlanPreview.schedule.map((row) => (
                        <tr key={row.num} className="border-t border-white/5">
                          <td className="px-3 py-2 text-slate-200">{row.num}</td>
                          <td className="px-3 py-2 text-slate-300">{row.fecha}</td>
                          <td className="px-3 py-2 text-slate-100">{formatCurrency(row.principal)}</td>
                          <td className="px-3 py-2 text-slate-300">{formatCurrency(row.interes)}</td>
                          <td className="px-3 py-2 text-slate-100">{formatCurrency(row.monto)}</td>
                          <td className="px-3 py-2 text-slate-100">{formatCurrency(row.saldoPendiente)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3">
                <button disabled={!can('prestamos.gestionar')} className="flex-1 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700" type="submit">Generar contrato PDF</button>
                <button type="button" onClick={resetContractForm} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300">Limpiar</button>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-base font-semibold text-white">Préstamos Activos</h4>
                  <div className="flex gap-2">
                    <input
                      placeholder="Buscar préstamo"
                      value={cobranzaSearch}
                      onChange={(e) => setCobranzaSearch(e.target.value)}
                    />
                    <button type="button" onClick={() => setCobranzaSearch(cobranzaSearch.trim())} className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white">Buscar</button>
                    {cobranzaSearch && (
                      <button type="button" onClick={() => setCobranzaSearch('')} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">Limpiar</button>
                    )}
                  </div>
                </div>
                <div className="table-scroll rounded-2xl border border-white/10 bg-slate-950/60">
                  <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                    <thead className="bg-slate-950/80 text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">Monto Original</th>
                        <th className="px-3 py-2">Saldo Pendiente</th>
                        <th className="px-3 py-2">Cuotas Pagadas/Total</th>
                        <th className="px-3 py-2">Tasa</th>
                        <th className="px-3 py-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCobranzaLoans.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                            {normalizedCobranzaSearch ? 'No hay préstamos activos para la búsqueda.' : 'Busca por ID o nombre para consultar los préstamos del cliente.'}
                          </td>
                        </tr>
                      ) : (
                        filteredCobranzaLoans.map((loan) => (
                          <tr key={loan.id} className="border-t border-white/5">
                            <td className="px-3 py-2 text-slate-100">{loan.cliente_nombre}</td>
                            <td className="px-3 py-2 text-slate-300">{formatCurrency(loan.monto_original)}</td>
                            <td className="px-3 py-2 font-semibold text-rose-300" style={{ color: '#ef4444' }}>{formatCurrency(loan.saldo_pendiente)}</td>
                            <td className="px-3 py-2 text-slate-300">{loan.cuotas_pagadas}/{loan.cuotas_totales}</td>
                            <td className="px-3 py-2 text-slate-300">{Number(loan.tasa || 0).toFixed(2)}%</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2">
                                <button type="button" onClick={() => startEditLoan(loan)} className="rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-300 hover:bg-cyan-500/20">Editar</button>
                                <button type="button" onClick={() => void handleDeleteLoan(loan.id)} className="rounded-xl bg-rose-600/80 px-3 py-1.5 text-sm text-white hover:bg-rose-500">Eliminar</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {editingLoanId && selectedLoan && (
                <div className="mt-6 rounded-[1.5rem] border border-brand-500/30 bg-brand-500/5 p-4">
                  <h4 className="mb-3 text-base font-semibold text-white">Editar Préstamo - {selectedLoan.cliente_nombre}</h4>
                  <form onSubmit={handleUpdateLoan} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Cuotas Restantes</label>
                        <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" type="number" min="1" placeholder="Número de cuotas" value={loanForm.cuotas_totales} onChange={(e) => setLoanForm({ ...loanForm, cuotas_totales: e.target.value })} required />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Frecuencia</label>
                        <select className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" value={loanForm.frecuencia} onChange={(e) => setLoanForm({ ...loanForm, frecuencia: e.target.value })}>
                          <option value="semanal">Semanal</option>
                          <option value="quincenal">Quincenal</option>
                          <option value="mensual">Mensual</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Tasa %</label>
                        <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" type="number" min="0" step="0.01" placeholder="Tasa de interés" value={loanForm.tasa} onChange={(e) => setLoanForm({ ...loanForm, tasa: e.target.value })} required />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Información del Préstamo</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-4">
                        <div><p className="text-[10px] text-slate-500">Monto Original</p><p className="text-sm font-semibold text-white">{formatCurrency(selectedLoan.monto_original)}</p></div>
                        <div><p className="text-[10px] text-slate-500">Saldo Pendiente</p><p className="text-sm font-semibold text-white">{formatCurrency(selectedLoan.saldo_pendiente)}</p></div>
                        <div><p className="text-[10px] text-slate-500">Cuotas Pagadas</p><p className="text-sm font-semibold text-white">{selectedLoan.cuotas_pagadas}</p></div>
                        <div><p className="text-[10px] text-slate-500">Cuotas Totales</p><p className="text-sm font-semibold text-white">{selectedLoan.cuotas_totales}</p></div>
                      </div>
                    </div>

                    {loanInstallments.length > 0 && (
                      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">Cuotas Recalculadas</p>
                        <div className="table-scroll">
                          <table className="min-w-full text-left text-xs">
                            <thead className="border-b border-white/10">
                              <tr className="text-slate-400">
                                <th className="py-2 px-2">N°</th>
                                <th className="py-2 px-2">Fecha</th>
                                <th className="py-2 px-2">Cuota</th>
                                <th className="py-2 px-2">Interés</th>
                                <th className="py-2 px-2">Capital</th>
                              </tr>
                            </thead>
                            <tbody>
                              {loanInstallments.map((inst) => (
                                <tr key={inst.id} className="border-t border-white/5">
                                  <td className="py-2 px-2 text-slate-300">{inst.numero_cuota}</td>
                                  <td className="py-2 px-2 text-slate-400">{inst.fecha_vencimiento}</td>
                                  <td className="py-2 px-2 text-slate-100 font-semibold">{formatCurrency(inst.monto_cuota)}</td>
                                  <td className="py-2 px-2 text-slate-400">{formatCurrency(inst.interes)}</td>
                                  <td className="py-2 px-2 text-slate-300">{formatCurrency(inst.capital)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button disabled={!can('prestamos.gestionar')} className="flex-1 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700" type="submit">Actualizar Préstamo</button>
                      <button type="button" onClick={resetLoanForm} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300">Cancelar</button>
                    </div>
                  </form>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    )
  }

  function renderFacturasView() {
    const normalizedSearch = normalizeSearchText(invoiceSearch)
    const filteredInvoices = invoices.filter((invoice) => {
      if (!normalizedSearch) return Number(invoice.saldo_pendiente ?? invoice.monto) > 0
      const haystack = normalizeSearchText(`${invoice.cliente_id} ${invoice.cliente} ${invoice.numero_factura} ${invoice.estado}`)
      return haystack.includes(normalizedSearch)
    })
    const paidInvoices = normalizedSearch
      ? filteredInvoices.filter((invoice) => Number(invoice.total_pagado || 0) > 0 || invoice.estado.toLowerCase() === 'pagada' || Number(invoice.saldo_pendiente ?? invoice.monto) <= 0)
      : []
    const pendingInvoices = filteredInvoices.filter((invoice) => Number(invoice.saldo_pendiente ?? invoice.monto) > 0)

    const renderInvoiceTable = (rows: InvoiceRow[], emptyMessage: string, pendingTable = false) => (
      <div className="table-scroll rounded-2xl border border-white/10 bg-slate-950/60">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              <th className="px-3 py-2">Factura</th>
              <th className="px-3 py-2">ID usuario</th>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Monto</th>
              {!pendingTable && <th className="px-3 py-2">Pagado</th>}
              <th className="px-3 py-2">Saldo pendiente</th>
              {pendingTable && <th className="px-3 py-2">Estado</th>}
              <th className="px-3 py-2">Vencimiento</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={pendingTable ? 8 : 8} className="px-3 py-5 text-center text-slate-400">{emptyMessage}</td></tr>
            ) : rows.map((invoice) => (
              <tr key={invoice.id} className="border-t border-white/5">
                <td className="px-3 py-3 font-medium text-white">{invoice.numero_factura}</td>
                <td className="px-3 py-3 text-slate-300">#{invoice.cliente_id}</td>
                <td className="px-3 py-3 text-slate-200">{invoice.cliente}</td>
                <td className="px-3 py-3 text-slate-200">{formatCurrency(Number(invoice.monto))}</td>
                {!pendingTable && <td className="px-3 py-3 font-semibold text-emerald-300" style={{ color: '#22c55e' }}>{formatCurrency(Number(invoice.total_pagado || 0))}</td>}
                <td className={`px-3 py-3 ${pendingTable ? 'font-semibold text-rose-300' : 'text-slate-200'}`}>{formatCurrency(Number(invoice.saldo_pendiente ?? invoice.monto))}</td>
                {pendingTable && <td className="px-3 py-3 text-slate-300">Pendiente</td>}
                <td className="px-3 py-3 text-slate-300">{invoice.fecha_vencimiento}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEditInvoice(invoice)} className="rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-300 hover:bg-cyan-500/20">Editar</button>
                    <button type="button" onClick={() => void handleDeleteInvoice(invoice.id)} className="rounded-xl bg-rose-600/80 px-3 py-1.5 text-sm text-white hover:bg-rose-500">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

    return (
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
          <h2 className="text-2xl font-semibold text-white">Facturas</h2>
          <p className="mt-2 text-sm text-slate-400">Consulta facturas pendientes y pagadas por usuario.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input className="flex-1 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" placeholder="Buscar por ID de usuario o nombre" value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} />
            <button type="button" onClick={() => setInvoiceSearch(invoiceSearch.trim())} className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white">Buscar</button>
            {invoiceSearch && <button type="button" onClick={() => setInvoiceSearch('')} className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-300">Limpiar</button>}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {normalizedSearch ? `${filteredInvoices.length} factura(s) encontradas` : `${filteredInvoices.length} factura(s) pendiente(s)`}
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
          <h3 className="mb-4 text-lg font-semibold text-white">Facturas pendientes <span className="text-sm font-normal text-amber-300">({pendingInvoices.length})</span></h3>
          {renderInvoiceTable(pendingInvoices, 'No hay facturas pendientes para este filtro.', true)}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
          <h3 className="mb-4 text-lg font-semibold text-white">Facturas pagadas o abonadas <span className="text-sm font-normal text-emerald-300">({paidInvoices.length})</span></h3>
          {renderInvoiceTable(paidInvoices, 'No hay facturas pagadas o abonadas para este filtro.')}
        </div>
      </div>
    )
  }

  function renderClientesView() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0 rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-soft sm:p-6">
          <h2 className="text-2xl font-semibold text-white">Clientes</h2>
          <p className="mt-2 text-sm text-slate-400">Mantén el registro de clientes y su estado actual.</p>

          <div className="table-scroll mt-6 max-w-full rounded-[1.5rem] border border-white/10 bg-slate-900/80">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left">
              <thead className="bg-slate-950/80 text-slate-400">
                <tr>
                  <th className="px-6 py-4 text-sm uppercase tracking-[0.24em]">ID</th>
                  <th className="px-6 py-4 text-sm uppercase tracking-[0.24em]">Nombre</th>
                  <th className="px-6 py-4 text-sm uppercase tracking-[0.24em]">Identificación</th>
                  <th className="px-6 py-4 text-sm uppercase tracking-[0.24em]">Teléfono</th>
                  <th className="px-6 py-4 text-sm uppercase tracking-[0.24em]">Empresa</th>
                  <th className="px-6 py-4 text-sm uppercase tracking-[0.24em]">Estado</th>
                  <th className="px-6 py-4 text-sm uppercase tracking-[0.24em]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-t border-white/5 transition hover:bg-white/5">
                    <td className="px-6 py-4 text-sm text-slate-200">#{client.id}</td>
                    <td className="px-6 py-4 text-sm text-slate-100">{client.nombre}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{client.identificacion || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{client.telefono || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{client.empresa || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${clientStatusBadge(client.estado)}`}>{client.estado}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEditClient(client)} className="rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-300 hover:bg-cyan-500/20">Editar</button>
                        <button type="button" onClick={() => void handleDeleteClient(client.id)} className="rounded-xl bg-rose-600/80 px-3 py-1.5 text-sm text-white hover:bg-rose-500">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-soft sm:p-6">
          <h3 className="text-lg font-semibold text-white">{editingClientId ? 'Editar cliente' : 'Agregar cliente'}</h3>
          <form onSubmit={handleCreateClient} className="mt-6 space-y-3">
            <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" placeholder="Nombre" value={clientForm.nombre} onChange={(e) => setClientForm({ ...clientForm, nombre: sanitizeLetters(e.target.value) })} required />
            <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" placeholder="Email" type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} required />
            <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" placeholder="Identificación personal" value={clientForm.identificacion} onChange={(e) => setClientForm({ ...clientForm, identificacion: formatIdentificacion(e.target.value) })} required />
            <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" placeholder="Teléfono" type="tel" value={clientForm.telefono} onChange={(e) => setClientForm({ ...clientForm, telefono: sanitizeDigits(e.target.value).slice(0, 15) })} required />
            <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" placeholder="Empresa" value={clientForm.empresa} onChange={(e) => setClientForm({ ...clientForm, empresa: sanitizeLetters(e.target.value) })} />
            <select className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" value={clientForm.estado} onChange={(e) => setClientForm({ ...clientForm, estado: e.target.value })}>
              <option value="activo">Activo</option>
              <option value="riesgo">Riesgo</option>
              <option value="inactivo">Inactivo</option>
            </select>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button disabled={!can('clientes.gestionar')} className="flex-1 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700" type="submit">{editingClientId ? 'Actualizar cliente' : 'Guardar cliente'}</button>
              {editingClientId ? <button type="button" onClick={resetClientForm} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300">Cancelar</button> : null}
            </div>
          </form>
        </div>
      </div>
    )
  }

  function renderPagosView() {
    const normalizedPagosSearch = pagosSearch.trim().toLowerCase()
    const filteredPagosList = pagos.filter((item) => {
      if (!normalizedPagosSearch) return true
      return `${item.numero_factura} ${item.metodo} ${item.fecha_pago}`.toLowerCase().includes(normalizedPagosSearch)
    })
    const filteredPagoLoans = loans.filter((loan) => {
      if (selectedPagoClienteId && String(loan.cliente_id) !== selectedPagoClienteId) return false
      if (!loan.estado || loan.estado !== 'activo') return false
      if (!normalizedPagosSearch) return true
      return `${loan.cliente_nombre} ${loan.estado}`.toLowerCase().includes(normalizedPagosSearch)
    })
    const filteredPagoInvoices = invoices.filter((invoice) => {
      if (selectedPagoClienteId && String(invoice.cliente_id) !== selectedPagoClienteId) return false
      if (Number(invoice.saldo_pendiente ?? invoice.monto) <= 0) return false
      if (!normalizedPagosSearch) return true
      return `${invoice.cliente} ${invoice.numero_factura}`.toLowerCase().includes(normalizedPagosSearch)
    })
    const normalizedPagoClienteSearch = normalizeSearchText(pagoClienteSearch)
    const filteredPagoClients = clients.filter((client) => {
      if (!normalizedPagoClienteSearch) return true
      return normalizeSearchText(`${client.id} ${client.nombre} ${client.identificacion || ''} ${client.email}`).includes(normalizedPagoClienteSearch)
    })

    return (
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
          <h2 className="text-2xl font-semibold text-white">Pagos</h2>
          <p className="mt-2 text-sm text-slate-400">Consulta pagos registrados y su método de cobro.</p>

          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
              placeholder="Buscar pagos por factura o método"
              value={pagosSearch}
              onChange={(e) => setPagosSearch(e.target.value)}
            />
            <button type="button" onClick={() => setPagosSearch(pagosSearch.trim())} className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white">Buscar</button>
          </div>

          <div className="mt-6 grid gap-4">
            {filteredPagosList.length === 0 ? (
              <div className="rounded-[1.25rem] border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-400">No hay pagos para la búsqueda seleccionada.</div>
            ) : (
              filteredPagosList.map((item) => (
                <div key={item.id} className="rounded-[1.25rem] border border-white/10 bg-slate-900/80 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-400">{item.numero_factura}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">Cuota asignada</p>
                      <p className="mt-1 text-base font-semibold text-white">{formatCurrency(Number(item.monto))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-300">{item.metodo}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.fecha_pago}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-white">{editingPagoId ? 'Editar pago' : 'Registrar pago'}</h3>
          <p className="mt-2 text-sm text-slate-400">Selecciona un cliente, préstamo o factura para cargar automáticamente la cuota.</p>
          <form onSubmit={handleCreatePago} className="mt-6 space-y-3">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                placeholder="Buscar cliente por ID o nombre"
                value={pagoClienteSearch}
                onChange={(e) => setPagoClienteSearch(e.target.value)}
              />
              {pagoClienteSearch && (
                <button type="button" onClick={() => { setPagoClienteSearch(''); setSelectedPagoClienteId('') }} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/10">Limpiar</button>
              )}
            </div>
            <select
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
              value={selectedPagoClienteId}
              onChange={(e) => {
                const clientId = e.target.value
                setSelectedPagoClienteId(clientId)
                const clientLoans = loans.filter((loan) => loan.cliente_id === Number(clientId) && loan.estado === 'activo')
                const clientInvoices = invoices.filter((invoice) => invoice.cliente_id === Number(clientId) && Number(invoice.saldo_pendiente ?? invoice.monto) > 0)
                if (clientLoans[0]) {
                  setPagoForm((prev) => ({ ...prev, factura_id: '', prestamo_id: String(clientLoans[0].id), monto: '' }))
                  void autoLoadNextInstallment(clientLoans[0].id)
                } else if (clientInvoices[0]) {
                  setPagoForm((prev) => ({ ...prev, factura_id: String(clientInvoices[0].id), prestamo_id: '', monto: String(clientInvoices[0].saldo_pendiente ?? clientInvoices[0].monto) }))
                } else {
                  setPagoForm((prev) => ({ ...prev, factura_id: '', prestamo_id: '', monto: '' }))
                }
              }}
            >
              <option value="">Selecciona cliente</option>
              {filteredPagoClients.map((client) => (
                <option key={client.id} value={client.id}>#{client.id} • {client.nombre}</option>
              ))}
            </select>
            {pagoClienteSearch && filteredPagoClients.length === 0 && (
              <p className="text-sm text-amber-300">No se encontraron clientes con esa búsqueda.</p>
            )}

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Opción 1: Pago por Préstamo</p>
              <select className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" value={pagoForm.prestamo_id} onChange={(e) => { const nextValue = e.target.value; setPagoForm({ ...pagoForm, prestamo_id: nextValue, factura_id: '', cuota_id: '' }); if (nextValue) { void autoLoadNextInstallment(Number(nextValue)) } }}>
                <option value="">Selecciona préstamo</option>
                {filteredPagoLoans.map((loan) => (
                  <option key={loan.id} value={loan.id}>{loan.cliente_nombre} — {formatCurrency(loan.saldo_pendiente)} pendiente</option>
                ))}
              </select>

              {paymentInstallments.length > 0 && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Cuota pendiente</label>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                    value={pagoForm.cuota_id}
                    onChange={(e) => {
                      const cuotaId = e.target.value
                      const selected = paymentInstallments.find((cuota) => String(cuota.id) === cuotaId)
                      setPagoForm((prev) => ({ ...prev, cuota_id: cuotaId, monto: selected ? String(selected.monto_cuota) : prev.monto }))
                    }}
                  >
                    <option value="">Selecciona cuota</option>
                    {paymentInstallments.map((cuota) => (
                      <option key={cuota.id} value={cuota.id}>Cuota {cuota.numero_cuota} — {formatCurrency(cuota.monto_cuota)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Opción 2: Pago por Factura</p>
              <select className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" value={pagoForm.factura_id} onChange={(e) => setPagoForm({ ...pagoForm, factura_id: e.target.value, prestamo_id: '', cuota_id: '', monto: String(Number(invoices.find((invoice) => String(invoice.id) === e.target.value)?.saldo_pendiente ?? invoices.find((invoice) => String(invoice.id) === e.target.value)?.monto ?? 0)) })}>
                <option value="">Selecciona factura</option>
                {filteredPagoInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>{invoice.numero_factura} — {invoice.cliente} — cuota {formatCurrency(Number(invoice.saldo_pendiente ?? invoice.monto))}</option>
                ))}
              </select>
            </div>

            <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" type="number" placeholder="Monto a pagar" value={pagoForm.monto} onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })} required />
            <select className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" value={pagoForm.metodo} onChange={(e) => setPagoForm({ ...pagoForm, metodo: e.target.value })} required>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="cheque">Cheque</option>
            </select>
            <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" type="date" value={pagoForm.fecha_pago} onChange={(e) => setPagoForm({ ...pagoForm, fecha_pago: e.target.value })} required />
            <div className="flex gap-3">
              <button disabled={!can('pagos.gestionar')} className="flex-1 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700" type="submit">{editingPagoId ? 'Actualizar pago' : 'Registrar pago'}</button>
              <button type="button" onClick={() => { resetPagoForm(); setSelectedPagoClienteId(''); setPagoClienteSearch(''); setMessage('Operación de pago cancelada') }} className="rounded-2xl border border-rose-400/40 px-4 py-3 text-sm text-rose-300 hover:bg-rose-500/10">
                Cancelar pago
              </button>
              {editingPagoId ? <button type="button" onClick={resetPagoForm} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300">Cancelar</button> : null}
            </div>
          </form>
        </div>
      </div>
    )
  }

  function renderReportesView() {
    return (
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Reportes</h2>
              <p className="mt-2 text-sm text-slate-400">Consulta tableros, exporta datos y gestiona tipos de reportes con métricas visuales.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={selectedReportType}
                onChange={(event) => setSelectedReportType(event.target.value as ReportType)}
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
              >
                <option value="general">Resumen general</option>
                <option value="clientes">Clientes</option>
                <option value="vencidas">Vencidas</option>
                <option value="pagos">Pagos</option>
                <option value="riesgo">Riesgo</option>
              </select>
              <button type="button" onClick={handleExportExcel} disabled={!can('reportes.exportar')} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Exportar Excel</button>
              <button type="button" onClick={handleExportPdf} disabled={!can('reportes.exportar')} className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700">Imprimir PDF</button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">Reportes personalizados</h3>
              <button onClick={handleCreateReport} className="rounded-2xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white">+ Nuevo reporte</button>
            </div>
            {customReports.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Aún no has generado reportes personalizados.</p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {customReports.map((report) => (
                  <div key={report.id} className="rounded-[1.25rem] border border-white/10 bg-slate-950/70 p-4">
                    <p className="font-semibold text-white">{report.title}</p>
                    <p className="mt-2 text-sm text-slate-400">{report.summary}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">{report.createdAt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{REPORT_TITLES[selectedReportType]}</h3>
                <p className="mt-1 text-sm text-slate-400">Gráfica de barras del tipo de reporte seleccionado.</p>
              </div>
              <span className="rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-sm text-brand-200">
                {getRoleLabel(authUser?.role || 'operador')}
              </span>
            </div>

            {chartData.length > 0 ? (
              <div className="mt-6 rounded-[1.5rem] border border-brand-500/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 shadow-inner">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Tendencia del reporte</p>
                    <p className="text-lg font-semibold text-white">{REPORT_TITLES[selectedReportType]}</p>
                  </div>
                  <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
                    +{Math.max(...chartData.map((entry: { value: number }) => entry.value), 0)} pts
                  </div>
                </div>
                <svg viewBox="0 0 600 240" className="h-64 w-full">
                  <rect x="40" y="20" width="520" height="180" rx="16" fill="#0f172a" stroke="#1e293b" />
                  <line x1="70" y1="180" x2="540" y2="180" stroke="#334155" strokeWidth="1.2" />
                  <line x1="70" y1="40" x2="70" y2="180" stroke="#334155" strokeWidth="1.2" />
                  {chartData.map((item: { label: string; value: number }, index: number) => {
                    const maxValue = Math.max(...chartData.map((entry: { value: number }) => entry.value), 1)
                    const barHeight = Math.max(24, (item.value / maxValue) * 120)
                    const x = 95 + index * 95
                    return (
                      <g key={`${item.label}-${index}`}>
                        <rect x={x} y={180 - barHeight} width="58" height={barHeight} rx="10" fill="url(#barGradient)" />
                        <rect x={x} y={180 - barHeight} width="58" height={barHeight} rx="10" fill="rgba(255,255,255,0.08)" />
                        <text x={x + 29} y="200" textAnchor="middle" fill="#cbd5e1" fontSize="10">{item.label}</text>
                        <text x={x + 29} y={172 - barHeight} textAnchor="middle" fill="#f8fafc" fontSize="11">{item.value}</text>
                      </g>
                    )
                  })}
                  <defs>
                    <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">No hay datos disponibles para la gráfica.</p>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-5">
            <h3 className="text-lg font-semibold text-white">Detalle del reporte</h3>
            <div className="mt-4 space-y-3">
              {currentReportRows.length === 0 ? (
                <p className="text-sm text-slate-400">No hay datos disponibles para mostrar.</p>
              ) : (
                currentReportRows.map((row: Record<string, unknown>, index: number) => (
                  <div key={`${JSON.stringify(row)}-${index}`} className="rounded-[1.25rem] border border-white/10 bg-slate-950/70 p-4">
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-b-0">
                        <span className="text-sm text-slate-400">{key}</span>
                        <span className="text-sm font-semibold text-white">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-5">
            <h3 className="text-lg font-semibold text-white">Resumen de exportación</h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-white">PDF</p>
                <p className="mt-1 text-sm text-slate-400">Se abrirá la vista de impresión para guardar el reporte como documento PDF.</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-white">Excel</p>
                <p className="mt-1 text-sm text-slate-400">Se descargará un archivo CSV compatible con Excel para su análisis.</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-white">Tipo de reporte</p>
                <p className="mt-1 text-sm text-slate-400">Selecciona cualquier vista disponible para actualizar automáticamente la gráfica y el detalle.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderConfiguracionView() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
            <h2 className="text-2xl font-semibold text-white">Configuración</h2>
            <p className="mt-2 text-sm text-slate-400">Administra respaldos, usuarios y preferencias del sistema.</p>

            {canManagePermissions ? (
              <div className="mt-6 rounded-[1.25rem] border border-white/10 bg-slate-900/80 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Permisos por rol</h3>
                    <p className="mt-1 text-sm text-slate-400">Marca las vistas que cada rol puede abrir.</p>
                  </div>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">Solo administrador</span>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="px-3 py-3 font-medium">Vista</th>
                        {ROLE_OPTIONS.map((role) => <th key={role.value} className="px-3 py-3 text-center font-medium">{role.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {VIEW_KEYS.map((view) => (
                        <tr key={view} className="border-b border-white/5 last:border-0">
                          <td className="px-3 py-3 font-medium text-white">{view}</td>
                          {ROLE_OPTIONS.map((role) => {
                            const locked = role.value === 'admin' && view === 'Configuración'
                            return (
                              <td key={role.value} className="px-3 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={permissions[role.value as RoleKey][view]}
                                  disabled={locked}
                                  onChange={() => togglePermission(role.value as RoleKey, view)}
                                  aria-label={`${view} para ${role.label}`}
                                  className="h-4 w-4 accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 border-t border-white/10 pt-5">
                  <h4 className="text-base font-semibold text-white">Funciones del sistema</h4>
                  <p className="mt-1 text-sm text-slate-400">Controla qué operaciones puede ejecutar cada rol.</p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead><tr className="border-b border-white/10 text-slate-400"><th className="px-3 py-3 font-medium">Función</th>{ROLE_OPTIONS.map((role) => <th key={role.value} className="px-3 py-3 text-center font-medium">{role.label}</th>)}</tr></thead>
                      <tbody>{ACTION_KEYS.map((action) => <tr key={action} className="border-b border-white/5 last:border-0"><td className="px-3 py-3 font-medium text-white">{action}</td>{ROLE_OPTIONS.map((role) => <td key={role.value} className="px-3 py-3 text-center"><input type="checkbox" checked={actions[role.value as RoleKey][action]} disabled={role.value === 'admin'} onChange={() => toggleAction(role.value as RoleKey, action)} aria-label={`${action} para ${role.label}`} className="h-4 w-4 accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-50" /></td>)}</tr>)}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 rounded-[1.25rem] border border-white/10 bg-slate-900/80 p-4">
              <p className="text-sm font-semibold text-white">Tema de la interfaz</p>
              <p className="mt-1 text-sm text-slate-400">Elige una apariencia neutra para el sistema.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setThemeMode('dark')} className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${themeMode === 'dark' ? 'border-white bg-black text-white' : 'border-white/10 bg-slate-950 text-slate-300 hover:bg-slate-800'}`}>
                  <span className="flex items-center gap-3 font-semibold">
                    <span className="flex overflow-hidden rounded-md border border-white/20" aria-label="Paleta negro y gris">
                      <span className="h-5 w-5 bg-black" />
                      <span className="h-5 w-5 bg-neutral-500" />
                    </span>
                    Oscuro neutro
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">Negro y gris</span>
                </button>
                <button type="button" onClick={() => setThemeMode('light')} className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${themeMode === 'light' ? 'border-black bg-white text-black' : 'border-white/10 bg-slate-950 text-slate-300 hover:bg-slate-800'}`}>
                  <span className="flex items-center gap-3 font-semibold">
                    <span className="flex overflow-hidden rounded-md border border-slate-400" aria-label="Paleta blanco y negro">
                      <span className="h-5 w-5 bg-white" />
                      <span className="h-5 w-5 bg-black" />
                    </span>
                    Claro neutro
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">Blanco y negro</span>
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={handleBackup} disabled={!canManageBackups} className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white ${canManageBackups ? 'bg-brand-600' : 'cursor-not-allowed bg-slate-700'}`}>
                Crear respaldo
              </button>
              <button onClick={() => handleRestore()} disabled={!canManageBackups || !selectedBackup} className={`rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white ${canManageBackups && selectedBackup ? 'bg-white/10' : 'cursor-not-allowed bg-slate-800/70'}`}>
                Restaurar respaldo seleccionado
              </button>
            </div>

            <div className="mt-6 rounded-[1.25rem] border border-white/10 bg-slate-900/80 p-4">
              <p className="text-sm text-slate-400">Respaldos disponibles</p>
              {backups.length === 0 ? <p className="mt-2 text-sm text-slate-300">No hay respaldos todavía.</p> : (
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <p className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-slate-200">
                    Seleccionado: <span className="font-semibold">{selectedBackup || 'Ninguno'}</span>
                  </p>
                  {backups.map((backup) => (
                    <button
                      key={backup}
                      type="button"
                      onClick={() => setSelectedBackup(backup)}
                      className={`w-full rounded-xl px-3 py-2 text-left transition ${selectedBackup === backup ? 'border border-brand-500/60 bg-brand-500/10 text-white' : 'border border-transparent bg-slate-950/70 text-slate-300 hover:bg-slate-800/60'}`}
                    >
                      {backup}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-white">Usuarios</h3>
          <form onSubmit={handleCreateUsuario} className="mt-6 space-y-3">
            <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" placeholder="Nombre" value={usuarioForm.nombre} onChange={(e) => setUsuarioForm({ ...usuarioForm, nombre: e.target.value })} required />
            <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" placeholder="Email" type="email" value={usuarioForm.email} onChange={(e) => setUsuarioForm({ ...usuarioForm, email: e.target.value })} required />
            <input className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" placeholder={editingUsuarioId ? 'Nueva contraseña (opcional)' : 'Contraseña'} type="password" value={usuarioForm.password} onChange={(e) => setUsuarioForm({ ...usuarioForm, password: e.target.value })} required={!editingUsuarioId} />
            <select className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white" value={usuarioForm.rol} onChange={(e) => setUsuarioForm({ ...usuarioForm, rol: e.target.value })} required>
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <button disabled={!canManageUsers} className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white ${canManageUsers ? 'bg-brand-600' : 'cursor-not-allowed bg-slate-700'}`} type="submit">{editingUsuarioId ? 'Actualizar usuario' : 'Registrar usuario'}</button>
            {editingUsuarioId ? <button type="button" onClick={resetUsuarioForm} className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white">Cancelar edición</button> : null}
          </form>

          <div className="mt-6 rounded-[1.25rem] border border-white/10 bg-slate-900/80 p-4">
            <p className="text-sm text-slate-400">Usuarios registrados</p>
            <div className="mt-3 space-y-2">
              {usuarios.map((user) => (
                <div key={user.id} className="rounded-xl bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{user.nombre}</p>
                      <p className="mt-1">{user.email} • {getRoleLabel(user.rol)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEditUsuario(user)} className="rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20">Editar</button>
                      <button type="button" onClick={() => void handleDeleteUsuario(user.id)} className="rounded-lg border border-rose-400/20 px-2 py-1 text-xs text-rose-300">Eliminar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderView() {
    if (!canAccessView(permissions, authUser?.role, activeView)) {
      return <div className="rounded-[2rem] border border-rose-400/20 bg-rose-500/10 p-6 text-sm text-rose-200">No tienes permiso para acceder a esta vista.</div>
    }
    switch (activeView) {
      case 'Cobranza':
        return renderCobranzaView()
      case 'Facturas':
        return renderFacturasView()
      case 'Clientes':
        return renderClientesView()
      case 'Pagos':
        return renderPagosView()
      case 'Reportes':
        return renderReportesView()
      case 'Configuración':
        return renderConfiguracionView()
      default:
        return renderDashboardView()
    }
  }

  if (!loggedIn) {
    return (
      <main className={`min-h-screen px-4 py-10 sm:px-6 lg:px-8 ${themeMode === 'light' ? 'bg-white text-black' : 'bg-black text-white'}`}>
        <div className={`mx-auto flex max-w-6xl flex-col gap-8 rounded-[2.5rem] border p-8 lg:flex-row lg:p-10 ${themeMode === 'light' ? 'border-slate-300 bg-white shadow-[0_30px_90px_-20px_rgba(15,23,42,0.18)]' : 'border-neutral-700 bg-neutral-950 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)]'}`}>
          <section className="flex-1 space-y-6">
            <div className={`inline-flex rounded-full border px-3 py-1 text-sm ${themeMode === 'light' ? 'border-slate-400 bg-slate-100 text-black' : 'border-neutral-600 bg-neutral-800 text-white'}`}>Sistema integral</div>
            <h1 className={`text-4xl font-semibold sm:text-5xl ${themeMode === 'light' ? 'text-black' : 'text-white'}`}>Aplicación funcional de cobranza con login, formularios, reportes y respaldo de base de datos</h1>
            <p className={`max-w-2xl text-lg leading-8 ${themeMode === 'light' ? 'text-slate-700' : 'text-neutral-300'}`}>Este proyecto integra Front-end, Back-end, microservicios, base de datos y control de versiones en una sola experiencia operativa.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {['Contenedores', 'Control de versiones', 'Front-end', 'Back-end', 'Microservicios', 'Base de datos'].map((item) => (
                <div key={item} className={`rounded-[1.25rem] border p-4 text-sm ${themeMode === 'light' ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-neutral-700 bg-neutral-900 text-neutral-300'}`}>{item}</div>
              ))}
            </div>
          </section>

          <section className={`w-full max-w-md rounded-[2rem] border p-6 shadow-soft ${themeMode === 'light' ? 'border-slate-300 bg-slate-50' : 'border-neutral-700 bg-neutral-900'}`}>
            <h2 className={`text-2xl font-semibold ${themeMode === 'light' ? 'text-black' : 'text-white'}`}>Acceso al sistema</h2>
            <p className={`mt-2 text-sm ${themeMode === 'light' ? 'text-slate-700' : 'text-neutral-300'}`}>Inicia sesión para gestionar clientes, facturas, pagos, seguimientos y respaldos.</p>
            {message ? <p className="mt-4 rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">{message}</p> : null}
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <input className={`w-full rounded-2xl border px-4 py-3 text-sm ${themeMode === 'light' ? 'border-slate-300 bg-white text-black' : 'border-neutral-700 bg-black text-white'}`} type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="Correo" required />
              <input className={`w-full rounded-2xl border px-4 py-3 text-sm ${themeMode === 'light' ? 'border-slate-300 bg-white text-black' : 'border-neutral-700 bg-black text-white'}`} type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="Contraseña" required />
              <button className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${themeMode === 'light' ? 'bg-black text-white hover:bg-neutral-800' : 'bg-neutral-600 text-white hover:bg-neutral-500'}`} style={{ color: '#ffffff' }} type="submit">Entrar</button>
            </form>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex max-w-[1700px] items-start gap-4 xl:gap-6">
        <aside className="hidden w-64 shrink-0 lg:block xl:w-72">
          <Sidebar activeView={activeView} onSelect={handleViewSelect} allowedViews={allowedViews} />
        </aside>

        <section className="min-w-0 flex-1 space-y-4 sm:space-y-5">
          <Header onViewReports={() => setActiveView('Reportes')} onNewReport={handleCreateReport} />
          <MobileNavigation activeView={activeView} onSelect={handleViewSelect} allowedViews={allowedViews} />

          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Panel operativo</p>
              <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">Gestión integral de cobranza</h2>
            </div>
            <button onClick={handleLogout} className="self-start rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/15 sm:self-auto">Cerrar sesión</button>
          </div>

          {message ? <div className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div> : null}

          {renderView()}
        </section>
      </div>
    </main>
  )
}
