const fs = require('node:fs');
const path = require('node:path');
const swaggerJsdoc = require('swagger-jsdoc');
const YAML = require('yaml');
const { version } = require('../package.json');

// Builds the spec from the @openapi JSDoc blocks next to each route
// (infrastructure/express/App.js and routes/). Shared schemas and security
// schemes live here so the route blocks can $ref them.
function buildSpec() {
  return swaggerJsdoc({
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'TicketDSaster Auth Service API',
        version: process.env.API_VERSION || version,
        description:
          'Registers and authenticates partners (VENUE_OWNER, ORGANIZER) and issues the HS256 JWTs ' +
          'that Booking, Event and Venue services validate statelessly.',
      },
      components: {
        securitySchemes: {
          staffBasicAuth: {
            type: 'http',
            scheme: 'basic',
            description: 'Staff credential (STAFF_USERNAME / STAFF_PASSWORD). PA-01-T2.',
          },
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            required: ['error'],
            properties: { error: { type: 'string', example: 'Invalid username or password' } },
          },
          Role: {
            type: 'string',
            enum: ['VENUE_OWNER', 'ORGANIZER'],
          },
        },
        headers: {
          RetryAfter: {
            description: 'Seconds until the client may try again.',
            schema: { type: 'integer', example: 10 },
          },
        },
        responses: {
          TooManyFailedAttempts: {
            description:
              'Too many failed attempts from this client IP within the window (RATE_LIMIT_MAX_FAILED / ' +
              'RATE_LIMIT_WINDOW_MS). Successful attempts do not count.',
            headers: { 'Retry-After': { $ref: '#/components/headers/RetryAfter' } },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Too many failed attempts, try again later' },
              },
            },
          },
          ServiceUnavailable: {
            description: 'Postgres or Redis is down or its circuit is open (fail closed).',
            headers: { 'Retry-After': { $ref: '#/components/headers/RetryAfter' } },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Service temporarily unavailable' },
              },
            },
          },
        },
      },
    },
    // swagger-jsdoc globs need forward slashes, even on Windows
    apis: [path.join(__dirname, '../src/**/*.js').replace(/\\/g, '/')],
  });
}

function writeSpec(spec) {
  const outDir = path.join(__dirname, '../dist');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'openapi.json'), JSON.stringify(spec, null, 2));
  fs.writeFileSync(path.join(outDir, 'openapi.yaml'), YAML.stringify(spec));
  console.log(`OpenAPI ${spec.info.version} written to dist/openapi.json and dist/openapi.yaml`);
}

if (require.main === module) {
  writeSpec(buildSpec());
}

module.exports = { buildSpec };
