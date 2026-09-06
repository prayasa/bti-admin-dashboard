begin;


-- ============================================================
-- ADMIN TECHNICIAN DEVICE STATUS
--
-- Menyediakan status akses perangkat teknisi untuk dashboard:
-- 1. ANDROID_NATIVE jika teknisi.device_id terisi.
-- 2. WEB_PWA jika terdapat sesi PWA aktif.
-- 3. UNBOUND jika belum ada perangkat yang terhubung.
--
-- Tabel staff_web_devices tetap tidak dapat dibaca langsung
-- oleh anon maupun authenticated. Data hanya diberikan melalui
-- RPC ini setelah role administrator diverifikasi dari JWT.
-- ============================================================


create or replace function
public.admin_get_technicians_with_device_status()
returns table (
    id text,
    nama_lengkap text,
    nik text,
    android_device_id text,
    created_at text,
    access_platform text,
    pwa_last_login_at text,
    pwa_last_seen_at text
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_user_id uuid;
    v_user_role text;
begin
    v_user_id := auth.uid();

    v_user_role := coalesce(
        auth.jwt()
            -> 'app_metadata'
            ->> 'role',
        ''
    );

    if v_user_id is null
       or v_user_role <> 'admin' then
        raise exception
            'Akses hanya tersedia untuk administrator.'
            using errcode = '42501';
    end if;

    return query
    select
        technician.id::text,
        technician.nama_lengkap::text,
        technician.nik::text,

        nullif(
            btrim(
                coalesce(
                    technician.device_id,
                    ''
                )
            ),
            ''
        )::text as android_device_id,

        case
            when technician.created_at is null then
                null
            else
                technician.created_at::text
        end as created_at,

        case
            when nullif(
                btrim(
                    coalesce(
                        technician.device_id,
                        ''
                    )
                ),
                ''
            ) is not null then
                'ANDROID_NATIVE'::text

            when active_web_device.last_login_at
                is not null then
                'WEB_PWA'::text

            else
                'UNBOUND'::text
        end as access_platform,

        case
            when active_web_device.last_login_at
                is null then
                null
            else
                active_web_device
                    .last_login_at::text
        end as pwa_last_login_at,

        case
            when active_web_device.last_seen_at
                is null then
                null
            else
                active_web_device
                    .last_seen_at::text
        end as pwa_last_seen_at

    from public.teknisi as technician

    left join lateral (
        select
            web_device.last_login_at,
            web_device.last_seen_at
        from public.staff_web_devices
            as web_device
        where web_device.technician_id
                = technician.id
          and web_device.is_active = true
        order by
            web_device.last_login_at desc,
            web_device.created_at desc,
            web_device.id_device desc
        limit 1
    ) as active_web_device
        on true

    order by
        technician.created_at desc nulls last,
        technician.nama_lengkap asc;
end;
$function$;


comment on function
public.admin_get_technicians_with_device_status() is
    'Mengambil teknisi beserta status binding Android atau sesi PWA aktif untuk administrator.';


revoke all
on function
public.admin_get_technicians_with_device_status()
from public, anon, authenticated;


grant execute
on function
public.admin_get_technicians_with_device_status()
to authenticated;


notify pgrst, 'reload schema';


commit;