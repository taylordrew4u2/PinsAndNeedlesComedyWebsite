"use client";

import { useState } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Wrong password");
      window.location.reload();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Wrong password");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <form onSubmit={submit} className="w-full max-w-sm">
        <p aria-hidden="true" className="mb-3 text-center text-[40px] leading-none">
          🎤
        </p>
        <h1 className="mb-1 text-center text-[22px] font-semibold text-neutral-50">
          Pins &amp; Needles
        </h1>
        <p className="mb-6 text-center text-[15px] text-neutral-400">Type the password to get in.</p>

        <label className="block">
          <span className="sr-only">Password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3.5 text-center text-[18px] tracking-[0.25em] text-neutral-50 outline-none placeholder:tracking-normal placeholder:text-neutral-600 focus:border-white focus:ring-2 focus:ring-white/15"
          />
        </label>

        {error ? <p className="mt-3 text-center text-[14px] text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={busy || !password}
          className="mt-4 min-h-[54px] w-full rounded-xl bg-white text-[16px] font-semibold text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
        >
          {busy ? "Checking…" : "Let me in"}
        </button>
      </form>
    </div>
  );
}
