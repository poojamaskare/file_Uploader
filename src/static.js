const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));

const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir, {
  etag: false,
  lastModified: false,
  cacheControl: false,
}))

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.FRONTEND_PORT || process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Frontend served at http://localhost:${PORT}`);
});
