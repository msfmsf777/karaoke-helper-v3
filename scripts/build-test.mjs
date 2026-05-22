import { runBuildPipeline } from './release-utils.mjs';

console.log('Building unsigned local test package...');
runBuildPipeline({ signed: false });
