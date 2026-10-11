export function SetupNotice() {
  return (
    <div className="panel">
      <h1>Connect Supabase</h1>
      <p className="muted">
        Add <code>SUPABASE_URL</code> and <code>SUPABASE_PUBLISHABLE_KEY</code> to <code>backend/.env.local</code>, or to the Vercel project&apos;s
        environment variables (the <code>NEXT_PUBLIC_</code> names also work), then restart or redeploy. Run <code>npm run db:push</code> and <code>npm run db:seed</code> to create the tables
        and load the UNC Chapel Hill data.
      </p>
    </div>
  );
}
