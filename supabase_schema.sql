-- =============================================
-- PROPCONTROL - Schema completo de base de datos
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- USUARIOS (extendido de auth.users de Supabase)
create table public.usuarios (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  nombre text,
  plan text default 'trial' check (plan in ('trial','starter','pro')),
  trial_inicio timestamp with time zone default now(),
  trial_fin timestamp with time zone default (now() + interval '15 days'),
  suscripcion_id text, -- ID de suscripción de MercadoPago
  suscripcion_estado text default 'trial' check (suscripcion_estado in ('trial','activa','pausada','cancelada','vencida')),
  suscripcion_inicio timestamp with time zone,
  suscripcion_fin timestamp with time zone,
  mp_customer_id text, -- ID de cliente en MercadoPago
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- GRUPOS DE PROPIEDADES
create table public.grupos (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.usuarios(id) on delete cascade not null,
  nombre text not null,
  descripcion text,
  created_at timestamp with time zone default now()
);

-- PROPIETARIOS
create table public.propietarios (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.usuarios(id) on delete cascade not null,
  nombre text not null,
  cuit text,
  telefono text,
  email text,
  obs text,
  created_at timestamp with time zone default now()
);

-- PROPIEDADES
create table public.propiedades (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.usuarios(id) on delete cascade not null,
  grupo_id uuid references public.grupos(id) on delete set null,
  codigo text,
  nombre text not null,
  direccion text,
  ciudad text default 'Yerba Buena',
  tipo text default 'local' check (tipo in ('local','depto','terreno','otro')),
  superficie numeric,
  observaciones text,
  activo boolean default true,
  pct_expensas numeric default 0,
  valor_compra numeric default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- PROPIEDADES_PROPIETARIOS (relación muchos a muchos)
create table public.propiedades_propietarios (
  id uuid default gen_random_uuid() primary key,
  propiedad_id uuid references public.propiedades(id) on delete cascade not null,
  propietario_id uuid references public.propietarios(id) on delete cascade not null,
  porcentaje numeric default 100,
  unique(propiedad_id, propietario_id)
);

-- INQUILINOS
create table public.inquilinos (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.usuarios(id) on delete cascade not null,
  nombre text not null,
  es_sociedad boolean default false,
  cuit text,
  dni text,
  telefono text,
  email text,
  contacto_pagos text,
  tel_contacto text,
  observaciones text,
  created_at timestamp with time zone default now()
);

-- CONTRATOS
create table public.contratos (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.usuarios(id) on delete cascade not null,
  propiedad_id uuid references public.propiedades(id) on delete cascade not null,
  inquilino_id uuid references public.inquilinos(id) on delete cascade not null,
  fecha_inicio date not null,
  activo boolean default true,
  tipo text default 'fijo' check (tipo in ('fijo','escalonado')),
  moneda text default 'pesos' check (moneda in ('pesos','dolar','nafta')),
  monto_base numeric,
  monto_sin_iva numeric default 0,
  monto_con_iva numeric default 0,
  ajuste text default 'ninguno',
  indice_id uuid,
  frec_ajuste text default 'mensual' check (frec_ajuste in ('mensual','trimestral','semestral','anual')),
  iva boolean default false,
  tramos jsonb default '[]',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- PAGOS
create table public.pagos (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.usuarios(id) on delete cascade not null,
  contrato_id uuid references public.contratos(id) on delete cascade not null,
  periodo text not null, -- formato YYYY-MM
  monto numeric not null,
  moneda text default 'pesos',
  monto_pesos numeric,
  tipo_pago text default 'transferencia' check (tipo_pago in ('transferencia','cheque','efectivo')),
  detalle text,
  fecha date default current_date,
  created_at timestamp with time zone default now()
);

-- GASTOS
create table public.gastos (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.usuarios(id) on delete cascade not null,
  propiedad_id uuid references public.propiedades(id) on delete cascade,
  tipo text default 'otro',
  monto numeric not null,
  moneda text default 'pesos',
  quien text default 'propietario' check (quien in ('propietario','inquilino')),
  estado text default 'pendiente' check (estado in ('pendiente','pagado')),
  descripcion text,
  fecha date default current_date,
  created_at timestamp with time zone default now()
);

-- VARIABLES (dólar, nafta, IPC por mes)
create table public.variables (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.usuarios(id) on delete cascade not null,
  periodo text not null, -- formato YYYY-MM
  dolar numeric,
  nafta numeric,
  ipc numeric,
  unique(usuario_id, periodo)
);

-- INDICES PERSONALIZADOS
create table public.indices (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.usuarios(id) on delete cascade not null,
  nombre text not null,
  created_at timestamp with time zone default now()
);

-- VALORES DE INDICES
create table public.indices_valores (
  id uuid default gen_random_uuid() primary key,
  indice_id uuid references public.indices(id) on delete cascade not null,
  periodo text not null,
  variacion numeric,
  unique(indice_id, periodo)
);

-- EXPENSAS
create table public.expensas (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references public.usuarios(id) on delete cascade not null,
  grupo_id uuid references public.grupos(id) on delete cascade not null,
  periodo text not null,
  monto_total numeric not null,
  distribucion text default 'proporcional' check (distribucion in ('proporcional','manual')),
  pagos jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- =============================================
-- ROW LEVEL SECURITY - Cada usuario ve solo sus datos
-- =============================================

alter table public.usuarios enable row level security;
alter table public.grupos enable row level security;
alter table public.propietarios enable row level security;
alter table public.propiedades enable row level security;
alter table public.propiedades_propietarios enable row level security;
alter table public.inquilinos enable row level security;
alter table public.contratos enable row level security;
alter table public.pagos enable row level security;
alter table public.gastos enable row level security;
alter table public.variables enable row level security;
alter table public.indices enable row level security;
alter table public.indices_valores enable row level security;
alter table public.expensas enable row level security;

-- Políticas: cada usuario solo ve sus propios datos
create policy "usuarios_own" on public.usuarios for all using (auth.uid() = id);
create policy "grupos_own" on public.grupos for all using (auth.uid() = usuario_id);
create policy "propietarios_own" on public.propietarios for all using (auth.uid() = usuario_id);
create policy "propiedades_own" on public.propiedades for all using (auth.uid() = usuario_id);
create policy "inquilinos_own" on public.inquilinos for all using (auth.uid() = usuario_id);
create policy "contratos_own" on public.contratos for all using (auth.uid() = usuario_id);
create policy "pagos_own" on public.pagos for all using (auth.uid() = usuario_id);
create policy "gastos_own" on public.gastos for all using (auth.uid() = usuario_id);
create policy "variables_own" on public.variables for all using (auth.uid() = usuario_id);
create policy "indices_own" on public.indices for all using (auth.uid() = usuario_id);
create policy "expensas_own" on public.expensas for all using (auth.uid() = usuario_id);
create policy "pp_own" on public.propiedades_propietarios for all using (
  exists (select 1 from public.propiedades p where p.id = propiedad_id and p.usuario_id = auth.uid())
);
create policy "iv_own" on public.indices_valores for all using (
  exists (select 1 from public.indices i where i.id = indice_id and i.usuario_id = auth.uid())
);

-- Función para crear usuario automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.usuarios (id, email, nombre, plan, trial_inicio, trial_fin, suscripcion_estado)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'trial',
    now(),
    now() + interval '15 days',
    'trial'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
