import { Suspense } from "react";
import { MapScreen } from "@/components/MapScreen";

export default function ExploreMapPage() {
  return (
    <Suspense>
      <MapScreen guest />
    </Suspense>
  );
}
