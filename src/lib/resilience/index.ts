// Vendored resilience primitives (from cubiczan-resilience). No npm registry,
// so the needed source is copied in under src/lib/resilience/.
export { safeFetch } from "./safeFetch";
export type { SafeFetchOptions, AllowlistHook } from "./safeFetch";
export { retry, computeBackoff } from "./retry";
export type { RetryOptions } from "./retry";
export { ResilienceError, isResilienceError } from "./errors";
export type { ResilienceErrorKind, ResilienceErrorOptions } from "./errors";
