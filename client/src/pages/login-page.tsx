import { AuthForm } from '@/features/auth/auth-form';
import { useAuth } from '@/features/auth/use-auth';
import { useDemoAvailable } from '@/features/auth/use-demo-available';

export function LoginPage() {
  const { login, loginAsDemo } = useAuth();
  const demoAvailable = useDemoAvailable();

  return (
    <AuthForm
      title="Welcome back"
      description="Sign in to your Khzenty wardrobe."
      submitLabel="Sign in"
      footer={{ prompt: 'No account yet?', linkLabel: 'Create one', to: '/register' }}
      onSubmit={({ email, password }) => login(email, password)}
      {...(demoAvailable ? { onDemo: loginAsDemo } : {})}
    />
  );
}
