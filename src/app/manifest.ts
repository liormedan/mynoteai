import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "mynoteai",
    short_name: "mynoteai",
    description: "A personal notebook, in Hebrew and English",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Language and direction follow each page; the manifest stays neutral.
    dir: "auto",
    background_color: "#ffffff",
    theme_color: "#18181b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
