begin;


-- ============================================================
-- STAFF PWA ACCESS HARDENING
--
-- Kebijakan akses:
-- 1. Akun dengan ANDROID_ID aktif hanya memakai Android Native.
-- 2. Akun tanpa ANDROID_ID dapat memakai PWA presensi.
-- 3. Hanya satu browser PWA aktif untuk setiap teknisi.
-- 4. Binding Android baru otomatis mencabut sesi PWA.
-- ============================================================


-- Sesi PWA lama milik akun yang telah terikat Android dicabut.
update public.staff_web_devices as web_device
set is_active = false,
    last_seen_at = clock_timestamp()
from public.teknisi as technician
where technician.id = web_device.technician_id
  and web_device.is_active = true
  and nullif(
        btrim(coalesce(technician.device_id, '')),
        ''
      ) is not null;


-- Jika data lama memiliki lebih dari satu browser aktif, sisakan
-- browser dengan login terbaru sebelum unique index dibuat.
with ranked_active_devices as (
    select
        web_device.id_device,
        row_number() over (
            partition by web_device.technician_id
            order by
                web_device.last_login_at desc,
                web_device.created_at desc,
                web_device.id_device desc
        ) as active_order
    from public.staff_web_devices as web_device
    where web_device.is_active = true
)
update public.staff_web_devices as web_device
set is_active = false,
    last_seen_at = clock_timestamp()
from ranked_active_devices as ranked
where ranked.id_device = web_device.id_device
  and ranked.active_order > 1;


create unique index if not exists
staff_web_devices_one_active_per_technician_idx
on public.staff_web_devices (
    technician_id
)
where is_active = true;


comment on index
public.staff_web_devices_one_active_per_technician_idx is
    'Menjamin hanya satu browser PWA aktif untuk setiap teknisi.';


-- ============================================================
-- INTERNAL DEVICE VALIDATION
--
-- Jika ANDROID_ID tersedia, hanya Android Native yang diterima.
-- Browser PWA hanya diperiksa untuk akun tanpa ANDROID_ID.
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

    select technician.*
    into v_staff
    from public.teknisi as technician
    where technician.id::text = v_technician_id
    limit 1;

    if not found then
        raise exception
            'Akun teknisi tidak ditemukan.'
            using errcode = 'P0001';
    end if;

    if nullif(
        btrim(coalesce(v_staff.device_id, '')),
        ''
    ) is not null then
        if btrim(v_staff.device_id) = v_device_id then
            return v_staff;
        end if;

        raise exception
            'Akun ini khusus digunakan melalui aplikasi Android Native.'
            using errcode = 'P0001';
    end if;

    update public.staff_web_devices
    set last_seen_at = clock_timestamp()
    where technician_id = v_staff.id
      and browser_device_id = v_device_id
      and is_active = true;

    if found then
        return v_staff;
    end if;

    raise exception
        'Sesi PWA tidak aktif. Silakan login kembali.'
        using errcode = 'P0001';
end;
$function$;


-- ============================================================
-- ANDROID BINDING REVOCATION
--
-- Ketika device_id Android dipasang atau diganti, seluruh sesi
-- PWA teknisi tersebut dinonaktifkan pada transaksi yang sama.
-- ============================================================

create or replace function
public.bti_revoke_web_devices_after_android_binding()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
begin
    if nullif(
        btrim(coalesce(new.device_id, '')),
        ''
    ) is not null then
        update public.staff_web_devices
        set is_active = false,
            last_seen_at = clock_timestamp()
        where technician_id = new.id
          and is_active = true;
    end if;

    return new;
end;
$function$;


drop trigger if exists
bti_revoke_web_devices_after_android_binding_trigger
on public.teknisi;


create trigger
bti_revoke_web_devices_after_android_binding_trigger
after update of device_id
on public.teknisi
for each row
when (
    new.device_id is distinct from old.device_id
)
execute function
public.bti_revoke_web_devices_after_android_binding();


-- ============================================================
-- PWA LOGIN
--
-- Password selalu diverifikasi sebelum kebijakan platform
-- dijelaskan agar status NIK tidak bocor kepada pemohon anonim.
-- Baris teknisi dikunci untuk mencegah dua login browser aktif
-- secara bersamaan pada akun yang sama.
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

    select technician.*
    into v_staff
    from public.teknisi as technician
    where upper(btrim(technician.nik)) = v_nik
    limit 1
    for update;

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

    if nullif(
        btrim(coalesce(v_staff.device_id, '')),
        ''
    ) is not null then
        raise exception
            'Akun ini telah terdaftar untuk aplikasi Android Native. Gunakan aplikasi Android atau hubungi administrator untuk mereset perangkat.'
            using errcode = 'P0001';
    end if;

    update public.staff_web_devices
    set is_active = false,
        last_seen_at = clock_timestamp()
    where technician_id = v_staff.id
      and browser_device_id <> v_browser_device_id
      and is_active = true;

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
-- PRIVILEGES
-- ============================================================

revoke all
on function public.bti_require_staff_device(
    text,
    text
)
from public, anon, authenticated;


revoke all
on function
public.bti_revoke_web_devices_after_android_binding()
from public, anon, authenticated;


revoke all
on function public.staff_web_login(
    text,
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


notify pgrst, 'reload schema';


commit;
