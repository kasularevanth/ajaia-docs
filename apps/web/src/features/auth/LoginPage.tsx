import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, LoginSchema } from '@ajaia/shared';
import { Avatar, Button, Input, Spinner, Wordmark } from '../../components/ui';
import { isApiError } from '../../lib/api';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null); // email being signed in

  if (status === 'authenticated') return <Navigate to={from} replace />;

  async function signIn(e: string, p: string) {
    setError(null);
    const parsed = LoginSchema.safeParse({ email: e, password: p });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your email and password');
      return;
    }
    setPending(parsed.data.email);
    try {
      await login(parsed.data.email, parsed.data.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Sign-in failed. Try again.');
    } finally {
      setPending(null);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void signIn(email, password);
  };

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-12 px-5 py-12 md:grid-cols-[1.1fr_1fr] md:px-10">
      <section>
        <Wordmark className="text-5xl md:text-6xl" />
        <p className="mt-5 max-w-md font-serif text-xl leading-relaxed text-muted">
          Write a draft, bring in the files you already have, and hand it to the people who need it. Every edit is saved
          as you type.
        </p>
        <dl className="mt-10 grid max-w-md gap-4 text-sm text-muted">
          <div className="flex gap-3">
            <dt className="mt-1.5 h-3 w-1 shrink-0 rounded-full bg-ink" aria-hidden="true" />
            <dd>Documents you own carry an ink tab.</dd>
          </div>
          <div className="flex gap-3">
            <dt className="mt-1.5 h-3 w-1 shrink-0 rounded-full bg-marker" aria-hidden="true" />
            <dd>Documents shared with you carry a highlighter tab, with who shared them and what you can do.</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl bg-paper p-6 shadow-sheet md:p-8">
        <h1 className="font-serif text-3xl font-medium">Sign in</h1>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit} noValidate>
          <label className="grid gap-1.5 text-sm font-medium">
            Email
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ajaia.test"
              invalid={!!error}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Password
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!error}
            />
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-danger-wash px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" loading={pending === email.trim().toLowerCase()} disabled={!!pending}>
            Sign in
          </Button>
        </form>

        <div className="mt-8 border-t border-line pt-6">
          <h2 className="text-sm font-semibold">Try a demo account</h2>
          <p className="mt-1 text-sm text-muted">
            Each one signs in instantly. The password for all three is <code className="rounded bg-desk px-1">{DEMO_PASSWORD}</code>.
          </p>
          <ul className="mt-4 grid gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  disabled={!!pending}
                  onClick={() => void signIn(account.email, DEMO_PASSWORD)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-accent-wash disabled:opacity-60"
                >
                  <Avatar name={account.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{account.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {account.email} — {account.hint}
                    </span>
                  </span>
                  {pending === account.email && <Spinner className="size-4 text-accent" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
