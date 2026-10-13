import { HuntScreen } from "@/components/HuntScreen";

export const metadata = { title: "Hunting" };

export default async function HuntPage({ params }: { params: Promise<{ dropId: string }> }) {
  const { dropId } = await params;
  return <HuntScreen dropId={dropId} />;
}
