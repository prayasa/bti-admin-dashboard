"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../../src/utils/supabase";

export default function QrGenerator() {
  const [qrData, setQrData] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [status, setStatus] = useState("Menyiapkan keamanan...");

  const generateNewToken = async () => {
    const uuid = crypto.randomUUID();
    const timestamp = Date.now();
    const payload = `${uuid}|${timestamp}`;

    setQrData(payload);
    setCountdown(30);

    // Lempar payload ke Supabase agar menjadi acuan validasi aplikasi mobile
    const { error } = await supabase
      .from("qr_aktif")
      .upsert({ id: 1, token: payload, updated_at: new Date() });

    if (error) {
      setStatus("Gagal sinkronisasi ke server!");
    } else {
      setStatus("Tersinkronisasi & Aman");
    }
  };

  useEffect(() => {
    generateNewToken();

    const refreshInterval = setInterval(() => {
      generateNewToken();
    }, 30000);

    const timerInterval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(timerInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Presensi Internal
        </h1>
        <p className="text-gray-500 mb-6">
          CV Bengkel Teknologi Indonesia
        </p>

        <div className="flex justify-center p-4 border-4 border-gray-50 rounded-xl mb-6 bg-white relative">
          {qrData ? (
            <QRCodeSVG
              value={qrData}
              size={250}
              level={"H"}
              includeMargin={true}
            />
          ) : (
            <div className="w-[250px] h-[250px] bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
              <span className="text-gray-400 font-medium">Membuat Token...</span>
            </div>
          )}
        </div>

        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${status.includes("Gagal") ? "bg-red-500" : "bg-green-500"}`}></div>
            <p className="text-sm font-bold uppercase tracking-wider">
              {status}
            </p>
          </div>
          <p className="text-xs opacity-80 mb-2">
            Dynamic QR Code hangus dan berganti dalam:
          </p>
          <div className="text-4xl font-black tabular-nums text-blue-700">
            {countdown} <span className="text-lg font-medium text-blue-600">detik</span>
          </div>
        </div>
      </div>
    </div>
  );
}