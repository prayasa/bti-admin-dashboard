-- Hanya pemeriksaan; tidak mengubah data.
select
  c.relname as table_name,
  c.relrowsecurity as rls_aktif
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'bti_report_holidays';

select policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'bti_report_holidays';

select
  has_table_privilege('authenticated', 'public.bti_report_holidays', 'SELECT') as authenticated_bisa_select_dibatasi_rls,
  has_table_privilege('anon', 'public.bti_report_holidays', 'SELECT') as anonim_bisa_select;

select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public' and event_object_table = 'bti_report_holidays'
order by trigger_name, event_manipulation;
