'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VerificationRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/review');
  }, [router]);
  return <div className="p-8 text-xs text-muted-foreground font-mono">Redirecting to /review...</div>;
}
