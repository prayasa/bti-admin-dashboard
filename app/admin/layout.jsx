"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  
  const navItems = [
    { name: "Beranda Utama", path: "/admin", icon: "📊" },
    { name: "QR Generator", path: "/admin/qr", icon: "📱" },
    { name: "Riwayat Kehadiran", path: "/admin/presensi", icon: "📋" },
    { name: "Manajemen Teknisi", path: "/admin/teknisi", icon: "👥" },
    { name: "Tiket Penugasan", path: "/admin/penugasan", icon: "🎫" },
    { name: "Live Pemetaan", path: "/admin/pemetaan", icon: "🗺️" },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar Navigasi Kiri */}
      <aside className="w-64 bg-white shadow-xl flex flex-col z-20">
        <div className="p-6 border-b border-gray-100 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-blue-200">
            <span className="text-2xl text-white font-black">BTI</span>
          </div>
          <h2 className="text-lg font-bold text-gray-800 text-center leading-tight">Dasbor Admin</h2>
          <p className="text-xs text-gray-500 mt-1 text-center">CV Bengkel Teknologi Indonesia</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            // Logika aktif: jika rute persis sama, atau jika rute adalah sub-path (kecuali untuk Beranda "/admin")
            const isActive = pathname === item.path || (item.path !== "/admin" && pathname.startsWith(item.path));
            return (
              <Link href={item.path} key={item.path}>
                <span
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-semibold text-sm tracking-wide">{item.name}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="text-xs text-center text-gray-400 font-medium space-y-1">
            <p>CV BENGKEL TEKNOLOGI INDONESIA</p>
            <p className="text-gray-500 font-bold">Devrian Prayasa © 2026</p>
          </div>
        </div>
      </aside>

      {/* Area Konten Utama */}
      <main className="flex-1 overflow-y-auto relative">
        {children}
      </main>
    </div>
  );
}