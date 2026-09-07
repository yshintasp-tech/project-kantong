import { google } from "googleapis";
import { NextResponse } from "next/server";
import { clearSession, getSession, localUsers, setSession, verifyPassword, type SessionUser } from "../../../lib/auth";
import { appsScriptGet } from "../../../lib/apps-script";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !process.env.GOOGLE_SHEET_ID) return null;
  return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

async function findUser(email: string, password: string, nickname: string) {
  const localUser = localUsers.get(email.toLowerCase());
  if (
    localUser &&
    (password === localUser.password || (localUser.password.includes(":") && verifyPassword(password, localUser.password))) &&
    nickname.trim().toLowerCase() === localUser.nickname.toLowerCase()
  ) {
    return { email: localUser.email, nickname: localUser.nickname, canEdit: localUser.canEdit } satisfies SessionUser;
  }
  const scriptData = await appsScriptGet("users");
  const scriptUser = scriptData?.users?.find(
    (item: { email?: string; nickname?: string; passwordHash?: string; canEdit?: boolean }) =>
      item.email?.toLowerCase() === email.toLowerCase() && item.nickname?.toLowerCase() === nickname.trim().toLowerCase()
  );
  if (scriptUser && (verifyPassword(password, scriptUser.passwordHash || "") || password === scriptUser.passwordHash)) {
    return { email: scriptUser.email, nickname: scriptUser.nickname, canEdit: Boolean(scriptUser.canEdit) } satisfies SessionUser;
  }
  const auth = getAuth();
  if (!auth) return null;
  const sheets = google.sheets({ version: "v4", auth });
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "users!A2:E" });
  const row = (result.data.values ?? []).find((item) => item[1]?.toLowerCase() === email.toLowerCase() && item[3]?.toLowerCase() === nickname.trim().toLowerCase());
  if (!row || !verifyPassword(password, row[2] ?? "")) return null;
  return { email: row[1], nickname: row[3], canEdit: String(row[4]).toLowerCase() === "true" || row[4] === "1" } satisfies SessionUser;
}

export async function GET() { return NextResponse.json({ user: await getSession() }); }

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; password?: string; nickname?: string };
  if (!body.email || !body.password || !body.nickname) return NextResponse.json({ message: "Email, password, dan nama panggilan wajib diisi." }, { status: 400 });
  try {
    const user = await findUser(body.email, body.password, body.nickname);
    if (!user) return NextResponse.json({ message: "Data login tidak cocok." }, { status: 401 });
    await setSession({ email: user.email, nickname: user.nickname, canEdit: user.canEdit });
    return NextResponse.json({ user: { email: user.email, nickname: user.nickname, canEdit: user.canEdit } });
  } catch { return NextResponse.json({ message: "Konfigurasi pengguna belum tersedia." }, { status: 500 }); }
}

export async function DELETE() { await clearSession(); return NextResponse.json({ ok: true }); }

