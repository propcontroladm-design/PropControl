import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan_id, mp_plan_id, email, user_id } = body

    if (!email || !user_id || !mp_plan_id) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase.from('usuarios').update({
      mp_plan_id: plan_id,
      suscripcion_estado: 'pendiente',
    }).eq('id', user_id)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://prop-control.vercel.app'
    const externalRef = `${user_id}_${plan_id}`

    // Crear preapproval por API (no usar link directo)
    // Esto asegura que MP dispare el webhook correctamente
    const mpResp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preapproval_plan_id: mp_plan_id,
        payer_email: email,
        external_reference: externalRef,
        back_url: `${appUrl}/exito`,
        notification_url: `${appUrl}/api/webhook`,
        status: 'pending', // se vuelve "authorized" cuando paga
      }),
    })

    const data = await mpResp.json()

    if (!mpResp.ok) {
      console.error('MP API error:', data)
      // Si falla la API, fallback al link directo
      const checkoutUrl = `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${mp_plan_id}&external_reference=${externalRef}`
      return NextResponse.json({ init_point: checkoutUrl, fallback: true })
    }

    // Guardar el preapproval_id en BD para tracking
    await supabase.from('usuarios').update({
      mp_subscription_id: data.id,
    }).eq('id', user_id)

    console.log('Preapproval created:', data.id, 'for user', user_id)

    // init_point es el link al que tiene que ir el usuario
    return NextResponse.json({ init_point: data.init_point })
  } catch (e: any) {
    console.error('Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
