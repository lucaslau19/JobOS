-- ============================================================
-- JobOS Supabase Schema
-- Run this in the Supabase SQL Editor to set up your database.
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS PROFILE TABLE
-- Extends Supabase Auth with app-specific fields
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  uwaterloo_email text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- JOBS TABLE
-- Unified table for WaterlooWorks + external job postings
-- ============================================================
create type public.job_source as enum ('waterlooworks', 'external');

create type public.job_status as enum (
  -- Shared
  'saved', 'applied', 'interview', 'rejected',
  -- WaterlooWorks-specific
  'ranked', 'matched',
  -- External-specific
  'phone_screen', 'offer'
);

create table public.jobs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  company text not null,
  role text not null,
  jd_text text,
  url text,
  salary text,
  location text,
  status public.job_status default 'saved' not null,
  source public.job_source not null,
  column_order integer default 0 not null,

  -- WaterlooWorks-specific fields (null for external jobs)
  ww_job_id text,
  ww_deadline timestamptz,
  ww_term text,            -- e.g. "Fall 2026", "Winter 2027"
  ww_openings integer,

  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_jobs_user_id on public.jobs(user_id);
create index idx_jobs_source on public.jobs(source);
create index idx_jobs_status on public.jobs(status);

-- ============================================================
-- RESUME VERSIONS TABLE
-- Stores each AI-tailored resume variant per job
-- ============================================================
create table public.resume_versions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade,
  version_number integer not null,
  file_url text not null,          -- Supabase Storage path
  match_score integer,             -- 0-100
  changes_summary text,            -- AI-generated diff summary
  is_master boolean default false, -- true for the original uploaded resume
  created_at timestamptz default now() not null
);

create index idx_resume_versions_user on public.resume_versions(user_id);
create index idx_resume_versions_job on public.resume_versions(job_id);

-- ============================================================
-- MOCK INTERVIEWS TABLE
-- Stores AI mock interview sessions per job
-- ============================================================
create table public.mock_interviews (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  scores jsonb not null default '[]'::jsonb,
  feedback text,
  created_at timestamptz default now() not null
);

create index idx_mock_interviews_user on public.mock_interviews(user_id);
create index idx_mock_interviews_job on public.mock_interviews(job_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Users can only access their own data
-- ============================================================

-- Profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Jobs
alter table public.jobs enable row level security;

create policy "Users can view own jobs"
  on public.jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own jobs"
  on public.jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own jobs"
  on public.jobs for update
  using (auth.uid() = user_id);

create policy "Users can delete own jobs"
  on public.jobs for delete
  using (auth.uid() = user_id);

-- Resume Versions
alter table public.resume_versions enable row level security;

create policy "Users can view own resumes"
  on public.resume_versions for select
  using (auth.uid() = user_id);

create policy "Users can insert own resumes"
  on public.resume_versions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own resumes"
  on public.resume_versions for update
  using (auth.uid() = user_id);

create policy "Users can delete own resumes"
  on public.resume_versions for delete
  using (auth.uid() = user_id);

-- Mock Interviews
alter table public.mock_interviews enable row level security;

create policy "Users can view own interviews"
  on public.mock_interviews for select
  using (auth.uid() = user_id);

create policy "Users can insert own interviews"
  on public.mock_interviews for insert
  with check (auth.uid() = user_id);

create policy "Users can update own interviews"
  on public.mock_interviews for update
  using (auth.uid() = user_id);

create policy "Users can delete own interviews"
  on public.mock_interviews for delete
  using (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET
-- For resume PDF uploads
-- ============================================================
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false);

create policy "Users can upload own resumes"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view own resumes"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own resumes"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- UPDATED_AT TRIGGER
-- Auto-update the updated_at column on row changes
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger update_jobs_updated_at
  before update on public.jobs
  for each row execute function public.update_updated_at();
