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

    const isPreapproval =
      type.includes('preapproval') ||
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
    console.log('🔑 external_reference:', sub.external_reference)
    console.log('📧 payer_email:', sub.payer_email)
    console.log('📊 status:', sub.status)

    if (!mpResp.ok) {
      console.error('❌ MP fetch error:', sub)
      return NextResponse.json({ ok: true })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const ref = sub.external_reference || ''
    const parts = ref.split('_')
    // external_reference es "user_id_plan_id" pero user_id es un UUID con guiones
    // El UUID tiene 36 chars, lo separamos por la última ocurrencia de "_"
    const lastUnderscore = ref.lastIndexOf('_')
    const user_id = lastUnderscore > 0 ? ref.substring(0, lastUnderscore) : ''
    const plan_id = lastUnderscore > 0 ? ref.substring(lastUnderscore + 1) : ''

    console.log('👤 user_id from ref:', user_id, '| plan_id:', plan_id)

    if (user_id) {
      await updateUser(supabase, user_id, plan_id, preapprovalId, sub)
      return NextResponse.json({ ok: true })
    }

    // Fallback: buscar por email
    console.log('⚠️ No user_id en external_reference. Fallback por email:', sub.payer_email)

    if (sub.payer_email) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, mp_plan_id, plan')
        .eq('email', sub.payer_email)
        .single()

      if (usuario) {
        console.log('✅ Usuario encontrado por email:', usuario.id)
        await updateUser(supabase, usuario.id, usuario.mp_plan_id || usuario.plan || 'starter', preapprovalId, sub)
      } else {
        console.log('❌ Usuario no encontrado por email:', sub.payer_email)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('❌ Webhook error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

async function updateUser(
  supabase: any,
  user_id: string,
  plan_id: string,
  preapprovalId: string,
  sub: any
) {
  let estado = 'activa'
  if (sub.status === 'paused') estado = 'pausada'
  else if (sub.status === 'cancelled') estado = 'cancelada'
  else if (sub.status !== 'authorized') {
    console.log('⚠️ Estado MP desconocido:', sub.status, '— no se actualiza BD')
    return
  }

  // Mapear plan_id al nombre de plan de la app
  const planMap: Record<string, string> = {
    starter: 'starter',
    pro: 'pro',
    pro_anual: 'pro',
  }
  const plan = planMap[plan_id] || 'starter'

  const updateData: any = {
    suscripcion_estado: estado,
    suscripcion_id: preapprovalId,      // nombre original del schema
    mp_subscription_id: preapprovalId,  // nombre alternativo por si existe en prod
    plan,
  }

  if (estado === 'activa') {
    updateData.suscripcion_inicio = new Date().toISOString()
    // Calcular fin: 35 días para mensual, 370 para anual
    const dias = plan_id === 'pro_anual' ? 370 : 35
    updateData.suscripcion_fin = new Date(Date.now() + dias * 86400000).toISOString()
  }

  console.log('📝 Actualizando usuario:', user_id, '→', updateData)

  // Intentar actualizar — si alguna columna no existe, lo intenta sin ella
  const { error } = await supabase.from('usuarios').update(updateData).eq('id', user_id)

  if (error) {
    console.error('❌ Supabase update error (intento 1):', error.message)

    // Reintento con solo columnas seguras que siempre existen en el schema original
    const safeData: any = {
      suscripcion_estado: estado,
      suscripcion_id: preapprovalId,
      plan,
    }
    if (estado === 'activa') {
      safeData.suscripcion_inicio = updateData.suscripcion_inicio
      safeData.suscripcion_fin = updateData.suscripcion_fin
    }

    const { error: error2 } = await supabase.from('usuarios').update(safeData).eq('id', user_id)
    if (error2) {
      console.error('❌ Supabase update error (intento 2 safe):', error2.message)
    } else {
      console.log(`✅ Usuario ${user_id} actualizado (safe) → ${estado}`)
    }
  } else {
    console.log(`✅ Usuario ${user_id} actualizado → ${estado}`)
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, msg: 'PropControl webhook activo' })
}
