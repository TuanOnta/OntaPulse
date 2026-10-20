# Mapping Konten yang Ditampilkan

Dokumen ini adalah inventaris informasi, status, aksi, dan aturan visibilitas
yang perlu tersedia pada produk OntaPulse. Dokumen ini sengaja tidak membagi
informasi berdasarkan _page_ atau layout. Setiap konsumen API—web, aplikasi
mobile, atau CLI—dapat menggunakan mapping yang sama.

Status data dan aksi pada dokumen ini dibedakan sebagai berikut:

- **Tersedia**: sudah dapat diperoleh atau dilakukan melalui API saat ini.
- **Belum tersedia**: penting untuk pengalaman produk, tetapi endpoint atau
  data API-nya belum ada. Item ini tidak boleh ditampilkan sebagai data nyata
  sebelum backend mendukungnya.

## Prinsip umum tampilan

- Tampilkan data hanya dalam workspace yang diikuti oleh user aktif.
- Selalu tampilkan konteks induknya untuk data turunan: workspace untuk
  project, project untuk monitor, dan monitor untuk scan.
- Gunakan nilai `null` sebagai keadaan "belum tersedia", bukan angka nol atau
  teks yang menyesatkan. Contohnya, `responseTimeMs: null` berarti scan belum
  menghasilkan waktu respons.
- Tampilkan waktu dalam zona waktu pengguna dan format yang mudah dibaca,
  sambil mempertahankan nilai ISO 8601 dari API sebagai sumber data.
- Sembunyikan atau nonaktifkan aksi yang tidak diizinkan oleh role. Backend
  tetap menjadi sumber otorisasi final.
- Saat data kosong, tampilkan keadaan kosong yang menjelaskan apa yang belum
  ada dan, bila role mengizinkan, aksi untuk membuat data pertama.
- Jangan menampilkan ID UUID sebagai konten utama; ID diperlukan untuk
  navigasi, pemanggilan API, dan bantuan teknis.

## 1. Konteks identitas dan sesi

### User aktif — tersedia

| Informasi         | Isi/data               | Sumber saat ini                     | Catatan tampilan                                                                |
| ----------------- | ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| Nama              | `user.name`            | Register, login, dan `GET /auth/me` | Identitas utama user.                                                           |
| Email             | `user.email`           | Register, login, dan `GET /auth/me` | Tampilkan sebagai identitas akun; jangan pernah menampilkan password atau hash. |
| Waktu akun dibuat | `user.createdAt`       | `GET /auth/me`                      | Informasi sekunder.                                                             |
| Sesi autentikasi  | Cookie sesi `httpOnly` | Register/login                      | Tidak ditampilkan sebagai nilai; UI cukup mencerminkan keadaan login/logout.    |

### Aksi sesi — tersedia

| Aksi              | Endpoint              | Input                       | Hasil yang perlu dicerminkan                          |
| ----------------- | --------------------- | --------------------------- | ----------------------------------------------------- |
| Registrasi        | `POST /auth/register` | `name`, `email`, `password` | User baru, sesi aktif, dan workspace awal.            |
| Login             | `POST /auth/login`    | `email`, `password`         | Sesi aktif dan identitas user.                        |
| Memuat user aktif | `GET /auth/me`        | Tidak ada                   | User aktif beserta membership workspace-nya.          |
| Logout            | `POST /auth/logout`   | Tidak ada                   | Sesi dihapus; respons sukses adalah `204` tanpa body. |

### Aturan registrasi — tersedia

- Nama: 2–80 karakter setelah spasi di tepi dihapus.
- Email: dinormalisasi ke huruf kecil dan harus berupa email valid.
- Password: 12–128 karakter.
- Saat registrasi berhasil, sistem otomatis membuat satu workspace bernama
  `<nama user>'s Workspace` dan menjadikan user sebagai `OWNER`.

## 2. Workspace dan membership

### Daftar workspace user — tersedia

Satu user dapat menjadi anggota banyak workspace. Setiap item workspace yang
ditampilkan harus memuat:

| Informasi        | Field API   | Keterangan                                                                                  |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------- |
| Identitas teknis | `id`        | UUID untuk request lanjutan; tidak perlu ditonjolkan.                                       |
| Nama workspace   | `name`      | Label utama workspace.                                                                      |
| Role user aktif  | `role`      | `OWNER`, `ADMIN`, atau `MEMBER`; role adalah milik membership user pada workspace tersebut. |
| Waktu bergabung  | `joinedAt`  | Waktu user aktif menjadi anggota.                                                           |
| Waktu dibuat     | `createdAt` | Waktu workspace dibuat.                                                                     |
| Waktu diperbarui | `updatedAt` | Waktu perubahan terakhir pada workspace.                                                    |

Endpoint: `GET /workspaces`. Urutannya saat ini berdasarkan `joinedAt` dari
yang paling awal.

### Membuat workspace — tersedia

| Input          | Aturan                             | Hasil                                                  |
| -------------- | ---------------------------------- | ------------------------------------------------------ |
| Nama workspace | Wajib, 1–120 karakter setelah trim | Workspace dibuat dan pembuat otomatis menjadi `OWNER`. |

Endpoint: `POST /workspaces`.

### Informasi anggota workspace — tersedia

Setiap anggota workspace dapat membaca daftar anggota melalui
`GET /workspaces/:workspaceId/members`. Setiap item memuat `id`, `name`,
`email`, `role`, dan `joinedAt`. Nama, email, role, dan pemilik workspace dapat
ditampilkan sebagai data faktual dari respons ini.

### Pengelolaan workspace — terbatas

- Mengubah nama workspace.
- Menghapus workspace.
- Memindahkan ownership.

Menambahkan anggota terdaftar dan menghapus `MEMBER` dapat dilakukan oleh
`OWNER` atau `ADMIN`. Hanya `OWNER` yang dapat mengubah role `MEMBER`/`ADMIN`
atau menghapus `ADMIN`; owner tidak dapat diubah atau dihapus.

## 3. Role dan otorisasi

Role ditentukan per membership, bukan per akun secara global. User yang sama
dapat menjadi `OWNER` pada Workspace A dan `MEMBER` pada Workspace B.

| Kemampuan                            |   OWNER   |    ADMIN    | MEMBER | Status implementasi                       |
| ------------------------------------ | :-------: | :---------: | :----: | ----------------------------------------- |
| Membaca project dalam workspace      |    Ya     |     Ya      |   Ya   | Tersedia                                  |
| Membaca monitor dalam project        |    Ya     |     Ya      |   Ya   | Tersedia                                  |
| Membaca scan dan finding             |    Ya     |     Ya      |   Ya   | Tersedia                                  |
| Membuat project                      |    Ya     |     Ya      | Tidak  | Tersedia                                  |
| Membuat monitor                      |    Ya     |     Ya      | Tidak  | Tersedia                                  |
| Menjalankan scan                     |    Ya     |     Ya      | Tidak  | Tersedia                                  |
| Membuat workspace baru milik sendiri |    Ya     |     Ya      |   Ya   | Tersedia untuk setiap user terautentikasi |
| Membaca anggota workspace            |    Ya     |     Ya      |   Ya   | Tersedia                                  |
| Menambah anggota                     |    Ya     |     Ya      | Tidak  | Tersedia                                  |
| Mengubah role anggota                |    Ya     |    Tidak    | Tidak  | Tersedia; owner tidak dapat diubah        |
| Menghapus anggota                    |    Ya     | MEMBER saja | Tidak  | Tersedia; owner tidak dapat dihapus       |
| Mengubah/menghapus workspace         | Belum ada |  Belum ada  | Tidak  | Belum tersedia di API                     |

Satu workspace hanya dapat memiliki satu `OWNER`. Akses ke resource di luar
workspace user diperlakukan sebagai `404`, agar keberadaan resource tidak
terungkap.

## 4. Project

Project adalah pengelompokan logical untuk satu atau beberapa monitor dan
selalu berada di dalam satu workspace.

### Konten project — tersedia

| Informasi        | Field API     | Keterangan                                                            |
| ---------------- | ------------- | --------------------------------------------------------------------- |
| Identitas teknis | `id`          | UUID project.                                                         |
| Workspace induk  | `workspaceId` | Gunakan untuk menjaga konteks dan request berikutnya.                 |
| Nama             | `name`        | Label utama project.                                                  |
| Deskripsi        | `description` | Boleh `null`; tampilkan keadaan tanpa deskripsi, bukan string `null`. |
| Waktu dibuat     | `createdAt`   | Metadata sekunder.                                                    |
| Waktu diperbarui | `updatedAt`   | Metadata sekunder.                                                    |

Endpoint daftar: `GET /workspaces/:workspaceId/projects`.

### Membuat project — tersedia untuk OWNER dan ADMIN

| Input         | Aturan                                        |
| ------------- | --------------------------------------------- |
| `name`        | Wajib, 1–120 karakter setelah trim.           |
| `description` | Opsional, maksimal 500 karakter setelah trim. |

Endpoint: `POST /workspaces/:workspaceId/projects`.

### Konten/aksi project yang belum tersedia

- Detail project tunggal melalui endpoint khusus.
- Ubah atau hapus project.
- Jumlah monitor, ringkasan kesehatan, scan terakhir, atau metrik agregat per
  project. Semua ini dapat dihitung di client dengan request tambahan terbatas,
  tetapi belum disediakan sebagai data ringkasan resmi API.

## 5. Monitor

Monitor mendefinisikan target HTTP/HTTPS yang dipantau dan selalu berada di
dalam satu project.

### Konten monitor — tersedia

| Informasi        | Field API         | Keterangan                                                            |
| ---------------- | ----------------- | --------------------------------------------------------------------- |
| Identitas teknis | `id`              | UUID monitor.                                                         |
| Project induk    | `projectId`       | Konteks induk monitor.                                                |
| Nama             | `name`            | Label utama monitor.                                                  |
| URL target       | `targetUrl`       | URL HTTP atau HTTPS yang akan diperiksa.                              |
| Interval         | `intervalSeconds` | Tampilkan dalam unit yang mudah dibaca, misalnya 300 menjadi 5 menit. |
| Status aktif     | `isActive`        | Boolean tersimpan pada model; monitor aktif dijadwalkan otomatis.     |
| Waktu dibuat     | `createdAt`       | Metadata sekunder.                                                    |
| Waktu diperbarui | `updatedAt`       | Metadata sekunder.                                                    |

Endpoint daftar: `GET /projects/:projectId/monitors`.

### Membuat monitor — tersedia untuk OWNER dan ADMIN

| Input             | Aturan                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `name`            | Wajib, 1–120 karakter setelah trim.                                                                                      |
| `targetUrl`       | Wajib; URL valid dengan protokol `http` atau `https`. URL yang sama tidak dapat dibuat dua kali dalam project yang sama. |
| `intervalSeconds` | Opsional; integer 60–86.400, default 300.                                                                                |

Endpoint: `POST /projects/:projectId/monitors`.

### Konten/aksi monitor yang belum tersedia

- Detail monitor tunggal melalui endpoint khusus.
- Mengubah nama, URL, interval, atau `isActive`.
- Menghapus monitor.
- Jadwal scan berikutnya, status runtime monitor, dan ringkasan scan terakhir.

## 6. Scan

Scan adalah satu eksekusi pemeriksaan untuk sebuah monitor. Scan dibuat terlebih
dahulu dengan status `QUEUED`, lalu diproses oleh worker secara asynchronous.

### Konten scan — tersedia

| Informasi        | Field API        | Keterangan tampilan                                                    |
| ---------------- | ---------------- | ---------------------------------------------------------------------- |
| Identitas teknis | `id`             | UUID scan.                                                             |
| Monitor induk    | `monitorId`      | Konteks scan.                                                          |
| Status           | `status`         | Gunakan label yang jelas: `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`.  |
| HTTP status      | `statusCode`     | Integer atau `null`; hanya tampilkan jika hasil HTTP tersedia.         |
| Waktu respons    | `responseTimeMs` | Integer milidetik atau `null`; format sebagai ms/detik.                |
| Pesan error      | `errorMessage`   | String atau `null`; tampilkan hanya pada kegagalan atau saat tersedia. |
| Waktu mulai      | `startedAt`      | Tanggal/waktu atau `null`.                                             |
| Waktu selesai    | `finishedAt`     | Tanggal/waktu atau `null`.                                             |
| Waktu antre/buat | `createdAt`      | Waktu scan dibuat.                                                     |

Endpoint daftar: `GET /monitors/:monitorId/scans`. Daftar diurutkan dari
`createdAt` terbaru ke terlama.

### Menjalankan scan — tersedia untuk OWNER dan ADMIN

Endpoint manual: `POST /monitors/:monitorId/scans`. Monitor aktif juga membuat scan
otomatis berdasarkan `intervalSeconds`.

Permintaan tidak memiliki body. Respons sukses adalah `202 Accepted` dan scan
berstatus awal `QUEUED`. Karena pemrosesan asynchronous, data scan perlu
dimuat ulang hingga mencapai `SUCCEEDED` atau `FAILED`.

### Arti status scan

| Status      | Makna                                               | Kondisi tampilan                                                                                                                       |
| ----------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `QUEUED`    | Scan dibuat dan menunggu worker.                    | Tampilkan sebagai sedang menunggu; hasil HTTP, waktu respons, dan waktu selesai mungkin `null`.                                        |
| `RUNNING`   | Worker sedang menjalankan pemeriksaan.              | Tampilkan sebagai sedang berjalan; waktu mulai mungkin tersedia.                                                                       |
| `SUCCEEDED` | Worker menyelesaikan lifecycle scan.                | Status HTTP dan temuan mungkin tersedia; respons HTTP 4xx/5xx tetap dapat menjadi `SUCCEEDED` karena scan berhasil memperoleh respons. |
| `FAILED`    | Worker atau antrean tidak dapat menyelesaikan scan. | Tampilkan `errorMessage` jika tersedia dan waktu selesai.                                                                              |

## 7. Finding hasil scan

Finding hanya tersedia pada detail satu scan, bukan pada endpoint daftar scan.

### Konten finding — tersedia

| Informasi         | Field API        | Keterangan                                                                                    |
| ----------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| Identitas teknis  | `id`             | UUID finding.                                                                                 |
| Scan induk        | `scanId`         | UUID scan pemilik finding.                                                                    |
| Kode              | `code`           | Kode mesin/stabil untuk jenis temuan.                                                         |
| Judul             | `title`          | Ringkasan utama yang dibaca user.                                                             |
| Tingkat keparahan | `severity`       | `LOW`, `MEDIUM`, `HIGH`, atau `CRITICAL`.                                                     |
| Deskripsi         | `description`    | Penjelasan temuan.                                                                            |
| Rekomendasi       | `recommendation` | Boleh `null`; tampilkan bila tersedia.                                                        |
| Bukti             | `evidence`       | JSON atau `null`; formatkan secara aman dan mudah dibaca, tanpa mengasumsikan struktur tetap. |
| Waktu dibuat      | `createdAt`      | Waktu finding dicatat.                                                                        |

Endpoint detail: `GET /scans/:scanId`. Respons memuat field scan lengkap dan
array `findings`, yang diurutkan dari `createdAt` paling awal.

### Penyajian severity

| Severity   | Makna tampilan                                    |
| ---------- | ------------------------------------------------- |
| `CRITICAL` | Prioritas paling tinggi.                          |
| `HIGH`     | Perlu perhatian segera.                           |
| `MEDIUM`   | Perlu ditinjau dan direncanakan tindak lanjutnya. |
| `LOW`      | Informasi atau risiko rendah.                     |

Tidak ada aksi acknowledge, resolve, assign, komentar, atau riwayat perubahan
finding pada API saat ini.

## 7a. Pemeriksaan keamanan (security posture)

Pemeriksaan keamanan adalah scan terpisah dari scan HTTP (`kind` =
`SECURITY_POSTURE`). Scan HTTP menjawab apakah target hidup dan seberapa cepat;
pemeriksaan keamanan mengamati header, cookie, CORS, redirect HTTP ke HTTPS,
serta sertifikat dan protokol TLS. Pemeriksaan ini pasif: hanya dua permintaan
GET dan satu handshake TLS ke host monitor.

### Informasi — tersedia

| Informasi              | Sumber API                                  | Keterangan                                                                            |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| Status pengaturan      | `GET /monitors/:id/check-settings`          | `securityPostureEnabled`; monitor tanpa pengaturan dianggap nonaktif.                 |
| Hasil terakhir         | `GET /monitors/:id/security-posture/latest` | Scan keamanan selesai terbaru. `404 NO_SECURITY_SCAN` berarti belum ada, bukan error. |
| Jenis scan             | `kind` pada scan                            | Tandai scan keamanan pada riwayat; grafik waktu respons hanya memakai scan HTTP.      |
| Temuan keamanan        | `findings[]` pada detail scan               | Tambahan: `checkId`, `category`, `confidence` (boleh `null`).                         |
| Pemeriksaan yang jalan | `subChecks[]`                               | `name`, `state` (`ran` atau `skipped`), `reason`. Tampilkan alasan jika dilewati.     |

### Aksi dan visibilitas

| Aksi                         | OWNER | ADMIN | MEMBER | Catatan                                                                                          |
| ---------------------------- | :---: | :---: | :----: | ------------------------------------------------------------------------------------------------ |
| Melihat hasil dan pengaturan |  Ya   |  Ya   |   Ya   | `MEMBER` melihat status aktif/nonaktif sebagai teks.                                             |
| Mengaktifkan/menonaktifkan   |  Ya   |  Ya   | Tidak  | `PATCH /monitors/:id/check-settings`. Backend yang memutuskan; UI menyembunyikan untuk `MEMBER`. |
| Menjalankan scan keamanan    |  Ya   |  Ya   | Tidak  | `POST /monitors/:id/scans` dengan `{"kind":"SECURITY_POSTURE"}`.                                 |

Batasan yang harus ditampilkan: `409 SECURITY_CHECKS_DISABLED` (pemeriksaan
belum diaktifkan) dan `429 SCAN_RATE_LIMITED` dengan `details.retryAfterSeconds`
(tampilkan sisa waktu, jangan hanya pesan error).

### Aturan penyajian

- Gunakan kata "teramati" (_observed_), bukan "rentan". Hasil pasif adalah
  pengamatan satu respons.
- Tampilkan `confidence` bila ada. Temuan deterministik tidak memilikinya.
- Severity dan status pemeriksaan selalu disertai teks atau ikon, tidak hanya
  warna.
- Teks dari target (nilai header, bukti) ditampilkan sebagai teks biasa, tidak
  pernah sebagai HTML.
- Keadaan kosong menjelaskan cara memulai scan, bukan skor nol. Bedakan "belum
  ada scan" dari "pemeriksaan nonaktif".
- Kegagalan sertifikat pada scan HTTP menampilkan pesan spesifik di
  `errorMessage` (hostname tidak cocok, kedaluwarsa, belum berlaku, atau tidak
  tepercaya); scan tetap `FAILED`. Temuan sertifikat lengkap ada pada scan
  keamanan.

## 7b. Lapisan edge (CDN, WAF, anti-bot)

Profil edge adalah pengamatan, bukan temuan: lapisan CDN, WAF, atau anti-bot
yang teramati di depan host monitor. Hasilnya diturunkan dari data yang sudah
dikumpulkan scan keamanan (nama header, nama cookie, status, penanda
challenge); tidak ada permintaan tambahan. Satu profil terkini per monitor.
Tampilan berbahasa Inggris, seperti seluruh aplikasi web.

### Informasi — tersedia

| Informasi           | Sumber API                       | Keterangan                                                                                                              |
| ------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Profil edge terkini | `GET /monitors/:id/edge-profile` | `404 NO_EDGE_PROFILE` berarti belum ada profil (bukan error). `detections: []` berarti tidak ada lapisan yang teramati. |
| Vendor dan lapisan  | `detections[].vendor`, `.layer`  | `layer`: `CDN`, `WAF`, `ANTI_BOT`. Vendor tak dikenal ditampilkan sebagai teks yang terbaca.                            |
| Keyakinan           | `detections[].confidence`        | `HIGH`, `MEDIUM`, `LOW`; selalu ditampilkan sebagai kata.                                                               |
| Sinyal pendukung    | `detections[].signals[]`         | `type` dan `name` saja (nama header atau cookie); nilai tidak pernah dikirim.                                           |
| Challenge           | `challengeObserved`              | Beri catatan bahwa halaman challenge dilayani ke scanner dan temuan dari respons itu dilewati.                          |
| Waktu pengamatan    | `observedAt`, `scanId`           | Waktu di zona waktu user; tautan "Open the scan" ke scan penghasil. UUID bukan konten utama.                            |
| Label sub-check     | `subChecks[].name` = `edge`      | Ditampilkan sebagai "Edge detection".                                                                                   |

Kartu tampil di dua tempat dan hanya dibaca: di bagian Security pada halaman
monitor (di bawah hasil scan terbaru, dengan tautan "Open the scan") dan di
halaman scan keamanan yang sudah selesai (di bawah daftar temuan, tanpa tautan
karena akan menunjuk ke halaman yang sama). Profil edge adalah profil terkini
per monitor, jadi halaman scan hanya menampilkannya bila scan itu yang
menghasilkannya; halaman scan yang lebih lama tidak menampilkan kartu. Semua peran (`OWNER`, `ADMIN`, `MEMBER`) melihat hal
yang sama; tidak ada aksi di kartu.

### Aturan penyajian

- Edge adalah informasi, bukan cacat: jangan memakai warna atau gaya severity
  (merah/kuning) dan jangan menulis "terlindungi oleh". Gunakan kata
  "teramati" (_observed_).
- Lapisan dan keyakinan ditampilkan sebagai teks, tidak hanya warna.
- Urutan tetap: CDN, WAF, anti-bot, lalu nama vendor, agar scan ulang tidak
  mengacak daftar.
- Nama sinyal dari API ditampilkan sebagai teks biasa, tidak pernah sebagai HTML.
- Tiga keadaan berbeda: belum ada profil ("No edge profile yet"), profil kosong
  ("No CDN, WAF, or anti-bot layer was observed in the last scan"), dan error
  (banner dengan `requestId` dan tombol coba lagi). Kegagalan kartu tidak
  menyembunyikan hasil scan keamanan, dan sebaliknya.
- Tidak ada teks penjelasan umum di bawah judul kartu. Catatan cakupan hanya
  muncul pada hasil kosong: hanya vendor yang punya sidik jari terverifikasi
  yang dapat dikenali (saat ini Cloudflare, Amazon CloudFront, AWS WAF, Vercel,
  Fastly, DataDome, HUMAN), sehingga hasil kosong tidak berarti tidak ada
  layanan edge.

## 8. Keadaan kosong, loading, dan error

### Keadaan kosong yang perlu dibedakan

| Data      | Makna kosong                                   | Aksi yang dapat ditawarkan                          |
| --------- | ---------------------------------------------- | --------------------------------------------------- |
| Workspace | User belum memiliki/menjadi anggota workspace. | Buat workspace; tersedia untuk user terautentikasi. |
| Project   | Workspace belum memiliki project.              | Buat project hanya untuk OWNER/ADMIN.               |
| Monitor   | Project belum memiliki monitor.                | Buat monitor hanya untuk OWNER/ADMIN.               |
| Scan      | Monitor belum pernah dipindai.                 | Jalankan scan hanya untuk OWNER/ADMIN.              |
| Finding   | Scan selesai tanpa temuan.                     | Tidak ada aksi khusus yang tersedia.                |

### Kontrak error API

Untuk error, gunakan data berikut bila tersedia:

| Field        | Kegunaan                                                                          |
| ------------ | --------------------------------------------------------------------------------- |
| `statusCode` | Kategori teknis HTTP.                                                             |
| `code`       | Kode mesin yang stabil, misalnya `UNAUTHENTICATED` atau `MONITOR_ALREADY_EXISTS`. |
| `message`    | Pesan aman untuk user.                                                            |
| `details`    | Detail validasi opsional; petakan ke input yang sesuai.                           |
| `requestId`  | Sertakan pada laporan masalah atau dukungan teknis.                               |

Kondisi utama yang perlu dicerminkan:

- `400 VALIDATION_ERROR`: input tidak sesuai aturan; tampilkan kesalahan pada
  input terkait bila detail tersedia.
- `401 UNAUTHENTICATED`: sesi tidak valid atau berakhir; arahkan ke login.
- `403 INSUFFICIENT_WORKSPACE_ROLE`: user adalah member, tetapi tidak berhak
  membuat atau menjalankan resource tersebut.
- `404`: resource tidak ada atau user tidak memiliki akses terhadap
  workspace-nya; jangan membedakan kedua kasus kepada user.
- `409 EMAIL_ALREADY_REGISTERED` atau `MONITOR_ALREADY_EXISTS`: tampilkan
  konflik dan pertahankan input agar mudah diperbaiki.
- `503 SCAN_QUEUE_UNAVAILABLE`: scan telah dicatat sebagai gagal karena antrean
  tidak tersedia; tampilkan error dan tawarkan percobaan baru hanya kepada
  OWNER/ADMIN.

## 9. Cakupan API saat ini

| Domain    | Baca                                   | Buat                  | Ubah                               | Hapus                       | Kelola anggota/role                          |
| --------- | -------------------------------------- | --------------------- | ---------------------------------- | --------------------------- | -------------------------------------------- |
| User/sesi | Ya                                     | Register              | Tidak                              | Logout hanya menghapus sesi | Tidak relevan                                |
| Workspace | Daftar workspace dan anggota           | Ya                    | Belum tersedia                     | Belum tersedia              | Tambah, ubah role, hapus dengan batasan role |
| Project   | Daftar per workspace                   | Ya, OWNER/ADMIN       | Belum tersedia                     | Belum tersedia              | Tidak relevan                                |
| Monitor   | Daftar per project                     | Ya, OWNER/ADMIN       | Belum tersedia                     | Belum tersedia              | Tidak relevan                                |
| Scan      | Daftar per monitor dan detail per scan | Jalankan, OWNER/ADMIN | Diproses worker, bukan diedit user | Belum tersedia              | Tidak relevan                                |
| Finding   | Dalam detail scan                      | Dibuat worker         | Belum tersedia                     | Belum tersedia              | Belum tersedia                               |

## 10. Urutan data dan dependensi

```text
User
  └─ WorkspaceMember (role per workspace)
       └─ Workspace
            └─ Project
                 └─ Monitor
                      └─ Scan
                           └─ Finding
```

Data di tingkat bawah hanya relevan dan boleh diakses setelah konteks di
atasnya dapat diakses oleh user. Project, monitor, scan, dan finding tidak
memiliki ownership langsung oleh user; aksesnya selalu diturunkan dari
membership user terhadap workspace induk.
