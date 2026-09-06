begin;

-- ============================================================
-- BTI LIVE TRACKING - DIRECT PRIVILEGE HARDENING
--
-- Migration incremental setelah:
-- 202608230001_live_assignment_tracking.sql
--
-- Supabase dapat menerapkan default table privileges kepada role
-- authenticated ketika tabel baru dibuat. RLS tetap melindungi
-- penulisan tanpa policy, tetapi aplikasi tidak memerlukan direct
-- INSERT, UPDATE, atau DELETE. Seluruh perubahan data tracking
-- harus melalui RPC security definer yang sudah memvalidasi sesi,
-- perangkat, penugasan, koordinat, akurasi, dan waktu lokasi.
-- ============================================================


-- ============================================================
-- TRACKING TABLE PRIVILEGES
-- ============================================================

revoke all privileges
on table public.assignment_tracking_sessions
from public, anon, authenticated;

revoke all privileges
on table public.technician_live_locations
from public, anon, authenticated;

revoke all privileges
on table public.technician_location_history
from public, anon, authenticated;

grant select
on table public.assignment_tracking_sessions
to authenticated;

grant select
on table public.technician_live_locations
to authenticated;

grant select
on table public.technician_location_history
to authenticated;


-- ============================================================
-- IDENTITY SEQUENCE PRIVILEGES
--
-- Client tidak pernah membutuhkan akses langsung ke sequence.
-- INSERT history dilakukan oleh RPC security definer.
-- ============================================================

do $sequence_privileges$
declare
    v_sequence_name text;
begin
    v_sequence_name := pg_get_serial_sequence(
        'public.technician_location_history',
        'id_location'
    );

    if v_sequence_name is null then
        raise exception
            'PRIVILEGE_HARDENING_FAILED: identity sequence technician_location_history.id_location tidak ditemukan';
    end if;

    execute format(
        'revoke all privileges on sequence %s from public, anon, authenticated',
        v_sequence_name
    );
end;
$sequence_privileges$;


-- ============================================================
-- POST-MIGRATION ASSERTIONS
-- ============================================================

do $privilege_assertions$
declare
    v_table_name text;
    v_sequence_name text;
begin
    foreach v_table_name in array array[
        'public.assignment_tracking_sessions',
        'public.technician_live_locations',
        'public.technician_location_history'
    ]
    loop
        if has_table_privilege(
            'anon',
            v_table_name,
            'SELECT, INSERT, UPDATE, DELETE'
        ) then
            raise exception
                'PRIVILEGE_HARDENING_FAILED: role anon masih memiliki direct privilege pada %',
                v_table_name;
        end if;

        if not has_table_privilege(
            'authenticated',
            v_table_name,
            'SELECT'
        ) then
            raise exception
                'PRIVILEGE_HARDENING_FAILED: role authenticated tidak memiliki SELECT pada %',
                v_table_name;
        end if;

        if has_table_privilege(
            'authenticated',
            v_table_name,
            'INSERT, UPDATE, DELETE'
        ) then
            raise exception
                'PRIVILEGE_HARDENING_FAILED: role authenticated masih memiliki write privilege pada %',
                v_table_name;
        end if;
    end loop;

    v_sequence_name := pg_get_serial_sequence(
        'public.technician_location_history',
        'id_location'
    );

    if has_sequence_privilege(
        'anon',
        v_sequence_name,
        'USAGE, SELECT, UPDATE'
    ) then
        raise exception
            'PRIVILEGE_HARDENING_FAILED: role anon masih memiliki akses identity sequence';
    end if;

    if has_sequence_privilege(
        'authenticated',
        v_sequence_name,
        'USAGE, SELECT, UPDATE'
    ) then
        raise exception
            'PRIVILEGE_HARDENING_FAILED: role authenticated masih memiliki akses identity sequence';
    end if;
end;
$privilege_assertions$;

commit;
