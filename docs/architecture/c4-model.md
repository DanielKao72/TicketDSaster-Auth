# Architecture — C4 Model

This document describes how the **Auth Service** fits into the overall Ticket D-Saster architecture, using the C4 levels (Context and Containers).

## Level 1 — System Context

![C4 - LVL 1 - System](/docs/architecture/C4%20-%20LVL%201%20-%20System.png)

At the system level, four types of actors interact with the platform, which in turn depends on two external systems:

- **Actors:** Fan, Buyer, Venue Owner, Organizer.
- **System:** Ticket D-Saster System.
- **External systems:** Payment System, Email System.


## Level 2 — Containers

![C4 - LVL 2 - Containers](/docs/architecture/C4%20-%20LVL%202%20-%20Container.png)

In the container diagram, the Auth Service sits within the **Auth & Payments Domain** (team *Ninjava*).

### Responsibility at this level

> **Auth Service (backend):** Handle authentication and user registration.

### Inbound flows

| Source | Via | Description |
|---|---|---|
| `D-Saster Front` (Fan / Buyer) | JWT + HTTP | Auth, Fan registration and preferences |
| `Backstage` (Venue Owner / Organizer) | JWT + HTTP | Auth, Org and Owners registration and preferences |

### Outbound flow

| Destination | Via | Description |
|---|---|---|
| `User Store` | Read/Write | Stores users and their preferences |

### Token consumers

The JWT issued by the Auth Service is implicitly consumed by the rest of the backends (`Booking Service`, `Event Service`, `Venue Service`, `Payment Service`) to authorize each actor's actions on their respective domains. Although the container diagram doesn't explicitly draw that arrow toward every service, it's a cross-cutting dependency: **any service receiving an authenticated request trusts the token issued here.**

## Design notes

- The `Backstage` frontend is shared between the Events team (*Aura*) and the Venues team (*SubAgentes*), but both rely on Auth to authenticate Organizers and Venue Owners.
- As a *Support*-type subdomain, the Auth Service does not contain "core" business logic (such as pricing or seat availability); its complexity lies in security and identity consistency, not in event domain rules.