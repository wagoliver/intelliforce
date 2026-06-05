import { redirect } from "next/navigation";

// Raiz redireciona pro Centro de Comando; o middleware manda pro /login se não houver sessão.
export default function RootPage() {
  redirect("/command");
}
