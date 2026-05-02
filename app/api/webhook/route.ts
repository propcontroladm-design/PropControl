import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, data } = body

    if (type === 'preapproval') {
      const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${data.id}`, {
        headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      })
      const preapproval = await mpRes.json()
      const [userId, planId] = (preapproval.external_reference || '').split('_')
      if (!userId) return NextResponse.json({ ok: true })

      let estado = 'pendiente'
      if (preapproval.status === 'authorized') estado = 'activa'
      else if (preapproval.status === 'paused') estado = 'pausada'
      else if (preapproval.status === 'cancelled') estado = 'cancelada'

      await supabaseAdmin.from('usuarios').update({
        suscripcion_estado: estado,
        suscripcion_id: preapproval.id,
        plan: planId || 'pro',
        suscripcion_inicio: preapproval.date_created,
        updated_at: new Date().toISOString()
      }).eq('id', userId)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Webhook error:', e)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
