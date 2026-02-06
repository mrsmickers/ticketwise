import { Pod } from "@/components/pod";

interface PageProps {
  searchParams: Promise<{ id?: string; screen?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const ticketId = params.id ? parseInt(params.id, 10) : undefined;
  const screen = params.screen || undefined;

  // Always render Pod - it will get ticket ID from postMessage if not in URL
  return (
    <main className="h-screen">
      <Pod ticketId={ticketId} screen={screen} />
    </main>
  );
}
