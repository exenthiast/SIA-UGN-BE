# 🔄 Sequence Diagrams

Dokumentasi alur proses kritis pada sistem backend SIA-UGN (Laravel 12 & RDBMS).

---

## 1. Alur Presensi Dosen Berbasis Geofencing GPS (Haversine Formula)

Menjelaskan alur saat Dosen melakukan check-in perkuliahan melalui mobile/web dengan validasi radius lokasi kampus.

```mermaid
sequenceDiagram
    autonumber
    actor Dosen
    participant App as Mobile/Web Frontend
    participant Route as Sanctum Auth Middleware
    participant Ctrl as PresensiDosenController
    participant Gps as GpsService
    participant DB as Database (PostgreSQL/MySQL)

    Dosen->>App: Klik "Check-in Presensi" (Kirim Lat/Lng & ID Jadwal)
    App->>Route: POST /api/dosen/presensi/checkin (Bearer Token)
    Route->>Route: Verifikasi Token & Role ('dosen')
    Route->>Ctrl: handleCheckIn(PresensiCheckInRequest $request)
    
    Ctrl->>DB: Query CampusSetting::where('is_active', true)->get()
    Ctrl->>Gps: findNearestActiveCampus(lat, lng, campusSettings)
    
    alt Lokasi Dosen di Luar Radius Seluruh Kampus (> radius_meter)
        Gps-->>Ctrl: Return null / Out of radius
        Ctrl-->>App: 422 Unprocessable Entity ("Anda berada di luar radius kampus")
        App-->>Dosen: Tampilkan Peringatan Lokasi Terlalu Jauh
    else Lokasi Dosen Valid (Dalam Radius)
        Gps-->>Ctrl: Return matched campus & distance_meter
        Ctrl->>DB: BEGIN Transaction
        Ctrl->>DB: INSERT INTO presensi_dosen (id_schedule, id_staff_profile, status='hadir', lat, lng, distance)
        Ctrl->>DB: COMMIT Transaction
        Ctrl-->>App: 201 Created (Data Presensi Berhasil Dicatat)
        App-->>Dosen: Status Presensi Hijau (Hadir)
    end
```

---

## 2. Alur Validasi BKD / Kenaikan Jabatan oleh Manager

Menjelaskan alur verifikasi berkas Beban Kerja Dosen dan pembaharuan Angka Kredit Kumulatif (PAK).

```mermaid
sequenceDiagram
    autonumber
    actor Manager
    participant App as Web Dashboard Manager
    participant Ctrl as BkdManagerController
    participant DB as Database

    Manager->>App: Review Berkas BKD & Klik "Setujui (Approve)"
    App->>Ctrl: POST /api/manager/bkd/{id}/approve
    
    Note over Ctrl: Validasi Role ('manager')
    
    Ctrl->>DB: BEGIN Transaction
    Ctrl->>DB: UPDATE bkd SET status = 'approved', approved_by = :manager_id
    Ctrl->>DB: UPDATE angka_kredit_dosen SET total_kumulatif = total_kumulatif + :poin
    Ctrl->>DB: COMMIT Transaction
    
    Ctrl-->>App: 200 OK (Status Berhasil Diperbarui)
    App-->>Manager: Tampilkan Notifikasi Approval Berhasil
```

---

## 3. Alur Integrasi Rekap Kehadiran Presensi ke Penggajian (C.1 $\rightarrow$ C.4)

Menjelaskan sinkronisasi otomatis persentase kehadiran dosen ke dalam komponen pemotongan atau tunjangan kehadiran gaji bulanan.

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Scheduler / Payroll Sync
    participant Svc as PayrollSyncService
    participant Rekap as RekapPresensiService
    participant DB as Database

    Cron->>Svc: syncMonthlyAttendanceToPayroll(periode_bulan, tahun)
    Svc->>Rekap: getMonthlyAttendanceSummary(dosen_id, bulan, tahun)
    Rekap->>DB: Aggregasi Total Hadir, Izin, Sakit, Alpha
    Rekap-->>Svc: Persentase Kehadiran (Contoh: 95%)
    
    Svc->>DB: BEGIN Transaction
    Svc->>DB: Query / Insert Gaji Periode Berjalan
    alt Kehadiran < 100%
        Svc->>DB: INSERT/UPDATE gaji_komponen (jenis='potongan_kehadiran', nominal=...)
    else Kehadiran 100%
        Svc->>DB: INSERT/UPDATE gaji_komponen (jenis='tunjangan_kehadiran_penuh', nominal=...)
    end
    Svc->>DB: Recalculate Gaji Bersih (Net Salary)
    Svc->>DB: COMMIT Transaction
    Svc-->>Cron: Sinkronisasi Selesai
```
