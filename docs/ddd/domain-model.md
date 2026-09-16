# Domain-Driven Design — Auth / User Management

![DDD Context Domains](/docs/ddd/DDD%20-%20Context%20Domains.png)

## Location in the domain map

| Attribute | Value |
|---|---|
| Subdomain | `Auth / UserManagement` |
| Classification | **Support** |
| Responsibility | Management of user registration and creation |
| Subdomain entities | `Fan`, `Backstage User` (Organizer / Owner) |

## Ubiquitous Language of the context

| Term | Meaning within this Bounded Context |
|---|---|
| **User** | The system's authenticatable entity; can be a Fan, Organizer, or Venue Owner |
| **Fan / Buyer** | End user who purchases tickets |
| **Backstage User** | Administrative user: Organizer or Venue Owner |
| **Session** | Period of validity of a user's authentication (not to be confused with the "Session" in the Sales domain, which refers to the purchase/seat hold) |
| **Token (JWT)** | Signed credential representing a user's authenticated identity to other contexts |

## Relationship with other Bounded Contexts

According to the subdomain communication map, Auth acts as an identity provider for the other contexts through a pattern close to **Shared Kernel**:

```text
Auth/UserManagement ──(JWT)──> Sales
Auth/UserManagement ──(JWT)──> EventManagement
Auth/UserManagement ──(JWT)──> VenueManagement
```


- **Integration pattern:** the issued JWT is the "shared element" that other contexts consume without needing to know the internal details of how Auth validates credentials, each context only trusts the token's signature.
- This prevents Auth from becoming a **Conformist** to anyone, and other contexts don't need an Anti-Corruption Layer to talk to it: the contract (JWT) is simple and stable.