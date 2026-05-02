'use client'
import { useState } from 'react'

export default function Home() {
  const [loading, setLoading] = useState(false)

  const login = async () => {
    setLoading(true)
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' }
    })
  }

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f1f3d,#1e3a8a,#16a344)'}}>
      <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 40px'}}>
        <span style={{color:'white',fontWeight:800,fontSize:22}}>
          Prop<span style={{color:'#4ade80'}}>Control</span>
        </span>
        <button onClick={login} style={{background:'white',color:'#1e3a8a',padding:'10px 24px',borderRadius:8,fontWeight:700,cursor:'pointer',border:'none'}}>
          Iniciar sesion
        </button>
      </nav>
      <div style={{textAlign:'center',padding:'100px 24px',maxWidth:700,margin:'0 auto'}}>
        <h1 style={{color:'white',fontSize:52,fontWeight:900,lineHeight:1.1,marginBottom:20}}>
          Controla tus alquileres.<br/>
          <span style={{color:'#4ade80'}}>Maximiza resultados.</span>
        </h1>
        <p style={{color:'rgba(255,255,255,0.8)',fontSize:18,marginBottom:40}}>
          La unica app argentina para contratos escalonados, ajustes por IPC y control de pagos.
        </p>
        <button onClick={login} disabled={loading} style={{background:'#16a344',color:'white',padding:'18px 40px',borderRadius:12,fontSize:18,fontWeight:800,cursor:'pointer',border:'none',boxShadow:'0 8px 24px rgba(22,163,68,0.5)'}}>
          {loading ? 'Conectando...' : 'Empezar gratis 15 dias'}
        </button>
        <p style={{color:'rgba(255,255,255,0.5)',marginTop:12,fontSize:14}}>Sin tarjeta de credito</p>
      </div>
    </div>
  )
}
