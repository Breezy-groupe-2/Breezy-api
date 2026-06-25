#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const invokingPackageDir = process.env.npm_package_json
  ? path.dirname(process.env.npm_package_json)
  : process.cwd();
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'breezy-acceptance-'));
const outputFile = path.join(outputDir, 'results.json');

let vitestBin;
try {
  const vitestEntry = require.resolve('vitest', {
    paths: [invokingPackageDir, repoRoot],
  });
  vitestBin = path.join(path.dirname(vitestEntry), 'vitest.mjs');
} catch {
  console.error(
    'Unable to resolve Vitest. Run npm install in the package that owns test:acceptance.'
  );
  process.exit(1);
}

const cliArgs = process.argv.slice(2);
const includeOptional =
  process.env.ACCEPTANCE_INCLUDE_OPTIONAL === 'true' || cliArgs.includes('--include-optional');
const passthroughArgs = cliArgs.filter((arg) => arg !== '--include-optional');

const featureNames = {
  Fx1: 'User account creation with validation',
  Fx2: 'Secure authentication',
  Fx3: 'Short post publishing',
  Fx4: 'Profile message display',
  Fx5: 'Chronological feed from followed users',
  Fx6: 'Post likes',
  Fx7: 'Post comments',
  Fx8: 'Replies to comments',
  Fx9: 'Follows and followers',
  Fx10: 'Basic user profile',
  Fx11: 'Published posts list on profile',
  Fx12: 'Tags on posts',
  Fx13: 'Search posts via tags',
  Fx14: 'Notifications for mentions',
  Fx15: 'Notifications for likes',
  Fx16: 'Notifications for new followers',
  Fx17: 'Private messages between users',
  Fx18: 'Images on posts',
  Fx19: 'Videos on posts',
  Fx20: 'Report inappropriate content',
  Fx21: 'User suspension or banning',
  Fx22: 'Multi-language interface',
  Fx23: 'Custom theme',
};

const implementedFeatures = [
  'Fx1',
  'Fx2',
  'Fx3',
  'Fx4',
  'Fx5',
  'Fx6',
  'Fx7',
  'Fx8',
  'Fx9',
  'Fx10',
  'Fx11',
  'Fx21',
  'Fx23',
];
const notImplementedFeatures = [
  'Fx12',
  'Fx13',
  'Fx14',
  'Fx15',
  'Fx16',
  'Fx17',
  'Fx18',
  'Fx19',
  'Fx20',
  'Fx22',
];
const allFeatures = [...implementedFeatures, ...notImplementedFeatures];

const vitestArgs = [
  vitestBin,
  'run',
  '--config',
  path.join(repoRoot, 'vitest.acceptance.config.js'),
  '--reporter=json',
  '--outputFile',
  outputFile,
  '--passWithNoTests',
  ...passthroughArgs,
];

const result = spawnSync(process.execPath, vitestArgs, {
  cwd: repoRoot,
  encoding: 'utf8',
});

if (!fs.existsSync(outputFile)) {
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  process.exit(result.status ?? 1);
}

const report = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
const runnerFailed = result.status !== 0;
const runnerOutput = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
const unhandledErrors = [...(report.unhandledErrors ?? []), ...(report.errors ?? [])].filter(
  Boolean
);

const formatRunnerError = (error) => {
  if (typeof error === 'string') {
    return error;
  }

  return error.message ?? error.stack ?? JSON.stringify(error);
};

const featureResults = new Map(
  allFeatures.map((featureId) => [
    featureId,
    {
      failed: [],
      passed: 0,
      skipped: 0,
      total: 0,
    },
  ])
);

for (const fileResult of report.testResults ?? []) {
  for (const assertion of fileResult.assertionResults ?? []) {
    const featureTitle = assertion.ancestorTitles?.find((title) => /^Fx\d+/.test(title));
    if (!featureTitle) {
      continue;
    }

    const featureIds = featureTitle.match(/Fx\d+/g) ?? [];
    for (const featureId of featureIds) {
      if (!featureResults.has(featureId)) {
        featureResults.set(featureId, {
          failed: [],
          passed: 0,
          skipped: 0,
          total: 0,
        });
      }

      const feature = featureResults.get(featureId);
      feature.total += 1;
      if (assertion.status === 'passed') {
        feature.passed += 1;
      } else if (assertion.status === 'skipped' || assertion.status === 'pending') {
        feature.skipped += 1;
      } else {
        feature.failed.push(assertion.title);
      }
    }
  }
}

const failingFeatures = [];

console.log('\nBreezy acceptance feature status\n');
if (includeOptional) {
  console.log(
    'Note: --include-optional is accepted for compatibility. Implemented optional features (Fx21, Fx23) are already included by default.\n'
  );
}
for (const featureId of allFeatures) {
  const feature = featureResults.get(featureId);
  const name = featureNames[featureId];

  if (notImplementedFeatures.includes(featureId)) {
    console.log(`${featureId} - ${name}: not implemented (out of scope)`);
    continue;
  }

  const works = feature.total > 0 && feature.failed.length === 0 && feature.skipped === 0;
  const status = works ? 'works' : 'does not work';
  const counts = `${feature.passed}/${feature.total} passed`;
  const skipped = feature.skipped > 0 ? `, ${feature.skipped} skipped` : '';

  console.log(`${featureId} - ${name}: ${status} (${counts}${skipped})`);

  if (!works) {
    failingFeatures.push(featureId);
    for (const failure of feature.failed) {
      console.log(`  - failing: ${failure}`);
    }
    if (feature.total === 0) {
      console.log('  - failing: no acceptance tests found for this feature');
    }
  }
}

if (unhandledErrors.length > 0) {
  console.log('\nVitest reported unhandled errors:');
  for (const error of unhandledErrors) {
    console.log(`  - ${formatRunnerError(error)}`);
  }
}

if (runnerFailed && failingFeatures.length === 0 && unhandledErrors.length === 0 && runnerOutput) {
  console.log('\nVitest runner output:');
  console.log(runnerOutput);
}

const implementedWorking = implementedFeatures.length - failingFeatures.length;
const notImplementedCount = notImplementedFeatures.length;
const totalBriefCount = allFeatures.length;
console.log(
  `\nSummary: ${implementedWorking}/${implementedFeatures.length} implemented features work. ${notImplementedCount}/${totalBriefCount} optional features are not implemented.`
);

process.exit(failingFeatures.length === 0 && !runnerFailed && unhandledErrors.length === 0 ? 0 : 1);
