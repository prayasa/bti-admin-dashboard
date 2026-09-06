-- Menyamakan skema log_presensi dengan RPC staff_submit_attendance.
-- RPC tidak mengirim metode_validasi karena seluruh presensi staf
-- pada alur ini menggunakan Dynamic QR Code + validasi geofence.

begin;

alter table public.log_presensi
    alter column metode_validasi
    set default 'QR_CODE';

comment on column public.log_presensi.metode_validasi is
    'Metode validasi presensi. Presensi dari aplikasi staf menggunakan QR_CODE.';

commit;
