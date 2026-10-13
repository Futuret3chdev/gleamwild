import { createFileRoute } from "@tanstack/react-router";
import { LumenfallApp } from "@/components/lumenfall";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LumenfallApp />;
}
