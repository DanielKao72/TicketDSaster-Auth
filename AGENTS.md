# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Auth Service for the Ticket D-Saster platform (Support subdomain, team Ninjava). It registers and authenticates users and issues the JWTs that Booking, Event and Venue services validate **statelessly**, so the JWT payload is a cross-service contract. Out of scope: payments, events, venues, tickets, queues and seats.

All code lives in `auth-service/` (Node 20 per `.nvmrc`, CommonJS, Express). The repo root holds only `docker-compose.yml` and `docs/`.

## Commands

Run these from `auth-service/`:

```bash
npm install
npm run dev            # nodemon src/server.js
npm start              # node src/server.js
npm run lint           # eslint . (flat config in eslint.config.js)
npm run openapi        # writes dist/openapi.{json,yaml} from @openapi JSDoc blocks
npm test               # node --test (built-in runner, picks up every *.test.js)
node --test src/core/domain/entities/Invitation.test.js                                  # single file
node --test --test-name-pattern="markUsed" src/core/domain/entities/Invitation.test.js   # single test by name
```

`src/infrastructure/config/Env.js` throws on load if `JWT_SECRET`, `STAFF_USERNAME` or `STAFF_PASSWORD` is missing. Copy `.env.example` to `.env` first, or set those variables inline when running tests.

Docker, from the repo root: `docker compose up --build` uses the `dev` stage of the Dockerfile, mounts `src/` for hot reload, reads `auth-service/.env` and listens on port 4000. The `runner` stage is the production image.

CI (`.github/workflows/on_pr.yml`) runs `npm ci`, `npm run lint` and `npm test` on PRs to `main` and `develop`. `commitlint.yml` lints the PR commits and the PR title (the squash commit message) against Conventional Commits; locally, `npm install` sets up a husky `commit-msg` hook (`auth-service/.husky/`, config in `auth-service/commitlint.config.js`) that does the same. A tag `v*.*.*` triggers `release.yml`, which publishes the OpenAPI spec, and `publish-image.yml`, which builds the `runner` stage and pushes it as `ninjava-auth-service` to the tailnet registry (`gateway.tail9a6ddb.ts.net:5000`).

## Architecture

The code follows a hexagonal (ports & adapters) layout under `auth-service/src/`, written as classes (OOP) that receive their collaborators through the constructor. Dependencies point inwards: `core/` depends only on `ports/`, and `adapters/` and `infrastructure/` depend on `core/`.

- `core/domain/`: entities (`User`, `Credential`, `Invitation`), `Roles.js` (`VENUE_OWNER`, `ORGANIZER`), `PasswordPolicy` (static `validate`) and `DomainError`. No framework or adapter imports.
- `core/use-cases/`: one class per use case (`GenerateInvitation`, `RegisterPartner`, `LoginPartner`), built with its ports (`new RegisterPartner({ userRepository, ..., passwordHasher })`) and run with `execute(input)`. Use-case error classes live in `core/use-cases/errors/`. `core/` must never `require` from `adapters/` or `infrastructure/` (tests excepted).
- `ports/interfaces.js`: abstract classes for every port (`UserRepository`, `CredentialRepository`, `InvitationRepository`, `PasswordHasher`, `TokenService`, `CodeGenerator`). Their methods throw `Not implemented`; adapters `extend` them. `ports/interfaces.test.js` checks each real adapter extends its port.
- `adapters/`: `controllers/` (`RegisterController`, `LoginController`, `TokenController`, `InvitationsController`) expose handlers as arrow-function class fields so Express can call them unbound. `repositories/` holds the in-memory stores. `services/` holds `BcryptPasswordHasher`, `JwtTokenService` and `InvitationCodeGenerator`.
- `infrastructure/express/App.js` is the **composition root**. `new App(deps).build()` wires adapters into use cases, controllers and routers and returns the Express app, defaulting every dependency to a fresh real adapter or in-memory store. Tests pass in fresh repositories to get an isolated store. `src/index.js` only builds the app and calls `listen`. `infrastructure/database/` is reserved for a future real database connection.
- `infrastructure/express/routes/AuthRoutes.js` builds a single router mounted once at the root, so each route declares its full path (`/auth/login`, `/.well-known/jwks.json`). Keep middleware order in `App.build()`: routes, then the 404 handler, then `ErrorHandler`.

Conventions that span several files:

- **Errors:** controllers call `next(error)`. `infrastructure/express/middlewares/ErrorHandler.js` maps `DomainError` to 400 and anything else to 500. Use cases define their own error classes (`InvalidCredentialsError`, `UserAlreadyExistsError`, `InvalidInvitationError`), and controllers map those to 401 or 409.
- **Config:** read environment variables only through `src/infrastructure/config/Env.js`, never `process.env` elsewhere.
- **JWT contract:** HS256 with a shared `JWT_SECRET` and an 8h expiry by default. The payload is only `{ sub, role }` plus `iat`/`exp`. Do not add claims without coordinating with downstream services. `POST /auth/validate` and `GET /.well-known/jwks.json` expose the verification contract to downstream services.
- **Partner registration flow:** staff calls `POST /invitations` with `{ role }` to create a single-use code. The route requires the staff credential (`STAFF_USERNAME` / `STAFF_PASSWORD`) as HTTP Basic Auth, enforced by `infrastructure/express/middlewares/StaffCredentialGuard.js` (PA-01-T2); it answers 401 and the invitation handler never runs. `new App({ staffCredentials })` overrides it in tests, and route tests that call `POST /invitations` must send the `Authorization` header. A partner then calls `POST /auth/register` with `username`, `password` (at least 8 characters) and `invitationCode`, and the role comes from the invitation. `POST /auth/login` returns `{ accessToken, tokenType: 'Bearer', expiresIn }`. An invitation is marked used only after registration fully succeeds.
- Code comments reference requirement and task IDs (`PA-01-T1`, `PA-08-T2`, …) from the team backlog. Keep them when editing.
- Test files sit next to the source as `*.test.js` and use `node:test` with `node:assert/strict`. Route tests start the app on port 0 and call it with `fetch`.

## Repository conventions

From `docs/contributing/`:

- Branches: `feature/`, `fix/`, `chore/`, `hotfix/` plus a kebab-case description. Integration happens on `develop`, and PRs are squash-merged into `main`.
- Commits follow Conventional Commits (`feat(auth): ...`).
- Files under `src/` use UpperCamelCase named after the class they export (`RegisterPartner.js`, `RegisterPartner.test.js`); the only exceptions are `index.js` and `ports/interfaces.js`. Folders stay lowercase. Domain names follow the ubiquitous language in `docs/ddd/domain-model.md`.
- Status codes: 201 register, 200 login, 401 bad credentials, 403 insufficient role, 409 duplicate user.
- When resolving merge conflicts in `App.js` or `AuthRoutes.js`, integrate both sides into one method. Several past resolutions kept both sides verbatim and broke `develop`. Run `node --check` on the touched files before committing.
