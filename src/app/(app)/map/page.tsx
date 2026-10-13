import { Suspense } from "react";
import { MapScreen } from "@/components/MapScreen";

export const metadata = { title: "Hunt" };

export default function MapPage() {
  return (
    <Suspense>
      <MapScreen />
    </Suspense>
  );
}
