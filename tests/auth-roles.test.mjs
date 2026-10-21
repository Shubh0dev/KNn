import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeForRoles, safeNextPath } from '../src/lib/auth/roles.ts';

test('safeNextPath keeps same-site relative paths', () => {
  assert.equal(safeNextPath('/business/'), '/business/');
  assert.equal(safeNextPath('/explore/?q=ghat'), '/explore/?q=ghat');
  assert.equal(safeNextPath('/business/onboarding/'), '/business/onboarding/');
});

test('safeNextPath rejects open-redirect payloads', () => {
  for (const payload of [
    'https://evil.example', '//evil.example', '/\\evil.example', '\\\\evil.example',
    'javascript:alert(1)', 'evil.example', '/%0d%0aSet-Cookie:x', '/\t/evil.example',
    '', null, undefined, 42, ['/admin/'], '/'.padEnd(600, 'a'),
  ]) {
    const result = safeNextPath(payload);
    assert.ok(result === null || (result.startsWith('/') && !result.startsWith('//')), `allowed: ${String(payload)}`);
  }
  assert.equal(safeNextPath('//evil.example'), null);
  assert.equal(safeNextPath('https://evil.example'), null);
  assert.equal(safeNextPath('/\\evil.example'), null);
});

test('homeForRoles picks the highest-privilege dashboard', () => {
  assert.equal(homeForRoles(['visitor']), '/account/');
  assert.equal(homeForRoles([]), '/account/');
  assert.equal(homeForRoles(['visitor', 'business_owner']), '/business/');
  assert.equal(homeForRoles(['visitor', 'business_owner', 'admin']), '/admin/');
  assert.equal(homeForRoles(['visitor', 'admin', 'super_admin']), '/superadmin/');
});
