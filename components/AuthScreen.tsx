import { Wordmark } from "./Wordmark";

export function AuthScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="aurora auth">
      <Wordmark large />
      <p className="tagline">Smarter Coaching. Stronger Players.</p>
      <div className="auth-card">{children}</div>
    </main>
  );
}
