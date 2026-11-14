import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { useAuth } from './use-auth';

/**
 * Shown in place of a page that only exists to upload photos, when the visitor
 * is in the demo sandbox. The server refuses uploads for demo copies (403), so
 * this just explains that instead of letting the visitor walk into an error.
 */
export function NotInDemo({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user?.isDemo) {
    return children;
  }

  return (
    <div className="bg-card max-w-md space-y-3 rounded-lg border p-6">
      <p className="text-sm font-medium">Photo upload is turned off in the demo</p>
      <p className="text-muted-foreground text-sm">
        The demo wardrobe comes with its own photos. Everything else works, and your changes stay
        private to you.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to="/">Back to the wardrobe</Link>
      </Button>
    </div>
  );
}
