import { describe, expect, it } from 'vitest';
import { demoDetails, emptyDetails, suggestDetails, validateDetails } from './plan';
import { validateFile } from './extract';
describe('plan intake', () => {
  it('preserves identifier prefixes and leading zeroes', () => { expect(suggestDetails('Member ID: AB00123\nGroup Number: 00042\nPolicy number: P-200')).toEqual({ memberId: 'AB00123', groupNumber: '00042', policyNumber: 'P-200' }); });
  it('does not invent identifiers from generic coverage text', () => { expect(suggestDetails('Members have coverage for preventive services.')).toEqual({}); });
  it('requires insurer and member ID while allowing absent group/policy', () => { expect(validateDetails(emptyDetails)).toBeTruthy(); expect(validateDetails({ ...demoDetails, memberId: ' ' })).toBeTruthy(); expect(validateDetails({ ...demoDetails, groupNumber: '', policyNumber: '' })).toBeNull(); });
  it('rejects reversed coverage dates', () => { expect(validateDetails({ ...demoDetails, endDate: '2020-01-01' })).toBeTruthy(); });
  it('rejects unsupported, oversized, and empty uploads', () => {
    expect(validateFile(new File(['hello'], 'test.html', { type: 'text/html' }))).toBeTruthy();
    expect(validateFile(new File([], 'empty.pdf', { type: 'application/pdf' }))).toBeTruthy();
    expect(validateFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' }))).toBeTruthy();
    expect(validateFile(new File(['test'], 'card.png', { type: 'image/png' }))).toBeNull();
  });
});
