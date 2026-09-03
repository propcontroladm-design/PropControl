import { NextResponse } from 'next/server'

// Trae la variación mensual oficial del IPC (INDEC) desde ArgentinaDatos,
// una API pública gratuita que republica los datos oficiales.
// Fuente: https://api.argentinadatos.com/v1/finanzas/indices/inflacion
export async function GET() {
  try {
    const r = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion', {
      next: { revalidate: 3600 }, // cachear 1h, el dato solo cambia ~1 vez por mes
    })
    if (!r.ok) throw new Error('upstream status ' + r.status)
    const data: { fecha: string; valor: number }[] = await r.json()

    // "fecha" viene como YYYY-MM-DD (último día del mes que mide) -> lo pasamos a periodo YYYY-MM
    const mapped = data
      .map(d => {
        const [y, m] = d.fecha.split('-')
        return { periodo: `${y}-${m}`, valor: d.valor }
      })
      .filter(d => d.periodo >= '2015-01') // recorte razonable, evita mandar 80 años de historia

    return NextResponse.json(mapped)
  } catch (e: any) {
    console.error('❌ /api/ipc:', e.message)
    return NextResponse.json({ error: e.message || 'error trayendo IPC' }, { status: 502 })
  }
}
