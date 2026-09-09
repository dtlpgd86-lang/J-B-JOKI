-- FISH JOKI: tabel order dan pelacakan status yang aman.
-- Jalankan seluruh file ini sekali di Supabase: SQL Editor > New query > Run.

create table if not exists public.orders (
  id text primary key,
  tracking_token uuid not null unique,
  game text not null check (game in ('fisch', 'fishit')),
  game_name text not null,
  service text not null,
  service_name text not null,
  target text not null,
  username text not null,
  detail text not null default '',
  priority text not null check (priority in ('Normal', 'Express')),
  priority_key text not null check (priority_key in ('normal', 'express')),
  price integer not null check (price >= 0),
  est text not null,
  status smallint not null default 0 check (status between 0 and 5),
  completed_at timestamptz,
  rating smallint check (rating between 1 and 5),
  rating_review text not null default '',
  rated_at timestamptz,
  customer_id uuid references auth.users(id) on delete set null,
  customer_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mendukung proyek yang tabel orders-nya sudah dibuat sebelum fitur rating.
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists rating smallint check (rating between 1 and 5);
alter table public.orders add column if not exists rating_review text not null default '';
alter table public.orders add column if not exists rated_at timestamptz;
-- Kompatibilitas dengan tabel order versi lama (sebelum login pelanggan ditambahkan).
alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists customer_email text not null default '';

-- Waktu selesai selalu dicatat oleh database saat admin mengubah status ke Selesai.
create or replace function public.set_order_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 4 and (old.status is distinct from 4) then
    new.completed_at := now();
  elsif new.status <> 4 then
    new.completed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists orders_set_completed_at on public.orders;
create trigger orders_set_completed_at before update on public.orders
for each row execute function public.set_order_completed_at();

-- Kirim hanya sinyal perubahan status ke halaman pelacakan yang memiliki token rahasia.
-- Broadcast memakai kanal publik karena halaman status dapat dibuka tanpa login; token UUID
-- pada nama kanal mencegah pelanggan lain menebak kanal sebuah order.
create or replace function public.notify_order_status_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform realtime.send(
      jsonb_build_object('id', new.id, 'status', new.status, 'updated_at', new.updated_at),
      'status_updated',
      'order-status:' || new.id || ':' || new.tracking_token::text,
      false
    );
  end if;
  return new;
end;
$$;
drop trigger if exists orders_notify_status_changed on public.orders;
create trigger orders_notify_status_changed after update on public.orders
for each row execute function public.notify_order_status_changed();

-- Angka beranda: hanya mengembalikan total, tanpa mengekspos data order pelanggan.
create or replace function public.get_public_order_stats()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'completed_orders', count(*) filter (where status = 4),
    'customers', count(distinct customer_id)
  )
  from public.orders;
$$;
grant execute on function public.get_public_order_stats() to anon, authenticated;

create or replace function public.notify_public_order_stats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send('{}'::jsonb, 'stats_updated', 'public-order-stats', false);
  return coalesce(new, old);
end;
$$;
drop trigger if exists orders_notify_public_stats on public.orders;
create trigger orders_notify_public_stats
after insert or update or delete on public.orders
for each row execute function public.notify_public_order_stats();

alter table public.orders enable row level security;

-- Pelanggan hanya dapat membuat order baru; mereka tidak bisa membaca semua order.
drop policy if exists "authenticated users can create orders" on public.orders;
create policy "authenticated users can create orders"
  on public.orders for insert to authenticated
  with check (customer_id = auth.uid() and status = 0 and created_at > now() - interval '5 minutes');

-- Status hanya dapat dibaca dengan pasangan Order ID + token pelacakan rahasia.
-- Return type versi lama berbeda, jadi fungsi lama perlu dihapus sebelum dibuat ulang.
drop function if exists public.get_order_status(text, uuid);
create or replace function public.get_order_status(p_id text, p_tracking_token uuid)
returns table (
  id text,
  game_name text,
  service_name text,
  target text,
  priority text,
  price integer,
  est text,
  status smallint,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz,
  rating smallint,
  rating_review text
)
language sql
security definer
set search_path = public
as $$
  select o.id, o.game_name, o.service_name, o.target, o.priority, o.price,
         o.est, o.status, o.created_at, o.updated_at, o.completed_at, o.rating, o.rating_review
  from public.orders o
  where o.id = p_id and o.tracking_token = p_tracking_token;
$$;

grant execute on function public.get_order_status(text, uuid) to anon, authenticated;

-- Hanya pemilik tautan pelacakan yang dapat memberi nilai, maksimal 10 menit setelah selesai.
create or replace function public.submit_order_rating(
  p_id text, p_tracking_token uuid, p_rating smallint, p_review text default ''
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_rating not between 1 and 5 then raise exception 'Nilai harus antara 1 sampai 5.'; end if;
  update public.orders
  set rating = p_rating, rating_review = left(coalesce(p_review, ''), 500), rated_at = now()
  where id = p_id and tracking_token = p_tracking_token and status = 4
    and completed_at is not null and now() <= completed_at + interval '10 minutes'
    and rating is null;
  if not found then raise exception 'Penilaian hanya tersedia selama 10 menit setelah order selesai.'; end if;
end;
$$;
grant execute on function public.submit_order_rating(text, uuid, smallint, text) to anon, authenticated;

-- Admin dashboard: hanya User UID di bawah ini yang dapat membaca/mengubah order.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'super_admin'))
);
-- Kompatibilitas untuk tabel admin_users versi lama.
alter table public.admin_users add column if not exists role text not null default 'admin';
alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check check (role in ('admin', 'super_admin'));

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin');
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

drop policy if exists "admin can read own record" on public.admin_users;
create policy "admin can read own record"
  on public.admin_users for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "admins can view orders" on public.orders;
drop policy if exists "admins can update orders" on public.orders;
drop policy if exists "admins can delete orders" on public.orders;
create policy "admins can view orders" on public.orders
  for select to authenticated using (public.is_admin() and (public.is_super_admin() or status <> 4));
create policy "admins can update orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Hanya super admin yang boleh menghapus catatan/order.
create policy "super admins can delete orders" on public.orders
  for delete to authenticated using (public.is_super_admin());

insert into public.admin_users (user_id, role)
values ('06b09841-97dd-4e93-82fc-8c4ae3ded1a2', 'super_admin')
on conflict (user_id) do update set role = 'super_admin';

-- Chat dua arah per order. Pesan tidak dapat dibaca tanpa token status atau hak admin.
create table if not exists public.order_messages (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders(id) on delete cascade,
  sender text not null check (sender in ('customer', 'admin')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists order_messages_order_created_idx on public.order_messages(order_id, created_at);
alter table public.order_messages enable row level security;

create or replace function public.get_order_messages(p_id text, p_tracking_token uuid)
returns table (sender text, body text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select m.sender, m.body, m.created_at
  from public.order_messages m join public.orders o on o.id = m.order_id
  where o.id = p_id and o.tracking_token = p_tracking_token
  order by m.created_at asc;
$$;

create or replace function public.send_customer_order_message(p_id text, p_tracking_token uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then raise exception 'Pesan harus berisi 1–1000 karakter.'; end if;
  if not exists (select 1 from public.orders where id = p_id and tracking_token = p_tracking_token and status between 0 and 3) then
    raise exception 'Chat hanya tersedia selama order sedang berjalan.';
  end if;
  insert into public.order_messages(order_id, sender, body) values (p_id, 'customer', trim(p_body));
end;
$$;

create or replace function public.get_admin_order_messages(p_id text)
returns table (sender text, body text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select m.sender, m.body, m.created_at from public.order_messages m
  where m.order_id = p_id and public.is_admin() order by m.created_at asc;
$$;

create or replace function public.send_admin_order_message(p_id text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat membalas chat.'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then raise exception 'Pesan harus berisi 1–1000 karakter.'; end if;
  if not exists (select 1 from public.orders where id = p_id and status between 0 and 3) then raise exception 'Chat hanya tersedia selama order sedang berjalan.'; end if;
  insert into public.order_messages(order_id, sender, body) values (p_id, 'admin', trim(p_body));
end;
$$;

grant execute on function public.get_order_messages(text, uuid) to anon, authenticated;
grant execute on function public.send_customer_order_message(text, uuid, text) to anon, authenticated;
grant execute on function public.get_admin_order_messages(text) to authenticated;
grant execute on function public.send_admin_order_message(text, text) to authenticated;

create or replace function public.notify_order_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare order_token uuid;
begin
  select tracking_token into order_token from public.orders where id = new.order_id;
  perform realtime.send(
    jsonb_build_object('sender', new.sender, 'body', new.body, 'created_at', new.created_at),
    'new_message', 'order-chat:' || new.order_id || ':' || order_token::text, false
  );
  return new;
end;
$$;
drop trigger if exists order_messages_notify on public.order_messages;
create trigger order_messages_notify after insert on public.order_messages
for each row execute function public.notify_order_message();
