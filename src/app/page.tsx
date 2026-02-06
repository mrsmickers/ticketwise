import { Pod } from "@/components/pod";

interface PageProps {
  searchParams: Promise<{ id?: string; screen?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const ticketId = params.id ? parseInt(params.id, 10) : 0;
  const screen = params.screen || "ticket";

  // Validate ticket ID
  if (!ticketId || isNaN(ticketId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Invalid Ticket</h1>
          <p className="text-gray-600 text-sm">
            Please open this pod from within a ConnectWise ticket.
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Expected URL format: ?id=[cw_id]&amp;screen=[cw_screen]
          </p>
          <div className="mt-4 p-2 bg-gray-100 rounded text-left text-xs text-gray-600 font-mono break-all">
            <p><strong>Received params:</strong></p>
            <pre>{JSON.stringify(params, null, 2)}</pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen">
      <Pod ticketId={ticketId} screen={screen} />
    </main>
  );
}
