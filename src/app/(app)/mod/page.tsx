import { redirect } from "next/navigation";
import { ModScreen } from "@/components/ModScreen";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Review queue" };

export default async function ModPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "MOD" && user.role !== "ADMIN")) redirect("/bounties");
  return <ModScreen />;
}
