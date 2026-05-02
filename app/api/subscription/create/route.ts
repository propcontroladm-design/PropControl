import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

const PRECIOS: Record<string, { monto: number; descripcion: string; frecuencia: string }> = {
  starter: { monto: 9900, descripcion: 'PropControl Starter - Hasta 10 propiedades', frecuencia: 'months' },
  pro: { monto: 19900, descripcion: 'PropControl Pro - Propiedades ilimitadas', frecuencia: 'months' },
  pro_anual: { monto: 179900, descripcion: 'PropControl Pro Anual', frecuencia: 'years' },
}

export async function POST(req: NextRequest) {
  try {
    const { planId, userId, email } = await req.json()
    const plan = PRECIOS[planId]
    if (!plan) return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })

    // Crear preferencia de pago en MercadoPago
    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        preapproval_plan_id: null, // para suscripción sin plan previo
        reason: plan.descripcion,
        external_reference: `${userId}_${planId}`,
        payer_email: email,
        auto_recurring: {
          frequency: 1,
          frequency_type: plan.frecuencia,
          transaction_amount: plan.monto,
          currency_id: 'ARS',
          free_trial: {
            frequency: 15,
            frequency_type: 'days'
          }
        },
        back_url: `${APP_URL}/api/subscription/success?userId=${userId}&plan=${planId}`,
        status: 'pending'
      })
    })

    const mpData = await mpRes.json()

    if (mpData.init_point) {
      // Guardar referencia en Supabase
      await supabaseAdmin
        .from('usuarios')
        .update({
          suscripcion_id: mpData.id,
          suscripcion_estado: 'pendiente',
          plan: planId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      return NextResponse.json({ init_point: mpData.init_point, id: mpData.id })
    }

    console.error('MP Error:', mpData)
    return NextResponse.json({ error: 'Error creando suscripción', details: mpData }, { status: 500 })

  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
