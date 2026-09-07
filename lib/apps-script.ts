export function appsScriptUrl() { return process.env.APPS_SCRIPT_URL; }

export async function appsScriptGet(action: "finance" | "targets" | "users", ownerEmail?: string) {
  const base = appsScriptUrl();
  if (!base) return null;
  try {
    const query = ownerEmail ? `&ownerEmail=${encodeURIComponent(ownerEmail)}` : "";
    const response = await fetch(`${base}?action=${action}${query}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    return data.error ? null : data;
  } catch { return null; }
}

export async function appsScriptPost(body: Record<string, unknown>) {
  const base = appsScriptUrl();
  if (!base) return null;
  try {
    const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok || data.error) {
      console.error("[AppsScriptPost Error]", data?.error || response.statusText);
      return null;
    }
    return data;
  } catch (err) {
    console.error("[AppsScriptPost Fetch Exception]", err);
    return null;
  }
}
