# Code Standards — Auth Service

This document defines the coding conventions for the Auth Service, built with **Node.js + Express**, using **Passport (OAuth2 + JWT strategies)**, and containerized with **Docker**.

## General Principles

- Code should reflect the **Ubiquitous Language** defined in [`docs/ddd/domain-model.md`](../ddd/domain-model.md) — variables, functions, and classes related to the domain must use terms like `User`, `Fan`, `Organizer`, `VenueOwner`, `Token`, not generic or ambiguous names.
- Favor **explicit and readable** code over clever one-liners.
- Every module should have a single, clear responsibility (aligned with the Support subdomain boundary: this service does **not** own event, venue, or payment logic).

## Project Structure

The service follows a **hexagonal (ports & adapters)** layout written in **object-oriented** style:

```text
auth-service/src/
├── core/                 # No framework or adapter imports
│   ├── domain/           # Entities (User, Credential, Invitation), Roles, PasswordPolicy, DomainError
│   └── use-cases/        # One class per use case with execute(); use-case errors in errors/
├── adapters/
│   ├── controllers/      # Translate HTTP in/out of the use cases
│   ├── repositories/     # Implement the repository ports (in-memory for now)
│   └── services/         # Implement PasswordHasher, TokenService and CodeGenerator ports
├── ports/
│   └── interfaces.js     # Abstract classes every adapter extends
├── infrastructure/
│   ├── express/          # App.js (composition root), routes/, middlewares/
│   ├── config/Env.js     # The only place that reads process.env
│   └── database/         # Reserved for the real database connection
└── index.js              # Entry point: builds the App and listens
```

Dependencies point inwards: `core` depends only on `ports`; `adapters` and `infrastructure` depend on `core`. Every class receives its collaborators through the constructor, and `infrastructure/express/App.js` is the only place that wires them together.


## Node.js / Express Conventions

- **Node version** pinned via `.nvmrc` and matching the Docker base image.
- Use `async/await` — no mixing with raw `.then()` chains or callbacks.
- All routes go through a centralized **error-handling middleware**; controllers should not `try/catch` every error individually, only cases needing specific handling.
- Input validation on every endpoint (e.g. via `joi` or `zod`) before reaching the service layer.
- Environment variables accessed only through a single `config` module — never `process.env` scattered across the codebase.
- Use **HTTP status codes** correctly:
  - `201` on successful registration
  - `200` on successful login
  - `401` for invalid credentials
  - `403` for valid credentials but insufficient role/permissions
  - `409` for duplicate user registration

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Files | UpperCamelCase, named after the class they export (except `index.js` and `ports/interfaces.js`) | `LoginController.js`, `RegisterPartner.test.js` |
| Classes | PascalCase | `RegisterPartner`, `JwtTokenService` |
| Methods/variables | camelCase | `execute`, `findByUsername` |
| Constants | UPPER_SNAKE_CASE | `JWT_EXPIRATION_TIME` |
| Env vars | UPPER_SNAKE_CASE | `JWT_SECRET`, `OAUTH_CLIENT_ID` |

## Passport / OAuth2 / JWT Conventions

- Each authentication mechanism lives in its **own class** under `src/infrastructure/express/middlewares/` (e.g. `StaffCredentialGuard`, `JwtAuthenticator`).
- **Never** hardcode client secrets, JWT secrets, or callback URLs — always read from environment variables (see `.env.example`).
- JWT payload must be minimal and consistent across the system, since other services (Booking, Event, Venue) depend on it:
```json
  {
    "sub": "userId",
    "role": "Fan | Organizer | VenueOwner",
    "iat": 0,
    "exp": 0
  }
```
- Do not put sensitive data (passwords, tokens, PII beyond `sub`/`role`) inside the JWT payload.
- Token expiration and refresh logic must be centralized behind the `TokenService` port (`adapters/services/JwtTokenService.js`), not duplicated across controllers.
- Role-based access control (RBAC) middleware (e.g. `infrastructure/express/middlewares/RoleGuard.js`) must be used to protect role-specific routes rather than checking roles inline in controllers.
- Passwords must always be hashed with **bcrypt** (or equivalent) — never stored or logged in plain text.

## Testing

- Unit tests for use cases and adapters (`*.test.js` next to the source) — use fakes or in-memory adapters for the ports.
- Integration tests for routes (`infrastructure/express/routes/*.test.js`) — use a test database or in-memory store.
- Minimum coverage threshold enforced in CI (e.g. 80%), especially on `core/use-cases/` and `JwtTokenService.js`.
- Never commit real credentials, tokens, or `.env` files — only `.env.example` with placeholder values.

## Docker Conventions

- Use a **multi-stage build**: one stage to install dependencies and build, one minimal stage (`node:20-alpine` or similar) to run.
- `.dockerignore` must exclude `node_modules`, `.env`, tests, and docs.
- The container must run as a **non-root user**.
- Expose only the necessary port (e.g. `3000`) and read it from an environment variable (`PORT`).
- Health check endpoint (`/health`) must be implemented and referenced in `HEALTHCHECK` in the Dockerfile.
- `docker-compose.yml` (for local development) should include the Auth service plus its database, with environment variables loaded from `.env`.

**Example minimal Dockerfile skeleton:**

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Run stage
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app /app
USER appuser
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK CMD wget --spider -q http://localhost:3000/health || exit 1
CMD ["node", "src/index.js"]
```

## Linting & Formatting

- **ESLint** (Airbnb base or similar) + **Prettier**, enforced via a pre-commit hook (e.g. `husky` + `lint-staged`).
- CI must fail the build if lint errors are present.