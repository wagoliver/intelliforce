import { redirect } from "next/navigation";

// Raiz redireciona pra área autenticada; o middleware manda pro /login se não houver sessão.
export default function RootPage() {
  redirect("/dashboard");
}
