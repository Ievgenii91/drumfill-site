create extension if not exists pgcrypto;

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null,
  page_path text not null default '/',
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'waitlist_signups_email_format'
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_email_format
      check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
  end if;
end
$$;

alter table public.waitlist_signups enable row level security;

grant usage on schema public to public;
grant insert on public.waitlist_signups to public;
grant update on public.waitlist_signups to public;

drop policy if exists "Public can insert waitlist signups" on public.waitlist_signups;
drop policy if exists "Anyone can insert waitlist signups" on public.waitlist_signups;
drop policy if exists "Anyone can update waitlist signups" on public.waitlist_signups;

create policy "Anyone can insert waitlist signups"
  on public.waitlist_signups
  for insert
  to public
  with check (true);

create policy "Anyone can update waitlist signups"
  on public.waitlist_signups
  for update
  to public
  using (true)
  with check (true);
