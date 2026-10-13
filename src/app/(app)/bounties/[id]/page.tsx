import { BountyScreen } from "@/components/BountyScreen";
export const metadata = { title: "Bounty" };
export default async function BountyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BountyScreen id={id} />;
}
