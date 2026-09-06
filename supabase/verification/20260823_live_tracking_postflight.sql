begin;

set transaction read only;

-- ============================================================
-- BTI LIVE ASSIGNMENT TRACKING - POSTFLIGHT VERIFICATION
--
-- Jalankan setelah migration berikut berhasil diterapkan:
-- 202608230001_live_assignment_tracking.sql
--
-- Script ini hanya membaca metadata dan data. Tidak ada operasi
-- insert, update, delete, alter, create, drop, grant, atau revoke.
-- Jika komponen wajib tidak ditemukan, eksekusi dihentikan dengan
-- exception agar hasil yang tidak lengkap tidak dianggap berhasil.
-- ============================================================


-- ============================================================
-- 1. REQUIRED TABLES
-- ============================================================

do $postflight$
begin
    if to_regclass(
        'public.assignment_tracking_sessions'
    ) is null then
        raise exception
            'POSTFLIGHT_FAILED: table public.assignment_tracking_sessions tidak ditemukan';
    end if;

    if to_regclass(
        'public.technician_live_locations'
    ) is null then
        raise exception
            'POSTFLIGHT_FAILED: table public.technician_live_locations tidak ditemukan';
    end if;

    if to_regclass(
        'public.technician_location_history'
    ) is null then
        raise exception
            'POSTFLIGHT_FAILED: table public.technician_location_history tidak ditemukan';
    end if;
end;
$postflight$;


-- ============================================================
-- 2. MOBILE CONFIG COLUMNS AND VALUES
-- ============================================================

do $postflight$
declare
    v_missing_columns text;
    v_config_count bigint;
begin
    select string_agg(required.column_name, ', ')
    into v_missing_columns
    from (
        values
            ('tracking_update_interval_ms'),
            ('tracking_history_interval_ms'),
            ('tracking_history_min_distance_meters'),
            ('tracking_stale_after_ms'),
            ('tracking_history_retention_days')
    ) as required(column_name)
    where not exists (
        select 1
        from information_schema.columns as c
        where c.table_schema = 'public'
          and c.table_name = 'bti_mobile_config'
          and c.column_name = required.column_name
    );

    if v_missing_columns is not null then
        raise exception
            'POSTFLIGHT_FAILED: kolom bti_mobile_config belum lengkap: %',
            v_missing_columns;
    end if;

    select count(*)
    into v_config_count
    from public.bti_mobile_config
    where id = 1
      and tracking_update_interval_ms
          between 5000 and 300000
      and tracking_history_interval_ms
          between 10000 and 900000
      and tracking_history_min_distance_meters
          between 1.0 and 1000.0
      and tracking_stale_after_ms
          between 30000 and 3600000
      and tracking_history_retention_days
          between 1 and 365;

    if v_config_count <> 1 then
        raise exception
            'POSTFLIGHT_FAILED: konfigurasi live tracking id=1 tidak ditemukan atau nilainya tidak valid';
    end if;
end;
$postflight$;


-- ============================================================
-- 3. REQUIRED FUNCTIONS AND EXACT SIGNATURES
-- ============================================================

do $postflight$
declare
    v_missing_functions text;
begin
    select string_agg(required.signature, E'\n')
    into v_missing_functions
    from (
        values
            (
                'public.bti_tracking_distance_meters(double precision,double precision,double precision,double precision)'
            ),
            (
                'public.staff_start_assignment_tracking(text,text,text,double precision,double precision,double precision,text,boolean)'
            ),
            (
                'public.staff_push_live_location(text,text,text,text,double precision,double precision,double precision,double precision,double precision,double precision,text,boolean)'
            ),
            (
                'public.staff_get_tracking_state(text,text)'
            ),
            (
                'public.staff_stop_assignment_tracking(text,text,text,text)'
            ),
            (
                'public.bti_close_assignment_tracking()'
            ),
            (
                'public.bti_cleanup_tracking_history()'
            )
    ) as required(signature)
    where to_regprocedure(required.signature) is null;

    if v_missing_functions is not null then
        raise exception
            'POSTFLIGHT_FAILED: function berikut tidak ditemukan:%',
            E'\n' || v_missing_functions;
    end if;
end;
$postflight$;


-- ============================================================
-- 4. REQUIRED INDEXES
-- ============================================================

do $postflight$
declare
    v_missing_indexes text;
begin
    select string_agg(required.index_name, ', ')
    into v_missing_indexes
    from (
        values
            ('assignment_tracking_one_active_per_technician'),
            ('assignment_tracking_one_active_per_assignment'),
            ('assignment_tracking_assignment_time_idx'),
            ('assignment_tracking_technician_time_idx'),
            ('technician_live_assignment_idx'),
            ('technician_live_updated_idx'),
            ('technician_history_session_time_idx'),
            ('technician_history_assignment_time_idx'),
            ('technician_history_technician_time_idx')
    ) as required(index_name)
    where not exists (
        select 1
        from pg_indexes as i
        where i.schemaname = 'public'
          and i.indexname = required.index_name
    );

    if v_missing_indexes is not null then
        raise exception
            'POSTFLIGHT_FAILED: index berikut tidak ditemukan: %',
            v_missing_indexes;
    end if;
end;
$postflight$;


-- ============================================================
-- 5. AUTOMATIC CLOSURE TRIGGER
-- ============================================================

do $postflight$
declare
    v_trigger_count bigint;
begin
    select count(*)
    into v_trigger_count
    from pg_trigger as t
    join pg_class as c
      on c.oid = t.tgrelid
    join pg_namespace as n
      on n.oid = c.relnamespace
    join pg_proc as p
      on p.oid = t.tgfoid
    join pg_namespace as pn
      on pn.oid = p.pronamespace
    where n.nspname = 'public'
      and c.relname = 'tiket_tugas'
      and t.tgname =
          'tiket_tugas_close_tracking_trigger'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
      and pn.nspname = 'public'
      and p.proname =
          'bti_close_assignment_tracking';

    if v_trigger_count <> 1 then
        raise exception
            'POSTFLIGHT_FAILED: trigger penutup tracking tidak ditemukan atau tidak aktif';
    end if;
end;
$postflight$;


-- ============================================================
-- 6. ROW LEVEL SECURITY AND SELECT POLICIES
-- ============================================================

do $postflight$
declare
    v_rls_table_count bigint;
    v_policy_count bigint;
begin
    select count(*)
    into v_rls_table_count
    from pg_class as c
    join pg_namespace as n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
          'assignment_tracking_sessions',
          'technician_live_locations',
          'technician_location_history'
      )
      and c.relrowsecurity;

    if v_rls_table_count <> 3 then
        raise exception
            'POSTFLIGHT_FAILED: RLS belum aktif pada seluruh tabel tracking';
    end if;

    select count(*)
    into v_policy_count
    from pg_policies
    where schemaname = 'public'
      and (
          (
              tablename =
                  'assignment_tracking_sessions'
              and policyname =
                  'assignment_tracking_authenticated_select'
          )
          or (
              tablename =
                  'technician_live_locations'
              and policyname =
                  'technician_live_authenticated_select'
          )
          or (
              tablename =
                  'technician_location_history'
              and policyname =
                  'technician_history_authenticated_select'
          )
      )
      and cmd = 'SELECT'
      and 'authenticated' = any(roles);

    if v_policy_count <> 3 then
        raise exception
            'POSTFLIGHT_FAILED: policy SELECT authenticated belum lengkap';
    end if;
end;
$postflight$;


-- ============================================================
-- 7. TABLE PRIVILEGES
-- ============================================================

do $postflight$
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
                'POSTFLIGHT_FAILED: role anon masih memiliki akses langsung ke %',
                v_table_name;
        end if;

        if not has_table_privilege(
            'authenticated',
            v_table_name,
            'SELECT'
        ) then
            raise exception
                'POSTFLIGHT_FAILED: role authenticated tidak memiliki SELECT pada %',
                v_table_name;
        end if;

        if has_table_privilege(
            'authenticated',
            v_table_name,
            'INSERT, UPDATE, DELETE'
        ) then
            raise exception
                'POSTFLIGHT_FAILED: role authenticated memiliki write langsung ke %',
                v_table_name;
        end if;
    end loop;

    v_sequence_name := pg_get_serial_sequence(
        'public.technician_location_history',
        'id_location'
    );

    if v_sequence_name is null then
        raise exception
            'POSTFLIGHT_FAILED: identity sequence technician_location_history.id_location tidak ditemukan';
    end if;

    if has_sequence_privilege(
        'anon',
        v_sequence_name,
        'USAGE, SELECT, UPDATE'
    ) then
        raise exception
            'POSTFLIGHT_FAILED: role anon memiliki akses langsung ke identity sequence tracking';
    end if;

    if has_sequence_privilege(
        'authenticated',
        v_sequence_name,
        'USAGE, SELECT, UPDATE'
    ) then
        raise exception
            'POSTFLIGHT_FAILED: role authenticated memiliki akses langsung ke identity sequence tracking';
    end if;
end;
$postflight$;


-- ============================================================
-- 8. RPC AND INTERNAL FUNCTION PRIVILEGES
-- ============================================================

do $postflight$
declare
    v_rpc_signature text;
    v_internal_signature text;
begin
    foreach v_rpc_signature in array array[
        'public.staff_start_assignment_tracking(text,text,text,double precision,double precision,double precision,text,boolean)',
        'public.staff_push_live_location(text,text,text,text,double precision,double precision,double precision,double precision,double precision,double precision,text,boolean)',
        'public.staff_get_tracking_state(text,text)',
        'public.staff_stop_assignment_tracking(text,text,text,text)'
    ]
    loop
        if not has_function_privilege(
            'anon',
            v_rpc_signature,
            'EXECUTE'
        ) then
            raise exception
                'POSTFLIGHT_FAILED: role anon tidak dapat menjalankan RPC %',
                v_rpc_signature;
        end if;

        if not has_function_privilege(
            'authenticated',
            v_rpc_signature,
            'EXECUTE'
        ) then
            raise exception
                'POSTFLIGHT_FAILED: role authenticated tidak dapat menjalankan RPC %',
                v_rpc_signature;
        end if;
    end loop;

    foreach v_internal_signature in array array[
        'public.bti_tracking_distance_meters(double precision,double precision,double precision,double precision)',
        'public.bti_close_assignment_tracking()',
        'public.bti_cleanup_tracking_history()'
    ]
    loop
        if has_function_privilege(
            'anon',
            v_internal_signature,
            'EXECUTE'
        ) then
            raise exception
                'POSTFLIGHT_FAILED: role anon dapat menjalankan function internal %',
                v_internal_signature;
        end if;

        if has_function_privilege(
            'authenticated',
            v_internal_signature,
            'EXECUTE'
        ) then
            raise exception
                'POSTFLIGHT_FAILED: role authenticated dapat menjalankan function internal %',
                v_internal_signature;
        end if;
    end loop;
end;
$postflight$;


-- ============================================================
-- 9. SUPABASE REALTIME PUBLICATION
-- ============================================================

do $postflight$
declare
    v_realtime_table_count bigint;
begin
    if not exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
    ) then
        raise exception
            'POSTFLIGHT_FAILED: publication supabase_realtime tidak ditemukan';
    end if;

    select count(*)
    into v_realtime_table_count
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in (
          'technician_live_locations',
          'assignment_tracking_sessions'
      );

    if v_realtime_table_count <> 2 then
        raise exception
            'POSTFLIGHT_FAILED: tabel live tracking belum lengkap pada publication Supabase Realtime';
    end if;
end;
$postflight$;


-- ============================================================
-- 10. DATA INTEGRITY
-- ============================================================

do $postflight$
declare
    v_invalid_count bigint;
begin
    select count(*)
    into v_invalid_count
    from (
        select technician_id
        from public.assignment_tracking_sessions
        where status = 'ACTIVE'
        group by technician_id
        having count(*) > 1
    ) as duplicate_technician;

    if v_invalid_count <> 0 then
        raise exception
            'POSTFLIGHT_FAILED: terdapat teknisi dengan lebih dari satu sesi aktif';
    end if;

    select count(*)
    into v_invalid_count
    from (
        select assignment_id
        from public.assignment_tracking_sessions
        where status = 'ACTIVE'
        group by assignment_id
        having count(*) > 1
    ) as duplicate_assignment;

    if v_invalid_count <> 0 then
        raise exception
            'POSTFLIGHT_FAILED: terdapat penugasan dengan lebih dari satu sesi aktif';
    end if;

    select count(*)
    into v_invalid_count
    from public.technician_live_locations as live
    left join public.assignment_tracking_sessions as session
      on session.id_session = live.tracking_session_id
    where session.id_session is null
       or session.status <> 'ACTIVE'
       or session.technician_id <> live.technician_id
       or session.assignment_id <> live.assignment_id
       or session.device_id <> live.device_id;

    if v_invalid_count <> 0 then
        raise exception
            'POSTFLIGHT_FAILED: terdapat live location yang tidak konsisten dengan sesi aktif';
    end if;

    select count(*)
    into v_invalid_count
    from public.assignment_tracking_sessions as session
    left join public.tiket_tugas as assignment
      on assignment.id_tugas::text = session.assignment_id
    where session.status = 'ACTIVE'
      and (
          assignment.id_tugas is null
          or assignment.status <> 'On Process'
          or assignment.id_teknisi::text
             <> session.technician_id
      );

    if v_invalid_count <> 0 then
        raise exception
            'POSTFLIGHT_FAILED: terdapat sesi aktif yang tidak sesuai dengan tiket On Process';
    end if;
end;
$postflight$;


rollback;


-- ============================================================
-- 11. FINAL SUMMARY
-- ============================================================

select
    'POSTFLIGHT_PASSED'::text as status,
    (
        select count(*)
        from public.assignment_tracking_sessions
    ) as tracking_session_count,
    (
        select count(*)
        from public.assignment_tracking_sessions
        where status = 'ACTIVE'
    ) as active_tracking_session_count,
    (
        select count(*)
        from public.technician_live_locations
    ) as live_location_count,
    (
        select count(*)
        from public.technician_location_history
    ) as location_history_count,
    config.tracking_update_interval_ms,
    config.tracking_history_interval_ms,
    config.tracking_history_min_distance_meters,
    config.tracking_stale_after_ms,
    config.tracking_history_retention_days,
    (
        select count(*)
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename in (
              'technician_live_locations',
              'assignment_tracking_sessions'
          )
    ) as realtime_tracking_table_count
from public.bti_mobile_config as config
where config.id = 1;
