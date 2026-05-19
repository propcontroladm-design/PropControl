import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan_id, mp_plan_id, email, user_id } = body

    console.log('🔵 Subscription create:', { plan_id, mp_plan_id, email, user_id })

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

    // Construir checkout URL con external_reference
    // El external_reference SE PROPAGA al preapproval cuando el usuario completa el pago
    // Esto SÍ dispara el webhook configurado en MP
    const checkoutUrl = `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${mp_plan_id}&external_reference=${encodeURIComponent(externalRef)}`

    console.log('✅ Returning checkout URL with external_reference:', checkoutUrl)

    return NextResponse.json({ init_point: checkoutUrl })
  } catch (e: any) {
    console.error('❌ Server error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
