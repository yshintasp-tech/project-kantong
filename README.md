# Kantong

Tracker keuangan Next.js dengan Google Sheets sebagai database.

## Jalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Hubungkan Google Sheets

1. Buat Google Sheet dengan tab bernama `pemasukan`, `pengeluaran`, `tabungan`, `target`, dan `users`.
2. Baris pertama tiap tab: `ID`, `Name`, `Date`, `Nominal`, `Information`, `URL_Foto`. Pada tab `target`, gunakan kolom G `Pinned` untuk status target prioritas. Pada tab `pemasukan`, `pengeluaran`, dan `tabungan`, gunakan kolom G `Target`, kolom H `OwnerEmail`, dan kolom I `Category`. Kategori pengeluaran yang digunakan: `food`, `transport`, `entertainment`, `shopping`, `others`.
3. Buat service account di Google Cloud, aktifkan Google Sheets API, lalu share spreadsheet ke email service account sebagai Editor.
4. Salin `.env.example` menjadi `.env.local`, isi `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, dan `AUTH_SECRET` dengan string acak panjang.

5. Pada tab `users`, gunakan header `ID`, `Email`, `PasswordHash`, `Nickname`, `CanEdit`. Password harus disimpan sebagai hash `salt:hash` yang dibuat dengan `scryptSync` (akun demo lokal: `demo@kantong.app`, `kantong123`, `Andi`). Isi `CanEdit` dengan `TRUE` untuk pengguna yang boleh menambah atau mengubah data.

Template CSV yang sudah sesuai kontrak aplikasi tersedia di folder `spreadsheet-template`. Workbook terlampir adalah format awal dan belum memiliki kolom `Target`, `OwnerEmail`, `Category`, `Pinned`, atau tab `users`.

Login membutuhkan email, password aplikasi, dan nama panggilan yang cocok dengan data pengguna.

Untuk fitur lupa password, isi `APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, dan `SMTP_FROM`. Tanpa SMTP, aplikasi tetap memberi status bahwa email terdaftar, tetapi tidak mengirim email. Token reset berlaku 15 menit dan hanya dapat digunakan sekali.

## Apps Script CRUD

Kode siap-tempel tersedia di `apps-script/Code.gs`.

1. Buka spreadsheet, pilih **Extensions > Apps Script**, lalu tempel isi file tersebut.
2. Pada **Project Settings > Script properties**, tambahkan `SPREADSHEET_ID` berisi ID spreadsheet. Jangan tambahkan `API_KEY` agar deployment berjalan tanpa API key.
3. Deploy sebagai **Web app**, pilih **Execute as Me** dan akses **Anyone**.
4. Isi `APPS_SCRIPT_URL` dengan URL deployment di `.env.local`. Integrasi ini tidak menggunakan API key.
5. Restart Next.js. GET membaca data dari Apps Script, sedangkan POST/PUT/DELETE akan memakai Apps Script untuk CRUD.

Jika URL deployment mengembalikan `Argumen tidak valid: id`, buka Apps Script > **Deploy > Manage deployments**, pilih deployment tersebut, klik **Edit**, pilih **New version**, lalu deploy ulang. URL tetap sama. Pastikan isi `Code.gs` terbaru sudah disimpan sebelum deploy.

Apps Script membaca header berdasarkan nama kolom sehingga tetap mendukung urutan `URL_Foto` dan `Information` pada sheet target. Pastikan tab memiliki nama `pemasukan`, `pengeluaran`, `tabungan`, `target`, dan `users`.

Tanpa env tersebut, aplikasi memakai data contoh dari spreadsheet terlampir dan endpoint tetap dapat diuji dalam mode demo.
