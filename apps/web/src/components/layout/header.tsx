import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight mr-6">
          <span className="text-sm">⬡</span>
          SENTINEL VISION
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium flex-1">
          <Link href="/cases" className="text-muted-foreground hover:text-foreground transition-colors">
            Cases
          </Link>
          <Link href="/cameras" className="text-muted-foreground hover:text-foreground transition-colors">
            Cameras
          </Link>
          <Link href="/sightings" className="text-muted-foreground hover:text-foreground transition-colors">
            Sightings
          </Link>
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
