import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Drops",
    short_name: "Drops",
    description: "Money becomes a real-world treasure hunt.",
    start_url: "/home",
    display: "standalone",
    background_color: "#eef1f6",
    theme_color: "#eef1f6",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
