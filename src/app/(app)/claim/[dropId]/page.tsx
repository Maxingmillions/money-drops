import { ClaimScreen } from "@/components/ClaimScreen";

export const metadata = { title: "Claim" };

export default async function ClaimPage({ params }: { params: Promise<{ dropId: string }> }) {
  const { dropId } = await params;
  return <ClaimScreen dropId={dropId} />;
}
