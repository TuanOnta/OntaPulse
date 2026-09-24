# OntaPulse TODO

Prioritas diurutkan berdasarkan risiko terhadap keandalan data dan operasional,
baru kemudian kelengkapan fitur produk.

## P0 — Wajib sebelum mengandalkan scheduler di lingkungan bersama

1. [x] Jadikan migrasi database test sebagai langkah wajib di CI sebelum API test.
   - Jalankan `pnpm --filter @ontapulse/api test:db:migrate` sebelum Vitest.
   - Tujuan: mencegah kegagalan seperti kolom `Monitor.nextScheduledAt` yang
     belum ada pada database test.
2. [x] Tambahkan test integrasi scheduler dengan PostgreSQL dan RabbitMQ lokal yang
       terisolasi.
   - Buktikan job scheduler benar-benar dapat dikonsumsi worker dan mencapai
     status terminal.
   - Uji pemulihan saat broker atau database sementara tidak tersedia.
3. [x] Tambahkan observabilitas scheduler.
   - Structured log dan metrik untuk jumlah monitor jatuh tempo, scan dibuat,
     kegagalan enqueue, durasi satu siklus, dan monitor yang gagal diklaim.
4. [x] Tentukan dan dokumentasikan kebijakan scheduler pada kegagalan enqueue.
   - Pastikan jadwal berikutnya tidak membuat monitor terlewat atau menciptakan
     duplikasi scan yang tidak diinginkan.

## P1 — Menutup celah test dan kontrak

5. [x] Tambahkan test frontend.
   - Unit/component test untuk form auth, workspace, project, monitor, scan,
     dan tampilan error/loading.
   - E2E untuk alur register/login → buat monitor → trigger scan → lihat hasil.
6. [x] Uji endpoint yang masih belum tercakup langsung.
   - `GET /ready` untuk kondisi database siap dan tidak siap.
   - `GET /workspaces/:workspaceId/members`, termasuk role dan isolasi akses.
7. [x] Jalankan worker infrastructure test secara terjadwal di CI menggunakan
       PostgreSQL dan RabbitMQ terisolasi.
8. [x] Tambahkan laporan coverage serta ambang minimal untuk API, worker, dan web.
9. [x] Perbarui `docs/display-content-mapping.md` agar sesuai dengan endpoint
       pengelolaan anggota workspace yang sudah tersedia.

## P2 — Keandalan sistem antrean

10. Implementasikan transactional outbox atau mekanisme pengiriman setara
    antara PostgreSQL dan RabbitMQ.
11. Buat prosedur dan tool redrive DLQ yang aman, terotorisasi, dan dapat diaudit.
12. Tambahkan dashboard/alert operasional untuk backlog queue, retry, DLQ,
    scan yang terlalu lama `QUEUED`/`RUNNING`, dan kegagalan worker.

## P3 — Fitur inti yang belum tersedia

13. Tambahkan update/delete untuk workspace, project, dan monitor.
14. Tambahkan pause/resume monitor melalui `isActive`, termasuk pengaturan ulang
    jadwal saat monitor diaktifkan kembali.
15. Tambahkan endpoint detail project dan monitor serta ringkasan scan terakhir.
16. Buat dashboard agregat: uptime, SLA/SLO, tren response time, dan riwayat
    insiden.
17. Tambahkan lifecycle finding: acknowledge, resolve, assign, komentar, dan
    riwayat perubahan.

## P4 — Notifikasi dan pengalaman operasional

18. Rancang kebijakan alert dan escalation.
19. Implementasikan kanal notifikasi bertahap: webhook terlebih dahulu, lalu
    email dan chat integrations.
20. Tambahkan dukungan redirect HTTP dan, bila diperlukan, inspeksi response
    body yang dibatasi ukuran serta aman untuk data sensitif.
