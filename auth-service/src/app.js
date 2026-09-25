const express = require('express');

function createApp() {
  const app = express();

  app.use(express.json());

  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Health check
   *     responses:
   *       200:
   *         description: Service is up
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: ok
   */
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  return app;
}

module.exports = createApp;
