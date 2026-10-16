import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { getSessionContext } from "@/server/session";

/** Innloggingsstatus i Merovo-skallet (samme server-handlinger som før; ingen ny autentiseringslogikk). */
export async function MerovoAccount() {
  const ctx = await getSessionContext();
  if (ctx.status === "not_configured") return <span className="text-xs text-muted">Innlogging ikke konfigurert · demomodus</span>;
  if (ctx.status === "anonymous") return <Link href="/login" className="min-h-11 rounded-lg border border-forest px-4 py-2.5 text-sm font-semibold text-forest hover:bg-sand-soft">Logg inn</Link>;
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
      <span>{ctx.user.email ?? "Innlogget"}{ctx.status === "member" ? ` · ${ctx.dealership.name}` : " · ikke knyttet til firma"}</span>
      <form action={signOut}>
        <button type="submit" className="min-h-11 rounded-lg border border-sand px-3 py-2 font-semibold text-forest hover:bg-sand-soft">Logg ut</button>
      </form>
    </div>
  );
}
