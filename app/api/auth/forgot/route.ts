import { google } from "googleapis";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { createResetToken, localUsers } from "../../../../lib/auth";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !process.env.GOOGLE_SHEET_ID) return null;
  return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

async function knownEmail(email: string) {
  if (localUsers.has(email.toLowerCase())) return true;
  const auth = getAuth();
  if (!auth) return false;
  const sheets = google.sheets({ version: "v4", auth });
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "users!B2:B" });
  return (result.data.values ?? []).some((row) => row[0]?.toLowerCase() === email.toLowerCase());
}

export async function POST(request: Request) {
  const { email } = await request.json() as { email?: string };
  if (!email || !(await knownEmail(email))) return NextResponse.json({ message: "Jika email terdaftar, instruksi reset akan dikirim." });
  const token = createResetToken(email);
  const baseUrl = process.env.APP_URL || new URL(request.url).origin;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.SMTP_FROM) return NextResponse.json({ message: "Email terdaftar. Konfigurasi SMTP belum tersedia, jadi notifikasi belum dapat dikirim." });
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  await transporter.sendMail({ from: process.env.SMTP_FROM, to: email, subject: "Reset password Kantong", text: `Buka tautan ini untuk mengganti password: ${resetUrl}\nTautan berlaku 15 menit.` });
  return NextResponse.json({ message: "Instruksi penggantian password telah dikirim ke email." });
}