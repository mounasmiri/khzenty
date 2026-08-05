import { Button } from '@/components/ui/button';

/**
 * Application root. Routing and providers are added in the phase that first
 * needs them; this is a placeholder shell that exists to confirm the Tailwind
 * and shadcn/ui pipeline renders.
 */
function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-foreground">
      <h1 className="text-4xl font-semibold tracking-tight">Khzenty</h1>
      <p className="text-muted-foreground">Organize less. Decide faster. Dress better.</p>
      <Button>Get started</Button>
    </main>
  );
}

export default App;
