begin;

-- ============================================================
-- BTI LIVE ASSIGNMENT TRACKING
--
-- Migration incremental setelah:
-- 202608220001_staff_security_rpc.sql
--
-- Tujuan:
-- 1. Menyimpan satu sesi perjalanan untuk setiap tugas aktif.
-- 2. Menyimpan satu posisi terbaru per teknisi untuk dashboard.
-- 3. Menyimpan history tersampling untuk menggambar rute aktual.
-- 4. Menyediakan RPC aman untuk aplikasi Android.
-- 5. Menghentikan tracking otomatis ketika tugas selesai/dihapus.
-- ============================================================


-- ============================================================
-- MOBILE TRACKING CONFIG
-- ============================================================

alter table public.bti_mobile_config
    add column if not exists
        tracking_update_interval_ms bigint
        not null default 15000,
    add column if not exists
        tracking_history_interval_ms bigint
        not null default 30000,
    add column if not exists
        tracking_history_min_distance_meters
        double precision not null default 20.0,
    add column if not exists
        tracking_stale_after_ms bigint
        not null default 120000,
    add column if not exists
        tracking_history_retention_days integer
        not null default 30;

alter table public.bti_mobile_config
    drop constraint if exists
        bti_mobile_config_tracking_update_valid;

alter table public.bti_mobile_config
    add constraint
        bti_mobile_config_tracking_update_valid
        check (
            tracking_update_interval_ms
            between 5000 and 300000
        );

alter table public.bti_mobile_config
    drop constraint if exists
        bti_mobile_config_tracking_history_interval_valid;

alter table public.bti_mobile_config
    add constraint
        bti_mobile_config_tracking_history_interval_valid
        check (
            tracking_history_interval_ms
            between 10000 and 900000
        );

alter table public.bti_mobile_config
    drop constraint if exists
        bti_mobile_config_tracking_distance_valid;

alter table public.bti_mobile_config
    add constraint
        bti_mobile_config_tracking_distance_valid
        check (
            tracking_history_min_distance_meters
            between 1.0 and 1000.0
        );

alter table public.bti_mobile_config
    drop constraint if exists
        bti_mobile_config_tracking_stale_valid;

alter table public.bti_mobile_config
    add constraint
        bti_mobile_config_tracking_stale_valid
        check (
            tracking_stale_after_ms
            between 30000 and 3600000
        );

alter table public.bti_mobile_config
    drop constraint if exists
        bti_mobile_config_tracking_retention_valid;

alter table public.bti_mobile_config
    add constraint
        bti_mobile_config_tracking_retention_valid
        check (
            tracking_history_retention_days
            between 1 and 365
        );

update public.bti_mobile_config
set
    tracking_update_interval_ms = 15000,
    tracking_history_interval_ms = 30000,
    tracking_history_min_distance_meters = 20.0,
    tracking_stale_after_ms = 120000,
    tracking_history_retention_days = 30,
    updated_at = now()
where id = 1;


-- ============================================================
-- TRACKING SESSION
--
-- ID assignment/technician disimpan sebagai text agar tetap
-- kompatibel dengan schema lama yang mungkin memakai bigint/UUID.
-- ============================================================

create table if not exists
public.assignment_tracking_sessions (
    id_session uuid primary key
        default gen_random_uuid(),

    assignment_id text not null,
    technician_id text not null,
    device_id text not null,

    status text not null default 'ACTIVE',
    stop_reason text,

    start_latitude double precision not null,
    start_longitude double precision not null,
    start_accuracy_meters double precision not null,

    started_at timestamp with time zone
        not null default now(),
    last_location_at timestamp with time zone,
    ended_at timestamp with time zone,
    created_at timestamp with time zone
        not null default now(),
    updated_at timestamp with time zone
        not null default now(),

    constraint assignment_tracking_status_valid
        check (
            status in (
                'ACTIVE',
                'COMPLETED',
                'STOPPED',
                'CANCELLED'
            )
        ),

    constraint assignment_tracking_start_latitude_valid
        check (
            start_latitude between -90.0 and 90.0
        ),

    constraint assignment_tracking_start_longitude_valid
        check (
            start_longitude between -180.0 and 180.0
        ),

    constraint assignment_tracking_start_accuracy_valid
        check (
            start_accuracy_meters > 0.0
        ),

    constraint assignment_tracking_end_time_valid
        check (
            ended_at is null
            or ended_at >= started_at
        )
);

create unique index if not exists
    assignment_tracking_one_active_per_technician
on public.assignment_tracking_sessions (
    technician_id
)
where status = 'ACTIVE';

create unique index if not exists
    assignment_tracking_one_active_per_assignment
on public.assignment_tracking_sessions (
    assignment_id
)
where status = 'ACTIVE';

create index if not exists
    assignment_tracking_assignment_time_idx
on public.assignment_tracking_sessions (
    assignment_id,
    started_at desc
);

create index if not exists
    assignment_tracking_technician_time_idx
on public.assignment_tracking_sessions (
    technician_id,
    started_at desc
);


-- ============================================================
-- CURRENT/LIVE LOCATION
--
-- Satu baris per teknisi. Tabel ini yang disubscribe dashboard.
-- ============================================================

create table if not exists
public.technician_live_locations (
    technician_id text primary key,
    assignment_id text not null,
    tracking_session_id uuid not null,
    device_id text not null,

    latitude double precision not null,
    longitude double precision not null,
    accuracy_meters double precision not null,
    altitude_meters double precision,
    speed_mps double precision,
    bearing_degrees double precision,
    is_mock boolean not null default false,

    recorded_at timestamp with time zone not null,
    received_at timestamp with time zone
        not null default now(),
    updated_at timestamp with time zone
        not null default now(),

    constraint technician_live_session_fk
        foreign key (tracking_session_id)
        references public.assignment_tracking_sessions(
            id_session
        )
        on delete cascade,

    constraint technician_live_latitude_valid
        check (
            latitude between -90.0 and 90.0
        ),

    constraint technician_live_longitude_valid
        check (
            longitude between -180.0 and 180.0
        ),

    constraint technician_live_accuracy_valid
        check (
            accuracy_meters > 0.0
        ),

    constraint technician_live_speed_valid
        check (
            speed_mps is null
            or speed_mps >= 0.0
        ),

    constraint technician_live_bearing_valid
        check (
            bearing_degrees is null
            or (
                bearing_degrees >= 0.0
                and bearing_degrees < 360.0
            )
        )
);

create index if not exists
    technician_live_assignment_idx
on public.technician_live_locations (
    assignment_id
);

create index if not exists
    technician_live_updated_idx
on public.technician_live_locations (
    updated_at desc
);


-- ============================================================
-- LOCATION HISTORY
--
-- event_id membuat retry Android idempotent.
-- ============================================================

create table if not exists
public.technician_location_history (
    id_location bigint generated by default
        as identity primary key,

    event_id uuid not null default gen_random_uuid(),
    tracking_session_id uuid not null,
    assignment_id text not null,
    technician_id text not null,
    device_id text not null,

    latitude double precision not null,
    longitude double precision not null,
    accuracy_meters double precision not null,
    altitude_meters double precision,
    speed_mps double precision,
    bearing_degrees double precision,
    is_mock boolean not null default false,

    recorded_at timestamp with time zone not null,
    received_at timestamp with time zone
        not null default now(),

    constraint technician_history_event_unique
        unique (event_id),

    constraint technician_history_session_fk
        foreign key (tracking_session_id)
        references public.assignment_tracking_sessions(
            id_session
        )
        on delete cascade,

    constraint technician_history_latitude_valid
        check (
            latitude between -90.0 and 90.0
        ),

    constraint technician_history_longitude_valid
        check (
            longitude between -180.0 and 180.0
        ),

    constraint technician_history_accuracy_valid
        check (
            accuracy_meters > 0.0
        ),

    constraint technician_history_speed_valid
        check (
            speed_mps is null
            or speed_mps >= 0.0
        ),

    constraint technician_history_bearing_valid
        check (
            bearing_degrees is null
            or (
                bearing_degrees >= 0.0
                and bearing_degrees < 360.0
            )
        )
);

create index if not exists
    technician_history_session_time_idx
on public.technician_location_history (
    tracking_session_id,
    recorded_at asc
);

create index if not exists
    technician_history_assignment_time_idx
on public.technician_location_history (
    assignment_id,
    recorded_at desc
);

create index if not exists
    technician_history_technician_time_idx
on public.technician_location_history (
    technician_id,
    recorded_at desc
);


-- ============================================================
-- INTERNAL HAVERSINE HELPER
-- ============================================================

create or replace function
public.bti_tracking_distance_meters(
    p_start_latitude double precision,
    p_start_longitude double precision,
    p_end_latitude double precision,
    p_end_longitude double precision
)
returns double precision
language sql
immutable
strict
parallel safe
set search_path = public, extensions, pg_temp
as $function$
    select
        2.0 * 6371000.0 * asin(
            least(
                1.0,
                sqrt(
                    greatest(
                        0.0,
                        power(
                            sin(
                                radians(
                                    p_end_latitude
                                    - p_start_latitude
                                ) / 2.0
                            ),
                            2.0
                        )
                        + cos(radians(p_start_latitude))
                        * cos(radians(p_end_latitude))
                        * power(
                            sin(
                                radians(
                                    p_end_longitude
                                    - p_start_longitude
                                ) / 2.0
                            ),
                            2.0
                        )
                    )
                )
            )
        );
$function$;


-- ============================================================
-- DROP OLD TRACKING RPC SIGNATURES IF MIGRATION IS RE-RUN
-- ============================================================

drop function if exists
public.staff_start_assignment_tracking(
    text,
    text,
    text,
    double precision,
    double precision,
    double precision,
    text,
    boolean
);

drop function if exists
public.staff_push_live_location(
    text,
    text,
    text,
    text,
    double precision,
    double precision,
    double precision,
    double precision,
    double precision,
    double precision,
    text,
    boolean
);

drop function if exists
public.staff_get_tracking_state(
    text,
    text
);

drop function if exists
public.staff_stop_assignment_tracking(
    text,
    text,
    text,
    text
);


-- ============================================================
-- RPC 1: START/RESUME TRACKING
-- ============================================================

create function
public.staff_start_assignment_tracking(
    p_technician_id text,
    p_device_id text,
    p_assignment_id text,
    p_latitude double precision,
    p_longitude double precision,
    p_accuracy_meters double precision,
    p_recorded_at text,
    p_is_mock boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_staff public.teknisi%rowtype;
    v_assignment public.tiket_tugas%rowtype;
    v_config public.bti_mobile_config%rowtype;
    v_active_session
        public.assignment_tracking_sessions%rowtype;
    v_session
        public.assignment_tracking_sessions%rowtype;

    v_assignment_id text;
    v_recorded_at timestamp with time zone;
    v_resumed boolean := false;
begin
    select *
    into v_staff
    from public.bti_require_staff_device(
        p_technician_id,
        p_device_id
    );

    select *
    into v_config
    from public.bti_mobile_config
    where id = 1;

    if not found then
        raise exception
            'Konfigurasi tracking belum tersedia.'
            using errcode = 'P0001';
    end if;

    v_assignment_id := nullif(
        btrim(coalesce(p_assignment_id, '')),
        ''
    );

    if v_assignment_id is null then
        raise exception
            'ID penugasan tidak valid.'
            using errcode = 'P0001';
    end if;

    if p_latitude is null
       or p_latitude < -90.0
       or p_latitude > 90.0
       or p_longitude is null
       or p_longitude < -180.0
       or p_longitude > 180.0 then
        raise exception
            'Koordinat awal tracking tidak valid.'
            using errcode = 'P0001';
    end if;

    if p_accuracy_meters is null
       or p_accuracy_meters <= 0.0 then
        raise exception
            'Akurasi lokasi tidak valid.'
            using errcode = 'P0001';
    end if;

    if p_accuracy_meters
       > v_config.max_location_accuracy_meters then
        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'message',
            format(
                'Akurasi GPS terlalu rendah. Maksimal %s meter.',
                round(
                    v_config
                    .max_location_accuracy_meters
                )::bigint
            )
        );
    end if;

    begin
        v_recorded_at := coalesce(
            nullif(
                btrim(coalesce(p_recorded_at, '')),
                ''
            )::timestamp with time zone,
            now()
        );
    exception
        when others then
            raise exception
                'Waktu lokasi tidak valid.'
                using errcode = 'P0001';
    end;

    if v_recorded_at > now() + interval '2 minutes'
       or v_recorded_at < now() - interval '5 minutes' then
        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'message',
            'Lokasi awal sudah kedaluwarsa atau berasal dari waktu mendatang.'
        );
    end if;

    select t.*
    into v_assignment
    from public.tiket_tugas as t
    where t.id_tugas::text = v_assignment_id
      and t.id_teknisi = v_staff.id
    for update;

    if not found then
        raise exception
            'Penugasan tidak ditemukan atau bukan milik akun ini.'
            using errcode = 'P0001';
    end if;

    if v_assignment.status is distinct from 'On Process' then
        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'message',
            'Tracking hanya dapat dimulai pada tugas berstatus On Process.'
        );
    end if;

    if v_assignment.latitude_klien is null
       or v_assignment.longitude_klien is null
       or v_assignment.latitude_klien < -90.0
       or v_assignment.latitude_klien > 90.0
       or v_assignment.longitude_klien < -180.0
       or v_assignment.longitude_klien > 180.0 then
        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'message',
            'Koordinat tujuan klien belum valid.'
        );
    end if;

    select s.*
    into v_active_session
    from public.assignment_tracking_sessions as s
    where s.technician_id = v_staff.id::text
      and s.status = 'ACTIVE'
    order by s.started_at desc
    limit 1
    for update;

    if found then
        if v_active_session.assignment_id
           is distinct from v_assignment.id_tugas::text then
            return jsonb_build_object(
                'success',
                false,
                'accepted',
                false,
                'message',
                'Selesaikan atau hentikan tracking tugas aktif terlebih dahulu.',
                'active_assignment_id',
                v_active_session.assignment_id,
                'active_session_id',
                v_active_session.id_session::text
            );
        end if;

        v_session := v_active_session;
        v_resumed := true;
    else
        insert into public.assignment_tracking_sessions (
            assignment_id,
            technician_id,
            device_id,
            status,
            start_latitude,
            start_longitude,
            start_accuracy_meters,
            started_at,
            last_location_at,
            updated_at
        )
        values (
            v_assignment.id_tugas::text,
            v_staff.id::text,
            btrim(p_device_id),
            'ACTIVE',
            p_latitude,
            p_longitude,
            p_accuracy_meters,
            now(),
            v_recorded_at,
            now()
        )
        returning *
        into v_session;
    end if;

    insert into public.technician_live_locations (
        technician_id,
        assignment_id,
        tracking_session_id,
        device_id,
        latitude,
        longitude,
        accuracy_meters,
        altitude_meters,
        speed_mps,
        bearing_degrees,
        is_mock,
        recorded_at,
        received_at,
        updated_at
    )
    values (
        v_staff.id::text,
        v_assignment.id_tugas::text,
        v_session.id_session,
        btrim(p_device_id),
        p_latitude,
        p_longitude,
        p_accuracy_meters,
        null,
        null,
        null,
        coalesce(p_is_mock, false),
        v_recorded_at,
        now(),
        now()
    )
    on conflict (technician_id)
    do update set
        assignment_id = excluded.assignment_id,
        tracking_session_id =
            excluded.tracking_session_id,
        device_id = excluded.device_id,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy_meters = excluded.accuracy_meters,
        altitude_meters = excluded.altitude_meters,
        speed_mps = excluded.speed_mps,
        bearing_degrees = excluded.bearing_degrees,
        is_mock = excluded.is_mock,
        recorded_at = excluded.recorded_at,
        received_at = excluded.received_at,
        updated_at = now();

    if not v_resumed then
        insert into public.technician_location_history (
            event_id,
            tracking_session_id,
            assignment_id,
            technician_id,
            device_id,
            latitude,
            longitude,
            accuracy_meters,
            altitude_meters,
            speed_mps,
            bearing_degrees,
            is_mock,
            recorded_at,
            received_at
        )
        values (
            gen_random_uuid(),
            v_session.id_session,
            v_assignment.id_tugas::text,
            v_staff.id::text,
            btrim(p_device_id),
            p_latitude,
            p_longitude,
            p_accuracy_meters,
            null,
            null,
            null,
            coalesce(p_is_mock, false),
            v_recorded_at,
            now()
        );
    end if;

    update public.assignment_tracking_sessions
    set
        last_location_at = greatest(
            coalesce(last_location_at, v_recorded_at),
            v_recorded_at
        ),
        updated_at = now()
    where id_session = v_session.id_session;

    return jsonb_build_object(
        'success',
        true,
        'accepted',
        true,
        'message',
        case
            when v_resumed then
                'Tracking tugas dilanjutkan.'
            else
                'Tracking tugas dimulai.'
        end,
        'resumed',
        v_resumed,
        'session_id',
        v_session.id_session::text,
        'assignment_id',
        v_assignment.id_tugas::text,
        'destination',
        jsonb_build_object(
            'name',
            v_assignment.nama_klien,
            'address',
            v_assignment.alamat_klien,
            'latitude',
            v_assignment.latitude_klien,
            'longitude',
            v_assignment.longitude_klien
        ),
        'config',
        jsonb_build_object(
            'update_interval_ms',
            v_config.tracking_update_interval_ms,
            'history_interval_ms',
            v_config.tracking_history_interval_ms,
            'history_min_distance_meters',
            v_config
            .tracking_history_min_distance_meters,
            'stale_after_ms',
            v_config.tracking_stale_after_ms
        )
    );
end;
$function$;


-- ============================================================
-- RPC 2: PUSH CURRENT LOCATION
-- ============================================================

create function
public.staff_push_live_location(
    p_technician_id text,
    p_device_id text,
    p_session_id text,
    p_event_id text,
    p_latitude double precision,
    p_longitude double precision,
    p_accuracy_meters double precision,
    p_altitude_meters double precision,
    p_speed_mps double precision,
    p_bearing_degrees double precision,
    p_recorded_at text,
    p_is_mock boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_staff public.teknisi%rowtype;
    v_assignment public.tiket_tugas%rowtype;
    v_config public.bti_mobile_config%rowtype;
    v_session
        public.assignment_tracking_sessions%rowtype;
    v_last_history
        public.technician_location_history%rowtype;

    v_session_id uuid;
    v_event_id uuid;
    v_recorded_at timestamp with time zone;
    v_should_store_history boolean := false;
    v_history_stored boolean := false;
    v_assignment_found boolean := false;
    v_inserted_count integer := 0;
    v_elapsed_ms double precision;
    v_distance_meters double precision;
    v_safe_speed double precision;
    v_safe_bearing double precision;
begin
    select *
    into v_staff
    from public.bti_require_staff_device(
        p_technician_id,
        p_device_id
    );

    select *
    into v_config
    from public.bti_mobile_config
    where id = 1;

    if not found then
        raise exception
            'Konfigurasi tracking belum tersedia.'
            using errcode = 'P0001';
    end if;

    begin
        v_session_id := nullif(
            btrim(coalesce(p_session_id, '')),
            ''
        )::uuid;

        v_event_id := coalesce(
            nullif(
                btrim(coalesce(p_event_id, '')),
                ''
            )::uuid,
            gen_random_uuid()
        );
    exception
        when others then
            raise exception
                'Identitas event atau sesi tracking tidak valid.'
                using errcode = 'P0001';
    end;

    if v_session_id is null then
        raise exception
            'Sesi tracking tidak tersedia.'
            using errcode = 'P0001';
    end if;

    if p_latitude is null
       or p_latitude < -90.0
       or p_latitude > 90.0
       or p_longitude is null
       or p_longitude < -180.0
       or p_longitude > 180.0 then
        raise exception
            'Koordinat tracking tidak valid.'
            using errcode = 'P0001';
    end if;

    if p_accuracy_meters is null
       or p_accuracy_meters <= 0.0 then
        raise exception
            'Akurasi lokasi tidak valid.'
            using errcode = 'P0001';
    end if;

    if p_accuracy_meters
       > v_config.max_location_accuracy_meters then
        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'message',
            format(
                'Akurasi GPS terlalu rendah. Maksimal %s meter.',
                round(
                    v_config
                    .max_location_accuracy_meters
                )::bigint
            )
        );
    end if;

    begin
        v_recorded_at := coalesce(
            nullif(
                btrim(coalesce(p_recorded_at, '')),
                ''
            )::timestamp with time zone,
            now()
        );
    exception
        when others then
            raise exception
                'Waktu lokasi tidak valid.'
                using errcode = 'P0001';
    end;

    if v_recorded_at > now() + interval '2 minutes' then
        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'message',
            'Waktu lokasi berasal dari masa mendatang.'
        );
    end if;

    select s.*
    into v_session
    from public.assignment_tracking_sessions as s
    where s.id_session = v_session_id
      and s.technician_id = v_staff.id::text
      and s.device_id = btrim(p_device_id)
      and s.status = 'ACTIVE'
    for update;

    if not found then
        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'session_closed',
            true,
            'message',
            'Sesi tracking sudah berakhir atau tidak ditemukan.'
        );
    end if;

    if v_recorded_at
       < v_session.started_at - interval '1 minute' then
        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'message',
            'Lokasi tercatat sebelum sesi tracking dimulai.'
        );
    end if;

    select t.*
    into v_assignment
    from public.tiket_tugas as t
    where t.id_tugas::text = v_session.assignment_id
      and t.id_teknisi = v_staff.id
    limit 1;

    v_assignment_found := found;

    if not v_assignment_found
       or v_assignment.status is distinct from 'On Process' then
        update public.assignment_tracking_sessions
        set
            status = case
                when v_assignment_found then 'COMPLETED'
                else 'CANCELLED'
            end,
            stop_reason = case
                when v_assignment_found then 'ASSIGNMENT_NOT_ACTIVE'
                else 'ASSIGNMENT_NOT_FOUND'
            end,
            ended_at = now(),
            updated_at = now()
        where id_session = v_session.id_session;

        delete from public.technician_live_locations
        where tracking_session_id = v_session.id_session;

        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'session_closed',
            true,
            'message',
            'Penugasan tidak lagi aktif.'
        );
    end if;

    v_safe_speed := case
        when p_speed_mps is null then null
        when p_speed_mps < 0.0 then 0.0
        else p_speed_mps
    end;

    v_safe_bearing := case
        when p_bearing_degrees is null then null
        when p_bearing_degrees < 0.0 then null
        when p_bearing_degrees >= 360.0 then null
        else p_bearing_degrees
    end;

    insert into public.technician_live_locations (
        technician_id,
        assignment_id,
        tracking_session_id,
        device_id,
        latitude,
        longitude,
        accuracy_meters,
        altitude_meters,
        speed_mps,
        bearing_degrees,
        is_mock,
        recorded_at,
        received_at,
        updated_at
    )
    values (
        v_staff.id::text,
        v_session.assignment_id,
        v_session.id_session,
        btrim(p_device_id),
        p_latitude,
        p_longitude,
        p_accuracy_meters,
        p_altitude_meters,
        v_safe_speed,
        v_safe_bearing,
        coalesce(p_is_mock, false),
        v_recorded_at,
        now(),
        now()
    )
    on conflict (technician_id)
    do update set
        assignment_id = excluded.assignment_id,
        tracking_session_id =
            excluded.tracking_session_id,
        device_id = excluded.device_id,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy_meters = excluded.accuracy_meters,
        altitude_meters = excluded.altitude_meters,
        speed_mps = excluded.speed_mps,
        bearing_degrees = excluded.bearing_degrees,
        is_mock = excluded.is_mock,
        recorded_at = excluded.recorded_at,
        received_at = excluded.received_at,
        updated_at = now()
    where
        excluded.tracking_session_id
        = technician_live_locations
          .tracking_session_id
        and excluded.recorded_at
        >= technician_live_locations.recorded_at;

    select h.*
    into v_last_history
    from public.technician_location_history as h
    where h.tracking_session_id = v_session.id_session
    order by h.recorded_at desc
    limit 1;

    if not found then
        v_should_store_history := true;
    else
        v_elapsed_ms := extract(
            epoch from (
                v_recorded_at
                - v_last_history.recorded_at
            )
        ) * 1000.0;

        v_distance_meters :=
            public.bti_tracking_distance_meters(
                v_last_history.latitude,
                v_last_history.longitude,
                p_latitude,
                p_longitude
            );

        v_should_store_history :=
            v_elapsed_ms
                >= v_config
                   .tracking_history_interval_ms
            or v_distance_meters
                >= v_config
                   .tracking_history_min_distance_meters;
    end if;

    if v_should_store_history then
        insert into public.technician_location_history (
            event_id,
            tracking_session_id,
            assignment_id,
            technician_id,
            device_id,
            latitude,
            longitude,
            accuracy_meters,
            altitude_meters,
            speed_mps,
            bearing_degrees,
            is_mock,
            recorded_at,
            received_at
        )
        values (
            v_event_id,
            v_session.id_session,
            v_session.assignment_id,
            v_staff.id::text,
            btrim(p_device_id),
            p_latitude,
            p_longitude,
            p_accuracy_meters,
            p_altitude_meters,
            v_safe_speed,
            v_safe_bearing,
            coalesce(p_is_mock, false),
            v_recorded_at,
            now()
        )
        on conflict (event_id)
        do nothing;

        get diagnostics
            v_inserted_count = row_count;

        v_history_stored :=
            v_inserted_count > 0;
    end if;

    update public.assignment_tracking_sessions
    set
        last_location_at = greatest(
            coalesce(last_location_at, v_recorded_at),
            v_recorded_at
        ),
        updated_at = now()
    where id_session = v_session.id_session;

    return jsonb_build_object(
        'success',
        true,
        'accepted',
        true,
        'session_closed',
        false,
        'history_stored',
        v_history_stored,
        'recorded_at',
        v_recorded_at,
        'received_at',
        now()
    );
end;
$function$;


-- ============================================================
-- RPC 3: RESTORE ACTIVE TRACKING STATE
-- ============================================================

create function
public.staff_get_tracking_state(
    p_technician_id text,
    p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_staff public.teknisi%rowtype;
    v_assignment public.tiket_tugas%rowtype;
    v_config public.bti_mobile_config%rowtype;
    v_session
        public.assignment_tracking_sessions%rowtype;
    v_live_location jsonb;
    v_assignment_found boolean := false;
begin
    select *
    into v_staff
    from public.bti_require_staff_device(
        p_technician_id,
        p_device_id
    );

    select *
    into v_config
    from public.bti_mobile_config
    where id = 1;

    if not found then
        raise exception
            'Konfigurasi tracking belum tersedia.'
            using errcode = 'P0001';
    end if;

    select s.*
    into v_session
    from public.assignment_tracking_sessions as s
    where s.technician_id = v_staff.id::text
      and s.device_id = btrim(p_device_id)
      and s.status = 'ACTIVE'
    order by s.started_at desc
    limit 1;

    if not found then
        return jsonb_build_object(
            'success',
            true,
            'active',
            false,
            'config',
            jsonb_build_object(
                'update_interval_ms',
                v_config.tracking_update_interval_ms,
                'history_interval_ms',
                v_config.tracking_history_interval_ms,
                'history_min_distance_meters',
                v_config
                .tracking_history_min_distance_meters,
                'stale_after_ms',
                v_config.tracking_stale_after_ms
            )
        );
    end if;

    select t.*
    into v_assignment
    from public.tiket_tugas as t
    where t.id_tugas::text = v_session.assignment_id
      and t.id_teknisi = v_staff.id
    limit 1;

    v_assignment_found := found;

    if not v_assignment_found
       or v_assignment.status is distinct from 'On Process' then
        update public.assignment_tracking_sessions
        set
            status = case
                when v_assignment_found then 'COMPLETED'
                else 'CANCELLED'
            end,
            stop_reason = case
                when v_assignment_found then 'ASSIGNMENT_NOT_ACTIVE'
                else 'ASSIGNMENT_NOT_FOUND'
            end,
            ended_at = now(),
            updated_at = now()
        where id_session = v_session.id_session;

        delete from public.technician_live_locations
        where tracking_session_id = v_session.id_session;

        return jsonb_build_object(
            'success',
            true,
            'active',
            false,
            'message',
            'Sesi tracking lama telah ditutup.'
        );
    end if;

    select jsonb_build_object(
        'latitude',
        l.latitude,
        'longitude',
        l.longitude,
        'accuracy_meters',
        l.accuracy_meters,
        'altitude_meters',
        l.altitude_meters,
        'speed_mps',
        l.speed_mps,
        'bearing_degrees',
        l.bearing_degrees,
        'is_mock',
        l.is_mock,
        'recorded_at',
        l.recorded_at,
        'received_at',
        l.received_at
    )
    into v_live_location
    from public.technician_live_locations as l
    where l.tracking_session_id = v_session.id_session
    limit 1;

    return jsonb_build_object(
        'success',
        true,
        'active',
        true,
        'session_id',
        v_session.id_session::text,
        'assignment_id',
        v_assignment.id_tugas::text,
        'started_at',
        v_session.started_at,
        'last_location_at',
        v_session.last_location_at,
        'destination',
        jsonb_build_object(
            'name',
            v_assignment.nama_klien,
            'address',
            v_assignment.alamat_klien,
            'latitude',
            v_assignment.latitude_klien,
            'longitude',
            v_assignment.longitude_klien
        ),
        'last_location',
        v_live_location,
        'config',
        jsonb_build_object(
            'update_interval_ms',
            v_config.tracking_update_interval_ms,
            'history_interval_ms',
            v_config.tracking_history_interval_ms,
            'history_min_distance_meters',
            v_config
            .tracking_history_min_distance_meters,
            'stale_after_ms',
            v_config.tracking_stale_after_ms
        )
    );
end;
$function$;


-- ============================================================
-- RPC 4: STOP TRACKING WITHOUT COMPLETING ASSIGNMENT
-- ============================================================

create function
public.staff_stop_assignment_tracking(
    p_technician_id text,
    p_device_id text,
    p_assignment_id text,
    p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_staff public.teknisi%rowtype;
    v_session
        public.assignment_tracking_sessions%rowtype;
    v_assignment_id text;
    v_reason text;
begin
    select *
    into v_staff
    from public.bti_require_staff_device(
        p_technician_id,
        p_device_id
    );

    v_assignment_id := nullif(
        btrim(coalesce(p_assignment_id, '')),
        ''
    );

    if v_assignment_id is null then
        raise exception
            'ID penugasan tidak valid.'
            using errcode = 'P0001';
    end if;

    v_reason := upper(
        left(
            coalesce(
                nullif(
                    btrim(coalesce(p_reason, '')),
                    ''
                ),
                'USER_STOPPED'
            ),
            100
        )
    );

    select s.*
    into v_session
    from public.assignment_tracking_sessions as s
    where s.assignment_id = v_assignment_id
      and s.technician_id = v_staff.id::text
      and s.device_id = btrim(p_device_id)
      and s.status = 'ACTIVE'
    order by s.started_at desc
    limit 1
    for update;

    if not found then
        return jsonb_build_object(
            'success',
            true,
            'accepted',
            true,
            'already_stopped',
            true,
            'message',
            'Tracking sudah berhenti.'
        );
    end if;

    update public.assignment_tracking_sessions
    set
        status = 'STOPPED',
        stop_reason = v_reason,
        ended_at = now(),
        updated_at = now()
    where id_session = v_session.id_session;

    delete from public.technician_live_locations
    where tracking_session_id = v_session.id_session;

    return jsonb_build_object(
        'success',
        true,
        'accepted',
        true,
        'already_stopped',
        false,
        'message',
        'Tracking berhasil dihentikan.',
        'session_id',
        v_session.id_session::text,
        'assignment_id',
        v_session.assignment_id
    );
end;
$function$;


-- ============================================================
-- AUTOMATIC SESSION CLOSURE
-- ============================================================

create or replace function
public.bti_close_assignment_tracking()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_assignment_id text;
    v_target_status text;
    v_stop_reason text;
begin
    if tg_op = 'DELETE' then
        v_assignment_id := old.id_tugas::text;
        v_target_status := 'CANCELLED';
        v_stop_reason := 'ASSIGNMENT_DELETED';
    elsif old.id_teknisi is distinct from new.id_teknisi then
        v_assignment_id := old.id_tugas::text;
        v_target_status := 'CANCELLED';
        v_stop_reason := 'ASSIGNMENT_REASSIGNED';
    elsif old.status = 'On Process'
          and new.status is distinct from 'On Process' then
        v_assignment_id := new.id_tugas::text;
        v_target_status := case
            when new.status = 'Success' then
                'COMPLETED'
            else
                'CANCELLED'
        end;
        v_stop_reason := case
            when new.status = 'Success' then
                'ASSIGNMENT_COMPLETED'
            else
                'ASSIGNMENT_NOT_ACTIVE'
        end;
    else
        return new;
    end if;

    update public.assignment_tracking_sessions
    set
        status = v_target_status,
        stop_reason = v_stop_reason,
        ended_at = now(),
        updated_at = now()
    where assignment_id = v_assignment_id
      and status = 'ACTIVE';

    delete from public.technician_live_locations
    where assignment_id = v_assignment_id;

    if tg_op = 'DELETE' then
        return old;
    end if;

    return new;
end;
$function$;

drop trigger if exists
    tiket_tugas_close_tracking_trigger
on public.tiket_tugas;

create trigger
    tiket_tugas_close_tracking_trigger
after update of status, id_teknisi
or delete
on public.tiket_tugas
for each row
execute function
    public.bti_close_assignment_tracking();


-- ============================================================
-- OPTIONAL RETENTION HELPER
--
-- Tidak diberikan ke client. Dapat dijadwalkan melalui Supabase
-- Cron setelah seluruh fitur stabil.
-- ============================================================

create or replace function
public.bti_cleanup_tracking_history()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_retention_days integer;
    v_deleted_count bigint;
begin
    select tracking_history_retention_days
    into v_retention_days
    from public.bti_mobile_config
    where id = 1;

    v_retention_days := greatest(
        1,
        least(
            coalesce(v_retention_days, 30),
            365
        )
    );

    delete from public.technician_location_history
    where recorded_at
          < now()
            - make_interval(
                days => v_retention_days
            );

    get diagnostics
        v_deleted_count = row_count;

    return v_deleted_count;
end;
$function$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.assignment_tracking_sessions
    enable row level security;

alter table public.technician_live_locations
    enable row level security;

alter table public.technician_location_history
    enable row level security;

drop policy if exists
    assignment_tracking_authenticated_select
on public.assignment_tracking_sessions;

drop policy if exists
    technician_live_authenticated_select
on public.technician_live_locations;

drop policy if exists
    technician_history_authenticated_select
on public.technician_location_history;

create policy
    assignment_tracking_authenticated_select
on public.assignment_tracking_sessions
for select
to authenticated
using (true);

create policy
    technician_live_authenticated_select
on public.technician_live_locations
for select
to authenticated
using (true);

create policy
    technician_history_authenticated_select
on public.technician_location_history
for select
to authenticated
using (true);


-- ============================================================
-- TABLE PRIVILEGES
-- ============================================================

revoke all privileges
on table public.assignment_tracking_sessions
from public, anon;

revoke all privileges
on table public.technician_live_locations
from public, anon;

revoke all privileges
on table public.technician_location_history
from public, anon;

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
-- FUNCTION PRIVILEGES
-- ============================================================

revoke all
on function public.bti_tracking_distance_meters(
    double precision,
    double precision,
    double precision,
    double precision
)
from public, anon, authenticated;

revoke all
on function public.bti_close_assignment_tracking()
from public, anon, authenticated;

revoke all
on function public.bti_cleanup_tracking_history()
from public, anon, authenticated;

revoke all
on function public.staff_start_assignment_tracking(
    text,
    text,
    text,
    double precision,
    double precision,
    double precision,
    text,
    boolean
)
from public, anon, authenticated;

revoke all
on function public.staff_push_live_location(
    text,
    text,
    text,
    text,
    double precision,
    double precision,
    double precision,
    double precision,
    double precision,
    double precision,
    text,
    boolean
)
from public, anon, authenticated;

revoke all
on function public.staff_get_tracking_state(
    text,
    text
)
from public, anon, authenticated;

revoke all
on function public.staff_stop_assignment_tracking(
    text,
    text,
    text,
    text
)
from public, anon, authenticated;

grant execute
on function public.staff_start_assignment_tracking(
    text,
    text,
    text,
    double precision,
    double precision,
    double precision,
    text,
    boolean
)
to anon, authenticated;

grant execute
on function public.staff_push_live_location(
    text,
    text,
    text,
    text,
    double precision,
    double precision,
    double precision,
    double precision,
    double precision,
    double precision,
    text,
    boolean
)
to anon, authenticated;

grant execute
on function public.staff_get_tracking_state(
    text,
    text
)
to anon, authenticated;

grant execute
on function public.staff_stop_assignment_tracking(
    text,
    text,
    text,
    text
)
to anon, authenticated;


-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================

do $realtime$
begin
    if exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
    ) then
        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename =
                  'technician_live_locations'
        ) then
            execute
                'alter publication supabase_realtime '
                'add table '
                'public.technician_live_locations';
        end if;

        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename =
                  'assignment_tracking_sessions'
        ) then
            execute
                'alter publication supabase_realtime '
                'add table '
                'public.assignment_tracking_sessions';
        end if;
    end if;
end;
$realtime$;

commit;
