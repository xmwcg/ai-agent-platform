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

test('watcher records success only after production validation and release probes pass', async () => {
  const watcher = await readFile(watcherPath, 'utf8');
  const validationIndex = watcher.indexOf('if validate_production_configuration "$CANDIDATE_STATE"');
  const composeIndex = watcher.indexOf('&& compose_up "$CANDIDATE_STATE"', validationIndex);
  const internalIndex = watcher.indexOf('verify_release "$CANDIDATE_STATE" internal', composeIndex);
  const publicIndex = watcher.indexOf('verify_release "$CANDIDATE_STATE" public', internalIndex);
  const stateIndex = watcher.indexOf('mv -f "$CANDIDATE_STATE" "$STATE_FILE"', publicIndex);

  assert.ok(validationIndex >= 0, 'missing production configuration validation');
  assert.ok(composeIndex > validationIndex, 'deployment must follow production validation');
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

test('CNB long-running dependency installs and image builds keep the runner alive without hiding failures', async () => {
  const pipeline = await readFile(cnbPath, 'utf8');
  const installIndex = pipeline.indexOf('- name: install-locked-dependencies');
  const buildGateIndex = pipeline.indexOf('- name: typescript-and-build-gate', installIndex);
  const imageBuildIndex = pipeline.indexOf('- name: build-and-push-immutable-images');
  const mirrorIndex = pipeline.indexOf('- name: mirror-github-safely', imageBuildIndex);
  const installStage = pipeline.slice(installIndex, buildGateIndex);
  const imageBuildStage = pipeline.slice(imageBuildIndex, mirrorIndex);

  assert.ok(installIndex >= 0 && buildGateIndex > installIndex, 'missing dependency install stage');
  assert.ok(imageBuildIndex >= 0 && mirrorIndex > imageBuildIndex, 'missing immutable image build stage');

  for (const stage of [installStage, imageBuildStage]) {
    assert.match(stage, /run_with_heartbeat\(\)/);
    assert.match(stage, /while kill -0 "\$command_pid" 2>\/dev\/null; do/);
    assert.match(stage, /\) &\s+heartbeat_pid=\$!/);
    assert.match(stage, /if wait "\$command_pid"; then[\s\S]*command_status=\$\?[\s\S]*return "\$command_status"/);
    assert.match(stage, /kill "\$heartbeat_pid" 2>\/dev\/null \|\| true/);
    assert.doesNotMatch(stage, /while\s+(?:true|:)/);
    assert.doesNotMatch(stage, /wait "\$command_pid"\s*\|\|\s*true/);

    const heartbeatSeconds = [...stage.matchAll(/sleep (\d+)/g)].map((match) => Number(match[1]));
    assert.ok(heartbeatSeconds.length > 0, 'heartbeat interval must be explicit');
    assert.ok(heartbeatSeconds.every((seconds) => seconds > 0 && seconds < 600),
      'heartbeat interval must remain below the CNB 10-minute idle timeout');
  }

  assert.match(installStage, /run_with_heartbeat server-npm-ci npm ci --no-audit --no-fund/);
  assert.match(installStage, /run_with_heartbeat client-npm-ci env NODE_OPTIONS=--max-old-space-size=8192[\s\\]*npm ci --no-audit --no-fund/);
  assert.match(imageBuildStage, /run_with_heartbeat "docker-build-\$context" docker build --progress=plain --pull/);
});

test('production deployment stays outbound-pull only and embeds no deploy webhook secret', async () => {
  const pipeline = await readFile(cnbPath, 'utf8');

  assert.doesNotMatch(pipeline, /notify-webhook|DEPLOY_SECRET|cnb-deploy-secret|159\.75\.124\.59:9000/);
});

test('CNB static production gate uses fixtures and scopes GitHub secret to mirror stage', async () => {
  const pipeline = await readFile(cnbPath, 'utf8');
  const staticGateIndex = pipeline.indexOf('- name: production-config-static-gate');
  const dependencyScanIndex = pipeline.indexOf('- name: dependency-security-scan', staticGateIndex);
  const mirrorIndex = pipeline.indexOf('- name: mirror-github-safely');
  const promoteIndex = pipeline.indexOf('- name: promote-production-ref', mirrorIndex);
  const staticGate = pipeline.slice(staticGateIndex, dependencyScanIndex);
  const beforeMirror = pipeline.slice(0, mirrorIndex);
  const mirrorStage = pipeline.slice(mirrorIndex, promoteIndex);

  assert.ok(staticGateIndex >= 0, 'missing static production configuration gate');
  assert.ok(dependencyScanIndex > staticGateIndex, 'dependency scan must follow static gate');
  assert.ok(mirrorIndex > dependencyScanIndex, 'GitHub mirror must follow release gates');
  assert.ok(promoteIndex > mirrorIndex, 'production promotion must follow GitHub mirror');
  assert.match(staticGate, /npm run validate:production-contract/);
  assert.doesNotMatch(staticGate, /WECHAT_PRIVATE_KEY|WECHAT_PLATFORM_CERT|MONGODB_URI|REDIS_URL/);
  assert.doesNotMatch(beforeMirror, /cnb-github-migration-guide\/.*secrets\.yml/);
  assert.match(mirrorStage, /imports:[\s\S]*cnb-github-migration-guide\/.*secrets\.yml/);
});

test('watcher validates real production configuration before switching containers', async () => {
  const watcher = await readFile(watcherPath, 'utf8');
  const validateFunctionIndex = watcher.indexOf('validate_production_configuration()');
  const deployChainIndex = watcher.indexOf('if validate_production_configuration "$CANDIDATE_STATE"');
  const composeIndex = watcher.indexOf('&& compose_up "$CANDIDATE_STATE"', deployChainIndex);

  assert.ok(validateFunctionIndex >= 0, 'missing real production configuration validation');
  assert.match(watcher, /--network none[\s\S]*--read-only[\s\S]*--cap-drop ALL/);
  assert.match(watcher, /--env-file "\$PRODUCTION_ENV_FILE"/);
  assert.match(watcher, /dist\/scripts\/validate-production-config\.js/);
  assert.ok(deployChainIndex >= 0, 'production validation must be in candidate deployment chain');
  assert.ok(composeIndex > deployChainIndex, 'production validation must run before Compose');
});

test('watcher rejects production environment files readable by non-root users', async () => {
  const watcher = await readFile(watcherPath, 'utf8');

  assert.match(watcher, /find "\$PRODUCTION_ENV_FILE" -perm \/077/);
  assert.match(watcher, /生产环境文件权限过宽/);
});
