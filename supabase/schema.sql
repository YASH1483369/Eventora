-- Eventora database schema for Supabase (PostgreSQL)
-- Run this whole file once in: Supabase dashboard -> SQL Editor -> New query -> Run.

-- ============ TABLES ============
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 3 and 150),
  category    text not null check (category in ('Tech','Music','Workshop','Sports','Cultural','Business')),
  starts_at   timestamptz not null,
  venue       text not null,
  city        text not null,
  price       integer not null default 0 check (price >= 0),
  seats       integer not null check (seats > 0),
  featured    boolean not null default false,
  published   boolean not null default true,
  short_desc  text not null,
  long_desc   text not null,
  image_url   text,
  created_at  timestamptz not null default now()
);

create table if not exists public.registrations (
  id          bigint generated always as identity primary key,
  ref         text not null unique,
  event_id    bigint not null references public.events(id) on delete cascade,
  name        text not null,
  email       text not null,
  phone       text not null,
  created_at  timestamptz not null default now()
);
-- one registration per email per event
create unique index if not exists registrations_event_email_uq
  on public.registrations (event_id, lower(email));

-- people allowed to use the admin page (add rows after creating their login)
create table if not exists public.admins (
  email text primary key
);

-- ============ HELPERS ============
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ============ PUBLIC VIEW (events + seats left) ============
-- Runs with the owner's rights, so visitors can see seat counts without reading registrations.
create or replace view public.events_public as
select e.id, e.title, e.category, e.starts_at, e.venue, e.city, e.price, e.seats,
       e.featured, e.short_desc, e.long_desc, e.image_url,
       greatest(e.seats - coalesce(r.cnt, 0), 0)::int as seats_left
from public.events e
left join (select event_id, count(*) cnt from public.registrations group by event_id) r on r.event_id = e.id
where e.published = true;

-- ============ ROW LEVEL SECURITY ============
alter table public.events        enable row level security;
alter table public.registrations enable row level security;
alter table public.admins        enable row level security;

-- events: admins manage everything; nobody else touches the table directly (visitors use the view)
drop policy if exists "admin all events" on public.events;
create policy "admin all events" on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- registrations: admins can read and delete; inserts happen only through register_for_event()
drop policy if exists "admin read registrations" on public.registrations;
create policy "admin read registrations" on public.registrations for select to authenticated
  using (public.is_admin());
drop policy if exists "admin delete registrations" on public.registrations;
create policy "admin delete registrations" on public.registrations for delete to authenticated
  using (public.is_admin());

-- admins table: an admin can see the list, nobody can edit it from the API
drop policy if exists "admin read admins" on public.admins;
create policy "admin read admins" on public.admins for select to authenticated
  using (public.is_admin());

grant select on public.events_public to anon, authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, delete on public.registrations to authenticated;
grant select on public.admins to authenticated;

-- ============ REGISTER (server-side validation, seat limit, duplicates) ============
create or replace function public.register_for_event(
  p_event_id bigint, p_name text, p_email text, p_phone text, p_website text default ''
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_event  public.events%rowtype;
  v_taken  int;
  v_phone  text;
  v_ref    text;
begin
  -- honeypot: bots fill the hidden "website" field. Pretend success, store nothing.
  if coalesce(p_website, '') <> '' then
    return json_build_object('ok', true, 'ref', 'EVT-000000');
  end if;

  p_name  := btrim(coalesce(p_name, ''));
  p_email := lower(btrim(coalesce(p_email, '')));
  v_phone := regexp_replace(coalesce(p_phone, ''), '[\s-]', '', 'g');
  v_phone := regexp_replace(v_phone, '^(\+91|91|0)(?=\d{10}$)', '');

  if char_length(p_name) < 3 or p_name !~ '^[A-Za-z][A-Za-z .''-]*$' then
    return json_build_object('ok', false, 'field', 'name', 'error', 'Enter a valid name (letters only, at least 3 characters).');
  end if;
  if p_email !~ '^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$' or char_length(p_email) > 254 then
    return json_build_object('ok', false, 'field', 'email', 'error', 'Enter a valid email address.');
  end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then
    return json_build_object('ok', false, 'field', 'phone', 'error', 'Enter a valid 10-digit mobile number.');
  end if;

  -- lock the event row so two people cannot take the last seat at the same time
  select * into v_event from public.events where id = p_event_id and published = true for update;
  if not found then
    return json_build_object('ok', false, 'field', 'event', 'error', 'This event is not available.');
  end if;
  if v_event.starts_at <= now() then
    return json_build_object('ok', false, 'field', 'event', 'error', 'This event has already started.');
  end if;

  select count(*) into v_taken from public.registrations where event_id = p_event_id;
  if v_taken >= v_event.seats then
    return json_build_object('ok', false, 'field', 'event', 'error', 'Sorry, this event is sold out.');
  end if;

  if exists (select 1 from public.registrations where event_id = p_event_id and lower(email) = p_email) then
    return json_build_object('ok', false, 'field', 'email', 'error', 'This email is already registered for this event.');
  end if;

  -- gen_random_uuid() is built into Postgres (no extension needed, works with the locked search_path)
  v_ref := 'EVT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.registrations (ref, event_id, name, email, phone)
  values (v_ref, p_event_id, p_name, p_email, v_phone);

  return json_build_object('ok', true, 'ref', v_ref);
end;
$$;

-- ============ CANCEL (needs both the booking ID and the email used) ============
create or replace function public.cancel_registration(p_ref text, p_email text)
returns json
language plpgsql security definer set search_path = public
as $$
declare v_deleted int;
begin
  delete from public.registrations
  where ref = btrim(coalesce(p_ref, '')) and lower(email) = lower(btrim(coalesce(p_email, '')));
  get diagnostics v_deleted = row_count;
  return json_build_object('ok', v_deleted > 0);
end;
$$;

revoke all on function public.register_for_event(bigint, text, text, text, text) from public;
revoke all on function public.cancel_registration(text, text) from public;
grant execute on function public.register_for_event(bigint, text, text, text, text) to anon, authenticated;
grant execute on function public.cancel_registration(text, text) to anon, authenticated;
