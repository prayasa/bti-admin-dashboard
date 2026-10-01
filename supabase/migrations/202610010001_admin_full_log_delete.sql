begin;

-- Fail fast jika mekanisme penutupan tracking dari migration lama belum aktif.
do $preflight$
begin
    if not exists (
        select 1
        from pg_catalog.pg_trigger as trigger
        join pg_catalog.pg_class as relation on relation.oid = trigger.tgrelid
        join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
        where namespace.nspname = 'public'
          and relation.relname = 'tiket_tugas'
          and trigger.tgname = 'tiket_tugas_close_tracking_trigger'
          and not trigger.tgisinternal
          and trigger.tgenabled in ('O', 'A')
          and (trigger.tgtype::integer & 8) = 8
    ) then
        raise exception 'Migration tracking belum lengkap: aktifkan tiket_tugas_close_tracking_trigger dari 202608230001_live_assignment_tracking.sql terlebih dahulu.';
    end if;
end;
$preflight$;

-- Penambahan untuk akun admin yang sudah ada: app_metadata.role = 'admin'.
-- Jalankan setelah semua migration lama, termasuk 202609060004.
-- Migration ini tidak menghapus data. Penghapusan hanya saat admin memanggil RPC.

-- Semua RPC destructive memverifikasi identitas Supabase Auth dan role admin.
create or replace function public.bti_require_admin_log_delete()
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
    if auth.uid() is null
       or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
        raise exception 'Penghapusan log hanya tersedia untuk akun admin.'
            using errcode = '42501';
    end if;
end;
$function$;

revoke all on function public.bti_require_admin_log_delete()
from public, anon, authenticated;

-- Batasi juga jalur DELETE langsung. Policy restrictive mempersempit
-- policy permissive FOR ALL lama tanpa mengubah SELECT/INSERT/UPDATE.
alter table public.log_presensi enable row level security;
alter table public.tiket_tugas enable row level security;

drop policy if exists bti_admin_only_attendance_delete on public.log_presensi;
create policy bti_admin_only_attendance_delete
on public.log_presensi as restrictive
for delete to authenticated
using (
    (select auth.uid()) is not null
    and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
);

drop policy if exists bti_admin_only_assignment_delete on public.tiket_tugas;
create policy bti_admin_only_assignment_delete
on public.tiket_tugas as restrictive
for delete to authenticated
using (
    (select auth.uid()) is not null
    and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
);

-- Tetap menggunakan nama trigger lama, tetapi admin kini boleh menghapus
-- tiket Pending, On Process, Success, maupun status lain.
-- Operasi pemeliharaan SQL Editor/service_role tetap dapat berjalan.
create or replace function public.bti_guard_assignment_delete_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
    if coalesce(auth.role(), '') = 'service_role'
       or (
           auth.uid() is null
           and current_setting('role', true) in ('none', 'postgres')
           and session_user = 'postgres'
       ) then
        return old;
    end if;
    perform public.bti_require_admin_log_delete();
    return old;
end;
$function$;

revoke all on function public.bti_guard_assignment_delete_status()
from public, anon, authenticated;

drop trigger if exists bti_guard_assignment_delete_status_trigger
on public.tiket_tugas;
create trigger bti_guard_assignment_delete_status_trigger
before delete on public.tiket_tugas
for each row execute function public.bti_guard_assignment_delete_status();

create or replace function public.admin_delete_assignment(p_assignment_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_assignment public.tiket_tugas%rowtype;
    v_assignment_id text := nullif(btrim(coalesce(p_assignment_id, '')), '');
begin
    perform public.bti_require_admin_log_delete();
    if v_assignment_id is null then
        return jsonb_build_object('success', false, 'accepted', false,
            'message', 'Identitas tiket tidak valid.');
    end if;

    select assignment.* into v_assignment
    from public.tiket_tugas as assignment
    where assignment.id_tugas::text = v_assignment_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'accepted', false,
            'message', 'Tiket penugasan tidak ditemukan atau sudah dihapus.');
    end if;

    -- Trigger bti_close_assignment_tracking yang sudah ada tetap aktif:
    -- menutup sesi ACTIVE sebagai CANCELLED dan menghapus live location.
    -- Riwayat lokasi tidak dihapus oleh RPC ini.
    delete from public.tiket_tugas where id_tugas = v_assignment.id_tugas;

    return jsonb_build_object('success', true, 'accepted', true,
        'assignment_id', v_assignment.id_tugas::text,
        'status', v_assignment.status,
        'message', 'Tiket penugasan berhasil dihapus.');
end;
$function$;

create or replace function public.admin_delete_attendance(p_attendance_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_attendance_id text := nullif(btrim(coalesce(p_attendance_id, '')), '');
    v_deleted_id text;
begin
    perform public.bti_require_admin_log_delete();
    if v_attendance_id is null then
        return jsonb_build_object('success', false, 'accepted', false,
            'message', 'Identitas presensi tidak valid.');
    end if;

    delete from public.log_presensi
    where id_absen::text = v_attendance_id
    returning id_absen::text into v_deleted_id;

    if v_deleted_id is null then
        return jsonb_build_object('success', false, 'accepted', false,
            'message', 'Presensi tidak ditemukan atau sudah dihapus.');
    end if;

    return jsonb_build_object('success', true, 'accepted', true,
        'attendance_id', v_deleted_id, 'deleted_count', 1,
        'message', 'Log presensi berhasil dihapus.');
end;
$function$;

create or replace function public.admin_delete_all_attendance(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_deleted_count bigint;
begin
    perform public.bti_require_admin_log_delete();
    if btrim(coalesce(p_confirmation, '')) <> 'HAPUS SEMUA' then
        return jsonb_build_object('success', false, 'accepted', false,
            'message', 'Konfirmasi penghapusan tidak sesuai. Ketik HAPUS SEMUA.');
    end if;

    -- Satu DELETE dalam satu transaksi, bukan perulangan request client.
    -- Seluruh baris yang terlihat oleh perintah ini dihapus, semua tanggal/teknisi.
    -- Tidak memakai TRUNCATE: sequence dan audit presensi tetap dipertahankan.
    delete from public.log_presensi;
    get diagnostics v_deleted_count = row_count;

    return jsonb_build_object('success', true, 'accepted', true,
        'deleted_count', v_deleted_count,
        'message', 'Seluruh log presensi berhasil dihapus.');
end;
$function$;

revoke all on function public.admin_delete_assignment(text)
from public, anon, authenticated;
revoke all on function public.admin_delete_attendance(text)
from public, anon, authenticated;
revoke all on function public.admin_delete_all_attendance(text)
from public, anon, authenticated;

grant execute on function public.admin_delete_assignment(text) to authenticated;
grant execute on function public.admin_delete_attendance(text) to authenticated;
grant execute on function public.admin_delete_all_attendance(text) to authenticated;

comment on function public.admin_delete_assignment(text) is
    'Admin boleh menghapus tiket semua status, termasuk On Process; trigger tracking tetap berjalan.';
comment on function public.admin_delete_all_attendance(text) is
    'Admin menghapus seluruh log_presensi setelah konfirmasi HAPUS SEMUA. Audit dan QR claims tetap tersimpan.';

notify pgrst, 'reload schema';
commit;
