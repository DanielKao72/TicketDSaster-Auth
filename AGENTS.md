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
node --test src/domain/entities/Invitation.test.js          # single file
node --test --test-name-pattern="markUsed" src/domain/...   # single test by name
```

`src/config/env.js` throws on load if `JWT_SECRET`, `STAFF_USERNAME` or `STAFF_PASSWORD` is missing. Copy `.env.example` to `.env` first, or set those variables inline when running tests.

Docker, from the repo root: `docker compose up --build` uses the `dev` stage of the Dockerfile, mounts `src/` for hot reload, reads `auth-service/.env` and listens on port 4000. The `runner` stage is the production image.

CI (`.github/workflows/on_pr.yml`) runs `npm ci`, `npm run lint` and `npm test` on PRs to `main` and `develop`. `commitlint.yml` lints the PR commits and the PR title (the squash commit message) against Conventional Commits; locally, `npm install` sets up a husky `commit-msg` hook (`auth-service/.husky/`, config in `auth-service/commitlint.config.js`) that does the same. A tag `v*.*.*` triggers `release.yml`, which publishes the OpenAPI spec.

## Architecture

The code uses layered, hexagonal-style folders under `auth-service/src/`:

- `domain/`: entities (`User`, `Credential`, `Invitation`), `roles.js` (`VENUE_OWNER`, `ORGANIZER`), `password-policy.js` and `DomainError`. It has no framework imports.
- `application/use-cases/`: one file per use case (`generate-invitation`, `register-partner`, `login-partner`). Use cases receive repositories and adapters as arguments: as a factory (`createGenerateInvitation({ ... })` returns a function) or as call parameters (`registerPartner({ ..., userRepository })`).
- `infrastructure/`: adapters. `http/` holds controllers, routes and middlewares. `security/` holds jwt, bcrypt hasher and invitation-code generator. `persistence/` currently has only in-memory repositories (user, credential, invitation).
- `app.js` is the **composition root**. `createApp(deps)` wires repositories into use cases and routers, defaulting each one to a fresh in-memory store. Tests pass in fresh repositories to get an isolated store. `server.js` only calls `listen`.
- `auth.routes.js` is a single router mounted once at the root, so each route declares its full path (`/auth/login`, `/.well-known/jwks.json`). Keep middleware order in `app.js`: routes, then the 404 handler, then `errorHandler`.

Conventions that span several files:

- **Errors:** controllers call `next(error)`. `middlewares/error-handler.js` maps `DomainError` to 400 and anything else to 500. Use cases define their own error classes (`InvalidCredentialsError`, `UserAlreadyExistsError`, `InvalidInvitationError`), and controllers map those to 401 or 409.
- **Config:** read environment variables only through `src/config/env.js`, never `process.env` elsewhere.
- **JWT contract:** HS256 with a shared `JWT_SECRET` and an 8h expiry by default. The payload is only `{ sub, role }` plus `iat`/`exp`. Do not add claims without coordinating with downstream services. `POST /auth/validate` and `GET /.well-known/jwks.json` expose the verification contract to downstream services.
- **Partner registration flow:** staff calls `POST /invitations` with `{ role }` to create a single-use code. A partner then calls `POST /auth/register` with `username`, `password` (at least 8 characters) and `invitationCode`, and the role comes from the invitation. `POST /auth/login` returns `{ accessToken, tokenType: 'Bearer', expiresIn }`. An invitation is marked used only after registration fully succeeds.
- Code comments reference requirement and task IDs (`PA-01-T1`, `PA-08-T2`, …) from the team backlog. Keep them when editing.
- Test files sit next to the source as `*.test.js` and use `node:test` with `node:assert/strict`. Route tests start the app on port 0 and call it with `fetch`.

## Repository conventions

From `docs/contributing/`:

- Branches: `feature/`, `fix/`, `chore/`, `hotfix/` plus a kebab-case description. Integration happens on `develop`, and PRs are squash-merged into `main`.
- Commits follow Conventional Commits (`feat(auth): ...`).
- Files use kebab-case, except entity classes, which use PascalCase (`Invitation.js`). Domain names follow the ubiquitous language in `docs/ddd/domain-model.md`.
- Status codes: 201 register, 200 login, 401 bad credentials, 403 insufficient role, 409 duplicate user.
- `docs/contributing/code-standards.md` describes an older `controllers/`, `services/`, `strategies/` layout. The actual code uses the `domain`/`application`/`infrastructure` layout above, so follow the code.
- When resolving merge conflicts in `app.js` or `auth.routes.js`, integrate both sides into one function. Several past resolutions kept both sides verbatim and broke `develop`. Run `node --check` on the touched files before committing.
