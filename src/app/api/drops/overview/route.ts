import { handler, json } from "@/lib/api";
import { campaignOverview } from "@/lib/drops";

export const GET = handler(async () => json({ campaigns: await campaignOverview() }));
