import { runNodeScript } from './release-utils.mjs';

runNodeScript('scripts/build-release.mjs');
runNodeScript('scripts/publish-github-release.mjs');
