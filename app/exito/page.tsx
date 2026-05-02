'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'

export default function Exito() {
  const router = useRouter()

  useEffect(() => {
    setTimeout(() => router.push('/dashboard'), 4000)
  }, [])

  return (
    <div style={{minHeight:'100vh',background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',padding:40}}>
        <div style={{fontSize:64,marginBottom:20}}>🎉</div>
        <h1 style={{fontSize:28,fontWeight:800,color:'#14532d',marginBottom:12}}>¡Suscripción activada!</h1>
        <p style={{color:'#16a34a',fontSize:16,marginBottom:8}}>Ya podés usar PropControl sin límites.</p>
        <p style={{color:'#6b7280',fontSize:14}}>Redirigiendo al dashboard...</p>
      </div>
    </div>
  )
}
