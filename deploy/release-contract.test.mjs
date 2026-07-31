import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const watcherPath = new URL('./cnb-watcher.sh', import.meta.url);
const watcherInstallerPath = new URL('./install-cnb-watcher.sh', import.meta.url);
const cnbPath = new URL('../.cnb.yml', import.meta.url);
const serverDockerfilePath = new URL('../server/Dockerfile', import.meta.url);
const clientDockerfilePath = new URL('../client/Dockerfile', import.meta.url);
const productionCaddyPath = new URL('./Caddyfile.aibak-site', import.meta.url);
const productionComposePath = new URL('./docker-compose.production.yml', import.meta.url);

test('production dependency gate audits runtime dependencies with an explicit SPA-only advisory policy', async () => {
  const cnb = await readFile(cnbPath, 'utf8');
  const auditScript = await readFile(new URL('../scripts/audit-production-deps.cjs', import.meta.url), 'utf8');

  assert.match(cnb, /node scripts\/audit-production-deps\.cjs server/);
  assert.match(cnb, /node scripts\/audit-production-deps\.cjs client/);
  assert.doesNotMatch(cnb, /npm audit --audit-level=high/);
  assert.match(auditScript, /GHSA-qwww-vcr4-c8h2/);
  assert.match(auditScript, /createStaticRouter\|StaticRouterProvider\|ServerRouter\|RSCRouter/);
});

test('production Caddy contract permanently assigns aibak.site to AI Agent Platform', async () => {
  const caddy = await readFile(productionCaddyPath, 'utf8');

  assert.match(caddy, /^aibak\.site www\.aibak\.site \{/m);
  assert.match(caddy, /root \* \/opt\/ai-agent-platform\/client\/dist/);
  assert.match(caddy, /handle \/api\/\* \{[\s\S]*reverse_proxy 127\.0\.0\.1:3000/);
  assert.match(caddy, /try_files \{path\} \/index\.html[\s\S]*file_server/);
  assert.match(caddy, /tls \/etc\/caddy\/certs\/aibak\.site\.crt \/etc\/caddy\/certs\/aibak\.site\.key/);
  assert.doesNotMatch(caddy, /127\.0\.0\.1:3100/);
});

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

test('watcher only follows approved production ref and installer stays inactive by default', async () => {
  const [watcher, installer] = await Promise.all([
    readFile(watcherPath, 'utf8'),
    readFile(watcherInstallerPath, 'utf8'),
  ]);

  assert.match(watcher, /RELEASE_BRANCH=\$\{RELEASE_BRANCH:-deploy\/production\}/);
  assert.match(watcher, /BUILD_MODE=\$\{BUILD_MODE:-registry\}/);
  assert.doesNotMatch(watcher, /RELEASE_BRANCH=\$\{RELEASE_BRANCH:-main\}/);
  assert.match(installer, /ACTIVATE_WATCHER=\$\{ACTIVATE_WATCHER:-false\}/);
  assert.match(installer, /upsert_default RELEASE_BRANCH deploy\/production/);
  assert.match(installer, /upsert_default BUILD_MODE registry/);
  assert.match(installer, /if \[ "\$ACTIVATE_WATCHER" = 'true' \]/);
});

test('watcher pulls immutable Registry images and switches containers once', async () => {
  const watcher = await readFile(watcherPath, 'utf8');

  assert.match(watcher, /pull_release_images\(\)/);
  assert.match(watcher, /docker pull "\$server_tag"/);
  assert.match(watcher, /docker pull "\$client_tag"/);
  assert.match(watcher, /BUILT_SERVER_IMAGE=\$server_repo_digest/);
  assert.match(watcher, /BUILT_CLIENT_IMAGE=\$client_repo_digest/);
  assert.equal((watcher.match(/for c in ai-platform-server ai-platform-client/g) || []).length, 1);
});

test('client release preserves Caddy ownership and atomically publishes Registry assets', async () => {
  const [watcher, compose] = await Promise.all([
    readFile(watcherPath, 'utf8'),
    readFile(productionComposePath, 'utf8'),
  ]);
  const clientIndex = compose.indexOf('  client:');
  const workerIndex = compose.indexOf('  moneyprinterturbo:', clientIndex);
  const clientService = compose.slice(clientIndex, workerIndex);

  assert.ok(clientIndex >= 0, 'missing production client service');
  assert.doesNotMatch(clientService, /ports:\s*[\s\S]*["'](?:80|443):(?:80|443)["']/);
  assert.match(watcher, /STATIC_ROOT=\$\{STATIC_ROOT:-\/opt\/ai-agent-platform\/client\/dist\}/);
  assert.match(watcher, /publish_client_assets\(\)/);
  assert.match(watcher, /docker cp "\$container:\/usr\/share\/nginx\/html\/." "\$staging\/"/);
  assert.match(watcher, /grep -qi 'charset="UTF-8"' "\$staging\/index\.html"/);
  assert.match(watcher, /mv "\$staging" "\$STATIC_ROOT"/);
});

test('watcher records success only after production validation and release probes pass', async () => {
  const watcher = await readFile(watcherPath, 'utf8');
  const validationIndex = watcher.indexOf('if validate_production_configuration "$CANDIDATE_STATE"');
  const composeIndex = watcher.indexOf('&& compose_up "$CANDIDATE_STATE"', validationIndex);
  const internalIndex = watcher.indexOf('verify_release "$CANDIDATE_STATE" internal', composeIndex);
  const assetsIndex = watcher.indexOf('publish_client_assets "$CANDIDATE_STATE"', internalIndex);
  const publicIndex = watcher.indexOf('verify_release "$CANDIDATE_STATE" public', assetsIndex);
  const stateIndex = watcher.indexOf('mv -f "$CANDIDATE_STATE" "$STATE_FILE"', publicIndex);

  assert.ok(validationIndex >= 0, 'missing production configuration validation');
  assert.ok(composeIndex > validationIndex, 'deployment must follow production validation');
  assert.ok(internalIndex > composeIndex, 'internal probe must follow deployment');
  assert.ok(assetsIndex > internalIndex, 'Caddy assets must publish after internal API verification');
  assert.ok(publicIndex > assetsIndex, 'public probe must follow Caddy asset publication');
  assert.ok(stateIndex > publicIndex, 'state file must only update after all probes');
});

test('CNB GitHub mirror uses a parentless content snapshot and never uses an unguarded force push', async () => {
  const pipeline = await readFile(cnbPath, 'utf8');

  assert.match(pipeline, /source_tree=\$\(git rev-parse "\$CNB_COMMIT\^\{tree\}"\)/);
  assert.match(pipeline, /git commit-tree "\$source_tree"/);
  assert.match(pipeline, /--force-with-lease="refs\/heads\/main:\$github_sha"/);
  assert.match(pipeline, /mirrored_tree=\$\(git rev-parse "refs\/remotes\/github-mirror\/main\^\{tree\}"\)/);
  assert.doesNotMatch(pipeline, /git push[^\n]*(?:^|\s)--force(?:\s|$)/m);
});

test('CNB scripts remain compatible with the runner shell', async () => {
  const pipeline = await readFile(cnbPath, 'utf8');

  assert.doesNotMatch(pipeline, /pipefail/);
});

test('server runtime image excludes npm tooling and its bundled dependency tree', async () => {
  const dockerfile = await readFile(serverDockerfilePath, 'utf8');

  assert.match(dockerfile, /rm -rf \/usr\/local\/lib\/node_modules\/npm/);
  assert.match(dockerfile, /rm -f \/usr\/local\/bin\/npm \/usr\/local\/bin\/npx/);
  assert.ok(
    dockerfile.indexOf('rm -rf /usr/local/lib/node_modules/npm') < dockerfile.indexOf('USER node'),
    'npm must be removed from the runtime stage before dropping privileges'
  );
});

test('client runtime image uses the patched stable Nginx Alpine line', async () => {
  const dockerfile = await readFile(clientDockerfilePath, 'utf8');

  assert.match(dockerfile, /^FROM nginx:1\.30\.0-alpine3\.23 AS runtime$/m);
  assert.match(dockerfile, /^RUN apk upgrade --no-cache$/m);
  assert.doesNotMatch(dockerfile, /^FROM nginx:1\.27-alpine AS runtime$/m);
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

test('CNB Docker-only stages use an available CLI image while Git stages install Git explicitly', async () => {
  const pipeline = await readFile(cnbPath, 'utf8');
  const imageBuildIndex = pipeline.indexOf('- name: build-and-push-immutable-images');
  const imageScanIndex = pipeline.indexOf('- name: image-security-scan', imageBuildIndex);
  const mirrorIndex = pipeline.indexOf('- name: mirror-github-safely', imageScanIndex);
  const promoteIndex = pipeline.indexOf('- name: promote-production-ref', mirrorIndex);
  const verifyIndex = pipeline.indexOf('- name: verify-production-release', promoteIndex);
  const imageBuildStage = pipeline.slice(imageBuildIndex, imageScanIndex);
  const imageScanStage = pipeline.slice(imageScanIndex, mirrorIndex);
  const mirrorStage = pipeline.slice(mirrorIndex, promoteIndex);
  const promoteStage = pipeline.slice(promoteIndex, verifyIndex);

  assert.match(imageBuildStage, /image: docker:27-cli/);
  assert.match(imageScanStage, /image: docker:27-cli/);
  assert.doesNotMatch(imageBuildStage, /docker:27-git/);
  assert.doesNotMatch(imageScanStage, /docker:27-git/);
  assert.match(mirrorStage, /image: alpine:3\.21\.3/);
  assert.match(promoteStage, /image: alpine:3\.21\.3/);
  assert.match(mirrorStage, /apk add --no-cache git ca-certificates/);
  assert.match(promoteStage, /apk add --no-cache git ca-certificates/);
  assert.doesNotMatch(mirrorStage, /docker:27-git/);
  assert.doesNotMatch(promoteStage, /docker:27-git/);
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

test('watcher rollback restores both containers and Caddy static assets', async () => {
  const watcher = await readFile(watcherPath, 'utf8');
  const rollbackStart = watcher.indexOf('rollback_to_state()');
  const rollbackEnd = watcher.indexOf('preflight()', rollbackStart);
  const rollback = watcher.slice(rollbackStart, rollbackEnd);
  const composeIndex = rollback.indexOf('compose_up "$state_file"');
  const internalIndex = rollback.indexOf('verify_release "$state_file" internal', composeIndex);
  const assetsIndex = rollback.indexOf('publish_client_assets "$state_file"', internalIndex);
  const publicIndex = rollback.indexOf('verify_release "$state_file" public', assetsIndex);

  assert.ok(composeIndex >= 0, 'rollback must restore containers');
  assert.ok(internalIndex > composeIndex, 'rollback must verify internal API first');
  assert.ok(assetsIndex > internalIndex, 'rollback must restore Caddy assets');
  assert.ok(publicIndex > assetsIndex, 'rollback must verify public release last');
});

test('watcher rejects production environment files readable by non-root users', async () => {
  const watcher = await readFile(watcherPath, 'utf8');

  assert.match(watcher, /find "\$PRODUCTION_ENV_FILE" -perm \/077/);
  assert.match(watcher, /生产环境文件权限过宽/);
});
