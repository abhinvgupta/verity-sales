import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listUsers,
  createUser,
  deactivateUser,
  type CreateUserPayload,
} from '../api/users';

export default function TeamPage() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  });

  const [form, setForm] = useState<CreateUserPayload>({
    name: '',
    email: '',
    password: '',
    role: 'rep',
  });

  const update = (key: keyof CreateUserPayload, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const createMutation = useMutation({
    mutationFn: () => createUser(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setForm({ name: '', email: '', password: '', role: 'rep' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-semibold text-ink-900">Team</h1>

      <section className="rounded-xl border border-ink-100 bg-white p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink-900">
          Add a user
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div>
            <label className="label">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              value={form.role}
              onChange={(e) => update('role', e.target.value)}
              className="field"
            >
              <option value="rep">Rep</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          {createMutation.isError && (
            <p className="error-note sm:col-span-2">
              {(createMutation.error as Error).message}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? 'Adding…' : 'Add user'}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-ink-100 bg-white">
        {isLoading && <p className="p-6 text-ink-500">Loading…</p>}
        {users && (
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-[0.14em] text-ink-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.map((u) => (
                <tr key={u._id}>
                  <td className="px-4 py-3 font-medium text-ink-900">{u.name}</td>
                  <td className="px-4 py-3 text-ink-600">{u.email}</td>
                  <td className="px-4 py-3 text-ink-600">{u.role}</td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'company_admin' && (
                      <button
                        onClick={() => deactivateMutation.mutate(u._id)}
                        disabled={deactivateMutation.isPending}
                        className="text-sm font-medium text-verdict-mismatch hover:underline disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
