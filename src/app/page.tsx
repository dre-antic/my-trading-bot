import { redirect } from "next/navigation";
import { getSession } from "@/server/session";

export default async function Home() {
  const session = await getSession();
  if (session.userId) redirect("/terminal");
  redirect("/login");
}
