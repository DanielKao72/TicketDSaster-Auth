# Functional and Non-Functional Requirements — Auth Service

## Functional Requirements

### Derived from Venue Owner
- The venue owner must be able to **register and authenticate** before being able to register their venue.

### Derived from Organizer
- The organizer must be able to **register and authenticate** before being able to publish an event or schedule its sale.

### Derived from Fan / Buyer
- The fan must be able to **register and/or log in** before being able to reserve a seat and complete a purchase.
- The purchase session (ticket hold, 5-minute countdown) is tied to an authenticated user — meaning Auth is a prerequisite for the `Fan — purchase` flow.

### Service's own requirements (inferred from the design)

- The system must allow **registering** a new user, specifying their role: `Fan`, `Organizer`, or `Venue Owner`.
- The system must allow **logging in** and returning a valid token (JWT).
- The system must allow **validating a token** so other services (Booking, Event, Venue, Payment) can trust the user's identity.

## Non-Functional Requirements

| # | Description | Origin / Justification |
|---|---|---|
| NFR-1 | The service must support authentication spikes concurrent with sales spikes (100k concurrent users during a hot-sale), without degrading response time (< 500ms), since logging in is the first step before entering the purchase queue. | Tied to the general NFR of "100k concurrent users" in the ticket sales module. |
| NFR-2 | Token validation must be **stateless** (self-contained JWT), to avoid becoming a bottleneck when all other services need to validate identity in parallel. | Architectural consequence of NFR-1. |
| NFR-3 | Passwords must be stored with hash + salt, never in plain text. | Security best practice, not explicit in the original document but mandatory given the payment handling associated with the user. |
| NFR-4 | Given two concurrent login/registration attempts with the same email, the system must guarantee user uniqueness (avoid duplicates), analogous to the NFR for "two users buying the same ticket." | Extrapolated from the concurrency NFR of the ticket assignment module. |