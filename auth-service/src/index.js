const App = require('./infrastructure/express/App');
const { port, nodeEnv } = require('./infrastructure/config/Env');

const app = new App().build();

app.listen(port, () => {

  console.log(`[auth-service] listening on port ${port} (${nodeEnv})`);
});
