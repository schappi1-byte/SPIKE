import { VOLLEYBALL_PATH } from "@/frontend/src/brand";

export function Wordmark({ large = false }: { large?: boolean }) {
  return (
    <a href="/" aria-label="SPiKE dashboard" className={large ? "wordmark large" : "wordmark"}>
      SP
      <span className="dot" aria-hidden="true">
        ı
        <svg viewBox="0 0 36 36">
          <defs>
            <radialGradient id="spike-shade" cx="34%" cy="30%" r="72%">
              <stop offset="0%" style={{ stopColor: "var(--white)" }} />
              <stop offset="58%" style={{ stopColor: "var(--line-soft)" }} />
              <stop offset="100%" style={{ stopColor: "var(--line-strong)" }} />
            </radialGradient>
          </defs>
          <circle cx="18" cy="18" r="18" fill="url(#spike-shade)" />
          <path className="seams" d={VOLLEYBALL_PATH} />
        </svg>
      </span>
      KE
    </a>
  );
}
