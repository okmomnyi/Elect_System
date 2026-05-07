/**
 * email.service.js
 *
 * Sends transactional emails via the Brevo (formerly Sendinblue) REST API.
 * Uses Node's built-in https module — zero external dependencies.
 *
 * All public functions return true on success and false on failure so callers
 * can decide whether to surface the error to the user.
 *
 * Required env vars:
 *   BREVO_API_KEY      — Brevo API key (starts with "xkeysib-")
 *   BREVO_SENDER_EMAIL — Verified sender address in your Brevo account
 *   BREVO_SENDER_NAME  — Display name (optional, defaults to "University Voting System")
 */

const https = require('https');

const BREVO_API_KEY    = process.env.BREVO_API_KEY    || '';
const SENDER_EMAIL     = process.env.BREVO_SENDER_EMAIL || '';
const SENDER_NAME      = process.env.BREVO_SENDER_NAME  || 'University Voting System';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(date) {
  if (!date) return 'TBD';
  return new Date(date).toLocaleString('en-KE', {
    timeZone : 'Africa/Nairobi',
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

/**
 * POST a single email to the Brevo Transactional Email API.
 *
 * @param {{ to: string, toName?: string, subject: string, htmlContent: string }} opts
 * @returns {Promise<void>}  Rejects on non-2xx or network error.
 */
function postToBrevo({ to, toName, subject, htmlContent }) {
  if (!BREVO_API_KEY) {
    return Promise.reject(new Error('BREVO_API_KEY is not configured'));
  }
  if (!SENDER_EMAIL) {
    return Promise.reject(new Error('BREVO_SENDER_EMAIL is not configured'));
  }

  const body = JSON.stringify({
    sender   : { name: SENDER_NAME, email: SENDER_EMAIL },
    to       : [{ email: to, name: toName || to }],
    subject,
    htmlContent,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.brevo.com',
        path    : '/v3/smtp/email',
        method  : 'POST',
        headers : {
          'api-key'       : BREVO_API_KEY,
          'Content-Type'  : 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Brevo API ${res.statusCode}: ${raw.slice(0, 300)}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Email Templates
// ─────────────────────────────────────────────────────────────────────────────

function otpTemplate(name, otp) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#1e40af;padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">🗳️ University Voting System</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hi ${escapeHtml(name)},</p>
          <p style="margin:0 0 32px;color:#6b7280;font-size:15px;">Use the one-time code below to sign in. It expires in <strong>10 minutes</strong>.</p>
          <div style="text-align:center;margin:0 0 32px;">
            <span style="display:inline-block;background:#f0f4ff;border:2px dashed #1e40af;border-radius:8px;padding:20px 40px;font-size:36px;font-weight:bold;letter-spacing:12px;color:#1e40af;font-family:monospace;">${escapeHtml(otp)}</span>
          </div>
          <p style="margin:0;color:#9ca3af;font-size:13px;">If you did not request this code, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} University Voting System. This is an automated message — do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function voteConfirmationTemplate(name, electionTitle, receiptToken) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#15803d;padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">✅ Vote Confirmed</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hi ${escapeHtml(name)},</p>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Your vote in <strong>${escapeHtml(electionTitle)}</strong> has been recorded successfully.</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:0 0 24px;">
            <p style="margin:0 0 8px;color:#374151;font-size:13px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Your Vote Receipt</p>
            <p style="margin:0;color:#166534;font-size:13px;font-family:monospace;word-break:break-all;">${escapeHtml(receiptToken)}</p>
          </div>
          <p style="margin:0;color:#6b7280;font-size:14px;">Keep this receipt token. You can use it to verify your vote was counted at any time.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} University Voting System.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function electionOpenedTemplate(name, electionTitle, description, startTime, endTime) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#1e40af;padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">🗳️ Election Now Open</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hi ${escapeHtml(name)},</p>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">An election is now open and your vote counts.</p>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:0 0 24px;">
            <h2 style="margin:0 0 8px;color:#1e40af;font-size:18px;">${escapeHtml(electionTitle)}</h2>
            ${description ? `<p style="margin:0 0 16px;color:#374151;font-size:14px;">${escapeHtml(description)}</p>` : ''}
            <table cellpadding="0" cellspacing="0">
              <tr><td style="color:#6b7280;font-size:13px;padding-right:8px;">Opens:</td><td style="color:#374151;font-size:13px;">${escapeHtml(startTime)}</td></tr>
              ${endTime ? `<tr><td style="color:#6b7280;font-size:13px;padding-right:8px;">Closes:</td><td style="color:#374151;font-size:13px;">${escapeHtml(endTime)}</td></tr>` : ''}
            </table>
          </div>
          <p style="margin:0;color:#6b7280;font-size:14px;">Log in to the voting portal to cast your vote before the election closes.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} University Voting System.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function electionClosedTemplate(name, electionTitle, results, totalVotes) {
  const rows = results.map((r) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">${escapeHtml(r.name || '')}${r.position ? ` <span style="color:#9ca3af;font-size:12px;">(${escapeHtml(r.position)})</span>` : ''}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;text-align:right;color:#1e40af;font-weight:bold;font-size:14px;">${r.vote_count ?? 0}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#374151;padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">📊 Election Closed — Final Results</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hi ${escapeHtml(name)},</p>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px;"><strong>${escapeHtml(electionTitle)}</strong> has closed. Total votes cast: <strong>${totalVotes}</strong>.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:12px 16px;text-align:left;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Candidate</th>
                <th style="padding:12px 16px;text-align:right;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Votes</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} University Voting System.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function passwordResetTemplate(name, resetUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#1e40af;padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">🔑 Reset your password</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hi ${escapeHtml(name)},</p>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">We received a request to reset the password on your University Voting System account. Click the button below to choose a new password. This link expires in <strong>30 minutes</strong>.</p>
          <div style="text-align:center;margin:0 0 32px;">
            <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:bold;font-size:15px;">Reset password</a>
          </div>
          <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Or copy this link into your browser:</p>
          <p style="margin:0 0 24px;color:#1e40af;font-size:12px;word-break:break-all;font-family:monospace;">${escapeHtml(resetUrl)}</p>
          <p style="margin:0;color:#9ca3af;font-size:13px;">If you did not request this, you can safely ignore this email — your password will not change.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} University Voting System. This is an automated message — do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function suspiciousActivityTemplate(details) {
  const severityColor = details.severity === 'high' ? '#dc2626'
    : details.severity === 'medium' ? '#d97706' : '#6b7280';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#7f1d1d;padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">🚨 Security Alert</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 24px;color:#374151;font-size:15px;">Suspicious activity has been detected and requires your attention.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tr style="background:#fef2f2;"><td style="padding:12px 16px;color:#374151;font-size:13px;width:130px;font-weight:bold;">Severity</td><td style="padding:12px 16px;color:${severityColor};font-size:13px;font-weight:bold;text-transform:uppercase;">${escapeHtml(details.severity || 'medium')}</td></tr>
            <tr><td style="padding:12px 16px;color:#374151;font-size:13px;border-top:1px solid #e5e7eb;font-weight:bold;">Type</td><td style="padding:12px 16px;color:#374151;font-size:13px;border-top:1px solid #e5e7eb;">${escapeHtml(details.type || 'Unknown')}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#374151;font-size:13px;border-top:1px solid #e5e7eb;font-weight:bold;">Description</td><td style="padding:12px 16px;color:#374151;font-size:13px;border-top:1px solid #e5e7eb;">${escapeHtml(details.description || '')}</td></tr>
            ${details.userEmail ? `<tr><td style="padding:12px 16px;color:#374151;font-size:13px;border-top:1px solid #e5e7eb;font-weight:bold;">User</td><td style="padding:12px 16px;color:#374151;font-size:13px;border-top:1px solid #e5e7eb;">${escapeHtml(details.userEmail)}</td></tr>` : ''}
            ${details.ipAddress ? `<tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#374151;font-size:13px;border-top:1px solid #e5e7eb;font-weight:bold;">IP Address</td><td style="padding:12px 16px;color:#374151;font-size:13px;border-top:1px solid #e5e7eb;">${escapeHtml(details.ipAddress)}</td></tr>` : ''}
            <tr><td style="padding:12px 16px;color:#374151;font-size:13px;border-top:1px solid #e5e7eb;font-weight:bold;">Time</td><td style="padding:12px 16px;color:#374151;font-size:13px;border-top:1px solid #e5e7eb;">${escapeHtml(details.timestamp || new Date().toISOString())}</td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} University Voting System — Security Notification.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Escapes special HTML characters to prevent XSS in email templates.
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Email Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send OTP / magic-code email.
 * Called DIRECTLY from auth.controller — NOT queued (user is actively waiting).
 * Returns false on failure so the controller can surface the error.
 */
async function sendOtpEmail(email, otp, fullName = null) {
  try {
    await postToBrevo({
      to         : email,
      toName     : fullName || 'Student',
      subject    : 'Your Login Code — University Voting System',
      htmlContent: otpTemplate(fullName || 'Student', otp),
    });
    console.log(`📧 OTP email sent to ${email}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to send OTP email:', err.message);
    return false;
  }
}

/**
 * Send password reset email.
 * Called DIRECTLY from auth.controller — NOT queued (user is actively waiting).
 * Returns false on failure so the controller can surface the error.
 */
async function sendPasswordResetEmail(email, resetUrl, fullName = null) {
  try {
    await postToBrevo({
      to         : email,
      toName     : fullName || 'Student',
      subject    : 'Reset your password — University Voting System',
      htmlContent: passwordResetTemplate(fullName || 'Student', resetUrl),
    });
    console.log(`📧 Password reset email sent to ${email}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to send password reset email:', err.message);
    return false;
  }
}

/**
 * Send vote-confirmation receipt email.
 * Called from the BullMQ sendEmail worker.
 */
async function sendVoteConfirmation(user, election, receiptToken) {
  await postToBrevo({
    to         : user.email,
    toName     : user.full_name,
    subject    : `Vote Confirmed — ${election.title}`,
    htmlContent: voteConfirmationTemplate(user.full_name, election.title, receiptToken),
  });
}

/**
 * Send election-opened notification to a single student.
 * Called from the BullMQ sendEmail worker (one job per student).
 */
async function sendElectionOpenedNotification(user, election) {
  await postToBrevo({
    to         : user.email,
    toName     : user.full_name,
    subject    : `Election Open: ${election.title} — Cast Your Vote`,
    htmlContent: electionOpenedTemplate(
      user.full_name,
      election.title,
      election.description,
      formatDate(election.start_time),
      formatDate(election.end_time)
    ),
  });
}

/**
 * Send election-closed notification with final results to a single admin.
 * Called from the BullMQ sendEmail worker (one job per admin).
 */
async function sendElectionClosedNotification(user, election, results, totalVotes) {
  await postToBrevo({
    to         : user.email,
    toName     : user.full_name,
    subject    : `Election Closed: ${election.title} — Final Results`,
    htmlContent: electionClosedTemplate(user.full_name, election.title, results, totalVotes),
  });
}

/**
 * Send a suspicious-activity security alert to one or more super-admin addresses.
 * Callers are responsible for fetching recipient emails from the DB beforehand.
 *
 * @param {Array<{email: string, full_name: string}>} recipients
 * @param {object} details  — { type, description, userEmail, ipAddress, severity, timestamp }
 */
async function sendSuspiciousActivityAlert(recipients, details) {
  if (!recipients || recipients.length === 0) {
    console.warn('⚠️  sendSuspiciousActivityAlert: no recipients provided — skipping');
    return false;
  }

  const subject = `🚨 Security Alert [${(details.severity || 'medium').toUpperCase()}]: ${details.type || 'Suspicious Activity'}`;
  const html    = suspiciousActivityTemplate({
    ...details,
    timestamp: details.timestamp || new Date().toISOString(),
  });

  const results = await Promise.allSettled(
    recipients.map((r) =>
      postToBrevo({ to: r.email, toName: r.full_name, subject, htmlContent: html })
    )
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`❌ Suspicious activity alert: ${failed.length}/${recipients.length} emails failed`);
  } else {
    console.log(`🚨 Suspicious activity alert sent to ${recipients.length} super-admin(s)`);
  }

  return failed.length === 0;
}

/**
 * Quick reachability check for the Brevo API.
 * Returns true if the API key is configured and the endpoint is reachable.
 */
async function healthCheck() {
  if (!BREVO_API_KEY || !SENDER_EMAIL) return false;

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.brevo.com',
        path    : '/v3/account',
        method  : 'GET',
        headers : { 'api-key': BREVO_API_KEY },
        timeout : 5000,
      },
      (res) => resolve(res.statusCode >= 200 && res.statusCode < 400)
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

module.exports = {
  sendOtpEmail,
  sendPasswordResetEmail,
  sendVoteConfirmation,
  sendElectionOpenedNotification,
  sendElectionClosedNotification,
  sendSuspiciousActivityAlert,
  healthCheck,
};
