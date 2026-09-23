# Deploy ke Vercel

Aplikasi memakai Bun Function di Vercel. SQLite lokal tetap dipakai saat menjalankan
`bun run dev` atau Docker, sedangkan deployment Vercel memakai Turso untuk data dan
Vercel Blob untuk file galeri. Pemisahan ini diperlukan karena filesystem Vercel
Function tidak persisten.

## Persiapan

1. Buat database Turso dan salin URL serta token-nya.
2. Di project Vercel, buat Blob store dengan akses Public.
3. Tambahkan Environment Variables berikut untuk Production dan Preview:

   - `ADMIN_KEY`: minimal 12 karakter.
   - `STORAGE_ENABLED`: `true` untuk mengaktifkan penyimpanan atau `false` untuk
     menonaktifkan seluruh operasi tulis.
   - `TURSO_DATABASE_URL`: URL database, biasanya diawali `libsql://`.
   - `TURSO_AUTH_TOKEN`: token akses database Turso.
   - `BLOB_READ_WRITE_TOKEN`: otomatis tersedia setelah Blob store dihubungkan.

4. Import repository ke Vercel atau jalankan `vercel`. Framework Preset dapat
   dibiarkan pada **Other**. Build Command dan Output Directory tidak perlu diisi.

Schema database dibuat otomatis pada request pertama. Endpoint `/api/health`, halaman
`/admin`, RSVP, pengaturan, link tamu, dan upload galeri memakai entrypoint yang sama.

Ukuran request Vercel Function dibatasi oleh platform. Walaupun validasi lokal galeri
mengizinkan 10 MB per gambar, upload melalui Function harus berada di bawah batas
payload Vercel; untuk file besar, kecilkan gambar sebelum upload.

Jika `STORAGE_ENABLED=false`, koneksi Turso dan Vercel Blob tidak dibuat. Undangan
tetap tampil memakai konfigurasi bawaan, sedangkan RSVP, simpan settings/link tamu,
serta perubahan galeri mengembalikan HTTP 503 `Penyimpanan dinonaktifkan`.
