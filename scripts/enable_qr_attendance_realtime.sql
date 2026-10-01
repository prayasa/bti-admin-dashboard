-- Opsional: aktifkan update realtime untuk notifikasi presensi di halaman QR.
-- Tidak mengubah/menghapus data dan tidak mengubah policy RLS atau hak akses.
-- Jalankan di Supabase SQL Editor dengan akun pemilik project.
DO $bti_realtime$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'Publication supabase_realtime tidak ditemukan. Periksa konfigurasi Realtime project.';
  END IF;

  IF to_regclass('public.log_presensi') IS NULL THEN
    RAISE EXCEPTION 'Tabel public.log_presensi tidak ditemukan.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND puballtables
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'log_presensi'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.log_presensi;
  END IF;
END;
$bti_realtime$;

SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public' AND tablename = 'log_presensi';
