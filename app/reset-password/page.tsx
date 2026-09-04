"use client";

import { FormEvent, useEffect, useState } from "react";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token") || ""); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) { setMessage("Konfirmasi password belum sama."); return; }
    const response = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    const data = await response.json();
    setMessage(data.message);
  }
  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}><span className="brand-mark">K</span><p className="kicker">KEAMANAN AKUN</p><h1>Ganti password</h1><p className="auth-copy">Buat password baru minimal 8 karakter.</p><label>Password baru<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password baru" /></label><label>Ulangi password<input required minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Ulangi password" /></label>{message && <p className={message.includes("berhasil") ? "auth-success" : "auth-error"}>{message}</p>}<button className="primary-button full" type="submit">Simpan password</button></form></main>;
}