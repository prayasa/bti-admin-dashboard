# Dataset Jalan Kota Pontianak

## Ringkasan

Dataset ini digunakan oleh sistem BTI Operations sebagai indeks pencarian lokasi penugasan teknisi di wilayah administratif Kota Pontianak.

Dataset tidak menggantikan Mapbox sebagai penyedia tampilan peta. Data lokal digunakan untuk:

- Mencari nama jalan dan gang di Kota Pontianak.
- Menampilkan pilihan lokasi secara lebih konsisten.
- Menyorot ruas jalan yang dipilih administrator.
- Membatasi pemilihan lokasi penugasan ke wilayah administratif Kota Pontianak.
- Mengurangi ketergantungan pencarian lokasi terhadap layanan autocomplete eksternal.

Setelah memilih nama jalan, administrator tetap harus menentukan titik bangunan atau lokasi klien secara langsung pada peta agar koordinat penugasan tidak hanya mengacu pada titik tengah jalan.

## Cakupan Wilayah

| Atribut | Nilai |
| --- | --- |
| Wilayah | Kota Pontianak |
| Jenis cakupan | Batas administratif kota |
| OSM relation ID | `10617336` |
| Sistem koordinat | WGS 84 (`EPSG:4326`) |
| Waktu snapshot sumber | `2026-09-06T20:04:26Z` |
| Versi dataset | `1` |

Batas administratif yang digunakan berasal dari relasi OpenStreetMap berikut:

https://www.openstreetmap.org/relation/10617336

## Statistik Dataset

| Komponen | Jumlah |
| --- | ---: |
| Ruas jalan bernama dari sumber | 2.428 |
| Ruas jalan bernama yang dapat digunakan | 2.428 |
| Indeks nama jalan dan gang setelah normalisasi | 1.522 |
| Ruas bernama yang dilewati saat pemrosesan | 0 |
| Geometri batas administratif | 1 |

Satu nama jalan dapat memiliki lebih dari satu ruas geometri. Karena itu, jumlah indeks nama jalan lebih kecil daripada jumlah ruas jalan.

Normalisasi juga menggabungkan variasi penulisan nama yang dianggap merujuk pada jalan yang sama, tanpa menghapus nama asli dan alias yang tersedia.

## Berkas Dataset

### `public/data/pontianak-city-streets.json`

Indeks pencarian nama jalan dan gang.

Setiap data dapat memuat:

- ID jalan hasil normalisasi.
- Nama utama.
- Nama yang telah dinormalisasi.
- Alias.
- Kata kunci pencarian.
- Jenis jalan dari atribut `highway`.
- Daftar ID ruas OpenStreetMap.
- Titik tengah.
- Bounding box.
- Perkiraan panjang.
- Jumlah ruas yang tergabung.

### `public/data/pontianak-city-street-segments.geojson`

Geometri ruas jalan dalam format GeoJSON.

Setiap feature dihubungkan dengan indeks jalan melalui properti `road_id`. Berkas ini digunakan untuk menyorot seluruh ruas yang berkaitan dengan hasil pencarian yang dipilih.

### `public/data/pontianak-city-boundary.geojson`

Batas administratif Kota Pontianak dalam format GeoJSON.

Berkas ini digunakan untuk:

- Menampilkan visualisasi coverage pada peta.
- Memeriksa apakah titik penugasan berada di dalam Kota Pontianak.
- Menolak pemilihan titik di luar wilayah coverage.

### `docs/data/pontianak-city-dataset-quality.json`

Laporan kualitas dan statistik hasil pembentukan dataset.

Berkas ini tidak digunakan langsung oleh aplikasi, tetapi disimpan sebagai dokumentasi teknis dan bukti pemeriksaan dataset.

## Alur Penggunaan pada Sistem

1. Aplikasi memuat indeks jalan, geometri ruas, dan batas wilayah dari direktori `public/data`.
2. Administrator mengetik minimal dua karakter nama jalan atau gang.
3. Sistem melakukan pencarian terhadap indeks lokal.
4. Administrator memilih salah satu hasil.
5. Peta menuju area jalan dan menyorot ruas yang berkaitan.
6. Koordinat penugasan dikosongkan sampai administrator memilih titik yang tepat.
7. Administrator mengeklik lokasi bangunan atau tempat klien pada peta.
8. Sistem memeriksa apakah titik berada di dalam Kota Pontianak.
9. Jika berada di dalam coverage, koordinat disimpan dan reverse geocoding Mapbox digunakan untuk membantu melengkapi alamat.
10. Jika berada di luar coverage, titik ditolak dan koordinat sebelumnya tidak diubah.

## Batasan Dataset

Dataset ini bukan basis data alamat bangunan atau alamat pos lengkap.

Cakupannya dibatasi pada ruas dengan atribut `highway` dan nama yang tersedia di OpenStreetMap pada waktu snapshot. Jalan atau gang yang belum memiliki nama, belum dipetakan, baru dibangun, berubah nama, atau belum diperbarui di OpenStreetMap mungkin belum tersedia dalam indeks pencarian.

Istilah “seluruh jalan Kota Pontianak” dalam konteks implementasi ini berarti seluruh ruas jalan bernama yang berhasil diperoleh dari OpenStreetMap di dalam batas administratif Kota Pontianak pada waktu snapshot, bukan jaminan bahwa seluruh kondisi jalan di lapangan telah tercatat secara mutlak.

Karena data dapat berubah, dataset perlu diperbarui secara berkala apabila sistem digunakan dalam jangka panjang.

## Sumber dan Lisensi

Sumber data:

- OpenStreetMap.
- Overpass API.
- Nominatim untuk identifikasi dan pemeriksaan batas wilayah.

Atribusi:

> © OpenStreetMap contributors

Dataset sumber OpenStreetMap tersedia berdasarkan Open Database License (ODbL) 1.0.

Informasi lebih lanjut:

- https://www.openstreetmap.org/copyright
- https://opendatacommons.org/licenses/odbl/1-0/

Atribusi OpenStreetMap juga ditampilkan pada antarmuka pemilihan lokasi penugasan.