# 🏗️ Architecture & Engineering Design Decisions

Dokumen ini menjelaskan arsitektur perangkat lunak, pola desain, dan pertimbangan teknis pada **Sistem Informasi Akademik Universitas Global Nusantara (SIA-UGN-BE)** yang dibangun menggunakan **Laravel 12 & RDBMS (PostgreSQL / MySQL)**.

---

## 1. Architectural Layers & Separation of Concerns

Sistem dirancang dengan arsitektur N-Tier modular untuk memisahkan logika presentasi HTTP, validasi, orkestrasi proses bisnis, dan akses data:

```text
HTTP Request (Client)
     │
     ▼
[Routing & Sanctum Middleware] <-- Autentikasi Bearer token & RBAC (Admin, Manager, Dosen, Mahasiswa)
     │
     ▼
[Form Request Validation]      <-- Validasi payload input, aturan tipe data, & otorisasi request awal
     │
     ▼
[Thin Controllers]             <-- Mengatur alur HTTP, memanggil Service, mengembalikan JSON standard
     │
     ▼
[Service Layer]                <-- Domain Business Rules:
     │                             • GpsService (Haversine Geofencing Algorithm)
     │                             • RekapPresensiService (Agregasi Kehadiran Bulanan)
     │                             • PayrollSyncService (Kalkulasi Pemotongan Gaji berbasis Presensi)
     │                             • PushNotificationService (Integrasi FCM)
     ▼
[Eloquent Models & DB]         <-- Interaksi database relasional, foreign keys, cascade, & transactions
     │
     ▼
HTTP JSON Response Standard    <-- { status: "success"|"failed", message: "...", data: {...} }
```

---

## 2. Fitur Arsitektur & Domain Invariants

### A. Geofencing Verification (Haversine Formula)
* **Kebutuhan**: Mencegah kecurangan presensi (*titip absen*) dosen saat mengajar perkuliahan offline.
* **Solusi**: `GpsService` menghitung jarak spherical antara koordinat GPS real-time dosen $(lat_1, lng_1)$ dengan koordinat geolokasi kampus $(lat_2, lng_2)$ menggunakan formula Haversine:
  $$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
* **Multi-Campus Support**: Mendukung multi-lokasi kampus cabang. Data setting kampus dimuat secara *eager/in-memory* sebelum kalkulasi untuk mencegah query database berulang ($N+1$).

### B. State Machine Beban Kerja Dosen (BKD & Kenaikan Jabatan)
* Alur status pengajuan: `draft` $\rightarrow$ `submitted` $\rightarrow$ `under_review` $\rightarrow$ `approved` / `rejected`.
* Validasi ketat oleh Manager/Biro Kepegawaian sebelum angka kredit kumulatif (PAK) terakumulasi ke profil dosen.

### C. Integrasi Presensi ke Penggajian (C.1 $\rightarrow$ C.4)
* Persentase kehadiran dosen dalam satu periode bulan kalender secara otomatis mengkalkulasi komponen tunjangan kehadiran dan potongan absensi pada tabel `gaji` dan `gaji_komponen`.
* Eksekusi mutasi gaji selalu diisolasi di dalam blok `DB::transaction`.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Modul / Kemampuan | Admin | Manager (Biro) | Dosen | Mahasiswa |
| :--- | :---: | :---: | :---: | :---: |
| Statistik Dashboard Kampus | ✅ | ❌ | ❌ | ❌ |
| Manajemen Kelas, Prodi, Periode | ❌ | ✅ | ❌ | ❌ |
| Check-in / Check-out Presensi GPS | ❌ | ❌ | ✅ | ❌ |
| Rekap Kehadiran Seluruh Dosen | ❌ | ✅ | ❌ | ❌ |
| Pengajuan BKD & Tridharma | ❌ | ❌ | ✅ | ❌ |
| Validasi BKD, Penelitian, & PkM | ❌ | ✅ | ❌ | ❌ |
| Lihat & Unduh Slip Gaji Pribadi | ❌ | ❌ | ✅ | ❌ |
| Chat & Percakapan Kampus | ✅ | ✅ | ✅ | ✅ |
