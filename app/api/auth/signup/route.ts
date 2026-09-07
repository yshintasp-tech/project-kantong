import { google } from "googleapis";
import { NextResponse } from "next/server";
import { hashPassword, localUsers, setSession, type SessionUser } from "../../../../lib/auth";
import { appsScriptGet, appsScriptPost } from "../../../../lib/apps-script";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !process.env.GOOGLE_SHEET_ID) return null;
  return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

async function isEmailRegistered(email: string): Promise<boolean> {
  const normalized = email.toLowerCase();
  if (localUsers.has(normalized)) return true;

  try {
    const scriptData = await appsScriptGet("users");
    const scriptUser = scriptData?.users?.find(
      (item: { email?: string; nickname?: string; passwordHash?: string }) =>
        item.email?.toLowerCase() === normalized && Boolean(item.passwordHash || item.nickname)
    );
    if (scriptUser) return true;
  } catch {
    // Continue checking other sources
  }

  const auth = getAuth();
  if (auth) {
    try {
      const sheets = google.sheets({ version: "v4", auth });
      const result = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "user!A2:D" });
      const found = (result.data.values ?? []).some((row) => row[0]?.toLowerCase() === normalized && Boolean(row[1] || row[2]));
      if (found) return true;
    } catch {
      // Ignore sheets fetch error
    }
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string; nickname?: string; overwrite?: boolean };
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const nickname = String(body.nickname || "").trim();
    const overwrite = Boolean(body.overwrite);

    if (!email || !password || !nickname) {
      return NextResponse.json({ message: "Email, password, dan nama panggilan wajib diisi." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Format email tidak valid." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ message: "Password minimal 6 karakter." }, { status: 400 });
    }

    if (nickname.length < 2) {
      return NextResponse.json({ message: "Nama panggilan minimal 2 karakter." }, { status: 400 });
    }

    // Cek apakah email sudah terdaftar
    const alreadyRegistered = await isEmailRegistered(email);
    if (alreadyRegistered && !overwrite) {
      return NextResponse.json(
        {
          message: "Akun dengan email ini sudah terdaftar.",
          emailExists: true,
        },
        { status: 409 }
      );
    }

    const id = `USR${Date.now().toString().slice(-6)}`;
    const hashedPassword = hashPassword(password);
    const canEdit = true;

    // 1. Simpan ke memory lokal
    localUsers.set(email, { email, password: hashedPassword, nickname, canEdit });

    // 2. Simpan ke Google Apps Script jika tersedia
    let scriptSaved = false;
    if (process.env.APPS_SCRIPT_URL) {
      const scriptResult = await appsScriptPost({
        action: "create_user",
        id,
        email,
        password,
        passwordHash: hashedPassword,
        name: nickname,
        nickname,
        role: "user",
        canEdit: true,
      });
      if (scriptResult && scriptResult.user) {
        scriptSaved = true;
      }
    }

    // 3. Simpan langsung ke Google Sheets jika Service Account tersedia
    let sheetsSaved = false;
    const auth = getAuth();
    if (auth) {
      try {
        const sheets = google.sheets({ version: "v4", auth });
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: "user!A:D",
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[email, password, nickname, "user"]] },
        });
        sheetsSaved = true;
      } catch {
        // Fallback jika API sheets gagal
      }
    }

    // Buat sesi login untuk pengguna baru
    const sessionUser: SessionUser = { email, nickname, canEdit };
    await setSession(sessionUser);

    const isSyncedToSheet = scriptSaved || sheetsSaved;

    return NextResponse.json({
      message: isSyncedToSheet
        ? "Registrasi berhasil dan tersimpan ke spreadsheet."
        : "Registrasi berhasil di aplikasi. Namun data belum masuk ke Google Sheets karena Apps Script perlu di-deploy ulang dengan kode terbaru dari apps-script/Code.gs.",
      user: sessionUser,
      syncedToSheet: isSyncedToSheet,
    });
  } catch {
    return NextResponse.json({ message: "Terjadi kesalahan saat memproses pendaftaran." }, { status: 500 });
  }
}
