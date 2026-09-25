const fs = require('node:fs');
const path = require('node:path');
const swaggerJsdoc = require('swagger-jsdoc');
const { version } = require('../package.json');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'TicketDSaster Auth Service API',
      version: process.env.API_VERSION || version,
    },
  },
  // swagger-jsdoc globs need forward slashes, even on Windows
  apis: [path.join(__dirname, '../src/**/*.js').replace(/\\/g, '/')],
});

const outDir = path.join(__dirname, '../dist');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'openapi.json'), JSON.stringify(spec, null, 2));
console.log(`OpenAPI ${spec.info.version} written to dist/openapi.json`);
