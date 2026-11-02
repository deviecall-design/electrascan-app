/**
 * In-memory per-IP limiter for the open Vesh beta.
 * Each serverless instance keeps its own window. That is enough to blunt
 * a burst against one isolate without a paid store. Cold starts reset it.
 */

const buckets = new Map();

export function clientIp(req) {
  const headers = req?.headers || {};
  const real = headers["x-real-ip"] ?? headers["X-Real-Ip"];
  if (typeof real === "string" && real.trim()) return real.trim().slice(0, 80);
  const forwarded = headers["x-forwarded-for"] ?? headers["X-Forwarded-For"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw === "string" && raw.trim()) return raw.split(",")[0].trim().slice(0, 80);
  const remote = req?.socket?.remoteAddress;
  if (typeof remote === "string" && remote.trim()) return remote.trim().slice(0, 80);
  return "unknown";
}

export function rateLimit(key, { limit = 40, windowMs = 10_000 } = {}) {
  const now = Date.now();
  const id = String(key || "unknown").slice(0, 80);
  const stamps = buckets.get(id) || [];
  const fresh = stamps.filter(time => now - time < windowMs);
  if (fresh.length >= limit) {
    buckets.set(id, fresh);
    const retryAfter = Math.max(1, Math.ceil((fresh[0] + windowMs - now) / 1000));
    return { ok: false, retryAfter };
  }
  fresh.push(now);
  buckets.set(id, fresh);
  if (buckets.size > 5000) {
    for (const [bucketKey, times] of buckets) {
      if (times.every(time => now - time >= windowMs)) buckets.delete(bucketKey);
    }
  }
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}
