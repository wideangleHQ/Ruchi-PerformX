import { describe, it, expect } from 'vitest';
import { escapeHtml, senderDomain } from './email.service';

// Notification bodies carry free text one employee wrote and another reads,
// inside a mail sent from RUCHI's own address. An injected anchor there is a
// phishing link the recipient has every reason to trust.
describe('escapeHtml', () => {
  it('neutralises an injected anchor', () => {
    const remark = 'Rejected. <a href="https://evil.example">Click to appeal</a>';
    const out = escapeHtml(remark);
    expect(out).not.toContain('<a');
    expect(out).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;');
  });

  it('neutralises a script tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes the ampersand first, so entities are not double-decoded', () => {
    // & last would turn "&lt;" back into a working "<" in some clients
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('closes an attribute break-out', () => {
    expect(escapeHtml('" onload="x')).toBe('&quot; onload=&quot;x');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('Approved, 3 days, back on Monday')).toBe(
      'Approved, 3 days, back on Monday',
    );
  });
});

// A from-address on a domain Resend cannot verify fails every send, so the boot
// check that catches it has to read the domain out of both accepted forms.
// `Ruchi <a@gmail.com>` read naively gives `gmail.com>`, which matches nothing
// and turns the check off without saying so.
describe('senderDomain', () => {
  it('reads a plain address', () => {
    expect(senderDomain('noreply@ruchiperformx.in')).toBe('ruchiperformx.in');
  });

  it('reads a display-name address', () => {
    expect(senderDomain('RUCHI PerformX <noreply@ruchiperformx.in>')).toBe(
      'ruchiperformx.in',
    );
  });

  it('lowercases, so the domain set needs only one casing', () => {
    expect(senderDomain('Ops <Ops@GMail.com>')).toBe('gmail.com');
  });
});
