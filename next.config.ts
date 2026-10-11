import { existsSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// Keys live in backend/.env.local. On Vercel the file is absent and the dashboard's variables are used.
const backendEnv = join(process.cwd(), "backend", ".env.local");
if (existsSync(backendEnv)) process.loadEnvFile(backendEnv);

const nextConfig: NextConfig = {};

export default nextConfig;
