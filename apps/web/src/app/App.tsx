import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { Toaster } from 'sonner';
import { FullPageSpinner } from '../components/ui';
import { AuthProvider } from '../features/auth/AuthProvider';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { DashboardPage } from '../features/documents/DashboardPage';
import { ServerWakeBanner } from './ServerWakeBanner';

// The editor (TipTap + ProseMirror) is the heaviest chunk — load it only when a document opens.
const EditorPage = lazy(() => import('../features/editor/EditorPage'));

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: true },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ServerWakeBanner />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/d/:id"
              element={
                <RequireAuth>
                  <Suspense fallback={<FullPageSpinner label="Loading editor" />}>
                    <EditorPage />
                  </Suspense>
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster
        position="bottom-center"
        toastOptions={{ className: 'font-sans', style: { borderRadius: '12px' } }}
      />
    </QueryClientProvider>
  );
}

function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-5 py-24 text-center">
      <h1 className="font-serif text-4xl">Page not found</h1>
      <p className="mt-3 text-muted">The link may be mistyped or out of date.</p>
      <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-accent px-4 font-medium text-white">
        Go to documents
      </Link>
    </main>
  );
}
