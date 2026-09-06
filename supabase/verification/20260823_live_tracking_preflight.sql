begin;

do $preflight$
declare
    v_missing_columns text[];
    v_unexpected_status_count bigint;
    v_missing_destination_count bigint;
begin
    if to_regclass(
        'public.bti_mobile_config'
    ) is null then
        raise exception
            'PREFLIGHT_FAILED: tabel public.bti_mobile_config tidak ditemukan.';
    end if;

    if to_regclass(
        'public.teknisi'
    ) is null then
        raise exception
            'PREFLIGHT_FAILED: tabel public.teknisi tidak ditemukan.';
    end if;

    if to_regclass(
        'public.tiket_tugas'
    ) is null then
        raise exception
            'PREFLIGHT_FAILED: tabel public.tiket_tugas tidak ditemukan.';
    end if;

    if to_regprocedure(
        'public.bti_require_staff_device(text,text)'
    ) is null then
        raise exception
            'PREFLIGHT_FAILED: fungsi bti_require_staff_device(text,text) tidak ditemukan. Terapkan migration staff security terlebih dahulu.';
    end if;

    select array_agg(required.column_name)
    into v_missing_columns
    from (
        values
            ('bti_mobile_config', 'id'),
            (
                'bti_mobile_config',
                'max_location_accuracy_meters'
            ),
            (
                'bti_mobile_config',
                'updated_at'
            ),
            ('teknisi', 'id'),
            ('teknisi', 'device_id'),
            ('tiket_tugas', 'id_tugas'),
            ('tiket_tugas', 'id_teknisi'),
            ('tiket_tugas', 'nama_klien'),
            ('tiket_tugas', 'alamat_klien'),
            ('tiket_tugas', 'latitude_klien'),
            ('tiket_tugas', 'longitude_klien'),
            ('tiket_tugas', 'status'),
            ('tiket_tugas', 'created_at')
    ) as required(table_name, column_name)
    where not exists (
        select 1
        from information_schema.columns as columns
        where columns.table_schema = 'public'
          and columns.table_name =
              required.table_name
          and columns.column_name =
              required.column_name
    );

    if v_missing_columns is not null then
        raise exception
            'PREFLIGHT_FAILED: kolom wajib tidak ditemukan: %',
            array_to_string(
                v_missing_columns,
                ', '
            );
    end if;

    if not exists (
        select 1
        from public.bti_mobile_config
        where id = 1
    ) then
        raise exception
            'PREFLIGHT_FAILED: konfigurasi mobile id=1 tidak ditemukan.';
    end if;

    select count(*)
    into v_unexpected_status_count
    from public.tiket_tugas
    where status is null
       or status not in (
            'Pending',
            'On Process',
            'Success'
       );

    if v_unexpected_status_count > 0 then
        raise warning
            'PREFLIGHT_WARNING: % tiket memiliki status di luar Pending/On Process/Success.',
            v_unexpected_status_count;
    end if;

    select count(*)
    into v_missing_destination_count
    from public.tiket_tugas
    where latitude_klien is null
       or longitude_klien is null
       or latitude_klien < -90.0
       or latitude_klien > 90.0
       or longitude_klien < -180.0
       or longitude_klien > 180.0;

    if v_missing_destination_count > 0 then
        raise warning
            'PREFLIGHT_WARNING: % tiket belum memiliki koordinat tujuan valid. Tiket tersebut tidak dapat memulai tracking.',
            v_missing_destination_count;
    end if;

    if to_regclass(
        'public.assignment_tracking_sessions'
    ) is not null
       or to_regclass(
            'public.technician_live_locations'
       ) is not null
       or to_regclass(
            'public.technician_location_history'
       ) is not null then
        raise warning
            'PREFLIGHT_WARNING: sebagian tabel tracking sudah tersedia. Pastikan migration belum pernah diterapkan sebagian secara manual.';
    end if;

    raise notice
        'PREFLIGHT_PASSED: schema dasar siap untuk migration live assignment tracking.';
end;
$preflight$;

select
    'PREFLIGHT_PASSED' as status,
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
        from public.tiket_tugas
        where status = 'On Process'
    ) as active_assignment_count,
    (
        select count(*)
        from public.tiket_tugas
        where latitude_klien is not null
          and longitude_klien is not null
          and latitude_klien
              between -90.0 and 90.0
          and longitude_klien
              between -180.0 and 180.0
    ) as assignment_with_valid_destination_count;

rollback;
