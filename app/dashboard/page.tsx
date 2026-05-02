'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    setUser(session.user)

    // Get user subscription data
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (data) {
      setUserData(data)
      // Check if trial expired and no active subscription
      const trialFin = new Date(data.trial_fin)
      const ahora = new Date()
      if (trialFin < ahora && data.suscripcion_estado !== 'activa') {
        router.push('/planes')
        return
      }
    }
    setLoading(false)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const diasTrial = userData ? Math.max(0, Math.ceil((new Date(userData.trial_fin).getTime() - Date.now()) / 86400000)) : 0

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f9fafb'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:32,marginBottom:12}}>⏳</div>
        <p style={{color:'#6b7280'}}>Cargando...</p>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb'}}>
      {/* TOP NAV */}
      <nav style={{background:'white',borderBottom:'1px solid #e5e7eb',padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',height:60,position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontWeight:800,fontSize:18,color:'#1e3a8a'}}>Prop<span style={{color:'#16a344'}}>Control</span></span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          {userData?.suscripcion_estado === 'trial' && (
            <div style={{background:'#fef3c7',color:'#78350f',padding:'6px 14px',borderRadius:20,fontSize:13,fontWeight:600}}>
              ⏰ {diasTrial} días de prueba
            </div>
          )}
          <button onClick={() => router.push('/planes')} style={{background:'#16a344',color:'white',padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:700}}>
            {userData?.suscripcion_estado === 'activa' ? 'Mi plan' : 'Suscribirse'}
          </button>
          <div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={logout}>
            <div style={{width:32,height:32,borderRadius:'50%',background:'#dbeafe',color:'#1e3a8a',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14}}>
              {(user?.email || '?')[0].toUpperCase()}
            </div>
            <span style={{fontSize:13,color:'#6b7280'}}>Salir</span>
          </div>
        </div>
      </nav>

      {/* TRIAL BANNER */}
      {userData?.suscripcion_estado === 'trial' && diasTrial <= 5 && (
        <div style={{background:'#fef3c7',borderBottom:'1px solid #fde68a',padding:'10px 24px',textAlign:'center'}}>
          <span style={{color:'#78350f',fontSize:14,fontWeight:600}}>
            ⚠️ Tu período de prueba vence en {diasTrial} días.{' '}
            <button onClick={() => router.push('/planes')} style={{background:'none',border:'none',color:'#d97706',fontWeight:700,cursor:'pointer',textDecoration:'underline'}}>
              Suscribite ahora →
            </button>
          </span>
        </div>
      )}

      {/* CONTENT */}
      <div style={{maxWidth:480,margin:'0 auto',padding:'20px 16px'}}>
        {/* La app completa se renderiza aquí */}
        <AppPropControl userId={user?.id} userEmail={user?.email} />
      </div>
    </div>
  )
}

// App component embebida
function AppPropControl({ userId, userEmail }: { userId: string, userEmail: string }) {
  return (
    <div style={{textAlign:'center',padding:'60px 20px',color:'#6b7280'}}>
      <div style={{fontSize:48,marginBottom:16}}>🏗️</div>
      <h2 style={{fontSize:20,fontWeight:700,color:'#111827',marginBottom:8}}>App cargando...</h2>
      <p style={{fontSize:14}}>El dashboard completo se está construyendo.</p>
    </div>
  )
}
