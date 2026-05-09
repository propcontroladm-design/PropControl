import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)
    
    console.log('MP Webhook received:', JSON.stringify(body))

    // Verificar firma HMAC si tenemos secret configurado
    const secret = process.env.MP_WEBHOOK_SECRET
    if (secret) {
      const xSignature = request.headers.get('x-signature')
      const xRequestId = request.headers.get('x-request-id')
      const dataId = body.data?.id || ''
      
      if (xSignature && xRequestId) {
        const parts = xSignature.split(',')
        let ts = ''
        let v1 = ''
        for (const p of parts) {
          const [k, v] = p.trim().split('=')
          if (k === 'ts') ts = v
          if (k === 'v1') v1 = v
        }
        
        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
        const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
        
        if (hmac !== v1) {
          console.error('Invalid signature')
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
      }
    }

    // Solo procesamos preapproval (suscripciones)
    if (body.type !== 'preapproval' && body.topic !== 'preapproval') {
      console.log('Skipping non-preapproval event:', body.type || body.topic)
      return NextResponse.json({ ok: true })
    }

    const preapprovalId = body.data?.id || body.id
    if (!preapprovalId) {
      console.log('No preapproval ID')
      return NextResponse.json({ ok: true })
    }

    // Consultar estado en MP
    const accessToken = process.env.MP_ACCESS_TOKEN
    const mpResp = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const sub = await mpResp.json()
    
    console.log('MP subscription data:', JSON.stringify(sub))

    if (!mpResp.ok) {
      console.error('MP fetch error:', sub)
      return NextResponse.json({ ok: true })
    }

    const ref = sub.external_reference || ''
    const [user_id, plan_id] = ref.split('_')

    if (!user_id) {
      console.log('No user_id in external_reference:', ref)
      return NextResponse.json({ ok: true })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let estado = 'pendiente'
    if (sub.status === 'authorized') estado = 'activa'
    else if (sub.status === 'paused') estado = 'pausada'
    else if (sub.status === 'cancelled') estado = 'cancelada'

    const updateData: any = {
      suscripcion_estado: estado,
      mp_subscription_id: preapprovalId,
      mp_plan_id: plan_id,
    }
    
    if (estado === 'activa') {
      updateData.suscripcion_fin = new Date(Date.now() + 35 * 86400000).toISOString()
    }

    const { error } = await supabase.from('usuarios').update(updateData).eq('id', user_id)
    
    if (error) {
      console.error('Supabase update error:', error)
    } else {
      console.log(`Updated user ${user_id} to ${estado}`)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Webhook error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, msg: 'PropControl webhook activo' })
}
