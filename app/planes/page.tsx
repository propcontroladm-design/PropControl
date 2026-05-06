'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PLANES = [
  {
    id: 'starter',
    nombre: 'Starter',
    precio: 9900,
    periodo: '/mes',
    desc: 'Hasta 10 propiedades',
    mp_plan_id: '7302efeb23354c44b9680cdab2545cd6',
    features: [
      'Hasta 10 propiedades',
      'Contratos y pagos',
      'Inquilinos ilimitados',
      'Reportes básicos',
      'Soporte por email',
    ],
    pop: false,
  },
  {
    id: 'pro',
    nombre: 'Pro',
    precio: 19900,
    periodo: '/mes',
    desc: 'Propiedades ilimitadas',
    mp_plan_id: '098474a629c04308849afc155db0be49',
    features: [
      'Propiedades ilimitadas',
      'Todo lo del Starter',
      'ROI y rentabilidad',
      'Expensas por edificio',
      'Propietarios múltiples',
      'WhatsApp automático',
      'Soporte prioritario',
    ],
    pop: true,
  },
  {
    id: 'pro_anual',
    nombre: 'Pro Anual',
    precio: 179900,
    periodo: '/año',
    desc: 'Ahorrás 2 meses',
    mp_plan_id: 'bdb7f64dc25c49a2bee8e7198b43e106',
    features: [
      'Todo lo del plan Pro',
      'Precio fijo todo el año',
      '2 meses gratis',
      'Factura anual',
    ],
    pop: false,
  },
]

export default function Planes() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/')
        return
      }
      setUser(session.user)
      const { data } = await sb.from('usuarios').select('*').eq('id', session.user.id).single()
      setUserData(data)
    })
  }, [])

  async function suscribirse(plan: any) {
    if (!user) return
    setLoading(plan.id)
    try {
      const r = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan.id,
          mp_plan_id: plan.mp_plan_id,
          email: user.email,
          user_id: user.id,
        }),
      })
      const data = await r.json()
      if (data.init_point) {
        window.location.href = data.init_point
      } else {
        alert('Error: ' + (data.error || 'No se pudo crear la suscripción'))
        setLoading(null)
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
      setLoading(null)
    }
  }

  const diasTrial = userData
    ? Math.max(0, Math.ceil((new Date(userData.trial_fin).getTime() - Date.now()) / 86400000))
    : 0

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>← Dashboard</a>
        <span style={{ fontWeight: 800, fontSize: 17, color: '#1e3a8a' }}>Prop<span style={{ color: '#16a34a' }}>Control</span></span>
        <div style={{ width: 80 }} />
      </nav>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 32, fontWeight: 900, color: '#1e3a8a', marginBottom: 8 }}>Elegí tu plan</h1>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 15, marginBottom: 30 }}>
          {userData?.suscripcion_estado === 'trial' && diasTrial > 0
            ? `Te quedan ${diasTrial} días de prueba gratis`
            : userData?.suscripcion_estado === 'activa'
            ? 'Tu suscripción está activa'
            : 'Suscribite para seguir usando PropControl'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          {PLANES.map((pl) => (
            <div key={pl.id} style={{
              background: pl.pop ? 'linear-gradient(135deg,#1e3a8a,#2563eb)' : 'white',
              borderRadius: 18,
              padding: 24,
              border: pl.pop ? '2px solid #2563eb' : '2px solid #e5e7eb',
              boxShadow: pl.pop ? '0 8px 32px rgba(30,58,138,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
              position: 'relative',
            }}>
              {pl.pop && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#16a344', color: 'white', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>MÁS POPULAR</div>}
              <div style={{ fontWeight: 700, fontSize: 12, color: pl.pop ? 'rgba(255,255,255,0.6)' : '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{pl.nombre}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: pl.pop ? 'white' : '#1e3a8a', marginBottom: 4 }}>
                ${pl.precio.toLocaleString('es-AR')}<span style={{ fontSize: 14, fontWeight: 400, color: pl.pop ? 'rgba(255,255,255,0.6)' : '#6b7280' }}>{pl.periodo}</span>
              </div>
              <p style={{ color: pl.pop ? 'rgba(255,255,255,0.7)' : '#6b7280', fontSize: 13, marginBottom: 20 }}>{pl.desc}</p>
              <ul style={{ listStyle: 'none', marginBottom: 24, padding: 0 }}>
                {pl.features.map((f, j) => (
                  <li key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, fontSize: 13, color: pl.pop ? 'rgba(255,255,255,0.9)' : '#374151' }}>
                    <span style={{ color: pl.pop ? '#86efac' : '#16a344', fontWeight: 700 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => suscribirse(pl)} disabled={loading !== null} style={{
                width: '100%',
                background: pl.pop ? '#16a344' : '#1e3a8a',
                color: 'white',
                padding: '13px',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 15,
                cursor: loading ? 'wait' : 'pointer',
                border: 'none',
                opacity: loading && loading !== pl.id ? 0.5 : 1,
              }}>
                {loading === pl.id ? 'Conectando...' : 'Suscribirme'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 30, padding: 16, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
          <p style={{ marginBottom: 6 }}>💳 Pago seguro vía MercadoPago</p>
          <p>Podés cancelar tu suscripción en cualquier momento desde tu panel.</p>
        </div>
      </div>
    </div>
  )
}
