/**
 * M005 VR-* grep-gate — asserts four rule IDs appear in 17-contribution-room.md.
 * Deleting or renaming a VR-* ID in the source-of-truth doc will fail CI.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const doc = readFileSync(
  resolve(__dirname, '../../../../docs/source-of-truth/17-contribution-room.md'),
  'utf-8'
);

describe('M005 VR-* grep-gate — 17-contribution-room.md', () => {
  it('contains VR-RRSP-PA-001', () => {
    expect(doc).toMatch(/\bVR-RRSP-PA-001\b/);
  });

  it('contains VR-TFSA-RESIDENCY-001', () => {
    expect(doc).toMatch(/\bVR-TFSA-RESIDENCY-001\b/);
  });

  it('contains VR-FHSA-CARRY-001', () => {
    expect(doc).toMatch(/\bVR-FHSA-CARRY-001\b/);
  });

  it('contains VR-ROOM-PENALTY-001', () => {
    expect(doc).toMatch(/\bVR-ROOM-PENALTY-001\b/);
  });
});
