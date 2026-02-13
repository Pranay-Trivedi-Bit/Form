require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/otp', require('./routes/otp'));

// Fallback
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Export for Vercel
module.exports = app;

// Listen locally
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`OTP Lead Form running at http://localhost:${PORT}`);
  });
}
