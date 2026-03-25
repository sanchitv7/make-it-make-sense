import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Make It Make Sense",
    short_name: "MIMS",
    description: "Real-time AI fact-checking for live audio",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F5F0E8",
    theme_color: "#8B1A2B",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
