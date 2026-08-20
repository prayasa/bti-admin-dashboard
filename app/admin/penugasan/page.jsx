"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../src/utils/supabase";

// Import Mapbox & Geocoder
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

export default function ManajemenPenugasan() {
  const [tugasList, setTugasList] = useState([]);
  const [teknisiList, setTeknisiList] = useState([]);
  
  // State Form
  const [idTeknisi, setIdTeknisi] = useState("");
  const [namaKlien, setNamaKlien] = useState("");
  const [alamatKlien, setAlamatKlien] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  
  // State Mode Edit
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Referensi Peta
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Default Center (Kantor BTI Pontianak)
  const DEFAULT_LNG = 109.3425;
  const DEFAULT_LAT = -0.0227;

  const fetchTeknisi = async () => {
    const { data, error } = await supabase
      .from("teknisi")
      .select("id, nama_lengkap")
      .order("nama_lengkap", { ascending: true });

    if (!error && data) {
      setTeknisiList(data);
    }
  };

  const fetchTugas = async () => {
    setIsFetching(true);
    const { data, error } = await supabase
      .from("tiket_tugas")
      .select(`*, teknisi (nama_lengkap)`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Gagal menarik data tugas:", error.message);
    } else {
      setTugasList(data);
    }
    setIsFetching(false);
  };

  useEffect(() => {
    fetchTeknisi();
    fetchTugas();
  }, []);

  // Inisialisasi Peta Mapbox & Geocoder
  useEffect(() => {
    if (mapRef.current) return; 

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [DEFAULT_LNG, DEFAULT_LAT],
      zoom: 14, // Zoom sedikit diperbesar agar lebih mudah melihat gang
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    // ==========================================
    // REVISI OPTIMASI GEOCODER (PENCARIAN LOKASI)
    // ==========================================
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      marker: false, 
      placeholder: "Cari jalan, tempat, atau area...",
      countries: 'id', // Mengunci pencarian hanya di Indonesia
      language: 'id', // Memaksa bahasa Indonesia
      limit: 10, // Menambah jumlah hasil pencarian agar opsi lebih luas
      minLength: 3, // Mulai mencari setelah 3 huruf diketik
      proximity: {
        longitude: DEFAULT_LNG, // Magnet utama pencarian tetap di Pontianak
        latitude: DEFAULT_LAT
      },
      // Memperlebar jaring pencarian untuk menangkap bisnis/tempat lokal yang tidak terdaftar sebagai alamat resmi
      types: 'poi,address,neighborhood,locality,place,district' 
    });

    mapRef.current.addControl(geocoder, "top-left");

    markerRef.current = new mapboxgl.Marker({ color: "#2563EB" });

    // Aksi saat alamat dari Search Box dipilih
    geocoder.on("result", (e) => {
      const [lng, lat] = e.result.center;
      markerRef.current.setLngLat([lng, lat]).addTo(mapRef.current);
      setLatitude(lat);
      setLongitude(lng);
      setAlamatKlien(e.result.place_name); 
    });

    // Aksi saat peta diklik (Reverse Geocoding)
    mapRef.current.on("click", async (e) => {
      const { lng, lat } = e.lngLat;
      markerRef.current.setLngLat([lng, lat]).addTo(mapRef.current);
      setLatitude(lat);
      setLongitude(lng);

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&language=id`
        );
        const data = await response.json();
        
        // Memastikan hasil reverse geocoding mengisi form dengan deskripsi terbaik
        if (data.features && data.features.length > 0) {
          setAlamatKlien(data.features[0].place_name);
        } else {
          setAlamatKlien("Koordinat berhasil diamankan. Silakan ketik nama jalan detail secara manual.");
        }
      } catch (error) {
        console.error("Gagal mengambil data alamat:", error);
      }
    });
  }, []);

  const handleSimpanTugas = async (e) => {
    e.preventDefault();
    if (!idTeknisi) {
      alert("Silakan pilih teknisi terlebih dahulu!");
      return;
    }
    if (!latitude || !longitude) {
      alert("Silakan pilih titik lokasi klien di peta!");
      return;
    }

    setIsLoading(true);

    if (isEditMode) {
      const { error } = await supabase
        .from("tiket_tugas")
        .update({
          id_teknisi: idTeknisi,
          nama_klien: namaKlien,
          alamat_klien: alamatKlien,
          latitude_klien: parseFloat(latitude),
          longitude_klien: parseFloat(longitude),
        })
        .eq("id_tugas", editId);

      if (error) {
        alert("Gagal memperbarui tiket: " + error.message);
      } else {
        alert("Tiket penugasan berhasil diperbarui!");
        resetForm();
        fetchTugas();
      }
    } else {
      const { error } = await supabase
        .from("tiket_tugas")
        .insert([
          {
            id_teknisi: idTeknisi,
            nama_klien: namaKlien,
            alamat_klien: alamatKlien,
            latitude_klien: parseFloat(latitude),
            longitude_klien: parseFloat(longitude),
          }
        ]);

      if (error) {
        alert("Gagal membuat tiket penugasan: " + error.message);
      } else {
        alert("Tiket penugasan berhasil dibuat!");
        resetForm();
        fetchTugas(); 
      }
    }
    
    setIsLoading(false);
  };

  const handleEdit = (tugas) => {
    setIsEditMode(true);
    setEditId(tugas.id_tugas);
    setIdTeknisi(tugas.id_teknisi);
    setNamaKlien(tugas.nama_klien);
    setAlamatKlien(tugas.alamat_klien);
    setLatitude(tugas.latitude_klien);
    setLongitude(tugas.longitude_klien);

    if (mapRef.current && markerRef.current) {
      markerRef.current.setLngLat([tugas.longitude_klien, tugas.latitude_klien]).addTo(mapRef.current);
      mapRef.current.flyTo({
        center: [tugas.longitude_klien, tugas.latitude_klien],
        zoom: 16,
        essential: true
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHapus = async (idTugas) => {
    const konfirmasi = window.confirm("Apakah Anda yakin ingin menghapus tiket penugasan ini secara permanen?");
    if (!konfirmasi) return;

    try {
      const { error } = await supabase
        .from("tiket_tugas")
        .delete()
        .eq("id_tugas", idTugas);

      if (error) {
        alert("Gagal menghapus tiket: " + error.message);
      } else {
        fetchTugas();
        if (isEditMode && editId === idTugas) resetForm();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setIsEditMode(false);
    setEditId("");
    setIdTeknisi("");
    setNamaKlien("");
    setAlamatKlien("");
    setLatitude("");
    setLongitude("");
    if (markerRef.current) markerRef.current.remove();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <style dangerouslySetInnerHTML={{__html: `
        .mapboxgl-ctrl-geocoder input[type='text'] {
          color: #111827 !important;
          font-weight: 600 !important;
        }
        .mapboxgl-ctrl-geocoder input[type='text']::placeholder {
          color: #9CA3AF !important;
          font-weight: 500 !important;
        }
      `}} />

      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Manajemen Tiket Penugasan</h1>
            <p className="text-gray-500 mt-2">Buat, edit, dan pantau penugasan teknisi lapangan.</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-700">
              {isEditMode ? "Edit Tiket Penugasan" : "Buat Tiket Baru"}
            </h2>
            {isEditMode && (
              <button onClick={resetForm} className="text-sm font-bold text-red-500 hover:text-red-700 bg-red-50 px-4 py-2 rounded-lg">
                BATAL EDIT
              </button>
            )}
          </div>
          
          <form onSubmit={handleSimpanTugas} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            <div className="lg:col-span-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Delegasi Teknisi</label>
                <select
                  required
                  value={idTeknisi}
                  onChange={(e) => setIdTeknisi(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900 font-semibold"
                >
                  <option value="" disabled>-- Pilih Teknisi --</option>
                  {teknisiList.map((teknisi) => (
                    <option key={teknisi.id} value={teknisi.id}>
                      {teknisi.nama_lengkap}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Nama Klien</label>
                <input
                  type="text"
                  required
                  value={namaKlien}
                  onChange={(e) => setNamaKlien(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 font-medium placeholder-gray-400"
                  placeholder="Contoh: PT. ABC / Bapak Budi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Alamat Lengkap Klien</label>
                <textarea
                  required
                  value={alamatKlien}
                  onChange={(e) => setAlamatKlien(e.target.value)}
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-white text-gray-900 font-medium placeholder-gray-400"
                  placeholder="Anda dapat mengubah alamat ini secara manual jika hasil dari peta kurang akurat..."
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Latitude</label>
                  <input
                    type="number"
                    readOnly
                    value={latitude}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 font-mono text-xs text-gray-800 font-bold cursor-not-allowed"
                    placeholder="Otomatis"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Longitude</label>
                  <input
                    type="number"
                    readOnly
                    value={longitude}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 font-mono text-xs text-gray-800 font-bold cursor-not-allowed"
                    placeholder="Otomatis"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !latitude || !longitude}
                className={`w-full text-white font-semibold py-3 px-4 rounded-lg transition-colors mt-2 shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed ${
                  isEditMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isLoading ? "Memproses..." : isEditMode ? "Simpan Perubahan" : "Terbitkan Tiket Tugas"}
              </button>
            </div>

            <div className="lg:col-span-8 flex flex-col">
              <label className="block text-sm font-medium text-gray-600 mb-1">Peta Lokasi Klien (Mapbox)</label>
              <div 
                ref={mapContainer} 
                className="w-full h-[500px] rounded-xl border border-gray-300 overflow-hidden shadow-inner relative"
              />
              <p className="text-xs text-gray-600 mt-2 bg-blue-50 p-3 rounded-md border border-blue-100 leading-relaxed">
                <strong className="text-blue-700">Tips Administrator:</strong> Mapbox mungkin tidak menemukan nama gang tikus atau alamat yang sangat spesifik melalui kolom pencarian teks. Jika alamat tidak muncul di <i>Search Box</i>, <strong>silakan klik langsung area yang tepat pada peta</strong> untuk menjatuhkan pin dan mengamankan koordinat GPS-nya. Setelah itu, ketik ulang detail alamatnya di kotak form kiri.
              </p>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-700">Daftar Penugasan</h2>
          </div>
          
          <div className="overflow-x-auto max-h-[850px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="border-b border-gray-100 text-gray-500 text-sm">
                  <th className="p-4 font-medium">Teknisi</th>
                  <th className="p-4 font-medium">Target Klien</th>
                  <th className="p-4 font-medium">Koordinat (Lat, Long)</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isFetching ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-400">Memuat tiket penugasan...</td>
                  </tr>
                ) : tugasList.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-400">Belum ada tiket tugas yang diterbitkan.</td>
                  </tr>
                ) : (
                  tugasList.map((tugas) => (
                    <tr key={tugas.id_tugas} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-medium text-gray-800 whitespace-nowrap">
                        {tugas.teknisi?.nama_lengkap || "Teknisi Dihapus"}
                      </td>
                      <td className="p-4 text-gray-600">
                        <div className="font-bold text-gray-800">{tugas.nama_klien}</div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2 max-w-sm" title={tugas.alamat_klien}>
                          {tugas.alamat_klien}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-[11px] font-mono bg-gray-100 px-2 py-1 rounded w-fit border border-gray-200 text-gray-800">
                          {tugas.latitude_klien}, {tugas.longitude_klien}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          tugas.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          tugas.status === 'On Process' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {tugas.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(tugas)}
                            className="text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-amber-100"
                            title="Edit Tiket"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => handleHapus(tugas.id_tugas)}
                            className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-red-100"
                            title="Hapus Tiket"
                          >
                            HAPUS
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
  );
}