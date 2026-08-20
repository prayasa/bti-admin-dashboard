"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../src/utils/supabase";

export default function BerandaUtama() {
  const [stats, setStats] = useState({ teknisi: 0, tiketAktif: 0, tiketSelesai: 0, hadirHariIni: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatistik = async () => {
      setIsLoading(true);
      
      // Ambil tanggal hari ini dalam format YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];

      // 1. Hitung Total Teknisi
      const { count: totalTeknisi } = await supabase.from("teknisi").select("*", { count: "exact", head: true });

      // 2. Hitung Tiket Aktif (Pending & On Process)
      const { count: tiketAktif } = await supabase.from("tiket_tugas").select("*", { count: "exact", head: true }).in("status", ["Pending", "On Process"]);

      // 3. Hitung Tiket Selesai
      const { count: tiketSelesai } = await supabase.from("tiket_tugas").select("*", { count: "exact", head: true }).eq("status", "Success");

      // 4. Hitung Kehadiran Hari Ini
      const { count: hadir } = await supabase.from("log_presensi")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00Z`)
        .lte("created_at", `${today}T23:59:59Z`);

      setStats({
        teknisi: totalTeknisi || 0,
        tiketAktif: tiketAktif || 0,
        tiketSelesai: tiketSelesai || 0,
        hadirHariIni: hadir || 0
      });
      
      setIsLoading(false);
    };

    fetchStatistik();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Ringkasan Sistem</h1>
        <p className="text-gray-500 mb-8">Pantau aktivitas kehadiran dan penugasan teknisi CV Bengkel Teknologi Indonesia.</p>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white h-32 rounded-2xl border border-gray-100 shadow-sm"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-blue-500">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total Teknisi</p>
              <h2 className="text-4xl font-black text-gray-800 mt-2">{stats.teknisi}</h2>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-emerald-500">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Hadir Hari Ini</p>
              <h2 className="text-4xl font-black text-gray-800 mt-2">{stats.hadirHariIni}</h2>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-amber-500">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Tiket Aktif</p>
              <h2 className="text-4xl font-black text-gray-800 mt-2">{stats.tiketAktif}</h2>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-indigo-500">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Tiket Selesai</p>
              <h2 className="text-4xl font-black text-gray-800 mt-2">{stats.tiketSelesai}</h2>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}