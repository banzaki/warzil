import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PIX, pixCrc, pixPayloadValid } from '../src/game/support.js';

test('the Pix payload is a valid static BR Code for the published key', () => {
  assert.equal(pixCrc('123456789'), '29B1', 'CRC16-CCITT reference value');
  assert.ok(pixPayloadValid(PIX.payload), 'checksum matches');
  assert.ok(PIX.payload.startsWith('000201'));
  assert.ok(PIX.payload.includes(`0014br.gov.bcb.pix0136${PIX.key}`), 'carries the same key');
  assert.ok(!/54\d\d\d+\.\d\d/.test(PIX.payload.slice(PIX.payload.indexOf('5303986'), PIX.payload.indexOf('5802BR'))), 'no fixed amount');
  assert.ok(!pixPayloadValid(PIX.payload.replace('Warzil', 'WARZIL')), 'a changed payload fails the check');
  assert.ok(existsSync(new URL(`../public${PIX.qr}`, import.meta.url)), 'QR image is published');
});
