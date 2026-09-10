create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'super_admin'))
);
alter table public.admin_users add column if not exists role text not null default 'admin';
alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check check (role in ('admin', 'super_admin'));
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid()); $$;

create or replace function public.is_super_admin()
returns boolean language sql security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin'); $$;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

drop policy if exists "public can create orders" on public.orders;
drop policy if exists "authenticated users can create orders" on public.orders;
alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists customer_email text not null default '';

create or replace function public.validate_order_values()
returns trigger language plpgsql as $$
declare
  base_price integer;
  target_number numeric := coalesce(nullif(regexp_replace(new.target, '[^0-9]', '', 'g'), ''), '0')::numeric;
  target_factor numeric;
begin
  if auth.uid() is null or new.customer_id <> auth.uid() then
    raise exception 'Identitas customer tidak valid.';
  end if;
  if new.game = 'fisch' then
    base_price := case new.service
      when 'f-coins' then 15000 when 'f-xp' then 15000 when 'f-level' then 25000
      when 'f-item' then 20000 when 'f-quest' then 20000 when 'f-target' then 30000
      when 'f-custom' then 35000 else null end;
  elsif new.game = 'fishit' then
    base_price := case new.service
      when 'i-coins' then 15000 when 'i-xp' then 15000 when 'i-level' then 25000
      when 'i-fish' then 20000 when 'i-item' then 20000 when 'i-quest' then 20000
      when 'i-custom' then 35000 else null end;
  else
    base_price := null;
  end if;
  if base_price is null then raise exception 'Game atau layanan tidak valid.'; end if;
  new.game_name := case new.game when 'fisch' then 'Fisch' else 'Fish It!' end;
  new.priority_key := case when new.priority_key = 'express' then 'express' else 'normal' end;
  new.priority := case when new.priority_key = 'express' then 'Express' else 'Normal' end;
  target_factor := 1 + least(target_number / 500000, 3);
  new.price := greatest(10000, round(base_price * target_factor * case when new.priority_key = 'express' then 1.5 else 1 end / 5000) * 5000);
  new.status := 0;
  new.created_at := now();
  new.updated_at := now();
  new.customer_email := coalesce(auth.jwt() ->> 'email', '');
  return new;
end;
$$;
drop trigger if exists orders_validate_values on public.orders;
create trigger orders_validate_values before insert on public.orders
for each row execute function public.validate_order_values();
create policy "authenticated users can create orders"
on public.orders for insert to authenticated
with check (customer_id = auth.uid() and status = 0 and created_at > now() - interval '5 minutes');

drop policy if exists "customers can view own orders" on public.orders;
create policy "customers can view own orders"
on public.orders for select to authenticated
using (customer_id = auth.uid());

drop policy if exists "admin can read own record" on public.admin_users;
create policy "admin can read own record" on public.admin_users for select to authenticated using (user_id = auth.uid());

drop policy if exists "admins can view orders" on public.orders;
drop policy if exists "admins can update orders" on public.orders;
drop policy if exists "admins can delete orders" on public.orders;
create policy "admins can view orders" on public.orders for select to authenticated using (public.is_admin() and (public.is_super_admin() or status <> 4));
create policy "admins can update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "super admins can delete orders" on public.orders for delete to authenticated using (public.is_super_admin());

insert into public.admin_users (user_id, role)
values ('06b09841-97dd-4e93-82fc-8c4ae3ded1a2', 'super_admin')
on conflict (user_id) do update set role = 'super_admin';
