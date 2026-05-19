import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)
    
    console.log('🔔 MP Webhook received:', JSON.stringify(body))

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
          console.error('❌ Invalid signature')
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
      }
    }

    const type = body.type || body.topic || body.action || ''
    const entity = body.entity || ''
    
    const isPreapproval = type.includes('preapproval') || 
                          type.includes('subscription') || 
                          entity === 'preapproval' ||
                          body.topic === 'preapproval'
    
    if (!isPreapproval) {
      console.log('⏭️ Skipping non-preapproval event:', type, entity)
      return NextResponse.json({ ok: true })
    }

    const preapprovalId = body.data?.id || body.id
    if (!preapprovalId) {
      console.log('⚠️ No preapproval ID found')
      return NextResponse.json({ ok: true })
    }

    console.log('🔍 Fetching preapproval from MP:', preapprovalId)

    const accessToken = process.env.MP_ACCESS_TOKEN
    const mpResp = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const sub = await mpResp.json()
    
    console.log('📦 MP subscription data:', JSON.stringify(sub))

    if (!mpResp.ok) {
      console.error('❌ MP fetch error:', sub)
      return NextResponse.json({ ok: true })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const ref = sub.external_reference || ''
    const [user_id, plan_id] = ref.split('_')

    if (user_id) {
      await updateUser(supabase, user_id, plan_id, preapprovalId, sub)
      return NextResponse.json({ ok: true })
    }

    // Fallback: buscar por email
    console.log('⚠️ No user_id in external_reference. Trying email fallback:', sub.payer_email)
    
    if (sub.payer_email) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, mp_plan_id')
        .eq('email', sub.payer_email)
        .single()
      
      if (usuario) {
        console.log('✅ Found user by email:', usuario.id)
        await updateUser(supabase, usuario.id, usuario.mp_plan_id || 'starter', preapprovalId, sub)
      } else {
        console.log('❌ User not found by email:', sub.payer_email)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('❌ Webhook error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

async function updateUser(supabase: any, user_id: string, plan_id: string, preapprovalId: string, sub: any) {
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
    updateData.suscripcion_inicio = new Date().toISOString()
  }

  const { error } = await supabase.from('usuarios').update(updateData).eq('id', user_id)
  
  if (error) {
    console.error('❌ Supabase update error:', error)
  } else {
    console.log(`✅ Updated user ${user_id} to ${estado}`)
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, msg: 'PropControl webhook activo' })
}
