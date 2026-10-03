import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Fant ikke siden</h1>
      <p className="text-sm text-slate-600">Annonsen eller siden finnes ikke i demodataene.</p>
      <Link href="/dashboard" className="text-sm underline">Til dashboard</Link>
    </div>
  );
}
