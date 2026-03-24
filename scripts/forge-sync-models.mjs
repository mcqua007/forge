#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import {
  parseCliArgs,
  resolveForgeModels,
  toVsCodeModelName,
} from './lib/forge-models.mjs';

const AGENT_FILE_MAP = {
  'forge-test-writer': 'agents/forge-test-writer.agent.md',
  'forge-implementer': 'agents/forge-implementer.agent.md',
  'forge-refactorer': 'agents/forge-refactorer.agent.md',
  'forge-reviewer': 'agents/forge-reviewer.agent.md',
  'forge-committer': 'agents/forge-committer.agent.md',
};

function updateFrontmatterModel(content, vscodeModelName) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    throw new Error('Missing YAML frontmatter');
  }

  let frontmatter = frontmatterMatch[1];
  const modelLine = `model: "${vscodeModelName}"`;

  if (/^model:.*$/m.test(frontmatter)) {
    frontmatter = frontmatter.replace(/^model:.*$/m, modelLine);
  } else if (/^description:.*$/m.test(frontmatter)) {
    frontmatter = frontmatter.replace(
      /^description:.*$/m,
      (line) => `${line}\n${modelLine}`
    );
  } else {
    frontmatter = `${frontmatter}\n${modelLine}`;
  }

  return content.replace(/^---\n[\s\S]*?\n---/, `---\n${frontmatter}\n---`);
}

try {
  const { options, overrides } = parseCliArgs(process.argv.slice(2));
  const resolution = resolveForgeModels({
    repoRoot: options.repoRoot,
    pluginPath: options.pluginPath,
    userConfigPath: options.userConfigPath,
    repoConfigPath: options.repoConfigPath,
    overrides,
  });

  const updates = [];
  const skipped = [];

  for (const [agentName, modelName] of Object.entries(
    resolution.resolvedAgents
  )) {
    const relativePath = AGENT_FILE_MAP[agentName];
    if (!relativePath) {
      skipped.push({ agentName, reason: 'no agent file mapped' });
      continue;
    }

    const filePath = path.join(resolution.repoRoot, relativePath);
    if (!fs.existsSync(filePath)) {
      skipped.push({ agentName, reason: `missing file ${relativePath}` });
      continue;
    }

    const currentContent = fs.readFileSync(filePath, 'utf8');
    const nextContent = updateFrontmatterModel(
      currentContent,
      toVsCodeModelName(modelName)
    );

    if (options.write) {
      fs.writeFileSync(filePath, nextContent);
    }

    updates.push({
      agentName,
      modelName,
      vscodeModelName: toVsCodeModelName(modelName),
      filePath: relativePath,
      changed: currentContent !== nextContent,
    });
  }

  console.log(
    options.write
      ? 'Synced Forge agent models'
      : 'Preview Forge agent model sync'
  );
  console.log('');

  for (const update of updates) {
    console.log(
      `- ${update.agentName}: ${update.modelName} -> ${
        update.vscodeModelName
      } (${update.filePath})${update.changed ? '' : ' (no change)'}`
    );
  }

  if (skipped.length > 0) {
    console.log('');
    console.log('Skipped');

    for (const item of skipped) {
      console.log(`- ${item.agentName}: ${item.reason}`);
    }
  }

  if (!options.write) {
    console.log('');
    console.log('Run with --write to update the agent files.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
