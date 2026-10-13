import { createFileRoute } from "@tanstack/react-router";
import { LumenfallApp } from "@/components/lumenfall";

export const Route = createFileRoute("/lumenfall")({
  component: LumenfallPage,
  head: () => ({
    meta: [
      { title: "Lumenfall" },
      {
        name: "description",
        content: "Weave a glass courier through a falling nave. Dash, graze, and spend the nova.",
      },
    ],
  }),
});

function LumenfallPage() {
  return <LumenfallApp />;
}