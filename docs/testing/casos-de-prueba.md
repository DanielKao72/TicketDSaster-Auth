# Casos de prueba — Auth Service

Casos manuales y automatizados para las funcionalidades implementadas. Todos están en la colección de Postman [`docs/postman/auth-service.postman_collection.json`](../postman/auth-service.postman_collection.json), con el mismo ID en el nombre de cada request.

## Cómo ejecutarlos

1. Levanta el servicio (`docker compose up --build` desde la raíz) con `JWT_SECRET`, `STAFF_USERNAME` y `STAFF_PASSWORD` definidos en `auth-service/.env`.
2. En Postman: **Import** → el archivo de la colección.
3. En la pestaña **Variables** de la colección:
   - `baseUrl`: `http://localhost:4000` por defecto.
   - `jwtSecret`: el mismo valor que `JWT_SECRET` del `.env`. Solo lo usa VAL-07.
4. Ejecuta la colección completa con **Run collection**, en orden. Cada carpeta usa variables que guardan las anteriores (códigos de invitación, `userId`, `accessToken`).
5. Puedes repetir la ejecución sin reiniciar el servicio: H-01 genera un `runId` nuevo y todos los usernames lo llevan como sufijo.

Si ejecutas requests sueltos, respeta las dependencias: los REG necesitan los códigos de INV-01 a INV-03, LOG-01 necesita REG-01 y los VAL necesitan el token de LOG-01.

Resultado esperado: **98 aserciones, 0 fallos**.

El almacenamiento es en memoria: al reiniciar el contenedor se pierden usuarios, credenciales e invitaciones.

## 01 · Health — `GET /health`

| ID | Entrada | Resultado esperado | Interpretación |
|---|---|---|---|
| H-01 | Sin body | `200` `{"status":"ok"}` | El servicio está arriba. Es el endpoint que usa el `HEALTHCHECK` del Dockerfile. |

## 02 · Invitaciones — `POST /invitations` (PA-01)

Hoy no exige credencial de staff: el guard PA-01-T2 está pendiente, así que cualquiera puede generar invitaciones.

| ID | Entrada | Resultado esperado | Interpretación |
|---|---|---|---|
| INV-01 | `{"role":"VENUE_OWNER"}` | `201` `{code, role:"VENUE_OWNER", createdAt}`; `code` con formato `XXXX-XXXX-XXXX` | Código de 12 caracteres en 3 grupos. Excluye caracteres ambiguos (`0 O 1 I L U`) porque el staff lo entrega a mano. |
| INV-02 | `{"role":"ORGANIZER"}` | `201`, `role:"ORGANIZER"` | Segundo rol de partner admitido. |
| INV-03 | `{"role":"ORGANIZER"}` otra vez | `201` con un código distinto de INV-01 e INV-02 | Los códigos son aleatorios (`node:crypto`) y únicos en el store. Este código se guarda como `spareCode`. |
| INV-04 | `{}` | `400` `{"error":"Invalid request body","details":{"role":"role is required and must be one of: VENUE_OWNER, ORGANIZER"}}` | El rol es obligatorio. |
| INV-05 | `{"role":"FAN"}` | `400` `Invalid request body` | Solo se invita a partners; FAN no está en el catálogo de roles. |
| INV-06 | `{"role":"organizer"}` | `400` | El rol distingue mayúsculas. |
| INV-07 | `{"role":["ORGANIZER"]}` | `400` | Un tipo distinto de string no se acepta. |
| INV-08 | `Content-Type: text/plain`, body `role=ORGANIZER` | `400` | Sin JSON el body llega vacío y se trata como rol ausente. |
| INV-09 | `{"role": "ORGANIZER"` (JSON mal formado) | `400` `Malformed JSON body` | Un JSON roto es un error del cliente, no del servidor. Aplica a cualquier `POST`. |

## 03 · Registro — `POST /auth/register` (PA-02 a PA-06)

Body: `{ "username", "password", "invitationCode" }`. Orden de validación: campos obligatorios → tipos (string) → política de contraseña → username duplicado → invitación.

| ID | Entrada | Resultado esperado | Interpretación |
|---|---|---|---|
| REG-01 | username nuevo, password `Secret123!`, código de INV-02 | `201` `{id, username, role:"ORGANIZER"}`; `id` es UUID | Registro correcto. La respuesta no expone la contraseña ni el hash. |
| REG-02 | código de INV-01 y además `"role":"ORGANIZER"` en el body | `201` con `role:"VENUE_OWNER"` | PA-04: el rol lo dicta la invitación; el que mande el cliente se ignora. Evita que alguien se asigne otro rol. |
| REG-03 | código de INV-02 (ya usado en REG-01), username nuevo | `400` `Invitation code has already been used` | PA-03: el código es de un solo uso. |
| REG-04 | username de REG-01, código `spareCode` | `409` `Username '…' is already taken` | PA-05: usernames únicos. El código **no** se consume (lo confirma REG-12). |
| REG-05 | código `AAAA-BBBB-CCCC` | `400` `Invitation code not found` | Código inexistente. |
| REG-06 | `spareCode` en minúsculas | `400` `Invitation code not found` | Los códigos distinguen mayúsculas; el usuario debe escribirlos tal cual se entregan. |
| REG-07 | password `Abc1234` (7 caracteres) | `400` `Password must be at least 8 characters long` | PA-06: se rechaza antes de tocar el store, sin consumir el código. |
| REG-08 | sin `username` | `400` `username, password and invitationCode are required` | Campo obligatorio. |
| REG-09 | sin `password` | `400`, mismo mensaje | Campo obligatorio. |
| REG-10 | sin `invitationCode` | `400`, mismo mensaje | Campo obligatorio. |
| REG-11 | `{}` | `400`, mismo mensaje | Body vacío. |
| REG-12 | password `abcdefgh` (8 exactos), código `spareCode` | `201` | Valor límite de la política. Como usa `spareCode`, también demuestra que REG-04, REG-06 y REG-07 no consumieron el código. |
| REG-13 | `"password": 12345678` (número), código nuevo | `400` `username, password and invitationCode must be strings` | Los tres campos deben ser texto. |
| REG-14 | mismo username **y mismo código** que REG-13, con password válido | `201` | Un registro rechazado no deja usuarios a medias ni consume el código. |

## 04 · Login — `POST /auth/login` (PA-07)

Body: `{ "username", "password" }`.

| ID | Entrada | Resultado esperado | Interpretación |
|---|---|---|---|
| LOG-01 | usuario de REG-01, `Secret123!` | `200` `{accessToken, tokenType:"Bearer", expiresIn:28800}` | Login correcto. El payload del JWT solo contiene `sub` (id del usuario), `role`, `iat` y `exp`, firmado con HS256. `exp - iat = expiresIn` (8 h por defecto, `JWT_EXPIRES_IN_SECONDS`). |
| LOG-02 | password incorrecto | `401` `Invalid username or password` | Credenciales inválidas. |
| LOG-03 | usuario inexistente | `401` con **el mismo** mensaje | No revela si el username existe (evita enumerar usuarios). |
| LOG-04 | username con otras mayúsculas (`ORG_…`) | `401` | Los usernames distinguen mayúsculas. |
| LOG-05 | sin `password` | `400` `username and password are required` | Campo obligatorio. |
| LOG-06 | sin `username` | `400`, mismo mensaje | Campo obligatorio. |
| LOG-07 | usuario de REG-12, `abcdefgh` | `200` | Un usuario creado en el valor límite puede iniciar sesión. |
| LOG-08 | `"password": 12345678` (número) | `400` `username and password must be strings` | Ambos campos deben ser texto. |
| LOG-09 | `GET /auth/login` | `404` `Not found` | Solo existe `POST`. |

## 05 · Validación de JWT — `POST /auth/validate` (PA-08-T2)

Contrato para servicios downstream. Acepta el token en el body (`{"token"}`) o en `Authorization: Bearer <token>`.

| ID | Entrada | Resultado esperado | Interpretación |
|---|---|---|---|
| VAL-01 | `{"token": <token de LOG-01>}` | `200` `{valid:true, sub, role:"ORGANIZER", iat, exp}` | Token legítimo; `sub` coincide con el id de REG-01. |
| VAL-02 | header `Authorization: Bearer <token>`, sin body | `200` `valid:true` | Forma alternativa de enviar el token. |
| VAL-03 | `{}` | `400` `Token is required` | Falta el token. |
| VAL-04 | `{"token":"token-invalido.falso.firma"}` | `401` `{valid:false, error:"Invalid token signature"}` | Texto que no es un JWT. |
| VAL-05 | token de LOG-01 con `role` cambiado a `VENUE_OWNER` y la firma original | `401` `Invalid token signature` | Simula una escalada de privilegios: modificar el payload invalida la firma. |
| VAL-06 | token bien formado firmado con otro secreto | `401` `Invalid token signature` | Solo valen los tokens firmados con `JWT_SECRET`. |
| VAL-07 | token firmado con `jwtSecret` y `exp` en el pasado | `401` `Token expired` | Expiración. Si `jwtSecret` no coincide con el `.env`, la respuesta será `Invalid token signature`. |

## 06 · JWKS — `GET /.well-known/jwks.json` (PA-08-T2)

| ID | Entrada | Resultado esperado | Interpretación |
|---|---|---|---|
| JWKS-01 | Sin body | `200` `keys[0]` con `kty:"oct"`, `alg:"HS256"`, `use:"sig"`, **sin** campo `k` | Publica la estrategia de firma (simétrica) sin exponer el secreto. Los consumidores necesitan el `JWT_SECRET` por otra vía. |

## 07 · General

| ID | Entrada | Resultado esperado | Interpretación |
|---|---|---|---|
| GEN-01 | `GET /no-existe` | `404` `{"error":"Not found"}` | Rutas desconocidas. |

## Defectos corregidos

Estos defectos aparecieron al diseñar los casos. Hoy los cubren INV-09, REG-13, REG-14 y LOG-08.

| ID | Comportamiento anterior | Corrección |
|---|---|---|
| D1 | Un JSON mal formado respondía `500`. | `error-handler.js` responde `400` a los errores de parseo de `express.json()`. |
| D2 | Un `password` numérico en el registro respondía `500` y dejaba creado un usuario sin credencial, con el username bloqueado. | Los controladores validan que los campos sean strings, `validatePasswordPolicy` comprueba el tipo y `registerPartner` hashea antes de crear el usuario. |
| D3 | Un `password` numérico en el login respondía `500`. | `login.controller.js` valida tipos y responde `400`. |

## Fuera del alcance de estas pruebas

- **Credencial de staff en `/invitations` (PA-01-T2):** no implementada. Cuando exista, añadir casos de `401` sin credencial y `201` con `STAFF_USERNAME`/`STAFF_PASSWORD`.
- **Middleware `authenticateJwt`:** existe, pero ninguna ruta lo usa todavía; solo tiene tests unitarios.
- **Endpoints del README aún no implementados:** `/auth/refresh`, `/auth/me`, `/auth/me/preferences`.
