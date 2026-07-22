import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Visa Assistant - Passport OCR & Auto Form Filler" },
      { name: "description", content: "Scan passports with OCR and auto-fill visa forms instantly." },
      { property: "og:title", content: "AI Visa Assistant - Passport OCR & Auto Form Filler" },
      { property: "og:description", content: "Scan passports with OCR and auto-fill visa forms instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/visa-assistant.html"
      title="AI Visa Assistant"
      className="w-screen h-screen border-0 block"
    />
  );
}
