import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';

interface AuthFormProps {
  title: string;
  description: string;
  submitLabel: string;
  /** Shown under the form, e.g. a link to the other mode. */
  footer: { prompt: string; linkLabel: string; to: string };
  /** Register collects an optional display name; login does not. */
  withName?: boolean;
  onSubmit: (values: { email: string; password: string; name?: string }) => Promise<void>;
}

/**
 * Shared by the login and register pages — they differ only by copy and one
 * optional field, so two near-identical forms would drift apart.
 */
export function AuthForm({
  title,
  description,
  submitLabel,
  footer,
  withName = false,
  onSubmit,
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({ email, password, ...(withName ? { name } : {}) });
      // No success handling: the auth state change re-renders us away.
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {withName ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete={withName ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error ? (
              // `role="alert"` so screen readers announce the failure.
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : submitLabel}
            </Button>
          </form>

          <p className="text-muted-foreground mt-4 text-center text-sm">
            {footer.prompt}{' '}
            <Link to={footer.to} className="text-foreground underline underline-offset-4">
              {footer.linkLabel}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
