import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("web security headers", () => {
  it("denies framing and unused browser capabilities", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    if (!nextConfig.headers)
      throw new Error("Next.js security headers are required");
    const routes = await nextConfig.headers();
    const headers = Object.fromEntries(
      routes.flatMap((route) =>
        route.headers.map((header) => [header.key, header.value]),
      ),
    );

    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["Content-Security-Policy"]).toContain("http://[::1]:3100");
    expect(headers["Content-Security-Policy"]).not.toContain(
      "http://localhost:3100",
    );
  });
});
