-- Database test. Needs a local Postgres. Run from the project root:
--   su postgres -c "psql -f tests/db-test.sql"   (copy the project somewhere postgres can read first)
-- It creates a throwaway database, stubs the Supabase roles, and exercises RLS + register/cancel functions.
\set ON_ERROR_STOP off
drop database if exists evt_test;
create database evt_test;
\c evt_test
-- Supabase stand-ins
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
\set ON_ERROR_STOP on
\i supabase/schema.sql
\i supabase/seed.sql
\set ON_ERROR_STOP off
insert into public.admins values ('boss@example.com');

\echo '--- 1. anon reads events_public (expect 10)'
set role anon;
select count(*) as events_visible, min(seats_left) from public.events_public;
\echo '--- 2. anon cannot read registrations / events / insert directly (expect 3 errors)'
select * from public.registrations;
select * from public.events;
insert into public.registrations(ref,event_id,name,email,phone) values ('X',1,'Hack Er','a@b.co','9876543210');

\echo '--- 3. register: ok'
select public.register_for_event(1,'Ananya Sahoo','Ananya@Example.com','98765 43210','');
\echo '--- 4. duplicate (case-insens email) -> error json'
select public.register_for_event(1,'Ananya Sahoo','ananya@example.com','9876543210','');
\echo '--- 5. bad name / email / phone'
select public.register_for_event(1,'A1','x@y.co','9876543210','');
select public.register_for_event(1,'Good Name','not-an-email','9876543210','');
select public.register_for_event(1,'Good Name','ok@y.co','1234567890','');
\echo '--- 6. +91 phone normalised ok'
select public.register_for_event(2,'Ravi Kumar','ravi@example.com','+919876543210','');
\echo '--- 7. honeypot -> fake ok, nothing stored'
select public.register_for_event(3,'Robot Bot','bot@example.com','9876543210','http://spam');
\echo '--- 8. unknown event'
select public.register_for_event(9999,'Good Name','ok2@y.co','9876543210','');
\echo '--- 9. seats left for event 1 should be 149'
select seats_left from public.events_public where id=1;

\echo '--- 10. cancel with wrong email (false), right email (true)'
select public.cancel_registration((select ref from (select 1) s, lateral (select 'none') r(ref)), 'ananya@example.com');
reset role;
select ref from public.registrations where event_id=1 \gset
set role anon;
select public.cancel_registration(:'ref', 'wrong@example.com');
select public.cancel_registration(:'ref', 'ANANYA@example.com');
select seats_left from public.events_public where id=1;

\echo '--- 11. sold out + past event'
reset role;
update public.events set seats=1 where id=4;
insert into public.events(title,category,starts_at,venue,city,seats,short_desc,long_desc) values ('Past Event','Tech', now() - interval '1 day','V','C',10,'s','l');
set role anon;
select public.register_for_event(4,'First Person','one@example.com','9876543210','');
select public.register_for_event(4,'Second Person','two@example.com','9876543210','');
select count(*) as past_event_visible from public.events_public where title='Past Event';
reset role;
select id as past_id from public.events where title='Past Event' \gset
set role anon;
select public.register_for_event(:past_id,'Late Person','late@example.com','9876543210','');

\echo '--- 12. authenticated NON-admin: registrations (expect 0 rows), cannot insert event (expect error)'
reset role;
set role authenticated;
set request.jwt.claims = '{"email":"random@example.com"}';
select count(*) as rows_seen from public.registrations;
insert into public.events(title,category,starts_at,venue,city,seats,short_desc,long_desc) values ('Nope','Tech',now()+interval '9 day','V','C',10,'s','l');
select public.is_admin() as non_admin;

\echo '--- 13. ADMIN: sees registrations, can insert/update/delete event'
set request.jwt.claims = '{"email":"Boss@Example.com"}';
select public.is_admin() as admin;
select count(*) as rows_seen from public.registrations;
insert into public.events(title,category,starts_at,venue,city,seats,short_desc,long_desc) values ('Admin Event','Tech',now()+interval '9 day','V','C',10,'s','l') returning id;
update public.events set title='Admin Event 2' where title='Admin Event';
delete from public.events where title='Admin Event 2';
delete from public.registrations where email='one@example.com';
select count(*) as admins_visible from public.admins;
\echo '--- 14. admin cannot edit admins table (expect error)'
insert into public.admins values ('me@example.com');
