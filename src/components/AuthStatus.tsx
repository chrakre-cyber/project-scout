import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { getSessionContext } from "@/server/session";

export async function AuthStatus() {
  const ctx = await getSessionContext();
  if (ctx.status === "not_configured") {
    return <span className="text-xs text-slate-500">Innlogging ikke konfigurert · demomodus</span>;
  }
  if (ctx.status === "anonymous") {
    return <Link href="/login" className="text-sm font-medium text-slate-700 hover:underline">Logg inn</Link>;
  }
  return (
    <div className="flex items-center gap-3 text-xs text-slate-600">
      <span>
        {ctx.user.email ?? "Innlogget"}
        {ctx.status === "member" ? ` · ${ctx.dealership.name}` : " · ikke knyttet til firma"}
      </span>
      <form action={signOut}>
        <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100">Logg ut</button>
      </form>
    </div>
  );
}
