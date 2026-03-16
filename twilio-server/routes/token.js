'use strict';

/**
 * GET /token
 * ──────────────────────────────────────────────────────────────────────────
 * Issues a Twilio Access Token that the browser Twilio.Device uses to:
 *   • Authenticate with Twilio
 *   • Make outbound calls (via the TwiML App)
 *   • Receive inbound calls (incomingAllow: true)
 *
 * Query params:
 *   ?identity=alice   (optional — defaults to "browser-user")
 *
 * TODO (production): replace the identity logic with a real user ID
 * from your JWT/session, e.g.:
 *   const identity = req.user?.id ?? 'anonymous';
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_API_KEY       (create in Twilio Console → Account → API Keys)
 *   TWILIO_API_SECRET
 *   TWILIO_TWIML_APP_SID (create in Twilio Console → Voice → TwiML Apps)
 * ──────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const twilio  = require('twilio');

const router      = express.Router();
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant  = AccessToken.VoiceGrant;

router.get('/', (req, res) => {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    TWILIO_TWIML_APP_SID,
  } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !TWILIO_TWIML_APP_SID) {
    console.error('[/token] One or more required Twilio env vars are not set.');
    return res.status(500).json({
      error: 'Twilio server is not configured. Set all TWILIO_* env vars in .env.',
    });
  }

  // Sanitise and limit identity to what Twilio allows
  // TODO (production): derive from authenticated user session
  const rawIdentity = req.query.identity ?? 'browser-user';
  const identity    = sanitiseIdentity(String(rawIdentity));

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: true,          // allow browser to receive calls
  });

  const token = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    {
      identity,
      ttl: 3600,                  // 1 hour — SDK fires tokenWillExpire ~3 min before
    },
  );

  token.addGrant(voiceGrant);

  console.log(`[/token] Issued token  identity="${identity}"  ttl=3600s`);

  res.json({
    token:    token.toJwt(),
    identity,
    expires:  new Date(Date.now() + 3600 * 1000).toISOString(),
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Twilio identity rules:
 *   - Letters, digits, dashes, underscores only
 *   - Max 121 characters
 */
function sanitiseIdentity(raw) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 121);
}

module.exports = router;
