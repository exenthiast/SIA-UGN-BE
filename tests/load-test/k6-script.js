import http from 'k6/http';
import { check, sleep } from 'k6';

// Konfigurasi Skenario Pengujian Beban (Dosen GPS Check-in Jam Pagi)
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp-up ke 50 VUs
    { duration: '1m', target: 200 },    // Spike ke 200 concurrent dosen check-in serentak
    { duration: '30s', target: 0 },     // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<150'],  // 95% request harus selesai di bawah 150ms
    http_req_failed: ['rate<0.01'],    // Error rate di bawah 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost/api';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer 1|dummy-sanctum-token-for-loadtest',
  };

  // Koordinat simulasi (dalam radius Kampus UGN)
  const payload = JSON.stringify({
    latitude: -7.771270 + (Math.random() - 0.5) * 0.0005,
    longitude: 110.377541 + (Math.random() - 0.5) * 0.0005,
    id_schedule: 1,
    keterangan: 'Presensi Dosen Perkuliahan Pagi',
  });

  const res = http.post(`${BASE_URL}/dosen/presensi/checkin`, payload, { headers });

  check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });

  sleep(0.5);
}
