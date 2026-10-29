import { wrapInBaseLayout, escapeHtml, RenderedTemplate } from './base-layout';

export interface VerifyEmailData {
  name: string;
  email: string;
  verifyUrl: string;
  token: string;
  expiresHours?: number;
}

export interface WelcomePendingApprovalData {
  name: string;
  email: string;
  supportEmail?: string;
}

export interface AccountApprovedData {
  name: string;
  email: string;
  role: string;
  loginUrl: string;
}

export interface AccountRejectedData {
  name: string;
  email: string;
  reason?: string;
}

export interface PasswordResetData {
  name: string;
  email: string;
  resetUrl: string;
  token: string;
  expiresMinutes?: number;
}

export interface PasswordChangedData {
  name: string;
  email: string;
  changedAt: string;
  loginUrl: string;
}

export interface NewLoginAlertData {
  name: string;
  email: string;
  deviceLabel: string;
  location: string;
  ip: string;
  time: string;
  secureAccountUrl: string;
}

export interface SecurityAlertData {
  name: string;
  email: string;
  reason: string;
  incidentTime: string;
  accountLocked: boolean;
  unlockUrl?: string;
}

export interface MobileOperatorApprovedData {
  name: string;
  email: string;
  portalUrl: string;
}

export interface DeviceApprovedData {
  name: string;
  deviceLabel: string;
  cameraId: string;
  streamUrl: string;
}

export interface InviteData {
  inviterName: string;
  recipientEmail: string;
  role: string;
  inviteUrl: string;
  expiresDays?: number;
}

export const emailTemplates = {
  verifyEmail: (data: VerifyEmailData): RenderedTemplate => {
    const hours = data.expiresHours ?? 24;
    return wrapInBaseLayout({
      title: 'Verify Your Sentinel Vision AI Account',
      preheader: 'Please confirm your email address to proceed with account approval.',
      bodyContent: `
        <h2 class="heading">Confirm Your Identity</h2>
        <p class="text">Hello ${escapeHtml(data.name)},</p>
        <p class="text">A registration request was submitted for Sentinel Vision AI. Please verify your email address to continue the security verification process.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${escapeHtml(data.verifyUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Verify Email Address</a>
        </div>
        <div class="meta-box">
          <div><strong>Verification Token:</strong> ${escapeHtml(data.token)}</div>
          <div><strong>Validity:</strong> Expires in ${hours} hours</div>
          <div><strong>Security:</strong> Single-use cryptographic token</div>
        </div>
        <p class="text" style="font-size: 12px; color: #a1a1aa;">Or paste this URL directly into your browser: <br>${escapeHtml(data.verifyUrl)}</p>
      `,
      textContent: `Hello ${data.name},\n\nPlease verify your email address by visiting this link within ${hours} hours:\n${data.verifyUrl}\n\nToken: ${data.token}`,
    });
  },

  welcomePendingApproval: (data: WelcomePendingApprovalData): RenderedTemplate => {
    return wrapInBaseLayout({
      title: 'Registration Received · Security Clearance Pending',
      preheader: 'Your account has been verified and is awaiting administrator authorization.',
      bodyContent: `
        <h2 class="heading">Awaiting Administrative Authorization</h2>
        <p class="text">Hello ${escapeHtml(data.name)},</p>
        <p class="text">Your email address has been verified successfully. Under statutory security protocols, your account is now in <strong>pending approval</strong> status.</p>
        <p class="text">A systems administrator or division supervisor will review your access request and assign appropriate operational credentials (Investigator, Reviewer, or Viewer).</p>
        <div class="meta-box">
          <div><strong>Account Email:</strong> ${escapeHtml(data.email)}</div>
          <div><strong>Status:</strong> PENDING_ADMIN_APPROVAL</div>
          <div><strong>Notice:</strong> You will receive an automated notification once reviewed.</div>
        </div>
      `,
      textContent: `Hello ${data.name},\n\nYour account (${data.email}) is verified and awaiting security clearance approval by an administrator. You will be notified once activated.`,
    });
  },

  accountApproved: (data: AccountApprovedData): RenderedTemplate => {
    return wrapInBaseLayout({
      title: 'Access Granted · Your Sentinel Account is Active',
      preheader: 'Your clearance has been approved. You may now sign in.',
      bodyContent: `
        <h2 class="heading">Access Clearance Approved</h2>
        <p class="text">Hello ${escapeHtml(data.name)},</p>
        <p class="text">Your account has been verified and authorized for active service on the Sentinel Vision AI platform.</p>
        <div class="meta-box">
          <div><strong>Assigned Role:</strong> ${escapeHtml(data.role.toUpperCase())}</div>
          <div><strong>Access Level:</strong> Operational Console Authorized</div>
          <div><strong>Status:</strong> ACTIVE</div>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${escapeHtml(data.loginUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Sign In to Command Center</a>
        </div>
      `,
      textContent: `Hello ${data.name},\n\nYour Sentinel Vision AI account has been approved with role [${data.role}]. Sign in at: ${data.loginUrl}`,
    });
  },

  accountRejected: (data: AccountRejectedData): RenderedTemplate => {
    return wrapInBaseLayout({
      title: 'Sentinel Vision AI Access Request Update',
      preheader: 'Your registration request could not be authorized at this time.',
      bodyContent: `
        <h2 class="heading">Authorization Request Denied</h2>
        <p class="text">Hello ${escapeHtml(data.name)},</p>
        <p class="text">After review by command administration, your request for access to the Sentinel Vision AI platform has been declined.</p>
        ${data.reason ? `<div class="meta-box"><strong>Reason:</strong> ${escapeHtml(data.reason)}</div>` : ''}
        <p class="text">If you believe this determination was made in error, please consult your department liaison.</p>
      `,
      textContent: `Hello ${data.name},\n\nYour access request to Sentinel Vision AI has been declined. ${data.reason ? 'Reason: ' + data.reason : ''}`,
    });
  },

  passwordReset: (data: PasswordResetData): RenderedTemplate => {
    const mins = data.expiresMinutes ?? 30;
    return wrapInBaseLayout({
      title: 'Password Reset Request',
      preheader: 'Instructions to reset your Sentinel Vision AI credentials.',
      bodyContent: `
        <h2 class="heading">Password Reset Verification</h2>
        <p class="text">Hello ${escapeHtml(data.name)},</p>
        <p class="text">We received a request to reset the password associated with your account (${escapeHtml(data.email)}).</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${escapeHtml(data.resetUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Reset Password</a>
        </div>
        <div class="meta-box">
          <div><strong>Validity:</strong> Expires in ${mins} minutes</div>
          <div><strong>Security Note:</strong> If you did not initiate this request, no action is required and your password remains unchanged.</div>
        </div>
      `,
      textContent: `Hello ${data.name},\n\nReset your password at: ${data.resetUrl}\nExpires in ${mins} minutes.`,
    });
  },

  passwordChanged: (data: PasswordChangedData): RenderedTemplate => {
    return wrapInBaseLayout({
      title: 'Security Notice · Password Updated',
      preheader: 'Your Sentinel Vision AI password was recently changed.',
      bodyContent: `
        <h2 class="heading">Credentials Modified</h2>
        <p class="text">Hello ${escapeHtml(data.name)},</p>
        <p class="text">The password for your account was changed on <strong>${escapeHtml(data.changedAt)}</strong>.</p>
        <p class="text">All existing login sessions have been invalidated as a precautionary security safeguard.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${escapeHtml(data.loginUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Sign In With New Password</a>
        </div>
      `,
      textContent: `Hello ${data.name},\n\nYour password was changed at ${data.changedAt}. All previous sessions were revoked. Login: ${data.loginUrl}`,
    });
  },

  newLoginAlert: (data: NewLoginAlertData): RenderedTemplate => {
    return wrapInBaseLayout({
      title: 'Security Alert: New Sign-In Detected',
      preheader: 'A sign-in to your Sentinel account was detected from an unrecognized device.',
      bodyContent: `
        <h2 class="heading">New Sign-In Detected</h2>
        <p class="text">Hello ${escapeHtml(data.name)},</p>
        <p class="text">A new sign-in was recognized on your account with the following parameters:</p>
        <div class="meta-box">
          <div><strong>Device / Browser:</strong> ${escapeHtml(data.deviceLabel)}</div>
          <div><strong>IP Address:</strong> ${escapeHtml(data.ip)}</div>
          <div><strong>Approx. Location:</strong> ${escapeHtml(data.location)}</div>
          <div><strong>Timestamp:</strong> ${escapeHtml(data.time)}</div>
        </div>
        <p class="text">If this was you, you can safely disregard this message. If you do not recognize this activity, secure your account immediately:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${escapeHtml(data.secureAccountUrl)}" class="btn btn-danger" target="_blank" rel="noopener noreferrer">Secure My Account / Wasn't Me</a>
        </div>
      `,
      textContent: `Hello ${data.name},\n\nNew sign-in detected on ${data.time} from ${data.deviceLabel} (${data.ip}, ${data.location}). If this wasn't you, secure your account immediately: ${data.secureAccountUrl}`,
    });
  },

  securityAlert: (data: SecurityAlertData): RenderedTemplate => {
    return wrapInBaseLayout({
      title: 'CRITICAL SECURITY ALERT · Token Anomaly Detected',
      preheader: 'Security violation detected on your account session family.',
      bodyContent: `
        <h2 class="heading" style="color: #ef4444;">Session Compromise Safeguard Triggered</h2>
        <p class="text">Hello ${escapeHtml(data.name)},</p>
        <p class="text">Our threat detection telemetry identified a <strong>token reuse violation</strong>. An expired or previously rotated session token was presented to the API.</p>
        <div class="meta-box">
          <div><strong>Violation:</strong> ${escapeHtml(data.reason)}</div>
          <div><strong>Incident Time:</strong> ${escapeHtml(data.incidentTime)}</div>
          <div><strong>Countermeasure:</strong> Entire token family revoked immediately</div>
          ${data.accountLocked ? `<div style="color: #ef4444;"><strong>Account Status:</strong> Temporarily locked for protection</div>` : ''}
        </div>
        ${data.unlockUrl ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${escapeHtml(data.unlockUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Verify Identity & Unlock</a>
          </div>
        ` : ''}
      `,
      textContent: `CRITICAL ALERT: Token reuse violation detected at ${data.incidentTime}. Reason: ${data.reason}. All active sessions revoked.${data.unlockUrl ? '\nUnlock link: ' + data.unlockUrl : ''}`,
    });
  },

  mobileOperatorApproved: (data: MobileOperatorApprovedData): RenderedTemplate => {
    return wrapInBaseLayout({
      title: 'Mobile Camera Operator Clearance Approved',
      preheader: 'Your mobile broadcasting profile has been activated.',
      bodyContent: `
        <h2 class="heading">Mobile Operator Authorization</h2>
        <p class="text">Hello ${escapeHtml(data.name)},</p>
        <p class="text">Your registration as a Mobile Camera Operator has been approved by surveillance command.</p>
        <p class="text">You may now pair your mobile device and initiate live high-definition field broadcasts.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${escapeHtml(data.portalUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Launch Mobile Streamer Portal</a>
        </div>
      `,
      textContent: `Hello ${data.name},\n\nYour mobile operator clearance has been approved. Launch the streaming portal at: ${data.portalUrl}`,
    });
  },

  deviceApproved: (data: DeviceApprovedData): RenderedTemplate => {
    return wrapInBaseLayout({
      title: 'Field Camera Device Approved',
      preheader: 'Your mobile camera device has been registered to the surveillance network.',
      bodyContent: `
        <h2 class="heading">Device Registered to Surveillance Grid</h2>
        <p class="text">Hello ${escapeHtml(data.name)},</p>
        <p class="text">Device <strong>${escapeHtml(data.deviceLabel)}</strong> has been approved for live field ingestion.</p>
        <div class="meta-box">
          <div><strong>Camera ID:</strong> ${escapeHtml(data.cameraId)}</div>
          <div><strong>Ingest Channel:</strong> cam/${escapeHtml(data.cameraId)}</div>
          <div><strong>Protocol:</strong> WHEP / WHIP WebRTC Simulcast</div>
        </div>
      `,
      textContent: `Device ${data.deviceLabel} (Camera ID: ${data.cameraId}) is approved. Stream: ${data.streamUrl}`,
    });
  },

  invite: (data: InviteData): RenderedTemplate => {
    const days = data.expiresDays ?? 7;
    return wrapInBaseLayout({
      title: 'Invitation to Join Sentinel Vision AI',
      preheader: `You have been invited by ${data.inviterName} to join the Sentinel platform.`,
      bodyContent: `
        <h2 class="heading">Official Platform Invitation</h2>
        <p class="text">Hello,</p>
        <p class="text"><strong>${escapeHtml(data.inviterName)}</strong> has invited you to join the Sentinel Vision AI surveillance command platform as a <strong>${escapeHtml(data.role.toUpperCase())}</strong>.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${escapeHtml(data.inviteUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Accept Invitation & Register</a>
        </div>
        <div class="meta-box">
          <div><strong>Target Clearance:</strong> ${escapeHtml(data.role.toUpperCase())}</div>
          <div><strong>Invitation Validity:</strong> Expires in ${days} days</div>
        </div>
      `,
      textContent: `You have been invited by ${data.inviterName} to join Sentinel Vision AI with role [${data.role}]. Accept at: ${data.inviteUrl}`,
    });
  },
};

export type TemplateId = keyof typeof emailTemplates;
export type TemplateData<T extends TemplateId> = Parameters<(typeof emailTemplates)[T]>[0];
