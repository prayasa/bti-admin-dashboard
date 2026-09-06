begin;


-- ============================================================
-- ADMIN ASSIGNMENT DELETE POLICY
--
-- Dashboard administrator menghapus tiket melalui RPC ini,
-- sedangkan trigger database menjaga aturan status pada seluruh
-- jalur delete. Status yang dapat dihapus:
-- 1. Pending: pekerjaan belum mulai diproses.
-- 2. Success: pekerjaan telah selesai.
--
-- Tiket On Process dikunci agar sesi tracking dan pekerjaan
-- teknisi tidak terputus karena penghapusan dari dashboard.
-- ============================================================


create or replace function public.admin_delete_assignment(
    p_assignment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
    v_user_id uuid;
    v_user_role text;
    v_assignment public.tiket_tugas%rowtype;
    v_assignment_id text;
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

    v_assignment_id := nullif(
        btrim(
            coalesce(
                p_assignment_id,
                ''
            )
        ),
        ''
    );

    if v_assignment_id is null then
        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'message',
            'Identitas tiket tidak valid.'
        );
    end if;

    select assignment.*
    into v_assignment
    from public.tiket_tugas as assignment
    where assignment.id_tugas::text
            = v_assignment_id
    limit 1
    for update;

    if not found then
        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'message',
            'Tiket penugasan tidak ditemukan.'
        );
    end if;

    if coalesce(
        v_assignment.status,
        ''
    ) not in (
        'Pending',
        'Success'
    ) then
        return jsonb_build_object(
            'success',
            false,
            'accepted',
            false,
            'assignment_id',
            v_assignment.id_tugas::text,
            'status',
            v_assignment.status,
            'message',
            'Tiket yang sedang diproses tidak dapat dihapus.'
        );
    end if;

    delete from public.tiket_tugas
    where id_tugas = v_assignment.id_tugas;

    return jsonb_build_object(
        'success',
        true,
        'accepted',
        true,
        'assignment_id',
        v_assignment.id_tugas::text,
        'status',
        v_assignment.status,
        'message',
        'Tiket penugasan berhasil dihapus.'
    );
end;
$function$;


comment on function
public.admin_delete_assignment(text) is
    'Menghapus tiket Pending atau Success melalui otorisasi administrator; tiket On Process ditolak.';


revoke all
on function public.admin_delete_assignment(text)
from public, anon, authenticated;


grant execute
on function public.admin_delete_assignment(text)
to authenticated;


-- Trigger menjaga aturan yang sama untuk seluruh jalur delete,
-- termasuk dashboard versi lama selama rollout deployment.
create or replace function
public.bti_guard_assignment_delete_status()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
begin
    if coalesce(
        old.status,
        ''
    ) not in (
        'Pending',
        'Success'
    ) then
        raise exception
            'Tiket yang sedang diproses tidak dapat dihapus.'
            using errcode = 'P0001';
    end if;

    return old;
end;
$function$;


revoke all
on function
public.bti_guard_assignment_delete_status()
from public, anon, authenticated;


drop trigger if exists
bti_guard_assignment_delete_status_trigger
on public.tiket_tugas;


create trigger
bti_guard_assignment_delete_status_trigger
before delete
on public.tiket_tugas
for each row
execute function
public.bti_guard_assignment_delete_status();


notify pgrst, 'reload schema';


commit;