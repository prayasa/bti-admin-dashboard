-- Read-only verification. Jalankan setelah migration 202610010001.
-- Tidak menghapus atau membuat log/tiket dan tidak mengubah akun.
select
    has_function_privilege('authenticated', 'public.admin_delete_assignment(text)', 'EXECUTE')
        as authenticated_can_call_assignment_rpc,
    has_function_privilege('authenticated', 'public.admin_delete_attendance(text)', 'EXECUTE')
        as authenticated_can_call_attendance_rpc,
    has_function_privilege('authenticated', 'public.admin_delete_all_attendance(text)', 'EXECUTE')
        as authenticated_can_call_bulk_rpc,
    not has_function_privilege('anon', 'public.admin_delete_assignment(text)', 'EXECUTE')
        as anon_blocked_assignment,
    not has_function_privilege('anon', 'public.admin_delete_attendance(text)', 'EXECUTE')
        as anon_blocked_attendance,
    not has_function_privilege('anon', 'public.admin_delete_all_attendance(text)', 'EXECUTE')
        as anon_blocked_bulk;
-- Keenam kolom di atas harus true. RPC tetap memeriksa role admin.

select tablename, policyname, permissive, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and policyname in (
      'bti_admin_only_attendance_delete',
      'bti_admin_only_assignment_delete'
  );
-- Dua baris, RESTRICTIVE, DELETE, role authenticated, memeriksa role admin.

select table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
      'bti_guard_assignment_delete_status_trigger',
      'tiket_tugas_close_tracking_trigger'
  )
order by table_name, trigger_name, event_manipulation;
-- Harus ada guard BEFORE DELETE dan close tracking AFTER DELETE.

select pg_get_functiondef('public.admin_delete_assignment(text)'::regprocedure);
select pg_get_functiondef('public.admin_delete_attendance(text)'::regprocedure);
select pg_get_functiondef('public.admin_delete_all_attendance(text)'::regprocedure);
