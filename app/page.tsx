"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { FinanceRecord } from "./api/finance/route";
import type { Target } from "./api/targets/route";
import type { SessionUser } from "../lib/auth";

const initialRecords: FinanceRecord[] = [
  { id: "ID0001", name: "Gajian", date: "2026-05-01", amount: 1200000, information: "Pemasukan utama", type: "income" },
  { id: "ID0002", name: "Spp", date: "2026-05-03", amount: 500000, information: "Kebutuhan rutin", type: "expense" },
  { id: "ID0003", name: "Nabung masa depan", date: "2026-05-05", amount: 500000, information: "Dana darurat", type: "saving", target: "Dana darurat" },
  { id: "ID0004", name: "Jajan", date: "2026-05-06", amount: 50000, information: "Gaya hidup", type: "expense" },
  { id: "ID0005", name: "Bonus kerja", date: "2026-05-08", amount: 350000, information: "Tambahan", type: "income" },
];
const initialTargets: Target[] = [
  { id: "TG0001", name: "Dana darurat", targetAmount: 5000000, targetDate: "2026-12-31", information: "Cadangan untuk kebutuhan tidak terduga", pinned: true },
  { id: "TG0002", name: "Adidas Samba", targetAmount: 3200000, targetDate: "2026-09-30", information: "Wishlist pribadi", pinned: false },
];

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
const labels = { income: "Pemasukan", expense: "Pengeluaran", saving: "Tabungan" };
const categoryLabels = { food: "Food", transport: "Transport", entertainment: "Entertainment", shopping: "Shopping", others: "Others" } as const;
const categories = Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>;

function getCountdown(targetDate: string, percentage: number) {
  if (percentage >= 100) return "Target tercapai";
  const days = Math.ceil((new Date(`${targetDate}T23:59:59`).getTime() - Date.now()) / 86400000);
  if (days < 0) return `Terlambat ${Math.abs(days)} hari`;
  if (days === 0) return "Jatuh tempo hari ini";
  return `${days} hari lagi`;
}

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "", nickname: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [signupForm, setSignupForm] = useState({ email: "", password: "", nickname: "" });
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [emailConflict, setEmailConflict] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [records, setRecords] = useState<FinanceRecord[]>(initialRecords);
  const [targets, setTargets] = useState<Target[]>(initialTargets);
  const [activeFilter, setActiveFilter] = useState<"all" | FinanceRecord["type"]>("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [activeView, setActiveView] = useState<"overview" | "activity">("overview");
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [chartCategory, setChartCategory] = useState<"all" | FinanceRecord["category"]>("all");
  const [showForm, setShowForm] = useState(false);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [form, setForm] = useState({ name: "", amount: "", date: "2026-05-12", information: "", type: "expense" as FinanceRecord["type"], target: "", category: "others" as FinanceRecord["category"] });
  const [targetForm, setTargetForm] = useState({ name: "", targetAmount: "", targetDate: "2026-12-31", information: "", photoUrl: "" });

  useEffect(() => { fetch("/api/auth").then((response) => response.json()).then((data) => { setUser(data.user); setAuthChecked(true); }).catch(() => setAuthChecked(true)); }, []);
  useEffect(() => { setDarkMode(localStorage.getItem("kantong-theme") === "dark"); }, []);
  useEffect(() => { document.documentElement.dataset.theme = darkMode ? "dark" : "light"; localStorage.setItem("kantong-theme", darkMode ? "dark" : "light"); }, [darkMode]);
  useEffect(() => { if (!user) return; Promise.all([fetch("/api/finance"), fetch("/api/targets")]).then(async ([recordsResponse, targetsResponse]) => { const recordsData = await recordsResponse.json(); const targetsData = await targetsResponse.json(); setRecords(recordsData.records); setTargets(targetsData.targets); setIsDemo(recordsData.demo || targetsData.demo); }).catch(() => undefined); }, [user]);

  const totals = useMemo(() => ({
    income: records.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0),
    expense: records.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0),
    saving: records.filter((item) => item.type === "saving").reduce((sum, item) => sum + item.amount, 0),
  }), [records]);
  const balance = totals.income - totals.expense - totals.saving;
  const targetProgress = targets.map((target) => {
    const saved = records.filter((item) => item.target === target.id || item.target === target.name).reduce((sum, item) => sum + (item.type === "income" ? item.amount : item.type === "saving" ? item.amount : -item.amount), 0);
    return { ...target, saved: Math.max(0, saved), percentage: Math.min(100, Math.round((Math.max(0, saved) / target.targetAmount) * 100)) };
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const visibleRecords = records.filter((item) => (activeFilter === "all" || item.type === activeFilter) && (targetFilter === "all" || targets.some((target) => target.id === targetFilter && (item.target === target.id || item.target === target.name)))).sort((a, b) => b.date.localeCompare(a.date));
  const chartRecords = records.filter((item) => item.type === "expense" && (chartCategory === "all" || (item.category ?? "others") === chartCategory));
  const monthlyExpenses = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() - (5 - index), 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    const monthRecords = chartRecords.filter((item) => item.date.startsWith(monthKey));
    const categoryTotals = categories.reduce((result, category) => ({ ...result, [category]: monthRecords.filter((item) => (item.category ?? "others") === category).reduce((sum, item) => sum + item.amount, 0) }), {} as Record<keyof typeof categoryLabels, number>);
    return { key: monthKey, label: monthDate.toLocaleDateString("id-ID", { month: "short" }), total: monthRecords.reduce((sum, item) => sum + item.amount, 0), categoryTotals };
  });
  const maxMonthlyExpense = Math.max(...monthlyExpenses.map((item) => item.total), 1);

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/finance", { method: editingRecord ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, ...(editingRecord ? { id: editingRecord.id } : {}), amount: Number(form.amount) }) });
    const data = await response.json();
    setRecords((current) => editingRecord ? current.map((item) => item.id === data.record.id ? data.record : item) : [data.record, ...current]);
    setForm({ name: "", amount: "", date: "2026-05-12", information: "", type: "expense", target: "", category: "others" });
    setShowForm(false);
    setEditingRecord(null);
  }

  async function addTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/targets", { method: editingTarget ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...targetForm, ...(editingTarget ? { id: editingTarget.id } : {}), targetAmount: Number(targetForm.targetAmount) }) });
    const data = await response.json();
    setTargets((current) => editingTarget ? current.map((item) => item.id === data.target.id ? data.target : item) : [data.target, ...current]);
    setTargetForm({ name: "", targetAmount: "", targetDate: "2026-12-31", information: "", photoUrl: "" });
    setShowTargetForm(false);
    setEditingTarget(null);
  }

  async function deleteRecord(id: string) {
    if (!window.confirm("Hapus transaksi ini?")) return;
    const response = await fetch(`/api/finance?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) setRecords((current) => current.filter((item) => item.id !== id));
  }

  async function deleteTarget(id: string) {
    if (!window.confirm("Hapus target ini?")) return;
    const response = await fetch(`/api/targets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) setTargets((current) => current.filter((item) => item.id !== id));
  }

  async function togglePinned(target: Target) {
    const updated = { ...target, pinned: !target.pinned };
    const response = await fetch("/api/targets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
    if (response.ok) setTargets((current) => current.map((item) => item.id === target.id ? updated : item));
  }

  function editRecord(record: FinanceRecord) { setEditingRecord(record); setForm({ name: record.name, amount: String(record.amount), date: record.date, information: record.information, type: record.type, target: record.target ?? "", category: record.category ?? "others" }); setShowForm(true); }
  function editTarget(target: Target) { setEditingTarget(target); setTargetForm({ name: target.name, targetAmount: String(target.targetAmount), targetDate: target.targetDate, information: target.information, photoUrl: target.photoUrl ?? "" }); setShowTargetForm(true); }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setAuthLoading(true);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(loginForm) });
      const data = await response.json();
      if (!response.ok) { setLoginError(data.message ?? "Login gagal."); setAuthLoading(false); return; }
      setUser(data.user);
    } catch {
      setLoginError("Gagal menghubungi server.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function executeSignup(overwrite = false) {
    setSignupError("");
    setAuthLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...signupForm, overwrite }),
      });
      const data = await response.json();
      if (response.status === 409 || data.emailExists) {
        setEmailConflict(signupForm.email);
        setAuthLoading(false);
        return;
      }
      if (!response.ok) {
        setSignupError(data.message ?? "Pendaftaran gagal.");
        setAuthLoading(false);
        return;
      }
      setUser(data.user);
      setEmailConflict(null);
      setSignupForm({ email: "", password: "", nickname: "" });
    } catch {
      setSignupError("Gagal menghubungi server.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    executeSignup(false);
  }

  function handleUseOldAccount() {
    setLoginForm((prev) => ({ ...prev, email: signupForm.email }));
    setEmailConflict(null);
    setSignupError("");
    setAuthMode("login");
  }

  function handleForceNewAccount() {
    executeSignup(true);
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: forgotEmail }) });
    const data = await response.json();
    setForgotMessage(data.message);
  }

  async function logout() {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // Abaikan error jaringan saat logout
    }
    setUser(null);
    setShowSettings(false);
  }

  if (!authChecked) return <main className="auth-shell"><div className="auth-card"><span className="brand-mark">K</span><p className="kicker">KANTONG</p><h1>Menyiapkan ruang uangmu</h1></div></main>;
  if (!user && forgotMode) return <main className="auth-shell"><form className="auth-card" onSubmit={requestReset}><span className="brand-mark">K</span><p className="kicker">AKSES AKUN</p><h1>Lupa password?</h1><p className="auth-copy">Masukkan email akunmu. Kami akan mengirimkan tautan untuk mengganti password.</p><label>Email pengguna<input required type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="nama@email.com" /></label>{forgotMessage && <p className="auth-success">{forgotMessage}</p>}<button className="primary-button full" type="submit">Kirim instruksi</button><button type="button" className="back-button" onClick={() => { setForgotMode(false); setForgotMessage(""); }}>← Kembali ke login</button></form></main>;
  if (!user) return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-header">
          <span className="brand-mark">K</span>
          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === "login" ? "auth-tab active" : "auth-tab"}
              onClick={() => { setAuthMode("login"); setLoginError(""); setSignupError(""); setEmailConflict(null); }}
            >
              Masuk
            </button>
            <button
              type="button"
              className={authMode === "signup" ? "auth-tab active" : "auth-tab"}
              onClick={() => { setAuthMode("signup"); setLoginError(""); setSignupError(""); setEmailConflict(null); }}
            >
              Daftar Akun
            </button>
          </div>
        </div>

        {authMode === "login" ? (
          <form onSubmit={login}>
            <p className="kicker">RUANG KEUANGAN PRIBADI</p>
            <h1>Masuk ke Kantong</h1>
            <p className="auth-copy">Catat pemasukan, atur target, dan jaga langkahmu tetap terarah.</p>
            <label>
              Email pengguna
              <input
                required
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                placeholder="nama@email.com"
              />
            </label>
            <label>
              Password aplikasi
              <div className="password-field">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={loginForm.password}
                  onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                  placeholder="Masukkan password"
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? "Sembunyikan" : "Lihat"}
                </button>
              </div>
            </label>
            <label>
              Nama panggilan
              <input
                required
                value={loginForm.nickname}
                onChange={(event) => setLoginForm({ ...loginForm, nickname: event.target.value })}
                placeholder="Contoh: Andi"
              />
            </label>
            {loginError && <p className="auth-error">{loginError}</p>}
            <button className="primary-button full" type="submit" disabled={authLoading}>
              {authLoading ? "Memproses..." : "Masuk"}
            </button>
            <div className="auth-footer-links">
              <button type="button" className="forgot-button" onClick={() => setForgotMode(true)}>
                Lupa password?
              </button>
              <button
                type="button"
                className="switch-mode-button"
                onClick={() => { setAuthMode("signup"); setLoginError(""); }}
              >
                Belum punya akun? <strong>Daftar di sini</strong>
              </button>
            </div>
            <small className="demo-hint">Demo: demo@kantong.app · kantong123 · Andi</small>
          </form>
        ) : (
          <form onSubmit={signup}>
            <p className="kicker">PENDAFTARAN PENGGUNA</p>
            <h1>Buat Akun Kantong</h1>
            <p className="auth-copy">Daftar untuk mulai mencatat keuangan dan mewujudkan target masa depanmu.</p>
            <label>
              Email pengguna
              <input
                required
                type="email"
                value={signupForm.email}
                onChange={(event) => setSignupForm({ ...signupForm, email: event.target.value })}
                placeholder="nama@email.com"
              />
            </label>
            <label>
              Password aplikasi
              <div className="password-field">
                <input
                  required
                  minLength={6}
                  type={showSignupPassword ? "text" : "password"}
                  value={signupForm.password}
                  onChange={(event) => setSignupForm({ ...signupForm, password: event.target.value })}
                  placeholder="Minimal 6 karakter"
                />
                <button type="button" className="password-toggle" onClick={() => setShowSignupPassword((current) => !current)}>
                  {showSignupPassword ? "Sembunyikan" : "Lihat"}
                </button>
              </div>
            </label>
            <label>
              Nama panggilan
              <input
                required
                minLength={2}
                value={signupForm.nickname}
                onChange={(event) => setSignupForm({ ...signupForm, nickname: event.target.value })}
                placeholder="Contoh: Budi"
              />
            </label>
            {emailConflict && (
              <div className="email-conflict-banner">
                <div className="conflict-badge">⚠️ Email Sudah Terdaftar</div>
                <p className="conflict-text">
                  Akun dengan email <strong>{emailConflict}</strong> sudah terdaftar di sistem. Kamu dapat tetap membuat akun baru (memperbarui data akun) atau masuk memakai akun lama.
                </p>
                <div className="conflict-actions">
                  <button
                    type="button"
                    className="conflict-btn primary"
                    onClick={handleForceNewAccount}
                    disabled={authLoading}
                  >
                    {authLoading ? "Menyimpan..." : "Tetap Buat Akun Baru"}
                  </button>
                  <button
                    type="button"
                    className="conflict-btn secondary"
                    onClick={handleUseOldAccount}
                    disabled={authLoading}
                  >
                    Pakai Akun Lama
                  </button>
                </div>
              </div>
            )}
            {signupError && <p className="auth-error">{signupError}</p>}
            <button className="primary-button full" type="submit" disabled={authLoading}>
              {authLoading ? "Mendaftarkan..." : "Daftar Akun"}
            </button>
            <div className="auth-footer-links">
              <button
                type="button"
                className="switch-mode-button"
                onClick={() => { setAuthMode("login"); setSignupError(""); setEmailConflict(null); }}
              >
                Sudah punya akun? <strong>Masuk di sini</strong>
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">K</span><span>Kantong</span></div>
      <nav><button className={activeView === "overview" && !showSettings ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("overview"); setShowSettings(false); }}><span>⌂</span> Ikhtisar</button><button className={activeView === "activity" && !showSettings ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("activity"); setShowSettings(false); }}><span>↕</span> Aktivitas</button><button className="nav-item" onClick={() => user.canEdit && setShowTargetForm(true)}><span>◷</span> Target</button><button className={showSettings ? "nav-item active" : "nav-item"} onClick={() => setShowSettings(true)}><span>⚙</span> Settings</button></nav>
      <div className="sidebar-bottom"><div className="mini-target"><span className="eyebrow">TARGET BULAN INI</span><strong>{money.format(totals.saving)}</strong><div className="progress"><i style={{ width: "62%" }} /></div><small>62% dari target tabungan</small></div><div className="profile"><div className="avatar">{user.nickname.slice(0, 2).toUpperCase()}</div><div className="profile-info"><strong>{user.nickname}</strong><small>{user.canEdit ? "Editor" : "Akses baca"}</small></div><button className="logout-button" onClick={logout} title="Keluar dari akun"><span>↪</span> Keluar</button></div></div>
    </aside>
    <div className="content">
      {showSettings ? <section className="settings-page"><div className="settings-heading"><p className="kicker">PREFERENSI</p><h1>Settings</h1><p className="subheading">Atur pengalaman Kantong sesuai kebutuhanmu.</p></div><div className="settings-grid"><article className="settings-card"><div><p className="kicker">TAMPILAN</p><h2>Mode aplikasi</h2><p>Gunakan tampilan yang nyaman untuk siang atau malam.</p></div><button className={darkMode ? "theme-toggle dark" : "theme-toggle"} onClick={() => setDarkMode((current) => !current)}><span>{darkMode ? "☾" : "☀"}</span>{darkMode ? "Mode gelap" : "Mode terang"}<i /></button></article><article className="settings-card"><div><p className="kicker">AKUN AKTIF</p><h2>{user.nickname}</h2><p>{user.email}</p></div><span className="permission-badge">{user.canEdit ? "Editor" : "Akses baca"}</span></article><article className="settings-card"><div><p className="kicker">PENYIMPANAN DATA</p><h2>Google Sheets</h2><p>{isDemo ? "Mode demo aktif" : "Terhubung dan tersinkronisasi"}</p></div><span className={isDemo ? "connection-status demo" : "connection-status"}>● {isDemo ? "Belum terhubung" : "Terhubung"}</span></article></div><button className="settings-logout" onClick={logout}>↪ Keluar dari akun</button></section> : <>
      <header className="topbar">
        <div>
          <p className="kicker">SELASA, 12 MEI 2026</p>
          <h1>Selamat datang, {user.nickname}.</h1>
          <p className="subheading">Mari lihat bagaimana kabar uangmu hari ini.</p>
        </div>
        <div className="topbar-actions">
          {user.canEdit && <button className="primary-button" onClick={() => { setEditingRecord(null); setShowForm(true); }}><span>＋</span> Catat transaksi</button>}
          <div className="topbar-user">
            <span className="topbar-avatar">{user.nickname.slice(0, 2).toUpperCase()}</span>
            <span className="topbar-name">{user.nickname}</span>
            <button className="topbar-logout" onClick={logout} title="Keluar dari akun"><span>↪</span> Keluar</button>
          </div>
        </div>
      </header>
      {isDemo && <div className="notice"><span>●</span> Mode contoh aktif. Hubungkan Google Sheets untuk menyimpan data secara langsung.</div>}
      <div className="summary-grid"><article className="balance-card"><div className="card-top"><span className="eyebrow">SALDO TERSEDIA</span><span className="trend">↗ 12,8%</span></div><strong className="balance">{money.format(balance)}</strong><p>Naik dari bulan lalu</p><div className="sparkline"><i /><i /><i /><i /><i /><i /><i /><i /></div></article><article className="stat-card"><span className="icon green">↗</span><span className="eyebrow">PEMASUKAN</span><strong>{money.format(totals.income)}</strong><small>Bulan ini</small></article><article className="stat-card"><span className="icon coral">↘</span><span className="eyebrow">PENGELUARAN</span><strong>{money.format(totals.expense)}</strong><small>Bulan ini</small></article><article className="stat-card"><span className="icon yellow">◎</span><span className="eyebrow">DITABUNG</span><strong>{money.format(totals.saving)}</strong><small>Bulan ini</small></article></div>
      <div className="section-heading"><div><p className="kicker">RINGKASAN</p><h2>Aktivitas terbaru</h2></div><div className="filters">{[["all", "Semua"], ["income", "Masuk"], ["expense", "Keluar"], ["saving", "Tabungan"]].map(([value, label]) => <button key={value} className={activeFilter === value ? "filter active" : "filter"} onClick={() => setActiveFilter(value as typeof activeFilter)}>{label}</button>)}<select className="filter target-filter" value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)}><option value="all">Semua target</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></div></div>
      <div className="activity-list">{visibleRecords.map((item, index) => <div className="activity" key={`${item.type}-${item.id}-${index}`}><div className={`activity-icon ${item.type}`}>{item.type === "income" ? "↗" : item.type === "expense" ? "↘" : "◎"}</div><div className="activity-main"><strong>{item.name}</strong><span>{item.information || labels[item.type]} {item.category ? `· ${categoryLabels[item.category]}` : ""} {item.target ? `· ${targets.find((target) => target.id === item.target)?.name || item.target}` : ""}</span></div><time>{date.format(new Date(item.date))}</time><strong className={item.type === "income" ? "amount income-text" : "amount"}>{item.type === "income" ? "+" : "−"}{money.format(item.amount)}</strong>{user.canEdit && <div className="row-actions"><button onClick={() => editRecord(item)} title="Edit transaksi">Edit</button><button onClick={() => deleteRecord(item.id)} title="Hapus transaksi">Hapus</button></div>}</div>)}</div>
      <section className={activeView === "activity" ? "expense-chart" : "expense-chart hidden-chart"}><div className="chart-heading"><div><p className="kicker">ANALISIS PENGELUARAN</p><h2>Pengeluaran per bulan</h2></div><select className="chart-select" value={chartCategory} onChange={(event) => setChartCategory(event.target.value as typeof chartCategory)}><option value="all">Semua kategori</option>{categories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></div><div className="chart-bars">{monthlyExpenses.map((month) => <div className="bar-column" key={month.key}><span className="bar-value">{month.total ? money.format(month.total) : "-"}</span><div className="bar-track">{categories.map((category) => <i key={category} className={category} style={{ height: `${(month.categoryTotals[category] / maxMonthlyExpense) * 100}%`, display: chartCategory === "all" || chartCategory === category ? "block" : "none" }} />)}</div><small>{month.label}</small></div>)}</div><div className="chart-legend">{categories.map((category) => <span key={category}><i className={`legend-dot ${category}`} />{categoryLabels[category]}</span>)}</div></section>
      <div className="lower-grid"><section><div className="section-heading compact"><div><p className="kicker">PROGRES TARGET</p><h2>Rencana yang berjalan</h2></div>{user.canEdit && <button className="text-button" onClick={() => { setEditingTarget(null); setShowTargetForm(true); }}>＋ Buat target</button>}</div><div className="goal-list">{targetProgress.map((target) => <div className="goal" key={target.id}>{target.photoUrl ? <img className="target-photo" src={target.photoUrl} alt={`Gambar ${target.name}`} /> : <div className="goal-icon">⌂</div>}<div className="goal-copy"><strong>{target.name}</strong><span>{money.format(target.saved)} dari {money.format(target.targetAmount)} · Tenggat {date.format(new Date(target.targetDate))}</span><small>{target.information} · {getCountdown(target.targetDate, target.percentage)}</small><div className="progress"><i style={{ width: `${target.percentage}%` }} /></div></div><b>{target.percentage}%</b>{user.canEdit && <div className="target-actions"><button onClick={() => togglePinned(target)} title="Sematkan target">{target.pinned ? "★" : "☆"}</button><button onClick={() => editTarget(target)}>Edit</button><button onClick={() => deleteTarget(target.id)}>Hapus</button></div>}</div>)}</div></section><section className="quote"><span>“</span><p>Uang yang direncanakan hari ini memberi ruang untuk hidup yang kamu mau besok.</p></section></div>
    </>}
    </div>
    {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}><form className="modal" onSubmit={addRecord} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="kicker">CATAT BARU</p><h2>Tambah transaksi</h2></div><button type="button" className="close" onClick={() => setShowForm(false)}>×</button></div><label>Jenis transaksi<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as FinanceRecord["type"] })}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option><option value="saving">Tabungan</option></select></label>{form.type === "expense" && <label>Kategori pengeluaran<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as FinanceRecord["category"] })}>{categories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label>}<label>Nama transaksi<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contoh: Belanja mingguan" /></label><div className="form-row"><label>Nominal<input required min="1" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0" /></label><label>Tanggal<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label></div><label>Afiliasi target {form.type === "saving" ? "(wajib)" : "(opsional)"}<select required={form.type === "saving"} value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })}><option value="">Tanpa target</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label><label>Catatan (opsional)<input value={form.information} onChange={(event) => setForm({ ...form, information: event.target.value })} placeholder="Tambahkan keterangan" /></label><button className="primary-button full" type="submit">Simpan transaksi</button></form></div>}
    {showTargetForm && <div className="modal-backdrop" onClick={() => setShowTargetForm(false)}><form className="modal" onSubmit={addTarget} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="kicker">TARGET BARU</p><h2>Barang yang ingin dibeli</h2></div><button type="button" className="close" onClick={() => setShowTargetForm(false)}>×</button></div><label>Nama barang<input required value={targetForm.name} onChange={(event) => setTargetForm({ ...targetForm, name: event.target.value })} placeholder="Contoh: Laptop kerja" /></label><div className="form-row"><label>Nominal target<input required min="1" type="number" value={targetForm.targetAmount} onChange={(event) => setTargetForm({ ...targetForm, targetAmount: event.target.value })} placeholder="0" /></label><label>Batas waktu<input required type="date" value={targetForm.targetDate} onChange={(event) => setTargetForm({ ...targetForm, targetDate: event.target.value })} /></label></div><label>Gambar barang (opsional)<input type="url" value={targetForm.photoUrl} onChange={(event) => setTargetForm({ ...targetForm, photoUrl: event.target.value })} placeholder="https://contoh.com/gambar-barang.jpg" /></label>{targetForm.photoUrl && <img className="form-preview" src={targetForm.photoUrl} alt="Preview barang target" />}<label>Keterangan target<input value={targetForm.information} onChange={(event) => setTargetForm({ ...targetForm, information: event.target.value })} placeholder="Mengapa barang ini penting?" /></label><button className="primary-button full" type="submit">Buat target</button></form></div>}
  </main>;
}
