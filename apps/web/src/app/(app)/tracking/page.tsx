'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function TrackingRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(`/journeys${q ? `?${q}` : ''}`);
  }, [router, searchParams]);

  return <div className="p-8 text-xs text-muted-foreground font-mono">Redirecting to /journeys...</div>;
}

export default function TrackingRedirect() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground font-mono">Redirecting...</div>}>
      <TrackingRedirectContent />
    </Suspense>
  );
}
