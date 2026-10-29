import { ConfigService } from '@nestjs/config';
import { BrevoService } from '../brevo.service';
import { BrevoError } from '@getbrevo/brevo';

jest.mock('@getbrevo/brevo', () => {
  const actual = jest.requireActual('@getbrevo/brevo');
  return {
    ...actual,
    BrevoClient: jest.fn().mockImplementation(() => ({
      transactionalEmails: {
        sendTransacEmail: jest.fn(),
      },
    })),
  };
});

describe('BrevoService (Privacy Logging & Resilience)', () => {
  let service: BrevoService;
  let mockConfigService: any;
  let mockSendTransacEmail: jest.Mock;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'email.apiKey' || key === 'app.brevoApiKey') return 'test_brevo_key';
        if (key === 'email.timeout') return 10;
        if (key === 'email.maxRetries') return 2;
        if (key === 'email.sender.name') return 'Sentinel Vision AI';
        if (key === 'email.sender.email') return 'notifications@sentinelvision.ai';
        return undefined;
      }),
    };

    service = new BrevoService(mockConfigService as ConfigService);
    mockSendTransacEmail = (service as any).client.transactionalEmails.sendTransacEmail;
  });

  it('should successfully dispatch email and return messageId', async () => {
    mockSendTransacEmail.mockResolvedValueOnce({ messageId: 'brevo_msg_98765' });

    const result = await service.sendEmail({
      recipient: { email: 'operator.doe@agency.defense.gov', name: 'John Doe' },
      subject: 'Security Check',
      htmlContent: '<p>Test</p>',
    });

    expect(result.messageId).toBe('brevo_msg_98765');
    expect(result.status).toBe('sent');
    expect(mockSendTransacEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [{ email: 'operator.doe@agency.defense.gov', name: 'John Doe' }],
      }),
    );
  });

  it('should log ONLY the domain and rethrow BrevoError for BullMQ retry', async () => {
    const loggerSpy = jest.spyOn((service as any).logger, 'error');
    const brevoErr = new BrevoError({
      statusCode: 429,
      body: { message: 'Too Many Requests' },
    } as any);

    mockSendTransacEmail.mockRejectedValueOnce(brevoErr);

    await expect(
      service.sendEmail({
        recipient: { email: 'classified.operative@intelligence.state.gov' },
        subject: 'Urgent',
        htmlContent: '<p>Body</p>',
      }),
    ).rejects.toThrow(BrevoError);

    // Verify logged message contains ONLY the domain, never the full address or secret body
    expect(loggerSpy).toHaveBeenCalled();
    const logCall = loggerSpy.mock.calls[0][0];
    expect(logCall).toContain('@intelligence.state.gov');
    expect(logCall).not.toContain('classified.operative@intelligence.state.gov');
  });

  it('should rethrow unknown errors and log only recipient domain', async () => {
    const loggerSpy = jest.spyOn((service as any).logger, 'error');
    const unknownErr = new Error('Network socket disconnected');

    mockSendTransacEmail.mockRejectedValueOnce(unknownErr);

    await expect(
      service.sendEmail({
        recipient: { email: 'agent@sentinel.internal' },
        subject: 'Alert',
        htmlContent: '<p>Text</p>',
      }),
    ).rejects.toThrow('Network socket disconnected');

    expect(loggerSpy).toHaveBeenCalled();
    const logCall = loggerSpy.mock.calls[0][0];
    expect(logCall).toContain('@sentinel.internal');
    expect(logCall).not.toContain('agent@sentinel.internal');
  });
});
