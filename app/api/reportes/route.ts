import { proxyService } from '@/lib/service-client'

export async function GET(request: Request) {
  const tipo = new URL(request.url).searchParams.get('tipo') || 'general'
  return proxyService(request, process.env.REPORTS_SERVICE_URL || 'http://reports:4002', `/reports?type=${encodeURIComponent(tipo)}`)
}
