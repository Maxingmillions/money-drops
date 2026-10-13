import { BountiesScreen } from "@/components/BountiesScreen";

export const metadata = { title: "Active bounties" };

export default function ExploreBountiesPage() {
  return <BountiesScreen isMod={false} guest />;
}
