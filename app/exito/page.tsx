'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'

function ExitoContent() {
  const router = useRouter()
  const [count, setCount] = useState(5)

  useEffect(() => {
    const t = setInterval(() => setCount((c) => c - 1), 1000)
    const r = setTimeout(() => router.push('/dashboard'), 5000)
    return () => {
      clearInterval(t)
      clearTimeout(r)
    }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1e3a8a,#16a344)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '40px 32px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e3a8a', marginBottom: 12 }}>¡Suscripción activada!</h1>
        <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
          Tu pago fue procesado correctamente. Ya tenés acceso completo a PropControl.
        </p>
        <div style={{ background: '#dcfce7', color: '#14532d', padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 20 }}>
          La activación puede tardar unos minutos. Si no ves los cambios, recargá el dashboard.
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#16a344', color: 'white', padding: '14px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', width: '100%' }}>
          Ir al dashboard ({count})
        </button>
      </div>
    </div>
  )
}

export default function Exito() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>Cargando...</div>}>
      <ExitoContent />
    </Suspense>
  )
}
