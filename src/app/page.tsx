import { redirect } from "next/navigation";

// DEV-006F: demoens inngang er innloggingen. En innlogget bruker sendes videre til /searches av /login (ingen sesjonslogikk her).
// Eldre sider (/dashboard, /agents, /opportunities) er uendret og nås via direkte URL.
export default function Home() {
  redirect("/login");
}
