// A store the use case depends on (Postgres, Redis) timed out, kept failing
// after the retries or has its circuit open. Thrown by the resilience fallback
// so callers get a 503 and know when to try again, instead of a generic 500.
class ServiceUnavailableError extends Error {
  /** @param {{ dependency: string, retryAfterSeconds: number }} details */
  constructor({ dependency, retryAfterSeconds }) {
    super(`${dependency} is temporarily unavailable`);
    this.name = 'ServiceUnavailableError';
    this.dependency = dependency;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

module.exports = ServiceUnavailableError;
