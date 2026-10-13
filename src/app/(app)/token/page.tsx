import { DropsTokenCard, DropsTokenChart } from "@/components/DropsToken";

export const metadata = { title: "$DROPS" };

export default function TokenPage() {
  return (
    <main className="page px-5 pt-6 pb-32 lg:pb-10">
      <h1 className="mb-4 text-2xl font-bold">$DROPS</h1>
      <div className="mb-4">
        <DropsTokenCard external />
      </div>
      <DropsTokenChart />
    </main>
  );
}
