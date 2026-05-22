import path from 'node:path';
import {
  capture,
  getReleasePaths,
  getVersion,
  githubRepo,
  releaseTag,
  requireFiles,
  rootDir,
  run,
  runNodeScript,
} from './release-utils.mjs';

const version = getVersion();
const tag = releaseTag(version);
const title = `KHelper V${version}`;
const paths = getReleasePaths(version);
const assetPaths = [paths.installer, paths.blockmap, paths.latest, paths.notes];
const dryRun = process.argv.includes('--dry-run');

runNodeScript('scripts/validate-release-artifacts.mjs');
requireFiles([...assetPaths, paths.githubBody]);

const authStatus = run('gh', ['auth', 'status', '--hostname', 'github.com'], {
  stdio: 'ignore',
  allowFailure: true,
});

if (authStatus.status !== 0) {
  console.error('GitHub CLI is not authenticated. Run: gh auth login --hostname github.com --web --git-protocol https');
  process.exit(1);
}

const releaseExists = run('gh', ['release', 'view', tag, '--repo', githubRepo], {
  stdio: 'ignore',
  allowFailure: true,
}).status === 0;

const relativeAssets = assetPaths.map((assetPath) => path.relative(rootDir, assetPath));
const notesFile = path.relative(rootDir, paths.githubBody);
const gitWarnings = getGitReleaseWarnings();

if (dryRun) {
  console.log(`Release dry run for ${githubRepo} ${tag}`);
  console.log(`Mode: ${releaseExists ? 'update existing release' : 'create draft release'}`);
  console.log(`Title: ${title}`);
  console.log(`Notes: ${notesFile}`);
  console.log('Assets:');
  for (const asset of relativeAssets) console.log(`- ${asset}`);
  if (gitWarnings.length > 0) {
    console.log('Git safety warnings for real upload:');
    for (const warning of gitWarnings) console.log(`- ${warning}`);
  }
  process.exit(0);
}

if (gitWarnings.length > 0 && process.env.KH_ALLOW_UNSAFE_RELEASE !== '1') {
  console.error('Refusing to publish release because Git state is not release-safe:');
  for (const warning of gitWarnings) console.error(`- ${warning}`);
  console.error('Commit and push first, or set KH_ALLOW_UNSAFE_RELEASE=1 to override intentionally.');
  process.exit(1);
}

if (releaseExists) {
  run('gh', ['release', 'edit', tag, '--repo', githubRepo, '--title', title, '--notes-file', notesFile]);
  run('gh', ['release', 'upload', tag, ...relativeAssets, '--repo', githubRepo, '--clobber']);
} else {
  run('gh', [
    'release',
    'create',
    tag,
    ...relativeAssets,
    '--repo',
    githubRepo,
    '--title',
    title,
    '--notes-file',
    notesFile,
    '--draft',
  ]);
}

run('gh', ['release', 'view', tag, '--repo', githubRepo, '--web'], { allowFailure: true });

function getGitReleaseWarnings() {
  const warnings = [];

  const status = capture('git', ['status', '--porcelain']);
  if (status.status !== 0) {
    warnings.push('unable to inspect Git worktree status');
    return warnings;
  }
  if (status.stdout.trim()) {
    warnings.push('working tree has uncommitted changes');
  }

  const head = capture('git', ['rev-parse', 'HEAD']);
  const upstream = capture('git', ['rev-parse', '@{u}']);
  if (head.status !== 0) {
    warnings.push('unable to inspect local HEAD commit');
  }
  if (upstream.status !== 0) {
    warnings.push('current branch has no upstream tracking branch');
  }
  if (head.status === 0 && upstream.status === 0 && head.stdout.trim() !== upstream.stdout.trim()) {
    warnings.push('local HEAD does not match upstream; push commits before publishing');
  }

  return warnings;
}
