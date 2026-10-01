begin;

-- Pengaturan hari libur untuk laporan; tidak mengubah log presensi.
create table if not exists public.bti_report_holidays (
  day date primary key,
  name text not null check (length(btrim(name)) between 1 and 160),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.bti_report_holidays enable row level security;
drop policy if exists bti_report_holidays_admin on public.bti_report_holidays;
create policy bti_report_holidays_admin
  on public.bti_report_holidays for all to authenticated
  using (
    (select auth.uid()) is not null
    and coalesce((select auth.jwt())->'app_metadata'->>'role', '') = 'admin'
  )
  with check (
    (select auth.uid()) is not null
    and coalesce((select auth.jwt())->'app_metadata'->>'role', '') = 'admin'
  );

revoke all on public.bti_report_holidays from public, anon, authenticated;
grant select, insert, update, delete on public.bti_report_holidays
  to authenticated, service_role;

-- Metadata ditetapkan di server, bukan dipercaya dari browser.
create or replace function public.bti_stamp_report_holiday()
returns trigger language plpgsql set search_path = '' as $function$
begin
  new.updated_at := pg_catalog.now();
  new.updated_by := auth.uid();
  new.name := pg_catalog.btrim(new.name);
  return new;
end;
$function$;

revoke all on function public.bti_stamp_report_holiday() from public, anon, authenticated;
drop trigger if exists bti_stamp_report_holiday_trigger on public.bti_report_holidays;
create trigger bti_stamp_report_holiday_trigger
  before insert or update on public.bti_report_holidays
  for each row execute function public.bti_stamp_report_holiday();

notify pgrst, 'reload schema';
commit;
