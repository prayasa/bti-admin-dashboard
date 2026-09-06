begin;

do $preflight$
declare
    required_item record;
    duplicate_nik_count bigint;
    invalid_status_count bigint;
    invalid_coordinate_count bigint;
    active_qr_token text;
begin
    if to_regclass('public.teknisi') is null then
        raise exception
            'PREFLIGHT_FAILED: tabel public.teknisi tidak ditemukan';
    end if;

    if to_regclass('public.tiket_tugas') is null then
        raise exception
            'PREFLIGHT_FAILED: tabel public.tiket_tugas tidak ditemukan';
    end if;

    if to_regclass('public.log_presensi') is null then
        raise exception
            'PREFLIGHT_FAILED: tabel public.log_presensi tidak ditemukan';
    end if;

    if to_regclass('public.qr_aktif') is null then
        raise exception
            'PREFLIGHT_FAILED: tabel public.qr_aktif tidak ditemukan';
    end if;

    if to_regclass('public.token_qr_hangus') is null then
        raise exception
            'PREFLIGHT_FAILED: tabel public.token_qr_hangus tidak ditemukan';
    end if;

    for required_item in
        select *
        from (
            values
                ('teknisi', 'id'),
                ('teknisi', 'nik'),
                ('teknisi', 'nama_lengkap'),
                ('teknisi', 'password'),
                ('teknisi', 'device_id'),

                ('tiket_tugas', 'id_tugas'),
                ('tiket_tugas', 'id_teknisi'),
                ('tiket_tugas', 'nama_klien'),
                ('tiket_tugas', 'alamat_klien'),
                ('tiket_tugas', 'latitude_klien'),
                ('tiket_tugas', 'longitude_klien'),
                ('tiket_tugas', 'status'),
                ('tiket_tugas', 'created_at'),

                ('log_presensi', 'id_absen'),
                ('log_presensi', 'id_teknisi'),
                ('log_presensi', 'waktu_log'),
                ('log_presensi', 'tipe_log'),
                ('log_presensi', 'latitude_aktual'),
                ('log_presensi', 'longitude_aktual'),
                ('log_presensi', 'is_valid'),

                ('qr_aktif', 'id'),
                ('qr_aktif', 'token'),
                ('qr_aktif', 'updated_at'),

                ('token_qr_hangus', 'token_uuid'),
                ('token_qr_hangus', 'digunakan_pada')
        ) as required_columns(
            table_name,
            column_name
        )
    loop
        if not exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = required_item.table_name
              and column_name = required_item.column_name
        ) then
            raise exception
                'PREFLIGHT_FAILED: kolom %.% tidak ditemukan',
                required_item.table_name,
                required_item.column_name;
        end if;
    end loop;

    select count(*)
    into duplicate_nik_count
    from (
        select nik
        from public.teknisi
        where nik is not null
          and btrim(nik) <> ''
        group by nik
        having count(*) > 1
    ) as duplicate_nik;

    if duplicate_nik_count > 0 then
        raise exception
            'PREFLIGHT_FAILED: ditemukan % NIK duplikat',
            duplicate_nik_count;
    end if;

    if exists (
        select 1
        from public.teknisi
        where nik is null
           or btrim(nik) = ''
           or nama_lengkap is null
           or btrim(nama_lengkap) = ''
           or password is null
           or btrim(password) = ''
    ) then
        raise exception
            'PREFLIGHT_FAILED: terdapat teknisi dengan NIK, nama, atau password kosong';
    end if;

    select count(*)
    into invalid_status_count
    from public.tiket_tugas
    where status is not null
      and status not in (
          'Pending',
          'On Process',
          'Success'
      );

    if invalid_status_count > 0 then
        raise exception
            'PREFLIGHT_FAILED: ditemukan % tiket dengan status tidak didukung',
            invalid_status_count;
    end if;

    select count(*)
    into invalid_coordinate_count
    from public.tiket_tugas
    where latitude_klien is not null
      and longitude_klien is not null
      and (
          latitude_klien::numeric < -90
          or latitude_klien::numeric > 90
          or longitude_klien::numeric < -180
          or longitude_klien::numeric > 180
      );

    if invalid_coordinate_count > 0 then
        raise exception
            'PREFLIGHT_FAILED: ditemukan % tiket dengan koordinat di luar batas geografis',
            invalid_coordinate_count;
    end if;

    select token
    into active_qr_token
    from public.qr_aktif
    where id = 1
    limit 1;

    if active_qr_token is null then
        raise notice
            'PREFLIGHT_WARNING: qr_aktif id=1 belum tersedia. Buka halaman QR admin untuk membuat token';
    elsif active_qr_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\|[0-9]{10,}$' then
        raise notice
            'PREFLIGHT_WARNING: format token qr_aktif saat ini tidak sesuai UUID|timestamp';
    end if;

    raise notice
        'PREFLIGHT_PASSED: struktur dan data dasar siap untuk migration';
end
$preflight$;

rollback;