import { BountiesScreen } from "@/components/BountiesScreen";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Bounties" };

export default async function BountiesPage() {
  const user = await getCurrentUser();
  return <BountiesScreen isMod={user?.role === "MOD" || user?.role === "ADMIN"} />;
}
