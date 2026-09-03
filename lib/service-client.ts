import { NextResponse } from 'next/server'

export async function proxyService(request: Request, serviceUrl: string, targetPath: string, method = request.method, body?: unknown) {
  try {
    const response = await fetch(`${serviceUrl}${targetPath}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })
    const payload = await response.json()
    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    console.error(`Error al conectar con el servicio ${serviceUrl}:`, error)
    return NextResponse.json(
      { ok: false, error: 'Servicio no disponible' },
      { status: 503 }
    )
  }
}

export async function readJson(request: Request) {
  return request.json().catch(() => ({}))
}
