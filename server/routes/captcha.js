const express = require('express');
const svgCaptcha = require('svg-captcha');
const crypto = require('crypto');

const router = express.Router();

// In-memory CAPTCHA store: { sessionId: { text, expiresAt } }
const captchaStore = new Map();

const CAPTCHA_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Cleanup expired entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of captchaStore) {
    if (now > val.expiresAt) captchaStore.delete(key);
  }
}, 60000);

// GET /api/captcha/generate — create a new CAPTCHA image + session
router.get('/generate', (req, res) => {
  try {
    const sessionId = crypto.randomBytes(16).toString('hex');

    const captcha = svgCaptcha.create({
      size: 5,
      noise: 3,
      color: true,
      background: '#0d0d1f',
      width: 280,
      height: 60,
      fontSize: 46,
      charPreset: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    });

    captchaStore.set(sessionId, {
      text: captcha.text,
      expiresAt: Date.now() + CAPTCHA_EXPIRY_MS
    });

    console.log(`[CAPTCHA] Generated session ${sessionId.substring(0, 8)}... answer: ${captcha.text}`);

    res.json({ sessionId, svg: captcha.data });
  } catch (err) {
    console.error('CAPTCHA generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate CAPTCHA' });
  }
});

// POST /api/captcha/verify — verify CAPTCHA answer
router.post('/verify', (req, res) => {
  try {
    const { sessionId, captchaAnswer, lead } = req.body;

    if (!sessionId || !captchaAnswer) {
      return res.status(400).json({ error: 'CAPTCHA session and answer are required' });
    }

    // Validate lead fields
    if (!lead || !lead.name || !lead.email || !lead.phone) {
      return res.status(400).json({ error: 'Name, email, and phone are required' });
    }

    const entry = captchaStore.get(sessionId);

    if (!entry) {
      return res.status(400).json({
        error: 'CAPTCHA expired or invalid. Please refresh and try again.',
        needRefresh: true
      });
    }

    // Delete session immediately (single-use)
    captchaStore.delete(sessionId);

    if (Date.now() > entry.expiresAt) {
      return res.status(400).json({
        error: 'CAPTCHA expired. Please refresh and try again.',
        needRefresh: true
      });
    }

    if (captchaAnswer.trim().toLowerCase() !== entry.text.toLowerCase()) {
      return res.status(400).json({
        error: 'Incorrect CAPTCHA. Please try again with a new one.',
        needRefresh: true
      });
    }

    // CAPTCHA verified
    console.log(`[CAPTCHA] Verified lead: ${lead.name} (${lead.email})`);
    res.json({ success: true, message: 'Lead submitted successfully' });
  } catch (err) {
    console.error('CAPTCHA verify error:', err.message);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

module.exports = router;
