const {
  timeout,
  TimeoutStrategy,
  retry,
  ExponentialBackoff,
  circuitBreaker,
  ConsecutiveBreaker,
  CircuitState,
  fallback,
  handleWhen,
  wrap,
} = require('cockatiel');

const DomainError = require('../../core/domain/errors/DomainError');
const InvalidCredentialsError = require('../../core/use-cases/errors/InvalidCredentialsError');
const InvalidInvitationError = require('../../core/use-cases/errors/InvalidInvitationError');
const UserAlreadyExistsError = require('../../core/use-cases/errors/UserAlreadyExistsError');
const ServiceUnavailableError = require('../../core/use-cases/errors/ServiceUnavailableError');

// Business outcomes are answers, not failures of the store: they are never
// retried, never count towards opening the circuit and reach the caller as is.
const BUSINESS_ERRORS = [
  DomainError,
  InvalidCredentialsError,
  InvalidInvitationError,
  UserAlreadyExistsError,
  ServiceUnavailableError,
];

function isBusinessError(error) {
  return BUSINESS_ERRORS.some((ErrorClass) => error instanceof ErrorClass);
}

const STATE_NAMES = {
  [CircuitState.Closed]: 'closed',
  [CircuitState.Open]: 'open',
  [CircuitState.HalfOpen]: 'half-open',
  [CircuitState.Isolated]: 'open',
};

// Resilience for one store (Postgres or Redis), built on cockatiel. Every call
// runs as Fallback(CircuitBreaker(Retry(Timeout(call)))):
// - Timeout: each attempt is abandoned after `timeoutMs`.
// - Retry: failed attempts are retried `retry.maxAttempts` times with
//   exponential backoff and jitter. Only for idempotent operations.
// - CircuitBreaker: after `breaker.consecutiveFailures` failed calls the
//   circuit opens and calls fail at once, without touching the store, until
//   `breaker.halfOpenAfterMs` passes and a trial call is let through. One
//   breaker per store, shared by all of its operations.
// - Fallback: what the caller gets once the call failed. By default a
//   ServiceUnavailableError (503, fail closed); operations can override it.
class ResiliencePolicy {
  /**
   * @param {object} options
   * @param {string} options.name store name, used in logs, errors and /health
   * @param {number} options.timeoutMs
   * @param {{ maxAttempts: number, initialDelayMs: number, maxDelayMs: number }} options.retry
   * @param {{ consecutiveFailures: number, halfOpenAfterMs: number }} options.breaker
   * @param {{ warn: Function }} [options.logger]
   */
  constructor({ name, timeoutMs, retry: retryOptions, breaker: breakerOptions, logger = console }) {
    this.name = name;
    this.retryAfterSeconds = Math.ceil(breakerOptions.halfOpenAfterMs / 1000);
    this.handler = handleWhen((error) => !isBusinessError(error));

    this.timeoutPolicy = timeout(timeoutMs, TimeoutStrategy.Aggressive);
    this.retryPolicy = retry(this.handler, {
      maxAttempts: retryOptions.maxAttempts,
      backoff: new ExponentialBackoff({
        initialDelay: retryOptions.initialDelayMs,
        maxDelay: retryOptions.maxDelayMs,
      }),
    });
    this.circuitBreakerPolicy = circuitBreaker(this.handler, {
      halfOpenAfter: breakerOptions.halfOpenAfterMs,
      breaker: new ConsecutiveBreaker(breakerOptions.consecutiveFailures),
    });

    this.circuitBreakerPolicy.onBreak(() => logger.warn(`[auth-service] ${name} circuit open`));
    this.circuitBreakerPolicy.onHalfOpen(() => logger.warn(`[auth-service] ${name} circuit half-open`));
    this.circuitBreakerPolicy.onReset(() => logger.warn(`[auth-service] ${name} circuit closed`));
  }

  /**
   * @template T
   * @param {() => Promise<T>} operation
   * @param {object} [options]
   * @param {boolean} [options.idempotent=true] false skips the retry, for writes
   *   that must not run twice
   * @param {boolean} [options.timeout=true] false skips the cockatiel timeout,
   *   for work that must not be abandoned halfway (a transaction relies on the
   *   driver's own query timeout instead)
   * @param {() => T} [options.fallback] result once the call failed; throws a
   *   ServiceUnavailableError when omitted
   * @returns {Promise<T>}
   */
  execute(operation, { idempotent = true, timeout: withTimeout = true, fallback: onFailure } = {}) {
    const policies = [
      fallback(this.handler, onFailure ?? (() => this.unavailable())),
      this.circuitBreakerPolicy,
    ];
    if (idempotent) {
      policies.push(this.retryPolicy);
    }
    if (withTimeout) {
      policies.push(this.timeoutPolicy);
    }

    return wrap(...policies).execute(() => operation());
  }

  unavailable() {
    throw new ServiceUnavailableError({ dependency: this.name, retryAfterSeconds: this.retryAfterSeconds });
  }

  /** @returns {'closed' | 'open' | 'half-open'} */
  get state() {
    return STATE_NAMES[this.circuitBreakerPolicy.state];
  }
}

module.exports = ResiliencePolicy;
