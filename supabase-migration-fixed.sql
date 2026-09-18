-- Personal AI Studio - FIXED Migration
-- এই ফাইলটা Supabase SQL Editor এ Run করো

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Drop existing trigger first
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- profiles table - FIXED
drop table if exists public.profiles cascade;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- provider_connections
drop table if exists public.provider_connections cascade;
create table public.provider_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('openrouter','gemini','groq')),
  encrypted_api_key text not null,
  enabled boolean default true,
  last_validated_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, provider)
);

-- models_cache
drop table if exists public.models_cache cascade;
create table public.models_cache (
  id uuid primary key default uuid_generate_v4(),
  provider text not null,
  model_id text not null,
  display_name text not null,
  capabilities_json jsonb default '{}',
  pricing_json jsonb default '{}',
  metadata_json jsonb default '{}',
  last_synced_at timestamp with time zone default now(),
  unique(provider, model_id)
);

-- conversations
drop table if exists public.conversations cascade;
create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New Chat',
  mode text not null default 'chat' check (mode in ('chat','agent','code','image','video','research')),
  provider text,
  model_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- messages
drop table if exists public.messages cascade;
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  attachments_json jsonb default '[]',
  tool_calls_json jsonb default '[]',
  created_at timestamp with time zone default now()
);

-- projects
drop table if exists public.projects cascade;
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- project_files
drop table if exists public.project_files cascade;
create table public.project_files (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  path text not null,
  content_or_storage_path text,
  language text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.provider_connections enable row level security;
alter table public.models_cache enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.projects enable row level security;
alter table public.project_files enable row level security;

-- RLS Policies
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Users can manage own provider connections" on public.provider_connections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Anyone can read models_cache" on public.models_cache for select using (true);
create policy "Service role can manage models_cache" on public.models_cache for all using (auth.role() = 'service_role');

create policy "Users can manage own conversations" on public.conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage own messages" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage own projects" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage files of own projects" on public.project_files for all using (
  exists (select 1 from public.projects where projects.id = project_files.project_id and projects.user_id = auth.uid())
) with check (
  exists (select 1 from public.projects where projects.id = project_files.project_id and projects.user_id = auth.uid())
);

-- Function for new user
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
