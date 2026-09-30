import { registerOTel } from "@vercel/otel";

export async function register() {
  registerOTel({
    serviceName: "nextbooru",
  });

  // Imported dynamically: this file is also bundled for the edge runtime,
  // where the feed's pg/Prisma dependency graph cannot load.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmFeedCache } = await import("@/lib/feed");
    warmFeedCache();
  }
}
