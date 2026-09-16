# 🔐 Auth Service — Ticket D-Saster

> **Subdomain:** Auth / User Management (team *Ninjava*)

> **Type:** Support

## 📌 Description

The **Auth Service** is the microservice responsible for **user authentication and registration** within the Ticket D-Saster platform. It serves as the identity entry point for the three types of human actors in the system: **Fans/Buyers**, **Organizers**, and **Venue Owners**.

This service does not sell tickets, manage events, or process payments. Its responsibility is to ensure that **whoever claims to be someone actually is**, and to issue the credentials (**JWTs**) that the rest of the services use to trust that identity.

## 🎯 Responsibilities

* Register new users (**Fan, Organizer, Venue Owner**).
* Authenticate existing users (**login**).
* Issue and validate **JWT** tokens.
* Manage basic user preferences (profile data).
* Persist users and their preferences in the **User Store**.

### Out of Scope

The following responsibilities do not belong to this service:

* Process payments → *Payment Service*.
* Manage events, venues, or tickets → *Event Service* / *Venue Service* / *Booking Service*.
* Manage queue logic or seat reservations → *Booking Service*.

## 🧩 Context within the Domain (DDD)

| Aspect                    | Details                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Bounded Context**       | `Auth / UserManagement`                                                                                    |
| **Subdomain Type**        | Support (supporting subdomain; it is not the business core, but it is necessary for the system to operate) |
| **Main Entities**         | `Fan`, `Organizer`, `VenueOwner`                                                        |
| **Communication Pattern** | Partial **Shared Kernel** through JWT (the token is understood by all consuming contexts)                  |

## 🏗️ Architecture

```text
Fan / Buyer ──┐
              ├──> D-Saster Front ──> Auth Service ──> User Store
Venue Owner ──┤                          │
Organizer ────┘                          │
                                         └── issues JWT used by:
                                             ├── Booking Service
                                             ├── Event Service
                                             └── Venue Service
```

### Flow

* **Input:** HTTP requests from `D-Saster Front` (Fans/Buyers) and from `Backstage` (Organizers and Venue Owners).
* **Output:** JWT + HTTP communication with the other services, which validate the token to authorize actions.
* **Persistence:** `User Store` — stores users and their preferences.

## 📋 Data Model (High Level)

```text
User
├── id
├── name
├── email
├── password (hash)
├── role            // Fan | Organizer | VenueOwner
├── preferences
└── registrationDate
```

## 🔌 Main Endpoints (Proposal)

| Method | Endpoint               | Description                                   | Actor                      |
| ------ | ---------------------- | --------------------------------------------- | -------------------------- |
| `POST` | `/auth/register`       | Registers a new user                          | Fan, Organizer, VenueOwner |
| `POST` | `/auth/login`          | Authenticates the user and returns a JWT      | All                        |
| `POST` | `/auth/refresh`        | Renews an expired token                       | All                        |
| `GET`  | `/auth/me`             | Returns the authenticated user's profile      | All                        |
| `PUT`  | `/auth/me/preferences` | Updates the user's preferences                | All                        |
| `POST` | `/auth/validate`       | (Internal) Validates a JWT for other services | Internal Services          |

## ✅ Relevant Non-Functional Requirements

* The JWT must be independently validated by external services without requiring a request back to Auth on every request (**stateless validation**).
* Passwords must never be stored in plain text (**hash + salt**).
* The service must respond quickly during *hot-sale* peaks (**100k concurrent users attempting to log in/purchase**), since it is a prerequisite for entering the purchasing flow.

## 🔗 Related Services

* **Booking Service** (*Sap-atitos*): consumes the JWT issued by Auth to authorize ticket purchases.
* **Event Service** (*Aura*) / **Venue Service** (*SubAgentes*): use the JWT to ensure that only authenticated Organizers/Venue Owners can manage their resources.
* **Payment Service** (*Ninjava*): shares the same domain as Auth but remains an independent service.

## 📚 Documentation

- [C4 Model](docs/architecture/c4-model.md)
- [Functional and Non-Functional Requirements](docs/requirements/functional-requirements.md)
- [Domain-Driven Design](docs/ddd/domain-model.md)
- [Repository Management](docs/contributing/repository-management.md)
- [Code Standards](docs/contributing/code-standards.md)