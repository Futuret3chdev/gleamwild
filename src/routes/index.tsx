import { createFileRoute } from "@tanstack/react-router";
import { Gleamwild } from "@/components/gleamwild";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Gleamwild />;
}
