"use client";

import { useState, useEffect } from "react";
// Impor disesuaikan dengan struktur direktorimu
import { supabase } from "../../../src/utils/supabase";

export default function ManajemenTeknisi() {
  const [teknisiList, setTeknisiList] = useState([]);
  
  // State untuk form
  const [editId, setEditId] = useState(null); // Menyimpan ID jika sedang dalam mode Edit
  const [namaLengkap, setNamaLengkap] = useState("");
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Fungsi Read: Menarik data dari tabel 'teknisi'
  const fetchTeknisi = async () => {
    setIsFetching(true);
    const { data, error } = await supabase
      .from("teknisi")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Gagal menarik data:", error.message);
    } else {
      setTeknisiList(data);
    }
    setIsFetching(false);
  };

  useEffect(() => {
    fetchTeknisi();
  }, []);

  // Fungsi Reset Form
  const resetForm = () => {
    setEditId(null);
    setNamaLengkap("");
    setNik("");
    setPassword("");
  };

  // Fungsi Create & Update: Menyimpan atau memperbarui data
  const handleSimpan = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (editId) {
      // LOGIKA UPDATE
      const { error } = await supabase
        .from("teknisi")
        .update({ 
          nama_lengkap: namaLengkap, 
          nik: nik, 
          password: password 
        })
        .eq("id", editId);

      if (error) {
        alert("Gagal update data: " + error.message);
      } else {
        alert("Data teknisi berhasil diperbarui!");
        resetForm();
        fetchTeknisi();
      }
    } else {
      // LOGIKA CREATE
      const { error } = await supabase
        .from("teknisi")
        .insert([{ 
          nama_lengkap: namaLengkap, 
          nik: nik, 
          password: password 
        }]);

      if (error) {
        alert("Gagal menyimpan data: " + error.message);
      } else {
        alert("Teknisi berhasil didaftarkan!");
        resetForm();
        fetchTeknisi();
      }
    }
    
    setIsLoading(false);
  };

  // Fungsi Pindah ke Mode Edit
  const handleEdit = (teknisi) => {
    setEditId(teknisi.id);
    setNamaLengkap(teknisi.nama_lengkap);
    setNik(teknisi.nik);
    setPassword(teknisi.password || "");
  };

  // Fungsi Delete: Menghapus data dari tabel
  const handleDelete = async (id, nama) => {
    const isConfirm = window.confirm(`Apakah Anda yakin ingin menghapus data teknisi: ${nama}?`);
    
    if (isConfirm) {
      const { error } = await supabase
        .from("teknisi")
        .delete()
        .eq("id", id);

      if (error) {
        alert("Gagal menghapus data: " + error.message);
      } else {
        alert("Data teknisi berhasil dihapus!");
        fetchTeknisi();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Manajemen Teknisi Lapangan</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Kolom Kiri: Form Input & Update */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit transition-all">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              {editId ? "Edit Data Teknisi" : "Tambah Teknisi Baru"}
            </h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Masukkan nama lengkap"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">NIK (Nomor Induk Karyawan)</label>
                <input
                  type="text"
                  required
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Contoh: BTI-2026-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Password Akses</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Buat password teknisi"
                />
              </div>

              <div className="flex gap-3 pt-2">
                {editId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={isLoading}
                    className="w-1/3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`${editId ? 'w-2/3' : 'w-full'} bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:bg-blue-300`}
                >
                  {isLoading ? "Memproses..." : (editId ? "Update Data" : "Daftarkan Teknisi")}
                </button>
              </div>
            </form>
          </div>

          {/* Kolom Kanan: Tabel Data dengan Fitur Aksi */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-700">Daftar Teknisi Terdaftar</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                Total: {teknisiList.length} Teknisi
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-gray-500 text-sm">
                    <th className="p-4 font-medium">Nama Lengkap</th>
                    <th className="p-4 font-medium">Kredensial (NIK)</th>
                    <th className="p-4 font-medium">Status Perangkat</th>
                    <th className="p-4 font-medium text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isFetching ? (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-gray-400">Memuat data dari database...</td>
                    </tr>
                  ) : teknisiList.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-gray-400">Belum ada data teknisi.</td>
                    </tr>
                  ) : (
                    teknisiList.map((teknisi) => (
                      <tr key={teknisi.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="font-medium text-gray-800">{teknisi.nama_lengkap}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            Pass: {teknisi.password ? "••••••••" : "Belum diatur"}
                          </div>
                        </td>
                        <td className="p-4 text-gray-600 font-mono text-sm">{teknisi.nik}</td>
                        <td className="p-4">
                          {teknisi.device_id ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                              Terkunci (Terhubung)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                              Belum Login
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-3">
                            <button 
                              onClick={() => handleEdit(teknisi)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                            >
                              Edit
                            </button>
                            <div className="w-px h-4 bg-gray-300"></div>
                            <button 
                              onClick={() => handleDelete(teknisi.id, teknisi.nama_lengkap)}
                              className="text-red-600 hover:text-red-800 font-medium text-sm transition-colors"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}