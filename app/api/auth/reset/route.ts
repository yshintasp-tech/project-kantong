import { google } from "googleapis";
import { NextResponse } from "next/server";
import { consumeResetToken, hashPassword, localUsers } from "../../../../lib/auth";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !process.env.GOOGLE_SHEET_ID) return null;
  return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

export async function POST(request: Request) {
  const { token, password } = await request.json() as { token?: string; password?: string };
  if (!token || !password || password.length < 8) return NextResponse.json({ message: "Token tidak valid atau password minimal 8 karakter." }, { status: 400 });
  const reset = consumeResetToken(token);
  if (!reset) return NextResponse.json({ message: "Tautan reset sudah tidak berlaku." }, { status: 400 });
  const localUser = localUsers.get(reset.email);
  const auth = getAuth();
  if (localUser) {
    localUser.password = password;
  } else if (auth) {
    const sheets = google.sheets({ version: "v4", auth });
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "users!B2:B" });
    const rowIndex = (result.data.values ?? []).findIndex((row) => row[0]?.toLowerCase() === reset.email) + 2;
    if (rowIndex < 2) return NextResponse.json({ message: "Pengguna tidak ditemukan." }, { status: 404 });
    await sheets.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `users!C${rowIndex}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[hashPassword(password)]] } });
  }
  return NextResponse.json({ message: "Password berhasil diganti. Silakan login kembali." });
}