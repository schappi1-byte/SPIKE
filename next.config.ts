import { existsSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// Keys live in backend/.env.local. On Vercel the file is absent and the dashboard's variables are used.
const backendEnv = join(process.cwd(), "backend", ".env.local");
if (existsSync(backendEnv)) process.loadEnvFile(backendEnv);

const nextConfig: NextConfig = {
  // The dashboard is the Vite app in frontend/, built into public/spa by `npm run build:frontend`.
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/spa/index.html" }], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
