import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Social Channels Publisher",
    short_name: "Publisher",
    description: "Automated multi-channel social media publishing dashboard",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Queues & Calendar",
        short_name: "Queues",
        description: "View scheduled social media queue and calendar",
        url: "/queues",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Content Drafts",
        short_name: "Content",
        description: "Manage content packages and posts",
        url: "/content",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Database Records",
        short_name: "Database",
        description: "Browse SQLite tables and records",
        url: "/database",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
    categories: ["productivity", "social", "utilities"],
  };
}
