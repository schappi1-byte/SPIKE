import { loadEnv, type Connect, type Plugin } from "vite";
import { analyzePlayer, planTraining } from "./gemini.ts";

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > 64_000) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function attach(middlewares: Connect.Server, mode: string, root: string) {
  middlewares.use(async (req, res, next) => {
    const path = req.url?.split("?")[0];
    if (path !== "/api/analyze" && path !== "/api/training") return next();
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Use POST to request an analysis." }));
      return;
    }
    try {
      const env = loadEnv(mode, root, "");
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const options = { apiKey: env.GEMINI_API_KEY || process.env.GEMINI_API_KEY, model: env.GEMINI_MODEL || process.env.GEMINI_MODEL };
      const result = path === "/api/training" ? await planTraining(body, options) : await analyzePlayer(body, options);
      res.statusCode = result.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result.body));
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "The analysis request could not be read." }));
    }
  });
}

export function geminiPlugin(): Plugin {
  return {
    name: "spike-gemini",
    configureServer(server) {
      attach(server.middlewares, server.config.mode, server.config.root);
    },
    configurePreviewServer(server) {
      attach(server.middlewares, server.config.mode, server.config.root);
    },
  };
}
