import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan_id, mp_plan_id, email, user_id } = body

    console.log('🔵 Subscription create:', { plan_id, mp_plan_id, email, user_id })

    if (!email || !user_id || !mp_plan_id) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://prop-control.vercel.app'
    const externalRef = `${user_id}_${plan_id}`

    // Crear preapproval via API de MP para que external_reference quede guardado
    // en el objeto y llegue al webhook cuando se procese el pago.
    // Usar la URL de checkout directa NO guarda el external_reference.
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
      }),
    })

    const mpData = await mpResp.json()
    console.log('📦 MP preapproval response:', JSON.stringify(mpData))

    if (!mpResp.ok || !mpData.init_point) {
      console.error('❌ MP error:', mpData)
      return NextResponse.json(
        { error: mpData.message || 'Error creando suscripción en MercadoPago' },
        { status: 500 }
      )
    }

    console.log('✅ Preapproval creado. init_point:', mpData.init_point)
    return NextResponse.json({ init_point: mpData.init_point })
  } catch (e: any) {
    console.error('❌ Server error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
