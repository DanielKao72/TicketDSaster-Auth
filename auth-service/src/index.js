const App = require('./infrastructure/express/App');
const Persistence = require('./infrastructure/Persistence');
const config = require('./infrastructure/config/Env');

async function start() {
  const persistence = await Persistence.connect(config);
  const app = new App(persistence.dependencies).build();

  const server = app.listen(config.port, () => {
    console.log(`[auth-service] listening on port ${config.port} (${config.nodeEnv})`);
  });

  const shutdown = () => {
    server.close(() => persistence.close());
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start().catch((error) => {
  console.error(`[auth-service] failed to start: ${error.message}`);
  process.exit(1);
});
