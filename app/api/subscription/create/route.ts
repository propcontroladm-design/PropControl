import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan_id, mp_plan_id, email, user_id } = body

    if (!email || !user_id || !mp_plan_id) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // Marcar como pendiente en BD
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase.from('usuarios').update({
      mp_plan_id: plan_id,
      suscripcion_estado: 'pendiente',
    }).eq('id', user_id)

    // URL del checkout pre-armado de MP
    // El external_reference se pasa en la URL para que el webhook lo asocie al usuario
    const checkoutUrl = `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${mp_plan_id}&external_reference=${user_id}_${plan_id}`

    return NextResponse.json({ init_point: checkoutUrl })
  } catch (e: any) {
    console.error('Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
