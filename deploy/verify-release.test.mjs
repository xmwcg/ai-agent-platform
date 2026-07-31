import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDigest,
  validateHealth,
  validatePaymentMethods,
  validateRuntimeSafety,
  validateSandbox,
} from './verify-release.mjs';

const sha = 'a'.repeat(40);
const serverDigest = `sha256:${'b'.repeat(64)}`;
const clientDigest = `sha256:${'c'.repeat(64)}`;

const expected = { sha, serverDigest, clientDigest };

test('normalizeDigest accepts both digest and immutable image reference', () => {
  assert.equal(normalizeDigest(serverDigest), serverDigest);
  assert.equal(normalizeDigest(`docker.cnb.cool/example/server@${serverDigest}`), serverDigest);
  assert.throws(() => normalizeDigest('latest'), /格式无效/);
});

test('health probe requires database, Redis, revision and both image digests', () => {
  assert.doesNotThrow(() => validateHealth({
    status: 'healthy',
    mongodb: 'connected',
    redis: 'connected',
    revision: sha,
    serverImageDigest: serverDigest,
    clientImageDigest: clientDigest,
  }, expected));
  assert.throws(() => validateHealth({
    status: 'healthy',
    mongodb: 'connected',
    redis: 'connected',
    revision: sha,
    serverImageDigest: `sha256:${'d'.repeat(64)}`,
    clientImageDigest: clientDigest,
  }, expected), /server 镜像摘要不一致/);
});

test('sandbox probe only accepts production remote provider', () => {
  const safe = {
    success: true,
    data: {
      production: true,
      defaultMode: 'remote',
      mockEnabled: false,
      localEnabled: false,
      providers: [
        { mode: 'mock', configured: false },
        { mode: 'local', configured: false },
        { mode: 'remote', configured: true },
      ],
    },
  };
  assert.doesNotThrow(() => validateSandbox(safe));
  assert.throws(() => validateSandbox({
    ...safe,
    data: { ...safe.data, mockEnabled: true },
  }), /Mock\/Local 未关闭/);
});

test('runtime safety requires every non-production flag to be false', () => {
  assert.doesNotThrow(() => validateRuntimeSafety({
    success: true,
    data: { runtimeSafety: { production: true, mockMode: false, memoryRedisEnabled: false } },
  }));
  assert.throws(() => validateRuntimeSafety({
    success: true,
    data: { runtimeSafety: { production: true, mockMode: false, memoryRedisEnabled: true } },
  }), /memoryRedisEnabled/);
});

test('business probe requires exactly one enabled WeChat channel', () => {
  assert.doesNotThrow(() => validatePaymentMethods({
    success: true,
    data: { methods: [{ key: 'wechat', label: '微信支付', enabled: true }] },
  }));
  assert.throws(() => validatePaymentMethods({
    success: true,
    data: { methods: [
      { key: 'wechat', enabled: true },
      { key: 'mock', enabled: true },
    ] },
  }), /只能启用微信/);
});
