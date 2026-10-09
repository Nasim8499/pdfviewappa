import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, UserCheck, Loader2 } from "lucide-react";
import { login, type AppRole } from "../lib/api";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { me } = await import("../lib/api");
    if (await me()) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!role || !code) return;
    setBusy(true);
    setError(false);
    const res = await login({ data: { role, code } });
    setBusy(false);
    if (res.ok) window.location.assign("/");
    else setError(true);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
      <img src="/favicon.ico" alt="" className="mb-4 h-14 w-14 rounded-2xl" />
      <h1 className="text-2xl font-bold">Visa Desk</h1>

      <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
        {(
          [
            { role: "admin" as AppRole, icon: <ShieldCheck className="h-8 w-8" />, label: "Admin" },
            { role: "agent" as AppRole, icon: <UserCheck className="h-8 w-8" />, label: "Agent" },
          ] as const
        ).map(({ role: r, icon, label }) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-6 transition-colors ${
              role === r
                ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                : "border-slate-700 bg-slate-900 text-slate-400"
            }`}
          >
            {icon}
            <span className="text-sm font-bold">{label}</span>
          </button>
        ))}
      </div>

      {role && (
        <div className="mt-4 w-full max-w-sm">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Access code"
            className={`w-full rounded-xl border-2 bg-slate-900 px-4 py-3 text-center text-lg tracking-widest outline-none ${
              error ? "border-rose-500" : "border-slate-700 focus:border-indigo-500"
            }`}
          />
          {error && <p className="mt-2 text-center text-sm text-rose-400">Wrong code — try again</p>}
          <button
            onClick={submit}
            disabled={busy || !code}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-base font-bold text-white disabled:opacity-50"
          >
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            Enter
          </button>
        </div>
      )}
    </div>
  );
}
