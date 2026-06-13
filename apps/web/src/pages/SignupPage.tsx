import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { signup, type SignupPayload } from '../api/auth';
import { useAuthStore } from '../store/auth';
import AuthShell from '../components/AuthShell';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function SignupPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const [form, setForm] = useState<SignupPayload>({
    companyName: '',
    companySlug: '',
    name: '',
    email: '',
    password: '',
  });

  const update = (key: keyof SignupPayload, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => signup(form),
    onSuccess: (token) => {
      setToken(token);
      navigate('/', { replace: true });
    },
  });

  return (
    <AuthShell
      title="Create your company"
      subtitle="You'll be set up as the company admin."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="rounded-md font-semibold text-verity-600 hover:text-verity-700"
          >
            Sign in
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
          <label htmlFor="companyName" className="label mb-1.5">
            Company name
          </label>
          <input
            id="companyName"
            required
            value={form.companyName}
            onChange={(e) => {
              update('companyName', e.target.value);
              update('companySlug', slugify(e.target.value));
            }}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="companySlug" className="label mb-1.5">
            Company slug
          </label>
          <input
            id="companySlug"
            required
            value={form.companySlug}
            onChange={(e) => update('companySlug', e.target.value)}
            className="field font-mono"
          />
        </div>
        <div>
          <label htmlFor="name" className="label mb-1.5">
            Your name
          </label>
          <input
            id="name"
            required
            autoComplete="name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="email" className="label mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
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
            minLength={6}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
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
          {mutation.isPending ? 'Creating…' : 'Create company'}
        </button>
      </form>
    </AuthShell>
  );
}
