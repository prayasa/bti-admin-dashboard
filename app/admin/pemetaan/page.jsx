"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "../../../src/utils/supabase";

export default function PetaPenugasan() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [tugasList, setTugasList] = useState([]);
  const [presensiList, setPresensiList] = useState([]);

  // Koordinat Utama Kantor BTI (Pontianak)
  const KANTOR_LNG = 109.32172547120854;
  const KANTOR_LAT = -0.030199545602447704;

  useEffect(() => {
    const fetchData = async () => {
      // 1. Tarik Data Tiket Penugasan
      const { data: tugas } = await supabase
        .from("tiket_tugas")
        .select("*, teknisi(nama_lengkap)");
      if (tugas) setTugasList(tugas);

      // 2. Tarik Data Presensi Hari Ini (Hanya yang memiliki koordinat asli)
      const today = new Date().toISOString().split('T')[0];
      const { data: presensi } = await supabase
        .from("log_presensi")
        .select("*, teknisi(nama_lengkap)")
        .gte("waktu_log", `${today}T00:00:00Z`)
        .neq("latitude_aktual", 0); 
      
      if (presensi) setPresensiList(presensi);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (map.current) return;
    
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [KANTOR_LNG, KANTOR_LAT],
      zoom: 14, // Zoom diperbesar agar radius kantor terlihat jelas
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
  }, []);

  useEffect(() => {
    if (!map.current) return;

    // A. Menggambar Titik Pusat Kantor BTI dengan efek "Radar Geofence"
    const elKantor = document.createElement('div');
    elKantor.className = 'relative flex items-center justify-center w-24 h-24';
    elKantor.innerHTML = `
      <span class="absolute inline-flex w-full h-full rounded-full bg-blue-500 opacity-20 animate-ping" title="Radius Geofence 50m"></span>
      <span class="relative inline-flex w-4 h-4 rounded-full bg-blue-700 border-2 border-white shadow-lg"></span>
    `;
    
    new mapboxgl.Marker({ element: elKantor })
      .setLngLat([KANTOR_LNG, KANTOR_LAT])
      .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML('<div style="padding:4px; text-align:center;"><strong style="color:#1D4ED8;">KANTOR PUSAT BTI</strong><br/><span style="font-size:11px;">Titik Geofencing Absolut</span></div>'))
      .addTo(map.current);

    // B. Meletakkan Pin Tiket Penugasan
    tugasList.forEach((tugas) => {
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<div style="padding: 4px;">
          <h3 style="font-weight: bold; margin-bottom: 4px;">Tugas: ${tugas.nama_klien}</h3>
          <p style="font-size: 12px; margin: 0;">Teknisi: <strong>${tugas.teknisi?.nama_lengkap}</strong></p>
          <p style="font-size: 12px; margin: 0; color: #666;">Status: ${tugas.status}</p>
        </div>`
      );
      new mapboxgl.Marker({ color: tugas.status === 'Success' ? '#10B981' : '#F59E0B' })
        .setLngLat([tugas.longitude_klien, tugas.latitude_klien])
        .setPopup(popup)
        .addTo(map.current);
    });

    // C. Meletakkan Pin Lokasi Presensi (Teknisi)
    presensiList.forEach((presensi) => {
      const elPresensi = document.createElement('div');
      elPresensi.className = 'w-4 h-4 bg-purple-500 rounded-full border-2 border-white shadow-md';
      
      const popup = new mapboxgl.Popup({ offset: 10 }).setHTML(
        `<div style="padding: 4px;">
          <h3 style="font-weight: bold; margin-bottom: 4px; color:#7E22CE;">Scan Presensi</h3>
          <p style="font-size: 12px; margin: 0;">Oleh: <strong>${presensi.teknisi?.nama_lengkap}</strong></p>
          <p style="font-size: 12px; margin: 0;">Valid: ${presensi.is_valid ? 'Ya (Dalam Radius)' : 'Tidak (Luar Radius)'}</p>
        </div>`
      );

      new mapboxgl.Marker({ element: elPresensi })
        .setLngLat([presensi.longitude_aktual, presensi.latitude_aktual])
        .setPopup(popup)
        .addTo(map.current);
    });

  }, [tugasList, presensiList]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Pemetaan Spasial & Geofencing</h1>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <p className="text-gray-600 text-sm max-w-lg">
              Validasi pergerakan teknisi secara <i>real-time</i>. Memantau posisi aktual saat melakukan presensi (Geofencing) dan lokasi penyelesaian tiket tugas.
            </p>
            <div className="flex flex-wrap gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-700 rounded-full shadow-[0_0_0_2px_rgba(59,130,246,0.3)]"></div>
                <span className="text-xs text-gray-700 font-bold">Kantor (Geofence)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-xs text-gray-700 font-bold">Titik Presensi</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <span className="text-xs text-gray-700 font-bold">Tugas Aktif</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <span className="text-xs text-gray-700 font-bold">Tugas Selesai</span>
              </div>
            </div>
          </div>
          
          <div 
            ref={mapContainer} 
            className="w-full h-[650px] rounded-xl overflow-hidden border border-gray-200 shadow-inner"
          />
        </div>
      </div>
    </div>
  );
}