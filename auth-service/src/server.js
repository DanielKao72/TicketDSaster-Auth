const createApp = require('./app');
const { port, nodeEnv } = require('./config/env');

const app = createApp();

app.listen(port, () => {
  
  console.log(`[auth-service] listening on port ${port} (${nodeEnv})`);
});
