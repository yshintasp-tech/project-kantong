import { google } from "googleapis";
import { NextResponse } from "next/server";
import { requireEditor } from "../../../lib/auth";
import { normalizeCategory, normalizeDate, readPublicSheet } from "../../../lib/public-sheet";
import { appsScriptGet, appsScriptPost } from "../../../lib/apps-script";
import { getSession } from "../../../lib/auth";

export type FinanceRecord = {
  id: string;
  name: string;
  date: string;
  amount: number;
  information: string;
  photoUrl?: string;
  type: "income" | "expense" | "saving";
  target?: string;
  category?: "food" | "transport" | "entertainment" | "shopping" | "others";
};

const sheetNames = { income: "pemasukan", expense: "pengeluaran", saving: "tabungan", target: "target" } as const;
const demo: FinanceRecord[] = [
  { id: "ID0001", name: "Gajian", date: "2026-05-01", amount: 1200000, information: "Pemasukan utama", type: "income" },
  { id: "ID0002", name: "Spp", date: "2026-05-03", amount: 500000, information: "Kebutuhan rutin", type: "expense" },
  { id: "ID0003", name: "Nabung masa depan", date: "2026-05-05", amount: 500000, information: "Dana darurat", type: "saving", target: "Dana darurat" },
  { id: "ID0004", name: "Jajan", date: "2026-05-06", amount: 50000, information: "Gaya hidup", type: "expense" },
  { id: "ID0005", name: "Bonus kerja", date: "2026-05-08", amount: 350000, information: "Tambahan", type: "income" },
];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !process.env.GOOGLE_SHEET_ID) return null;
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

async function readRows(): Promise<FinanceRecord[]> {
  const auth = getAuth();
  if (!auth) {
    const rows: FinanceRecord[] = [];
    for (const [type, sheet] of Object.entries(sheetNames)) {
      if (type === "target") continue;
      const data = await readPublicSheet(sheet);
      const headers = data[0]?.map((header) => header.toLowerCase()) ?? [];
      const value = (row: string[], header: string) => row[headers.indexOf(header)] ?? "";
      rows.push(...data.slice(1).filter((row) => value(row, "id") && value(row, "date") && Number(value(row, "nominal")) > 0).map((row) => ({ id: value(row, "id"), name: value(row, "name") || "Tanpa nama", date: normalizeDate(value(row, "date")), amount: Number(value(row, "nominal")), information: value(row, "information"), photoUrl: value(row, "url_foto"), type: type as FinanceRecord["type"], target: value(row, "target"), category: normalizeCategory(value(row, "category")) as FinanceRecord["category"] })));
    }
    return rows.length ? rows : demo;
  }
  const sheets = google.sheets({ version: "v4", auth });
  const rows: FinanceRecord[] = [];
  for (const [type, sheet] of Object.entries(sheetNames)) {
    if (type === "target") continue;
      const result = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${sheet}!A2:I` });
    for (const row of result.data.values ?? []) {
      if (!row[0]) continue;
        rows.push({ id: row[0], name: row[1] ?? "Tanpa nama", date: row[2] ?? "", amount: Number(row[3]) || 0, information: row[4] ?? "", photoUrl: row[5] ?? "", type: type as FinanceRecord["type"], target: row[6] ?? "", category: row[8] as FinanceRecord["category"] || "others" });
    }
  }
  return rows.length ? rows : demo;
}

export async function GET() {
  try { const user = await getSession(); const scriptData = await appsScriptGet("finance", user?.email); if (scriptData) return NextResponse.json({ ...scriptData, demo: false }); return NextResponse.json({ records: await readRows(), demo: !getAuth() }); }
  catch { return NextResponse.json({ records: demo, demo: true }, { status: 200 }); }
}

export async function POST(request: Request) {
  let user;
  try { user = await requireEditor(); }
  catch (error) { return NextResponse.json({ message: error instanceof Error && error.message === "FORBIDDEN" ? "Pengguna ini hanya memiliki akses baca." : "Silakan login terlebih dahulu." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }); }
  const body = await request.json() as Omit<FinanceRecord, "id">;
  const record: FinanceRecord = { ...body, id: `ID${Date.now().toString().slice(-6)}` };
  const scriptData = await appsScriptPost({ action: "create", ...record, ownerEmail: user.email });
  if (scriptData) return NextResponse.json({ record: scriptData.record, demo: false });
  const auth = getAuth();
  if (!auth) return NextResponse.json({ record, demo: true });
  const sheet = sheetNames[record.type];
  const sheets = google.sheets({ version: "v4", auth });
    await sheets.spreadsheets.values.append({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${sheet}!A:I`, valueInputOption: "USER_ENTERED", requestBody: { values: [[record.id, record.name, record.date, record.amount, record.information, record.photoUrl ?? "-", record.target ?? "", user.email, record.category ?? "others"]] } });
  return NextResponse.json({ record, demo: false });
}

export async function PUT(request: Request) {
  let user;
  try { user = await requireEditor(); } catch { return NextResponse.json({ message: "Silakan login sebagai editor." }, { status: 401 }); }
  const body = await request.json() as FinanceRecord;
  const scriptData = await appsScriptPost({ action: "update", ...body, ownerEmail: user.email });
  if (scriptData) return NextResponse.json({ record: scriptData.record, demo: false });
  const auth = getAuth();
  if (!auth) return NextResponse.json({ record: body, demo: true });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, fields: "sheets(properties(sheetId,title))" });
  const sheetName = sheetNames[body.type];
  const sheet = spreadsheet.data.sheets?.find((item) => item.properties?.title === sheetName);
  const values = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${sheetName}!A2:I` });
  const rowIndex = (values.data.values ?? []).findIndex((row) => row[0] === body.id);
  if (rowIndex < 0 || !sheet?.properties?.sheetId) return NextResponse.json({ message: "Transaksi tidak ditemukan." }, { status: 404 });
  await sheets.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${sheetName}!A${rowIndex + 2}:I${rowIndex + 2}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[body.id, body.name, body.date, body.amount, body.information, body.photoUrl ?? "-", body.target ?? "", user.email, body.category ?? "others"]] } });
  return NextResponse.json({ record: body, demo: false });
}

export async function DELETE(request: Request) {
  try { await requireEditor(); } catch { return NextResponse.json({ message: "Silakan login sebagai editor." }, { status: 401 }); }
  const id = new URL(request.url).searchParams.get("id");
  const scriptData = await appsScriptPost({ action: "delete", id });
  if (scriptData) return NextResponse.json({ ...scriptData, demo: false });
  const auth = getAuth();
  if (!auth) return NextResponse.json({ ok: true, id, demo: true });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, fields: "sheets(properties(sheetId,title))" });
  for (const [type, sheetName] of Object.entries(sheetNames)) {
    if (type === "target") continue;
    const sheet = spreadsheet.data.sheets?.find((item) => item.properties?.title === sheetName);
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${sheetName}!A2:A` });
    const rowIndex = (values.data.values ?? []).findIndex((row) => row[0] === id);
    if (rowIndex >= 0 && sheet?.properties?.sheetId) { await sheets.spreadsheets.batchUpdate({ spreadsheetId: process.env.GOOGLE_SHEET_ID, requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: "ROWS", startIndex: rowIndex + 1, endIndex: rowIndex + 2 } } }] } }); return NextResponse.json({ ok: true, id, demo: false }); }
  }
  return NextResponse.json({ message: "Transaksi tidak ditemukan." }, { status: 404 });
}
