import { NextResponse } from 'next/server'
import { PDFDocument as PDFLibDocument, StandardFonts, rgb } from 'pdf-lib'
import dayjs from 'dayjs'
import { promises as fs } from 'fs'
import path from 'path'
import { query } from '@/lib/db'

type Body = {
  cliente_id: number
  monto: number
  cuotas: number
  frecuencia: 'semanal' | 'quincenal' | 'mensual'
  tasa?: number
  fecha_inicio?: string
  fecha_limite_pago?: string
  reglas?: string
}

function normalizeDateTimeValue(input?: string) {
  if (!input) return dayjs().format('YYYY-MM-DDTHH:mm')
  const normalized = input.includes('T') ? input : `${input}T00:00`
  return normalized
}

const EMPRESA_NOMBRE = process.env.EMPRESA_NOMBRE || 'Cobranza Express'
const EMPRESA_DESCRIPCION = process.env.EMPRESA_DESCRIPCION || 'Empresa dedicada a financiamiento, gestión de cobro y atención a clientes con procesos claros, responsables y seguros.'

async function ensureContratosTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS contratos (
      id SERIAL PRIMARY KEY,
      cliente_id INT,
      numero_contrato VARCHAR(50),
      monto NUMERIC(14,2),
      cuotas INT,
      frecuencia VARCHAR(20),
      tasa NUMERIC(6,4),
      fecha_limite_pago DATE,
      reglas TEXT,
      creado_en TIMESTAMP DEFAULT now()
    )
  `)

  const columns = await query<any[]>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contratos'
  `)

  const existing = new Set(columns.map((row) => row.column_name))
  const requiredColumns = [
    { name: 'numero_contrato', type: 'VARCHAR(50)' },
    { name: 'cliente_id', type: 'INT' },
    { name: 'monto', type: 'NUMERIC(14,2)' },
    { name: 'cuotas', type: 'INT' },
    { name: 'frecuencia', type: 'VARCHAR(20)' },
    { name: 'tasa', type: 'NUMERIC(6,4)' },
    { name: 'fecha_limite_pago', type: 'DATE' },
    { name: 'reglas', type: 'TEXT' },
    { name: 'creado_en', type: 'TIMESTAMP DEFAULT now()' },
  ]

  for (const column of requiredColumns) {
    if (!existing.has(column.name)) {
      await query(`ALTER TABLE contratos ADD COLUMN ${column.name} ${column.type}`)
    }
  }

  const indexRows = await query<any[]>(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'contratos' AND indexname = 'contratos_numero_contrato_idx'
  `)

  if (indexRows.length === 0) {
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS contratos_numero_contrato_idx
      ON contratos (numero_contrato)
      WHERE numero_contrato IS NOT NULL
    `)
  }
}

async function ensureIdentificacionColumn() {
  const result = await query<any[]>(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'identificacion' LIMIT 1`)
  if (result.length === 0) {
    await query(`ALTER TABLE clientes ADD COLUMN identificacion VARCHAR(25)`) 
  }
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function padNumber(n: number, width = 4) {
  return String(n).padStart(width, '0')
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Cliente'
}

function periodsPerYear(freq: string) {
  if (freq === 'semanal') return 52
  if (freq === 'quincenal') return 26
  return 12
}

const FIXED_INTEREST_RATE = 12

function getPeriodsPerYear(frecuencia: string) {
  if (frecuencia === 'semanal') return 52
  if (frecuencia === 'quincenal') return 24
  return 12
}

function buildContractPlan({ monto, cuotas, frecuencia, tasa, fechaLimite }: { monto: number; cuotas: number; frecuencia: string; tasa: number; fechaLimite: string }) {
  const principal = Number(monto) || 0
  const installments = Math.max(1, Number(cuotas) || 1)
  const annualRate = Number.isFinite(tasa) && tasa > 0 ? Number(tasa) : FIXED_INTEREST_RATE
  const periodRate = annualRate / 100 / getPeriodsPerYear(frecuencia)
  const quota = principal > 0 && periodRate > 0
    ? principal * ((periodRate * Math.pow(1 + periodRate, installments)) / (Math.pow(1 + periodRate, installments) - 1))
    : principal / installments

  let saldo = principal
  const schedule: Array<{ num: number; fecha: string; monto: number; principal: number; interes: number }> = []
  let current = dayjs(fechaLimite || new Date().toISOString().slice(0, 10))

  for (let i = 1; i <= installments; i++) {
    const step = frecuencia === 'semanal' ? 7 : frecuencia === 'quincenal' ? 14 : 30
    current = current.add(step, 'day')

    const interes = Number((saldo * periodRate).toFixed(2))
    const capital = Number((quota - interes).toFixed(2))
    const saldoNuevo = Number((saldo - capital).toFixed(2))

    schedule.push({
      num: i,
      fecha: current.format('YYYY-MM-DD'),
      monto: Number(quota.toFixed(2)),
      principal: capital,
      interes,
    })

    saldo = saldoNuevo
  }

  const totalInterest = Number(schedule.reduce((sum, row) => sum + row.interes, 0).toFixed(2))
  const totalPayable = Number((principal + totalInterest).toFixed(2))

  return {
    adjustedRate: annualRate,
    totalInterest,
    totalPayable,
    installmentAmount: Number(quota.toFixed(2)),
    schedule,
  }
}

export async function POST(request: Request) {
  try {
    await ensureIdentificacionColumn()
    const body = (await request.json()) as Body
    if (!body || !body.cliente_id || !body.monto || !body.cuotas || !body.frecuencia) {
      return NextResponse.json({ ok: false, error: 'Datos incompletos' }, { status: 400 })
    }

    const baseTasa = Number(body.tasa ?? Number(process.env.DEFAULT_TASA_ANUAL ?? 12))
    const fechaInicio = normalizeDateTimeValue(body.fecha_inicio || body.fecha_limite_pago)
    const fechaLimite = normalizeDateTimeValue(body.fecha_limite_pago || body.fecha_inicio)
    const reglas = body.reglas || '1. El cliente debe pagar en las fechas indicadas.\n2. El pago atrasado genera interés según la tasa acordada.\n3. El cliente acepta la firma del contratista y del cliente.\n4. El pago debe realizarse según la frecuencia acordada y la fecha establecida.\n5. Cualquier atraso generará interés sobre el saldo pendiente.\n6. La empresa podrá realizar seguimiento y recordatorios por medio telefónico o escrito.\n7. El cliente acepta la información y condiciones del préstamo de manera voluntaria.'

    await ensureContratosTable()

    const count = await query<any[]>(`
      SELECT COALESCE(MAX((substring(numero_contrato from 7))::int), 0) + 1 AS siguiente
      FROM contratos
      WHERE numero_contrato ~ '^CONTR-[0-9]+$'
    `)
    const contratoId = Number(count[0]?.siguiente || 1)
    const contratoNumber = `CONTR-${padNumber(contratoId)}`

    const plan = buildContractPlan({
      monto: Number(body.monto),
      cuotas: Number(body.cuotas),
      frecuencia: body.frecuencia,
      tasa: baseTasa,
      fechaLimite: fechaInicio.slice(0, 10),
    })

    const tasa = plan.adjustedRate

    await query(
      `INSERT INTO contratos (cliente_id, numero_contrato, monto, cuotas, frecuencia, tasa, fecha_limite_pago, reglas, creado_en) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [body.cliente_id, contratoNumber, Number(body.monto), Number(body.cuotas), body.frecuencia, tasa, fechaLimite.slice(0, 16), reglas]
    )

    const contratoRows = await query<any[]>(`SELECT id FROM contratos WHERE numero_contrato = $1 LIMIT 1`, [contratoNumber])
    const contratoDbId = Number(contratoRows[0]?.id)
    const prestamoResult = await query<any[]>(
      `INSERT INTO prestamos (cliente_id, contrato_id, monto_original, saldo_pendiente, cuotas_totales, cuotas_pagadas, frecuencia, tasa, fecha_inicio, fecha_proximo_pago, estado)
       VALUES ($1, $2, $3, $3, $4, 0, $5, $6, $7, $8, 'activo') RETURNING id`,
      [body.cliente_id, contratoDbId, Number(body.monto), Number(body.cuotas), body.frecuencia, tasa, fechaInicio.slice(0, 10), plan.schedule[0]?.fecha || fechaLimite.slice(0, 10)]
    )
    const prestamoId = Number(prestamoResult[0]?.id)
    let saldoCuotas = Number(body.monto)
    for (const cuota of plan.schedule) {
      saldoCuotas = Number(Math.max(0, saldoCuotas - cuota.principal).toFixed(2))
      await query(
        `INSERT INTO cuotas (prestamo_id, numero_cuota, fecha_vencimiento, capital, interes, monto_cuota, saldo_pendiente, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')`,
        [prestamoId, cuota.num, cuota.fecha, cuota.principal, cuota.interes, cuota.monto, saldoCuotas]
      )
    }

    const clienteRows = await query<any[]>(`SELECT id, nombre, email, telefono, identificacion FROM clientes WHERE id = ? LIMIT 1`, [body.cliente_id])
    const cliente = clienteRows[0] || { id: body.cliente_id, nombre: 'Cliente', email: '', telefono: '', identificacion: '' }

    const { totalInterest, totalPayable, installmentAmount: installment, schedule } = plan

    const pdfDoc = await PDFLibDocument.create()
    const page = pdfDoc.addPage([595, 842])
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontSizeTitle = 16
    const fontSizeNormal = 10
    let y = 820

    const printField = (label: string, value: string, indent = 50) => {
      page.drawText(`${label}: ${value}`, { x: indent, y, size: fontSizeNormal, font: helveticaFont })
      y -= 15
    }

    page.drawText('Contrato de Préstamo', { x: 200, y, size: fontSizeTitle, font: helveticaFont })
    y -= 20
    page.drawText(EMPRESA_NOMBRE, { x: 50, y, size: 12, font: helveticaFont })
    y -= 14
    const companyDescriptionLines = wrapText(EMPRESA_DESCRIPCION, 95)
    companyDescriptionLines.forEach((line) => {
      if (y < 80) {
        const newPage = pdfDoc.addPage([595, 842])
        y = 820
        page.drawText('', { x: 0, y: 0 })
      }
      page.drawText(line, { x: 50, y, size: fontSizeNormal, font: helveticaFont })
      y -= 12
    })
    y -= 10
    printField('Número de contrato', contratoNumber)
    printField('Fecha del contrato', dayjs().format('YYYY-MM-DD'))
    printField('ID del cliente', String(cliente.id))
    printField('Cliente', cliente.nombre)
    printField('Número de identificación', cliente.identificacion || 'Sin identificación registrada')
    printField('Email', cliente.email)
    printField('Teléfono', cliente.telefono || 'Sin teléfono registrado')
    printField('Monto prestado', `C$ ${Number(body.monto).toFixed(2)}`)
    printField('Cuotas', `${body.cuotas} (${body.frecuencia})`)
    printField('Tasa anual', `${tasa}%`)
    printField('Interés total', `C$ ${totalInterest.toFixed(2)}`)
    printField('Total a pagar', `C$ ${totalPayable.toFixed(2)}`)
    printField('Fecha de inicio', fechaInicio)
    printField('Fecha límite de pago', fechaLimite)
    y -= 10

    page.drawText('Reglas del contrato:', { x: 50, y, size: fontSizeNormal, font: helveticaFont })
    y -= 15
    const ruleLines = wrapText(
      `${reglas}`,
      95
    )
    ruleLines.forEach((line) => {
      if (y < 80) {
        const newPage = pdfDoc.addPage([595, 842])
        y = 820
        page.drawText('', { x: 0, y: 0 })
      }
      page.drawText(line, { x: 50, y, size: fontSizeNormal, font: helveticaFont })
      y -= 15
    })

    y -= 10
    page.drawText('Tabla de cuotas:', { x: 50, y, size: fontSizeNormal, font: helveticaFont })
    y -= 18
    page.drawText('N°', { x: 50, y, size: fontSizeNormal, font: helveticaFont })
    page.drawText('Fecha', { x: 90, y, size: fontSizeNormal, font: helveticaFont })
    page.drawText('Monto', { x: 210, y, size: fontSizeNormal, font: helveticaFont })
    page.drawText('Principal', { x: 300, y, size: fontSizeNormal, font: helveticaFont })
    page.drawText('Interés', { x: 390, y, size: fontSizeNormal, font: helveticaFont })
    y -= 14

    schedule.forEach((row) => {
      if (y < 80) {
        const newPage = pdfDoc.addPage([595, 842])
        y = 820
        page.drawText('', { x: 0, y: 0 })
      }
      page.drawText(String(row.num), { x: 50, y, size: fontSizeNormal, font: helveticaFont })
      page.drawText(row.fecha, { x: 90, y, size: fontSizeNormal, font: helveticaFont })
      page.drawText(`C$ ${row.monto.toFixed(2)}`, { x: 210, y, size: fontSizeNormal, font: helveticaFont })
      page.drawText(`C$ ${row.principal.toFixed(2)}`, { x: 300, y, size: fontSizeNormal, font: helveticaFont })
      page.drawText(`C$ ${row.interes.toFixed(2)}`, { x: 390, y, size: fontSizeNormal, font: helveticaFont })
      y -= 14
    })

    y -= 20
    page.drawText('Firmas:', { x: 50, y, size: fontSizeNormal, font: helveticaFont })
    y -= 30
    page.drawText('__________________________', { x: 50, y, size: fontSizeNormal, font: helveticaFont })
    page.drawText('__________________________', { x: 300, y, size: fontSizeNormal, font: helveticaFont })
    y -= 12
    page.drawText('Firma del Contratista', { x: 50, y, size: fontSizeNormal, font: helveticaFont })
    page.drawText('Firma del Cliente', { x: 300, y, size: fontSizeNormal, font: helveticaFont })

    const pdfBytes = await pdfDoc.save()
    const pdfBuffer = Buffer.from(pdfBytes)
    const contratosDir = path.join(process.cwd(), 'contratos')
    await fs.mkdir(contratosDir, { recursive: true })
    const contratoDate = dayjs().format('YYYY-MM-DD')
    const clienteFileName = sanitizeFileName(String(cliente.nombre))
    const fileName = `${clienteFileName}_${contratoDate}_${contratoNumber}.pdf`
    const filePath = path.join(contratosDir, fileName)
    await fs.writeFile(filePath, pdfBuffer)

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Contrato-Archivo': fileName,
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function GET() {
  try {
    await ensureIdentificacionColumn()
    const contratos = await query<any[]>(`
      SELECT c.id, c.numero_contrato, c.cliente_id, cl.nombre AS cliente, cl.identificacion, cl.telefono, c.monto, c.cuotas, c.frecuencia, c.tasa, c.fecha_limite_pago
      FROM contratos c
      LEFT JOIN clientes cl ON cl.id = c.cliente_id
      ORDER BY c.id DESC
    `)

    return NextResponse.json({ ok: true, contratos })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
