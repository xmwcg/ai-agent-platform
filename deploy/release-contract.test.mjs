import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const watcherPath = new URL('./cnb-watcher.sh', import.meta.url);
const cnbPath = new URL('../.cnb.yml', import.meta.url);

test('watcher retries and alerts when the CNB production ref cannot be read', async () => {
  const watcher = await readFile(watcherPath, 'utf8');

  assert.match(watcher, /resolve_remote_release_sha\(\)/);
  assert.match(watcher, /REMOTE_CHECK_ATTEMPTS/);
  assert.match(watcher, /REMOTE_CHECK_RETRY_SECONDS/);
  assert.match(
    watcher,
    /if ! REMOTE_SHA=\$\(resolve_remote_release_sha\); then[\s\S]*notify_failure[\s\S]*exit 1/
  );
  assert.doesNotMatch(watcher, /无法获取 CNB[^\n]*跳过本轮/);
});

test('watcher records success only after internal and public release probes pass', async () => {
  const watcher = await readFile(watcherPath, 'utf8');
  const composeIndex = watcher.indexOf('if compose_up "$CANDIDATE_STATE"');
  const internalIndex = watcher.indexOf('verify_release "$CANDIDATE_STATE" internal', composeIndex);
  const publicIndex = watcher.indexOf('verify_release "$CANDIDATE_STATE" public', internalIndex);
  const stateIndex = watcher.indexOf('mv -f "$CANDIDATE_STATE" "$STATE_FILE"', publicIndex);

  assert.ok(composeIndex >= 0, 'missing candidate Compose deployment');
  assert.ok(internalIndex > composeIndex, 'internal probe must follow deployment');
  assert.ok(publicIndex > internalIndex, 'public probe must follow internal probe');
  assert.ok(stateIndex > publicIndex, 'state file must only update after all probes');
});

test('CNB GitHub mirror never uses an unguarded force push', async () => {
  const pipeline = await readFile(cnbPath, 'utf8');

  assert.match(pipeline, /--force-with-lease="refs\/heads\/main:\$github_sha"/);
  assert.doesNotMatch(pipeline, /git push[^\n]*(?:^|\s)--force(?:\s|$)/m);
});

test('CNB scripts remain compatible with the runner shell', async () => {
  const pipeline = await readFile(cnbPath, 'utf8');

  assert.doesNotMatch(pipeline, /pipefail/);
});

test('production deployment stays outbound-pull only and embeds no deploy webhook secret', async () => {
  const pipeline = await readFile(cnbPath, 'utf8');

  assert.doesNotMatch(pipeline, /notify-webhook|DEPLOY_SECRET|cnb-deploy-secret|159\.75\.124\.59:9000/);
});
