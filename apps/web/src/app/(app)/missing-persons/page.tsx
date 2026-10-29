'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MissingPersonsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/cases');
  }, [router]);
  return <div className="p-8 text-xs text-muted-foreground font-mono">Redirecting to /cases...</div>;
}
