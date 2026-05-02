'use client'
import { useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

export default function AuthConfirm() {
  const router = useRouter()

  useEffect(() => {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard')
      else router.push('/')
    })
  }, [])

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f9fafb'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:32,marginBottom:12}}>⏳</div>
        <p style={{color:'#6b7280',fontSize:16}}>Iniciando sesión...</p>
      </div>
    </div>
  )
}
