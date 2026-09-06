begin;


-- ============================================================
-- STAFF PWA DEVICE ACCESS
--
-- Android tetap menggunakan public.teknisi.device_id.
-- PWA menggunakan browser_device_id yang dibuat oleh browser
-- dan disimpan pada tabel terpisah agar satu akun dapat memakai
-- Android Native dan PWA iOS tanpa saling mengganti binding.
-- ============================================================

create table if not exists public.staff_web_devices (
    id_device uuid
        primary key
        default gen_random_uuid(),
    technician_id uuid
        not null
        references public.teknisi(id)
        on delete cascade,
    browser_device_id text
        not null,
    is_active boolean
        not null
        default true,
    created_at timestamp with time zone
        not null
        default clock_timestamp(),
    last_login_at timestamp with time zone
        not null
        default clock_timestamp(),
    last_seen_at timestamp with time zone
        not null
        default clock_timestamp(),

    constraint staff_web_devices_browser_id_length_check
        check (
            char_length(btrim(browser_device_id))
                between 16 and 200
        ),

    constraint staff_web_devices_technician_browser_key
        unique (
            technician_id,
            browser_device_id
        )
);


create index if not exists
_staff_web_devices_active_technician_idx
on public.staff_web_devices (
    technician_id,
    is_active
);


comment on table public.staff_web_devices is
    'Daftar perangkat browser yang diizinkan menggunakan PWA presensi BTI.';

comment on column
public.staff_web_devices.browser_device_id is
    'UUID acak persisten yang dibuat pada browser PWA; bukan ANDROID_ID.';


alter table public.staff_web_devices
enable row level security;


revoke all
on table public.staff_web_devices
from public, anon, authenticated;


-- ============================================================
-- INTERNAL DEVICE VALIDATION
--
-- Mempertahankan signature lama agar seluruh RPC Android yang
-- sudah tersedia tidak perlu diubah. Credential dinyatakan valid
-- jika cocok dengan ANDROID_ID utama atau browser_device_id PWA
-- yang masih aktif.
-- ============================================================

create or replace function public.bti_require_staff_device(
    p_technician_id text,
    p_device_id text
)
returns public.teknisi
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_staff public.teknisi%rowtype;
    v_technician_id text;
    v_device_id text;
begin
    v_technician_id := nullif(
        btrim(coalesce(p_technician_id, '')),
        ''
    );

    v_device_id := nullif(
        btrim(coalesce(p_device_id, '')),
        ''
    );

    if v_technician_id is null then
        raise exception
            'Identitas teknisi tidak valid.'
            using errcode = 'P0001';
    end if;

    if v_device_id is null then
        raise exception
            'Identitas perangkat tidak tersedia.'
            using errcode = 'P0001';
    end if;

    select t.*
    into v_staff
    from public.teknisi as t
    where t.id::text = v_technician_id
    limit 1;

    if not found then
        raise exception
            'Akun teknisi tidak ditemukan.'
            using errcode = 'P0001';
    end if;

    if v_staff.device_id is not null
       and btrim(v_staff.device_id) <> ''
       and btrim(v_staff.device_id) = v_device_id then
        return v_staff;
    end if;

    update public.staff_web_devices
    set last_seen_at = clock_timestamp()
    where technician_id = v_staff.id
      and browser_device_id = v_device_id
      and is_active = true;

    if found then
        return v_staff;
    end if;

    if v_staff.device_id is null
       or btrim(v_staff.device_id) = '' then
        raise exception
            'Perangkat belum terdaftar. Silakan login kembali.'
            using errcode = 'P0001';
    end if;

    raise exception
        'Akun ini telah terikat pada perangkat lain.'
        using errcode = 'P0001';
end;
$function$;


-- ============================================================
-- PWA LOGIN
-- ============================================================

create or replace function public.staff_web_login(
    p_nik text,
    p_password text,
    p_browser_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_staff public.teknisi%rowtype;
    v_nik text;
    v_browser_device_id text;
begin
    v_nik := nullif(
        upper(btrim(coalesce(p_nik, ''))),
        ''
    );

    v_browser_device_id := nullif(
        btrim(coalesce(p_browser_device_id, '')),
        ''
    );

    if v_nik is null then
        raise exception
            'NIK wajib diisi.'
            using errcode = 'P0001';
    end if;

    if p_password is null
       or p_password = '' then
        raise exception
            'Password wajib diisi.'
            using errcode = 'P0001';
    end if;

    if v_browser_device_id is null
       or char_length(v_browser_device_id)
            not between 16 and 200 then
        raise exception
            'Identitas browser tidak valid.'
            using errcode = 'P0001';
    end if;

    select t.*
    into v_staff
    from public.teknisi as t
    where upper(btrim(t.nik)) = v_nik
    limit 1;

    if not found then
        raise exception
            'NIK atau password salah.'
            using errcode = 'P0001';
    end if;

    if v_staff.password is null
       or v_staff.password <> crypt(
            p_password,
            v_staff.password
       ) then
        raise exception
            'NIK atau password salah.'
            using errcode = 'P0001';
    end if;

    insert into public.staff_web_devices (
        technician_id,
        browser_device_id,
        is_active,
        last_login_at,
        last_seen_at
    )
    values (
        v_staff.id,
        v_browser_device_id,
        true,
        clock_timestamp(),
        clock_timestamp()
    )
    on conflict (
        technician_id,
        browser_device_id
    )
    do update
    set is_active = true,
        last_login_at = excluded.last_login_at,
        last_seen_at = excluded.last_seen_at;

    return jsonb_build_object(
        'success',
        true,
        'message',
        'Login PWA berhasil.',
        'id',
        v_staff.id::text,
        'nik',
        v_staff.nik,
        'nama_lengkap',
        v_staff.nama_lengkap,
        'browser_device_id',
        v_browser_device_id,
        'device_verified',
        true,
        'platform',
        'WEB_PWA'
    );
end;
$function$;


-- ============================================================
-- PWA SESSION VALIDATION
-- ============================================================

create or replace function public.staff_web_get_session(
    p_technician_id text,
    p_browser_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_staff public.teknisi%rowtype;
begin
    select *
    into v_staff
    from public.bti_require_staff_device(
        p_technician_id,
        p_browser_device_id
    );

    return jsonb_build_object(
        'authenticated',
        true,
        'id',
        v_staff.id::text,
        'nik',
        v_staff.nik,
        'nama_lengkap',
        v_staff.nama_lengkap,
        'device_verified',
        true,
        'platform',
        'WEB_PWA'
    );
end;
$function$;


-- ============================================================
-- PWA LOGOUT
-- ============================================================

create or replace function public.staff_web_logout(
    p_technician_id text,
    p_browser_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_technician_id uuid;
    v_browser_device_id text;
    v_revoked_count integer;
begin
    begin
        v_technician_id :=
            nullif(
                btrim(
                    coalesce(
                        p_technician_id,
                        ''
                    )
                ),
                ''
            )::uuid;
    exception
        when invalid_text_representation then
            v_technician_id := null;
    end;

    v_browser_device_id := nullif(
        btrim(
            coalesce(
                p_browser_device_id,
                ''
            )
        ),
        ''
    );

    if v_technician_id is null
       or v_browser_device_id is null then
        return jsonb_build_object(
            'success',
            true,
            'revoked',
            false,
            'message',
            'Sesi PWA sudah tidak aktif.'
        );
    end if;

    update public.staff_web_devices
    set is_active = false,
        last_seen_at = clock_timestamp()
    where technician_id = v_technician_id
      and browser_device_id = v_browser_device_id
      and is_active = true;

    get diagnostics
        v_revoked_count = row_count;

    return jsonb_build_object(
        'success',
        true,
        'revoked',
        v_revoked_count > 0,
        'message',
        case
            when v_revoked_count > 0 then
                'Logout PWA berhasil.'
            else
                'Sesi PWA sudah tidak aktif.'
        end
    );
end;
$function$;


-- ============================================================
-- FUNCTION PRIVILEGES
-- ============================================================

revoke all
on function public.bti_require_staff_device(
    text,
    text
)
from public, anon, authenticated;

revoke all
on function public.staff_web_login(
    text,
    text,
    text
)
from public, anon, authenticated;

revoke all
on function public.staff_web_get_session(
    text,
    text
)
from public, anon, authenticated;

revoke all
on function public.staff_web_logout(
    text,
    text
)
from public, anon, authenticated;


grant execute
on function public.staff_web_login(
    text,
    text,
    text
)
to anon, authenticated;

grant execute
on function public.staff_web_get_session(
    text,
    text
)
to anon, authenticated;

grant execute
on function public.staff_web_logout(
    text,
    text
)
to anon, authenticated;


notify pgrst, 'reload schema';


commit;
