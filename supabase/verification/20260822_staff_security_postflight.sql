do $postflight$
declare
    v_table record;
    v_function record;

    v_oid oid;
    v_security_definer boolean;
    v_argument_names text[];
    v_result_type text;

    v_exists boolean;
    v_rls_enabled boolean;
    v_invalid_password_count bigint;
    v_config_count bigint;
begin
    -- ========================================================
    -- MIGRATION HISTORY
    -- ========================================================

    select exists (
        select 1
        from supabase_migrations.schema_migrations
        where version = '202608220001'
    )
    into v_exists;

    if not v_exists then
        raise exception
            'POSTFLIGHT_FAILED: migration 202608220001 belum tercatat pada remote.';
    end if;


    -- ========================================================
    -- REQUIRED TABLES, RLS, ANON PRIVILEGES, ADMIN POLICIES
    -- ========================================================

    for v_table in
        select *
        from (
            values
                ('teknisi'),
                ('tiket_tugas'),
                ('log_presensi'),
                ('qr_aktif'),
                ('token_qr_hangus'),
                ('bti_mobile_config'),
                ('qr_token_claims'),
                ('presensi_audit')
        ) as required_tables(table_name)
    loop
        select exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = v_table.table_name
              and table_type = 'BASE TABLE'
        )
        into v_exists;

        if not v_exists then
            raise exception
                'POSTFLIGHT_FAILED: tabel public.% tidak ditemukan.',
                v_table.table_name;
        end if;

        select c.relrowsecurity
        into v_rls_enabled
        from pg_class as c
        join pg_namespace as n
          on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = v_table.table_name
          and c.relkind in ('r', 'p');

        if not coalesce(v_rls_enabled, false) then
            raise exception
                'POSTFLIGHT_FAILED: RLS public.% belum aktif.',
                v_table.table_name;
        end if;

        if has_table_privilege(
                'anon',
                format('public.%I', v_table.table_name),
                'SELECT'
           )
           or has_table_privilege(
                'anon',
                format('public.%I', v_table.table_name),
                'INSERT'
           )
           or has_table_privilege(
                'anon',
                format('public.%I', v_table.table_name),
                'UPDATE'
           )
           or has_table_privilege(
                'anon',
                format('public.%I', v_table.table_name),
                'DELETE'
           ) then
            raise exception
                'POSTFLIGHT_FAILED: anon masih memiliki akses langsung ke public.%.',
                v_table.table_name;
        end if;

        select exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = v_table.table_name
              and 'authenticated' = any(roles)
        )
        into v_exists;

        if not v_exists then
            raise exception
                'POSTFLIGHT_FAILED: policy authenticated pada public.% tidak ditemukan.',
                v_table.table_name;
        end if;
    end loop;


    -- ========================================================
    -- PGCRYPTO
    -- ========================================================

    select exists (
        select 1
        from pg_extension
        where extname = 'pgcrypto'
    )
    into v_exists;

    if not v_exists then
        raise exception
            'POSTFLIGHT_FAILED: extension pgcrypto tidak tersedia.';
    end if;


    -- ========================================================
    -- PASSWORD HASHING
    -- ========================================================

    select count(*)
    into v_invalid_password_count
    from public.teknisi
    where password is null
       or btrim(password) = ''
       or password
          !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$';

    if v_invalid_password_count > 0 then
        raise exception
            'POSTFLIGHT_FAILED: terdapat % password teknisi yang belum menggunakan bcrypt.',
            v_invalid_password_count;
    end if;

    select exists (
        select 1
        from pg_trigger as t
        join pg_class as c
          on c.oid = t.tgrelid
        join pg_namespace as n
          on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'teknisi'
          and t.tgname = 'trg_bti_hash_teknisi_password'
          and not t.tgisinternal
          and t.tgenabled <> 'D'
    )
    into v_exists;

    if not v_exists then
        raise exception
            'POSTFLIGHT_FAILED: trigger hashing password teknisi tidak aktif.';
    end if;


    -- ========================================================
    -- MOBILE CONFIG
    -- ========================================================

    select count(*)
    into v_config_count
    from public.bti_mobile_config
    where id = 1
      and office_name = 'Kantor BTI Pontianak'
      and abs(
            office_latitude -
            (-0.030199545602447704)
          ) < 0.000000000001
      and abs(
            office_longitude -
            109.32172547120854
          ) < 0.000000000001
      and geofence_radius_meters = 50.0
      and max_location_accuracy_meters = 100.0
      and max_location_age_ms = 30000
      and qr_max_age_ms = 45000
      and qr_future_tolerance_ms = 5000
      and session_duration_ms = 900000;

    if v_config_count <> 1 then
        raise exception
            'POSTFLIGHT_FAILED: konfigurasi mobile tidak sesuai AppConfig Android.';
    end if;


    -- ========================================================
    -- EXACT ANDROID RPC CONTRACTS
    -- ========================================================

    for v_function in
        select *
        from (
            values
                (
                    'staff_login',
                    'public.staff_login(text,text,text)',
                    array[
                        'p_nik',
                        'p_password',
                        'p_device_id'
                    ]::text[]
                ),
                (
                    'staff_get_profile',
                    'public.staff_get_profile(text,text)',
                    array[
                        'p_technician_id',
                        'p_device_id'
                    ]::text[]
                ),
                (
                    'staff_get_home',
                    'public.staff_get_home(text,text)',
                    array[
                        'p_technician_id',
                        'p_device_id'
                    ]::text[]
                ),
                (
                    'staff_get_assignments',
                    'public.staff_get_assignments(text,text)',
                    array[
                        'p_technician_id',
                        'p_device_id'
                    ]::text[]
                ),
                (
                    'staff_update_assignment_status',
                    'public.staff_update_assignment_status(text,text,text,text)',
                    array[
                        'p_technician_id',
                        'p_device_id',
                        'p_assignment_id',
                        'p_new_status'
                    ]::text[]
                ),
                (
                    'staff_get_attendance',
                    'public.staff_get_attendance(text,text,text,text,integer)',
                    array[
                        'p_technician_id',
                        'p_device_id',
                        'p_start_at',
                        'p_end_at',
                        'p_limit'
                    ]::text[]
                ),
                (
                    'staff_submit_attendance',
                    'public.staff_submit_attendance(text,text,text,text,double precision,double precision,double precision,bigint,boolean)',
                    array[
                        'p_technician_id',
                        'p_device_id',
                        'p_attendance_type',
                        'p_qr_payload',
                        'p_latitude',
                        'p_longitude',
                        'p_accuracy_meters',
                        'p_location_age_ms',
                        'p_is_mock'
                    ]::text[]
                )
        ) as required_functions(
            function_name,
            function_signature,
            expected_argument_names
        )
    loop
        v_oid := to_regprocedure(
            v_function.function_signature
        );

        if v_oid is null then
            raise exception
                'POSTFLIGHT_FAILED: RPC % dengan signature yang sesuai Android tidak ditemukan.',
                v_function.function_name;
        end if;

        select
            p.prosecdef,
            p.proargnames[1:p.pronargs]::text[],
            pg_get_function_result(p.oid)
        into
            v_security_definer,
            v_argument_names,
            v_result_type
        from pg_proc as p
        where p.oid = v_oid;

        if not coalesce(v_security_definer, false) then
            raise exception
                'POSTFLIGHT_FAILED: RPC % bukan SECURITY DEFINER.',
                v_function.function_name;
        end if;

        if v_argument_names is distinct from
           v_function.expected_argument_names then
            raise exception
                'POSTFLIGHT_FAILED: parameter RPC % tidak sesuai Android. Aktual: %, diharapkan: %.',
                v_function.function_name,
                v_argument_names,
                v_function.expected_argument_names;
        end if;

        if v_result_type <> 'jsonb' then
            raise exception
                'POSTFLIGHT_FAILED: RPC % tidak mengembalikan jsonb.',
                v_function.function_name;
        end if;

        if not has_function_privilege(
            'anon',
            v_oid,
            'EXECUTE'
        ) then
            raise exception
                'POSTFLIGHT_FAILED: anon tidak dapat mengeksekusi RPC %.',
                v_function.function_name;
        end if;

        if not has_function_privilege(
            'authenticated',
            v_oid,
            'EXECUTE'
        ) then
            raise exception
                'POSTFLIGHT_FAILED: authenticated tidak dapat mengeksekusi RPC %.',
                v_function.function_name;
        end if;
    end loop;


    -- ========================================================
    -- INTERNAL FUNCTIONS MUST NOT BE EXPOSED
    -- ========================================================

    v_oid := to_regprocedure(
        'public.bti_require_staff_device(text,text)'
    );

    if v_oid is null then
        raise exception
            'POSTFLIGHT_FAILED: internal device validator tidak ditemukan.';
    end if;

    if has_function_privilege(
        'anon',
        v_oid,
        'EXECUTE'
    ) then
        raise exception
            'POSTFLIGHT_FAILED: internal device validator dapat dieksekusi anon.';
    end if;

    v_oid := to_regprocedure(
        'public.bti_reject_attendance_request(text,text,text,text,double precision,double precision,double precision,bigint,double precision,boolean,text)'
    );

    if v_oid is null then
        raise exception
            'POSTFLIGHT_FAILED: internal attendance audit function tidak ditemukan.';
    end if;

    if has_function_privilege(
        'anon',
        v_oid,
        'EXECUTE'
    ) then
        raise exception
            'POSTFLIGHT_FAILED: internal attendance audit function dapat dieksekusi anon.';
    end if;


    raise notice
        'POSTFLIGHT_PASSED: migration, bcrypt, RLS, privileges, config, dan kontrak RPC Android valid.';
end;
$postflight$;


select
    'POSTFLIGHT_PASSED' as status,

    (
        select count(*)
        from public.teknisi
    ) as technician_count,

    (
        select count(*)
        from public.tiket_tugas
    ) as assignment_count,

    (
        select count(*)
        from public.log_presensi
    ) as attendance_count,

    (
        select count(*)
        from public.teknisi
        where password
              ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
    ) as bcrypt_password_count,

    (
        select count(*)
        from public.bti_mobile_config
        where id = 1
    ) as mobile_config_count,

    (
        select count(*)
        from pg_proc as p
        join pg_namespace as n
          on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
                'staff_login',
                'staff_get_profile',
                'staff_get_home',
                'staff_get_assignments',
                'staff_update_assignment_status',
                'staff_get_attendance',
                'staff_submit_attendance'
          )
    ) as mobile_rpc_count;