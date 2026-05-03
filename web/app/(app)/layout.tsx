import { requireUser } from "@/lib/auth/session";

// Layout só garante auth — cada página renderiza seu próprio sidebar/topbar
// (mantém fidelidade visual ao protótipo).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
