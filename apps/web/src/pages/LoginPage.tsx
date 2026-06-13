import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { login } from '../api/auth';
import { useAuthStore } from '../store/auth';
import AuthShell from '../components/AuthShell';

export default function LoginPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (token) => {
      setToken(token);
      navigate('/', { replace: true });
    },
  });

  return (
    <AuthShell
      title="Sign in"
      subtitle="Pick up where your team left off."
      footer={
        <>
          No account?{' '}
          <Link
            to="/signup"
            className="rounded-md font-semibold text-verity-600 hover:text-verity-700"
          >
            Create your company
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="email" className="label mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="password" className="label mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </div>

        {mutation.isError && (
          <p className="error-note">{(mutation.error as Error).message}</p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary w-full"
        >
          {mutation.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
