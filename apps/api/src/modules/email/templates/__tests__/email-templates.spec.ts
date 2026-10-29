import { emailTemplates } from '../index';

describe('Email Templates (Black/White Shadcn Branding & Security)', () => {
  it('should render verifyEmail template with token and escaped user values', () => {
    const rendered = emailTemplates.verifyEmail({
      name: 'Agent <script>alert(1)</script> John',
      email: 'john@sentinel.gov',
      verifyUrl: 'https://sentinel.internal/verify-email?token=sec_token_123',
      token: 'sec_token_123',
      expiresHours: 24,
    });

    expect(rendered.subject).toContain('Verify Your Sentinel Vision AI Account');
    expect(rendered.htmlContent).toContain('Agent &lt;script&gt;alert(1)&lt;/script&gt; John');
    expect(rendered.htmlContent).not.toContain('<script>');
    expect(rendered.htmlContent).toContain('sec_token_123');
    expect(rendered.textContent).toContain('sec_token_123');
  });

  it('should render welcomePendingApproval template', () => {
    const rendered = emailTemplates.welcomePendingApproval({
      name: 'Dr. Jane Vance',
      email: 'jane.vance@sentinel.gov',
    });

    expect(rendered.subject).toContain('Registration Received');
    expect(rendered.htmlContent).toContain('PENDING_ADMIN_APPROVAL');
    expect(rendered.textContent).toContain('Dr. Jane Vance');
  });

  it('should render accountApproved template with assigned role and login URL', () => {
    const rendered = emailTemplates.accountApproved({
      name: 'Marcus Chen',
      email: 'marcus@sentinel.gov',
      role: 'investigator',
      loginUrl: 'https://sentinel.internal/login',
    });

    expect(rendered.subject).toContain('Access Granted');
    expect(rendered.htmlContent).toContain('INVESTIGATOR');
    expect(rendered.htmlContent).toContain('https://sentinel.internal/login');
  });

  it('should render passwordReset template with validity time', () => {
    const rendered = emailTemplates.passwordReset({
      name: 'Marcus Chen',
      email: 'marcus@sentinel.gov',
      resetUrl: 'https://sentinel.internal/reset-password?token=abc',
      token: 'abc',
      expiresMinutes: 30,
    });

    expect(rendered.subject).toContain('Password Reset Request');
    expect(rendered.htmlContent).toContain('30 minutes');
  });

  it('should render newLoginAlert template with "wasn\'t me" link and security parameters', () => {
    const rendered = emailTemplates.newLoginAlert({
      name: 'Robert Vance',
      email: 'vance@sentinel.gov',
      deviceLabel: 'Chrome 122 on macOS',
      location: 'New York, US',
      ip: '198.51.100.24',
      time: '2026-10-29 14:00:00 UTC',
      secureAccountUrl: 'https://sentinel.internal/settings/security?action=lock',
    });

    expect(rendered.subject).toContain('Security Alert: New Sign-In Detected');
    expect(rendered.htmlContent).toContain('Chrome 122 on macOS');
    expect(rendered.htmlContent).toContain('198.51.100.24');
    expect(rendered.htmlContent).toContain("Secure My Account / Wasn't Me");
  });

  it('should render securityAlert template for token reuse detection', () => {
    const rendered = emailTemplates.securityAlert({
      name: 'Robert Vance',
      email: 'vance@sentinel.gov',
      reason: 'Previously rotated refresh token presented (Family Compromised)',
      incidentTime: '2026-10-29 14:15:00 UTC',
      accountLocked: true,
      unlockUrl: 'https://sentinel.internal/unlock?t=token_xyz',
    });

    expect(rendered.subject).toContain('CRITICAL SECURITY ALERT');
    expect(rendered.htmlContent).toContain('Session Compromise Safeguard Triggered');
    expect(rendered.htmlContent).toContain('Temporarily locked for protection');
    expect(rendered.htmlContent).toContain('Family Compromised');
  });

  it('should render mobileOperatorApproved template', () => {
    const rendered = emailTemplates.mobileOperatorApproved({
      name: 'Operator Mike',
      email: 'mike@sentinel.gov',
      portalUrl: 'https://sentinel.internal/m/stream',
    });

    expect(rendered.subject).toContain('Mobile Camera Operator Clearance Approved');
    expect(rendered.htmlContent).toContain('Launch Mobile Streamer Portal');
  });

  it('should render deviceApproved template', () => {
    const rendered = emailTemplates.deviceApproved({
      name: 'Operator Mike',
      deviceLabel: 'Pixel 9 Pro Field Rig #4',
      cameraId: 'CAM-MOB-004',
      streamUrl: 'https://sentinel.internal/cameras?id=CAM-MOB-004',
    });

    expect(rendered.subject).toContain('Field Camera Device Approved');
    expect(rendered.htmlContent).toContain('Pixel 9 Pro Field Rig #4');
    expect(rendered.htmlContent).toContain('CAM-MOB-004');
  });

  it('should render invite template with role and expiration', () => {
    const rendered = emailTemplates.invite({
      inviterName: 'Chief Vance',
      recipientEmail: 'specialist@sentinel.gov',
      role: 'investigator',
      inviteUrl: 'https://sentinel.internal/register?invite=INV-999',
      expiresDays: 7,
    });

    expect(rendered.subject).toContain('Invitation to Join Sentinel Vision AI');
    expect(rendered.htmlContent).toContain('Chief Vance');
    expect(rendered.htmlContent).toContain('INVESTIGATOR');
  });
});
