'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const PLANES = [
  {
    id: 'starter',
    nombre: 'Starter',
    precio: 9900,
    descripcion: 'Hasta 10 propiedades',
    features: ['Hasta 10 propiedades','Contratos y pagos','Inquilinos ilimitados','Reportes básicos','Soporte por email'],
    popular: false,
    mp_plan_id: '' // Se completa con el ID real de MercadoPago
  },
  {
    id: 'pro',
    nombre: 'Pro',
    precio: 19900,
    descripcion: 'Propiedades ilimitadas',
    features: ['Propiedades ilimitadas','Todo lo del Starter','ROI y rentabilidad','Expensas por edificio','Propietarios múltiples','Índices personalizados','WhatsApp automático','Soporte prioritario'],
    popular: true,
    mp_plan_id: '' // Se completa con el ID real de MercadoPago
  },
  {
    id: 'pro_anual',
    nombre: 'Pro Anual',
    precio: 179900,
    descripcion: 'Ahorrás 2 meses',
    features: ['Todo lo del plan Pro','Precio fijo todo el año','Factura anual'],
    popular: false,
    mp_plan_id: '' // Se completa con el ID real de MercadoPago
  }
]

export default function Planes() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [planSeleccionado, setPlanSeleccionado] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      setUser(session.user)
      const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single()
      setUserData(data)
    })
  }, [])

  const suscribirse = async (planId: string) => {
    if (!user) { router.push('/'); return }
    setPlanSeleccionado(planId)
    setLoading(true)

    try {
      const res = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, userId: user.id, email: user.email })
      })
      const data = await res.json()
      if (data.init_point) {
        window.location.href = data.init_point
      } else {
        alert('Error al crear la suscripción. Intentá de nuevo.')
      }
    } catch (e) {
      alert('Error de conexión. Intentá de nuevo.')
    }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb'}}>
      <nav style={{background:'white',borderBottom:'1px solid #e5e7eb',padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',height:60}}>
        <span style={{fontWeight:800,fontSize:18,color:'#1e3a8a',cursor:'pointer'}} onClick={() => router.push('/dashboard')}>
          Prop<span style={{color:'#16a344'}}>Control</span>
        </span>
        {user && (
          <button onClick={() => router.push('/dashboard')} style={{background:'#f3f4f6',color:'#374151',padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:600}}>
            ← Volver al dashboard
          </button>
        )}
      </nav>

      <div style={{maxWidth:900,margin:'0 auto',padding:'60px 24px'}}>
        <h1 style={{textAlign:'center',fontSize:36,fontWeight:800,color:'#1e3a8a',marginBottom:12}}>Elegí tu plan</h1>
        <p style={{textAlign:'center',color:'#6b7280',fontSize:16,marginBottom:48}}>
          {userData?.suscripcion_estado === 'trial'
            ? `Te quedan ${Math.max(0, Math.ceil((new Date(userData.trial_fin).getTime() - Date.now()) / 86400000))} días de prueba`
            : 'Sin sorpresas. Cancelás cuando querés.'}
        </p>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:24}}>
          {PLANES.map(plan => (
            <div key={plan.id} style={{
              background: plan.popular ? 'linear-gradient(135deg,#1e3a8a,#2563eb)' : 'white',
              borderRadius:20,padding:28,
              border: plan.popular ? '2px solid #2563eb' : '2px solid #e5e7eb',
              boxShadow: plan.popular ? '0 8px 32px rgba(30,58,138,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
              position:'relative'
            }}>
              {plan.popular && (
                <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'#16a344',color:'white',padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>
                  MÁS POPULAR
                </div>
              )}
              <div style={{fontWeight:700,fontSize:12,color:plan.popular?'rgba(255,255,255,0.6)':'#6b7280',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>
                {plan.nombre}
              </div>
              <div style={{fontSize:38,fontWeight:900,color:plan.popular?'white':'#1e3a8a',marginBottom:4}}>
                ${plan.precio.toLocaleString('es-AR')}
                <span style={{fontSize:14,fontWeight:400,color:plan.popular?'rgba(255,255,255,0.6)':'#6b7280'}}>
                  {plan.id === 'pro_anual' ? '/año' : '/mes'}
                </span>
              </div>
              <p style={{color:plan.popular?'rgba(255,255,255,0.7)':'#6b7280',fontSize:13,marginBottom:20}}>
                {plan.descripcion}
              </p>
              <ul style={{listStyle:'none',marginBottom:24}}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:9,fontSize:13,color:plan.popular?'rgba(255,255,255,0.9)':'#374151'}}>
                    <span style={{color:plan.popular?'#86efac':'#16a344',fontWeight:700,flexShrink:0}}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => suscribirse(plan.id)}
                disabled={loading && planSeleccionado === plan.id}
                style={{
                  width:'100%',
                  background: plan.popular ? '#16a344' : '#1e3a8a',
                  color:'white',
                  padding:'12px',borderRadius:10,fontWeight:700,fontSize:15,cursor:'pointer',
                  opacity: loading && planSeleccionado === plan.id ? 0.7 : 1,
                  boxShadow: plan.popular ? '0 4px 12px rgba(22,163,68,0.4)' : 'none'
                }}
              >
                {loading && planSeleccionado === plan.id ? 'Procesando...' : 'Suscribirme'}
              </button>
            </div>
          ))}
        </div>

        <p style={{textAlign:'center',color:'#9ca3af',fontSize:13,marginTop:32}}>
          Pagos procesados de forma segura por MercadoPago · Cancelás en cualquier momento
        </p>
      </div>
    </div>
  )
}
