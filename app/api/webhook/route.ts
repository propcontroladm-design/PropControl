import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('MP Webhook:', body)

    // Solo procesamos preapproval (suscripciones)
    if (body.type !== 'preapproval' && body.topic !== 'preapproval') {
      return NextResponse.json({ ok: true })
    }

    const preapprovalId = body.data?.id || body.id
    if (!preapprovalId) {
      return NextResponse.json({ ok: true })
    }

    // Consultar estado en MP
    const accessToken = process.env.MP_ACCESS_TOKEN
    const mpResp = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const sub = await mpResp.json()

    if (!mpResp.ok) {
      console.error('MP fetch error:', sub)
      return NextResponse.json({ ok: true })
    }

    // sub.external_reference = "userId_planId"
    const ref = sub.external_reference || ''
    const [user_id, plan_id] = ref.split('_')

    if (!user_id) {
      return NextResponse.json({ ok: true })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Actualizar estado según MP
    let estado = 'pendiente'
    if (sub.status === 'authorized') estado = 'activa'
    else if (sub.status === 'paused') estado = 'pausada'
    else if (sub.status === 'cancelled') estado = 'cancelada'

    await supabase.from('usuarios').update({
      suscripcion_estado: estado,
      mp_subscription_id: preapprovalId,
      mp_plan_id: plan_id,
      suscripcion_fin: estado === 'activa' ? new Date(Date.now() + 35 * 86400000).toISOString() : null,
    }).eq('id', user_id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Webhook error:', e)
    return NextResponse.json({ ok: false, error: e.message })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, msg: 'PropControl webhook' })
}
