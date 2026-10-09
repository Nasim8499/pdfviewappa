import { createFileRoute, redirect } from "@tanstack/react-router";

// Full-screen view of the standalone visa assistant (passport OCR + form filler).
export const Route = createFileRoute("/form")({
  beforeLoad: async () => {
    const { me } = await import("../lib/api");
    if (!(await me())) throw redirect({ to: "/login" });
  },
  component: () => (
    <iframe
      src="/visa-assistant.html"
      title="Visa Form Assistant"
      className="h-screen w-full border-0 block"
    />
  ),
});
