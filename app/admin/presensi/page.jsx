"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../src/utils/supabase";

export default function RiwayatPresensi() {
  const [teknisiList, setTeknisiList] = useState([]);
  const [selectedTeknisiId, setSelectedTeknisiId] = useState(null);
  
  const [logPresensi, setLogPresensi] = useState([]);
  const [logAnomali, setLogAnomali] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  
  const [filterMode, setFilterMode] = useState('minggu');

  const fetchData = async () => {
    setIsFetching(true);

    const { data: teknisiData } = await supabase
      .from("teknisi")
      .select("id, nama_lengkap, nik")
      .order("nama_lengkap", { ascending: true });
    
    if (teknisiData) {
      setTeknisiList(teknisiData);
      if (!selectedTeknisiId && teknisiData.length > 0) {
        setSelectedTeknisiId(teknisiData[0].id);
      }
    }

    const { data: presensi } = await supabase
      .from("log_presensi")
      .select("*, teknisi(nama_lengkap)")
      .order("waktu_log", { ascending: false })
      .limit(1000); 
    
    if (presensi) setLogPresensi(presensi);

    const { data: anomali } = await supabase
      .from("token_qr_hangus")
      .select("*")
      .order("digunakan_pada", { ascending: false })
      .limit(15);
      
    if (anomali) setLogAnomali(anomali);
    
    setIsFetching(false);
  };

  useEffect(() => {
    fetchData();

    const presensiSubscription = supabase
      .channel('live-presensi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'log_presensi' }, () => {
        fetchData();
      })
      .subscribe();

    const anomaliSubscription = supabase
      .channel('live-anomali')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'token_qr_hangus' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presensiSubscription);
      supabase.removeChannel(anomaliSubscription);
    };
  }, []);

  const formatTanggal = (isoString) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }) + " WIB";
  };

  // ==========================================
  // FUNGSI HAPUS PRESENSI OLEH ADMIN
  // ==========================================
  const hapusPresensi = async (idAbsen) => {
    const konfirmasi = window.confirm("Apakah Anda yakin ingin menghapus data presensi ini? Tindakan ini permanen dan tidak dapat dibatalkan.");
    
    if (!konfirmasi) return;

    try {
      const { error } = await supabase
        .from("log_presensi")
        .delete()
        .eq("id_absen", idAbsen);

      if (error) {
        console.error("Gagal menghapus data:", error);
        alert("Gagal menghapus data. Periksa koneksi atau izin database.");
      }
      // Jika sukses, tidak perlu panggil fetchData() karena Realtime Listener otomatis akan memperbarui UI
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const filteredLogs = logPresensi.filter((log) => {
    if (log.id_teknisi !== selectedTeknisiId) return false;

    const logDate = new Date(log.waktu_log);
    const today = new Date();
    
    if (filterMode === 'hari') {
      return logDate.toDateString() === today.toDateString();
    } else if (filterMode === 'minggu') {
      const diffTime = Math.abs(today - logDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    } else if (filterMode === 'bulan') {
      return logDate.getMonth() === today.getMonth() && logDate.getFullYear() === today.getFullYear();
    }
    return true;
  });

  let totalHariHadir = 0;
  if (filterMode === 'minggu' || filterMode === 'bulan') {
    const trackerHari = {};
    filteredLogs.forEach((log) => {
      if (log.is_valid) {
        const tanggalUnik = new Date(log.waktu_log).toDateString();
        if (!trackerHari[tanggalUnik]) {
          trackerHari[tanggalUnik] = { masuk: false, pulang: false };
        }
        if (log.tipe_log === 'MASUK') trackerHari[tanggalUnik].masuk = true;
        if (log.tipe_log === 'PULANG') trackerHari[tanggalUnik].pulang = true;
      }
    });
    
    totalHariHadir = Object.values(trackerHari).filter(hari => hari.masuk && hari.pulang).length;
  }

  const getTeknisiForAnomaly = (anomaliTime) => {
    if (!logPresensi || logPresensi.length === 0) return "Tidak Diketahui";
    
    const aTime = new Date(anomaliTime).getTime();
    let closestTeknisi = "Tidak Diketahui";
    let minDiff = Infinity;
    
    logPresensi.forEach(log => {
      const lTime = new Date(log.waktu_log).getTime();
      const diff = Math.abs(aTime - lTime);
      if (diff < 60000 && diff < minDiff) {
        minDiff = diff;
        closestTeknisi = log.teknisi?.nama_lengkap || "Data Dihapus";
      }
    });
    return closestTeknisi;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-screen-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Manajemen Presensi Teknisi</h1>
          <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-bold border border-green-200 shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            Realtime Auto-Sync
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          <div className="xl:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-700">Daftar Teknisi</h2>
            </div>
            <div className="flex flex-col divide-y divide-gray-50 max-h-[700px] overflow-y-auto">
              {teknisiList.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeknisiId(t.id)}
                  className={`p-4 text-left transition-colors flex flex-col ${
                    selectedTeknisiId === t.id 
                      ? 'bg-blue-50 border-l-4 border-blue-600' 
                      : 'hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <span className={`font-bold ${selectedTeknisiId === t.id ? 'text-blue-700' : 'text-gray-700'}`}>
                    {t.nama_lengkap}
                  </span>
                  <span className="text-xs text-gray-400 mt-1 font-mono">{t.nik}</span>
                </button>
              ))}
              {teknisiList.length === 0 && !isFetching && (
                <p className="p-4 text-sm text-gray-400 text-center">Belum ada teknisi.</p>
              )}
            </div>
          </div>

          <div className="xl:col-span-2 flex flex-col gap-4">
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Detail Riwayat Presensi</h2>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 cursor-pointer"
              >
                <option value="hari">Hari Ini</option>
                <option value="minggu">7 Hari Terakhir</option>
                <option value="bulan">Bulan Ini</option>
              </select>
            </div>

            {(filterMode === 'minggu' || filterMode === 'bulan') && (
              <div className="bg-white border border-gray-100 shadow-sm p-5 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-700">Total Hari Kehadiran Aktif</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Dihitung 1 hari jika memiliki <b>MASUK</b> dan <b>PULANG</b> <span className="text-green-600 font-bold">yang valid (sesuai radius)</span> di tanggal yang sama.
                  </p>
                </div>
                <div className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-5 py-2 rounded-xl font-black text-2xl flex items-center gap-2">
                  <span>{totalHariHadir}</span>
                  <span className="text-sm font-bold mt-1">Hari</span>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm">
                      <th className="p-4 font-medium">Waktu Log</th>
                      <th className="p-4 font-medium">Tipe Presensi</th>
                      <th className="p-4 font-medium">Validasi Spasial (Geofence)</th>
                      <th className="p-4 font-medium text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isFetching ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-gray-400">Menarik data server...</td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-10 text-center text-gray-400">
                          Tidak ada rekaman presensi pada rentang waktu ini.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id_absen} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-sm text-gray-700 font-mono font-medium">
                            {formatTanggal(log.waktu_log)}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              log.tipe_log === 'MASUK' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {log.tipe_log}
                            </span>
                          </td>
                          <td className="p-4">
                            {log.latitude_aktual !== 0 ? (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded w-fit border border-gray-200">
                                  {log.latitude_aktual}, {log.longitude_aktual}
                                </span>
                                {log.is_valid ? (
                                  <span className="text-xs font-bold text-green-600 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div> Sesuai Radius
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></div> Luar Jangkauan
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Data GPS Hilang</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => hapusPresensi(log.id_absen)}
                              className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm border border-red-100"
                              title="Hapus Presensi"
                            >
                              HAPUS
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="xl:col-span-1 bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden h-fit">
            <div className="p-4 border-b border-red-100 bg-red-50">
              <h2 className="font-bold text-red-700">Token Hangus</h2>
              <p className="text-[11px] text-red-500 mt-0.5 leading-tight">Pemantauan <i>Replay Attack</i></p>
            </div>
            <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto">
              {isFetching ? (
                <p className="text-center text-gray-400 text-sm py-4">Memuat...</p>
              ) : logAnomali.length === 0 ? (
                <p className="text-center text-green-600 text-sm font-medium py-4">Sistem 100% aman.</p>
              ) : (
                logAnomali.map((anomali) => (
                  <div key={anomali.token_uuid} className="p-3 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pemilik Token</span>
                      <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black">DIBLOKIR</span>
                    </div>
                    <p className="text-xs font-bold text-gray-800 mb-2 truncate" title={getTeknisiForAnomaly(anomali.digunakan_pada)}>
                      {getTeknisiForAnomaly(anomali.digunakan_pada)}
                    </p>
                    <div className="bg-white p-2 rounded border border-gray-100">
                      <p className="text-[9px] font-mono text-gray-400 break-all leading-tight">{anomali.token_uuid}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 font-medium">Hangus pada: {formatTanggal(anomali.digunakan_pada)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}