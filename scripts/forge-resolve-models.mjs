#!/usr/bin/env node

import {
  formatResolutionSummary,
  parseCliArgs,
  resolveForgeModels,
} from './lib/forge-models.mjs';

try {
  const { options, overrides } = parseCliArgs(process.argv.slice(2));
  const resolution = resolveForgeModels({
    repoRoot: options.repoRoot,
    pluginPath: options.pluginPath,
    userConfigPath: options.userConfigPath,
    repoConfigPath: options.repoConfigPath,
    overrides,
  });
  const summary = formatResolutionSummary(resolution);

  console.log('Forge model resolution');
  console.log('');

  for (const source of summary.sources) {
    console.log(
      `- ${source.name}: ${source.path}${source.found ? '' : ' (not found)'}`
    );
  }

  console.log('');
  console.log('Resolved models');

  for (const row of summary.rows) {
    console.log(
      `- ${row.agentName}: ${row.modelName} -> ${row.vscodeModelName}`
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
