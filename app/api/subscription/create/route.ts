import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan_id, mp_plan_id, email, user_id } = body

    if (!email || !user_id || !mp_plan_id) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const accessToken = process.env.MP_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({ error: 'MercadoPago no configurado' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://prop-control.vercel.app'

    // Crear preferencia de suscripción
    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        preapproval_plan_id: mp_plan_id,
        payer_email: email,
        back_url: `${appUrl}/exito?plan=${plan_id}&user=${user_id}`,
        external_reference: `${user_id}_${plan_id}`,
      }),
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('MP Error:', mpData)
      return NextResponse.json(
        { error: mpData.message || 'Error en MercadoPago', details: mpData },
        { status: 500 }
      )
    }

    // Guardar referencia en BD (opcional)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase.from('usuarios').update({
      mp_subscription_id: mpData.id,
      mp_plan_id: plan_id,
      suscripcion_estado: 'pendiente',
    }).eq('id', user_id)

    return NextResponse.json({ init_point: mpData.init_point, id: mpData.id })
  } catch (e: any) {
    console.error('Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
