import { AuthForm } from '@/features/auth/auth-form';
import { useAuth } from '@/features/auth/use-auth';

export function RegisterPage() {
  const { register } = useAuth();

  return (
    <AuthForm
      title="Create your account"
      description="Start cataloguing what you already own."
      submitLabel="Create account"
      footer={{ prompt: 'Already have an account?', linkLabel: 'Sign in', to: '/login' }}
      withName
      onSubmit={({ email, password, name }) => register(email, password, name)}
    />
  );
}
