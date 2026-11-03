import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';

/**
 * Placeholder for the signed-in area. The wardrobe itself is a later phase;
 * this exists to prove the protected route and session both work.
 */
export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Khzenty</h1>
          <p className="text-muted-foreground text-sm">
            Organize less. Decide faster. Dress better.
          </p>
        </div>

        <Button variant="outline" onClick={() => void logout()}>
          Sign out
        </Button>
      </header>

      <section className="rounded-lg border p-4">
        <p className="text-sm">
          Signed in as <span className="font-medium">{user?.name ?? user?.email}</span>
        </p>
        <p className="text-muted-foreground mt-1 text-sm">{user?.email}</p>
      </section>

      <p className="text-muted-foreground text-sm">Your wardrobe arrives in the next phase.</p>
    </main>
  );
}
