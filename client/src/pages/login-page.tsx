import { AuthForm } from '@/features/auth/auth-form';
import { useAuth } from '@/features/auth/use-auth';

export function LoginPage() {
  const { login } = useAuth();

  return (
    <AuthForm
      title="Welcome back"
      description="Sign in to your Khzenty wardrobe."
      submitLabel="Sign in"
      footer={{ prompt: 'No account yet?', linkLabel: 'Create one', to: '/register' }}
      onSubmit={({ email, password }) => login(email, password)}
    />
  );
}
