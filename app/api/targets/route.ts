import { google } from "googleapis";
import { NextResponse } from "next/server";
import { requireEditor } from "../../../lib/auth";
import { normalizeDate, readPublicSheet } from "../../../lib/public-sheet";
import { appsScriptGet, appsScriptPost } from "../../../lib/apps-script";
import { getSession } from "../../../lib/auth";

export type Target = {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  information: string;
  photoUrl?: string;
  pinned?: boolean;
};

const demoTargets: Target[] = [
  { id: "TG0001", name: "Dana darurat", targetAmount: 5000000, targetDate: "2026-12-31", information: "Cadangan untuk kebutuhan tidak terduga" },
  { id: "TG0002", name: "Adidas Samba", targetAmount: 3200000, targetDate: "2026-09-30", information: "Wishlist pribadi" },
];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !process.env.GOOGLE_SHEET_ID) return null;
  return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

export async function GET() {
  const user = await getSession();
  const scriptData = await appsScriptGet("targets", user?.email);
  if (scriptData) return NextResponse.json({ ...scriptData, demo: false });
  const auth = getAuth();
  if (!auth) {
    try {
      const data = await readPublicSheet("target");
      const headers = data[0]?.map((header) => header.toLowerCase()) ?? [];
      const value = (row: string[], header: string) => row[headers.indexOf(header)] ?? "";
      const targets = data.slice(1).filter((row) => value(row, "id")).map((row) => ({ id: value(row, "id"), name: value(row, "name") || "Tanpa nama", targetDate: normalizeDate(value(row, "date")), targetAmount: Number(value(row, "nominal")) || 0, information: value(row, "information"), photoUrl: value(row, "url_foto"), pinned: value(row, "pinned").toLowerCase() === "true" }));
      return NextResponse.json({ targets: targets.length ? targets : demoTargets, demo: true });
    } catch { return NextResponse.json({ targets: demoTargets, demo: true }); }
  }
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "target!A2:G" });
    const targets = (result.data.values ?? []).filter((row) => row[0]).map((row) => ({ id: row[0], name: row[1] ?? "Tanpa nama", targetDate: row[2] ?? "", targetAmount: Number(row[3]) || 0, information: row[4] ?? "", photoUrl: row[5] ?? "", pinned: String(row[6]).toLowerCase() === "true" }));
    return NextResponse.json({ targets: targets.length ? targets : demoTargets, demo: !targets.length });
  } catch { return NextResponse.json({ targets: demoTargets, demo: true }); }
}

export async function POST(request: Request) {
  let user;
  try { user = await requireEditor(); }
  catch (error) { return NextResponse.json({ message: error instanceof Error && error.message === "FORBIDDEN" ? "Pengguna ini hanya memiliki akses baca." : "Silakan login terlebih dahulu." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }); }
  const body = await request.json() as Omit<Target, "id">;
  const target: Target = { ...body, id: `TG${Date.now().toString().slice(-6)}` };
  const scriptData = await appsScriptPost({ action: "create", type: "target", ...target, ownerEmail: user.email });
  if (scriptData) return NextResponse.json({ target: scriptData.target, demo: false });
  const auth = getAuth();
  if (!auth) return NextResponse.json({ target, demo: true });
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "target!A:G", valueInputOption: "USER_ENTERED", requestBody: { values: [[target.id, target.name, target.targetDate, target.targetAmount, target.information, target.photoUrl ?? "-", target.pinned ? "TRUE" : "FALSE"]] } });
  return NextResponse.json({ target, demo: false });
}

export async function PUT(request: Request) {
  let user;
  try { user = await requireEditor(); } catch (error) { return NextResponse.json({ message: error instanceof Error && error.message === "FORBIDDEN" ? "Akses baca saja." : "Silakan login terlebih dahulu." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }); }
  const body = await request.json() as Target;
  const scriptData = await appsScriptPost({ action: "update", type: "target", ...body, ownerEmail: user.email });
  if (scriptData) return NextResponse.json({ target: scriptData.target, demo: false });
  const auth = getAuth();
  if (!auth) return NextResponse.json({ target: body, demo: true });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, fields: "sheets(properties(sheetId,title))" });
  const sheet = spreadsheet.data.sheets?.find((item) => item.properties?.title === "target");
  const values = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "target!A2:G" });
  const rowIndex = (values.data.values ?? []).findIndex((row) => row[0] === body.id);
  if (rowIndex < 0 || !sheet?.properties?.sheetId) return NextResponse.json({ message: "Target tidak ditemukan." }, { status: 404 });
  await sheets.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `target!A${rowIndex + 2}:G${rowIndex + 2}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[body.id, body.name, body.targetDate, body.targetAmount, body.information, body.photoUrl ?? "-", body.pinned ? "TRUE" : "FALSE"]] } });
  return NextResponse.json({ target: body, demo: false });
}

export async function DELETE(request: Request) {
  try { await requireEditor(); } catch (error) { return NextResponse.json({ message: "Silakan login sebagai editor." }, { status: 401 }); }
  const id = new URL(request.url).searchParams.get("id");
  const scriptData = await appsScriptPost({ action: "delete", type: "target", id });
  if (scriptData) return NextResponse.json({ ...scriptData, demo: false });
  const auth = getAuth();
  if (!auth) return NextResponse.json({ ok: true, id, demo: true });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, fields: "sheets(properties(sheetId,title))" });
  const sheet = spreadsheet.data.sheets?.find((item) => item.properties?.title === "target");
  const values = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "target!A2:A" });
  const rowIndex = (values.data.values ?? []).findIndex((row) => row[0] === id);
  if (rowIndex < 0 || !sheet?.properties?.sheetId) return NextResponse.json({ message: "Target tidak ditemukan." }, { status: 404 });
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: process.env.GOOGLE_SHEET_ID, requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: "ROWS", startIndex: rowIndex + 1, endIndex: rowIndex + 2 } } }] } });
  return NextResponse.json({ ok: true, id, demo: false });
}