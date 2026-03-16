'use strict';

/**
 * Twilio Voice TwiML routes
 * ──────────────────────────────────────────────────────────────────────────
 *
 *  POST /voice/outgoing
 *    Called by Twilio when the browser SDK (Twilio.Device.connect) makes
 *    an outbound call.  Set this URL as the "Voice Request URL" on your
 *    TwiML App in the Twilio Console.
 *
 *  POST /voice/incoming
 *    Called by Twilio when someone calls your Twilio phone number.
 *    Set this URL as the "A CALL COMES IN" webhook on your Twilio number.
 *
 * ──────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const twilio  = require('twilio');

const router       = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

// ─── POST /voice/outgoing ────────────────────────────────────────────────────

router.post('/outgoing', (req, res) => {
  /**
   * Twilio sends the params your browser SDK passed to Device.connect().
   * We always pass { To: '<e164-number>' } from the frontend.
   */
  const { To } = req.body;
  const twiml  = new VoiceResponse();

  if (!To) {
    twiml.say({ voice: 'alice' }, 'No destination number was provided. Goodbye.');
    return res.type('text/xml').send(twiml.toString());
  }

  if (!isValidPhoneNumber(To) && !isClientIdentity(To)) {
    console.warn(`[/voice/outgoing] Rejected invalid To="${To}"`);
    twiml.say({ voice: 'alice' }, 'The provided number is not valid. Goodbye.');
    return res.type('text/xml').send(twiml.toString());
  }

  console.log(`[/voice/outgoing] Dialling To="${To}"  callerId="${process.env.TWILIO_PHONE_NUMBER}"`);

  const dial = twiml.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER,  // REPLACE_THIS: your Twilio number
    record:   'do-not-record',                  // change to 'record-from-answer' to record
    timeout:  30,
    answerOnBridge: true,
  });

  if (isClientIdentity(To)) {
    // Calling another browser softphone by Twilio client identity
    // Strip the "client:" prefix Twilio sends back
    dial.client(To.replace(/^client:/, ''));
  } else {
    dial.number(To);
  }

  res.type('text/xml').send(twiml.toString());
});

// ─── POST /voice/incoming ────────────────────────────────────────────────────

router.post('/incoming', (req, res) => {
  const { From, To, CallSid } = req.body;

  console.log(`[/voice/incoming] CallSid=${CallSid}  From="${From}"  To="${To}"`);

  const twiml = new VoiceResponse();

  // Say a greeting first
  twiml.say({ voice: 'alice', language: 'da-DK' },
    'Tak for dit opkald. Vent venligst mens vi forbinder dig.',
  );

  // Forward to the browser softphone client.
  // REPLACE_THIS: change 'browser-user' to the agent identity you want to ring.
  // In production you would look up which agent is on duty and use their identity.
  const dial = twiml.dial({
    timeout:      20,
    hangupOnStar: true,
  });
  dial.client('browser-user'); // REPLACE_THIS: dynamic agent identity

  res.type('text/xml').send(twiml.toString());
});

// ─── POST /voice/call  (optional REST-API triggered call) ────────────────────

router.post('/call', async (req, res) => {
  /**
   * Server-side outbound call (not initiated from the browser SDK).
   * Useful for automated dialling, CRM-triggered calls, etc.
   *
   * Body:  { to: "+4512345678", from: "+4587654321" (optional) }
   */
  const { to, from } = req.body;

  if (!to || !isValidPhoneNumber(to)) {
    return res.status(400).json({ error: 'Missing or invalid "to" (E.164 format required, e.g. +4512345678)' });
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, SERVER_URL } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return res.status(500).json({ error: 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured' });
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  try {
    const call = await client.calls.create({
      to,
      from:  from ?? TWILIO_PHONE_NUMBER,
      url:   `${SERVER_URL}/voice/outgoing`,    // REPLACE_THIS: your ngrok/production URL
      method: 'POST',
    });

    console.log(`[/voice/call] REST call initiated  sid=${call.sid}  to="${to}"`);
    res.json({ ok: true, sid: call.sid, status: call.status });
  } catch (err) {
    console.error('[/voice/call] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates E.164 phone numbers: +[1-9][7-14 digits]
 * Examples: +4512345678  +15551234567  +447700900123
 */
function isValidPhoneNumber(n) {
  return typeof n === 'string' && /^\+[1-9]\d{7,14}$/.test(n);
}

/**
 * Twilio sends "client:alice" when dialling a browser identity.
 */
function isClientIdentity(n) {
  return typeof n === 'string' && n.startsWith('client:');
}

module.exports = router;
