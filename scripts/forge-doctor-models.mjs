#!/usr/bin/env node

import {
  formatResolutionSummary,
  parseCliArgs,
  resolveForgeModels,
  validateForgeModels,
} from './lib/forge-models.mjs';

function parseDoctorArgs(argv) {
  const parsed = parseCliArgs(argv);
  return {
    ...parsed,
    strict: argv.includes('--strict'),
  };
}

try {
  const { options, overrides, strict } = parseDoctorArgs(process.argv.slice(2));
  const resolution = resolveForgeModels({
    repoRoot: options.repoRoot,
    pluginPath: options.pluginPath,
    userConfigPath: options.userConfigPath,
    repoConfigPath: options.repoConfigPath,
    overrides,
  });
  const summary = formatResolutionSummary(resolution);
  const report = validateForgeModels({
    resolution,
    repoRoot: options.repoRoot,
  });

  console.log('Forge model doctor');
  console.log('');
  console.log('Resolved models');

  for (const row of summary.rows) {
    console.log(
      `- ${row.agentName}: ${row.modelName} -> ${row.vscodeModelName}`
    );
  }

  if (report.warnings.length > 0) {
    console.log('');
    console.log('Warnings');

    for (const warning of report.warnings) {
      console.log(`- ${warning}`);
    }

    if (strict) {
      process.exitCode = 1;
    }
  }

  if (report.errors.length > 0) {
    console.log('');
    console.log('Errors');

    for (const error of report.errors) {
      console.log(`- ${error}`);
    }

    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
