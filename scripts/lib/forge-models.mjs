import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_PLUGIN_FILE = 'plugin.json';
const DEFAULT_REPO_CONFIG_FILE = '.forge.json';
const DEFAULT_USER_CONFIG_FILE = path.join(
  os.homedir(),
  '.forge',
  'config.json'
);

export const AGENT_FILE_MAP = {
  'forge-test-writer': 'agents/forge-test-writer.agent.md',
  'forge-implementer': 'agents/forge-implementer.agent.md',
  'forge-refactorer': 'agents/forge-refactorer.agent.md',
  'forge-reviewer': 'agents/forge-reviewer.agent.md',
  'forge-reviewer-deep': 'agents/forge-reviewer-deep.agent.md',
  'forge-committer': 'agents/forge-committer.agent.md',
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override;
  }

  const merged = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }

    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = deepMerge(merged[key], value);
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

export function readJsonFile(filePath, { optional = false } = {}) {
  if (!fs.existsSync(filePath)) {
    if (optional) {
      return null;
    }

    throw new Error(`Missing JSON file: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error.message}`);
  }
}

export function readTextFile(filePath, { optional = false } = {}) {
  if (!fs.existsSync(filePath)) {
    if (optional) {
      return null;
    }

    throw new Error(`Missing file: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

export function getRequiredFlagValue(argv, index, flagName) {
  const value = argv[index + 1];

  if (
    value === undefined ||
    value === '--' ||
    (value.startsWith('--') && value.length > 2)
  ) {
    throw new Error(`Missing value for ${flagName}.`);
  }

  return value;
}

export function parseCliArgs(argv) {
  const overrides = {
    mode: null,
    allModel: null,
    agents: {},
  };
  const options = {
    repoRoot: process.cwd(),
    pluginPath: null,
    userConfigPath: DEFAULT_USER_CONFIG_FILE,
    repoConfigPath: null,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    if (arg === '--repo-root') {
      options.repoRoot = path.resolve(
        getRequiredFlagValue(argv, index, '--repo-root')
      );
      index += 1;
      continue;
    }

    if (arg === '--plugin') {
      options.pluginPath = path.resolve(
        getRequiredFlagValue(argv, index, '--plugin')
      );
      index += 1;
      continue;
    }

    if (arg === '--user-config') {
      options.userConfigPath = path.resolve(
        getRequiredFlagValue(argv, index, '--user-config')
      );
      index += 1;
      continue;
    }

    if (arg === '--repo-config') {
      options.repoConfigPath = path.resolve(
        getRequiredFlagValue(argv, index, '--repo-config')
      );
      index += 1;
      continue;
    }

    if (arg === '--mode') {
      overrides.mode = getRequiredFlagValue(argv, index, '--mode');
      index += 1;
      continue;
    }

    if (arg === '--all-model') {
      overrides.allModel = getRequiredFlagValue(argv, index, '--all-model');
      index += 1;
      continue;
    }

    if (arg === '--agent-model') {
      const assignment = getRequiredFlagValue(argv, index, '--agent-model');
      const separatorIndex = assignment.indexOf('=');

      if (separatorIndex === -1) {
        throw new Error(
          `Invalid --agent-model value: ${assignment}. Expected agent=model.`
        );
      }

      const agentName = assignment.slice(0, separatorIndex);
      const modelName = assignment.slice(separatorIndex + 1);
      overrides.agents[agentName] = modelName;
      index += 1;
      continue;
    }
  }

  return { options, overrides };
}

export function applyRuntimeOverrides(modelsConfig, overrides) {
  if (
    !overrides.mode &&
    !overrides.allModel &&
    Object.keys(overrides.agents).length === 0
  ) {
    return modelsConfig;
  }

  const nextModels = deepMerge(modelsConfig, {});
  const agentAssignments = { ...(nextModels.agents ?? {}) };
  const roleAssignments = nextModels.roles ?? {};

  if (overrides.mode === 'cheap' || overrides.mode === 'fast') {
    for (const agentName of Object.keys(agentAssignments)) {
      agentAssignments[agentName] = 'fast';
    }
  }

  if (overrides.mode === 'thorough') {
    for (const agentName of Object.keys(agentAssignments)) {
      agentAssignments[agentName] = 'reasoning';
    }
  }

  if (overrides.allModel) {
    for (const agentName of Object.keys(agentAssignments)) {
      agentAssignments[agentName] = overrides.allModel;
    }
  }

  for (const [agentName, modelName] of Object.entries(overrides.agents)) {
    agentAssignments[agentName] = modelName;
  }

  return {
    ...nextModels,
    roles: roleAssignments,
    agents: agentAssignments,
  };
}

export function resolveAgentModels(modelsConfig) {
  const roles = modelsConfig.roles ?? {};
  const agentAssignments = modelsConfig.agents ?? {};
  const resolved = {};

  for (const [agentName, assignment] of Object.entries(agentAssignments)) {
    if (roles[assignment]) {
      const resolvedModel = roles[assignment]?.default;

      if (!resolvedModel) {
        throw new Error(
          `Role ${assignment} for ${agentName} is missing a default model.`
        );
      }

      resolved[agentName] = resolvedModel;
      continue;
    }

    resolved[agentName] = assignment;
  }

  return resolved;
}

export function resolveForgeModels({
  repoRoot = process.cwd(),
  pluginPath = null,
  userConfigPath = DEFAULT_USER_CONFIG_FILE,
  repoConfigPath = null,
  overrides = { mode: null, allModel: null, agents: {} },
} = {}) {
  const effectivePluginPath =
    pluginPath ?? path.join(repoRoot, DEFAULT_PLUGIN_FILE);
  const effectiveRepoConfigPath =
    repoConfigPath ?? path.join(repoRoot, DEFAULT_REPO_CONFIG_FILE);

  const pluginConfig = readJsonFile(effectivePluginPath);
  const userConfig = readJsonFile(userConfigPath, { optional: true });
  const repoConfig = readJsonFile(effectiveRepoConfigPath, { optional: true });

  const sources = [
    { name: 'plugin', path: effectivePluginPath, found: true },
    { name: 'user', path: userConfigPath, found: Boolean(userConfig) },
    { name: 'repo', path: effectiveRepoConfigPath, found: Boolean(repoConfig) },
  ];

  let mergedModels = deepMerge(pluginConfig.models ?? {}, {});

  if (userConfig?.models) {
    mergedModels = deepMerge(mergedModels, userConfig.models);
  }

  if (repoConfig?.models) {
    mergedModels = deepMerge(mergedModels, repoConfig.models);
  }

  mergedModels = applyRuntimeOverrides(mergedModels, overrides);

  return {
    repoRoot,
    pluginPath: effectivePluginPath,
    repoConfigPath: effectiveRepoConfigPath,
    userConfigPath,
    sources,
    mergedModels,
    resolvedAgents: resolveAgentModels(mergedModels),
  };
}

const VSCODE_MODEL_NAME_MAP = {
  'gpt-5-4': 'GPT-5.4 (copilot)',
  'claude-opus-4-6': 'Claude Opus 4.6 (copilot)',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6 (copilot)',
  'claude-haiku-4-5': 'Claude Haiku 4.5 (copilot)',
  'gemini-2-5-pro': 'Gemini 2.5 Pro (copilot)',
  'gemini-2-5-flash': 'Gemini 2.5 Flash (copilot)',
};

export function toVsCodeModelInfo(modelId) {
  if (VSCODE_MODEL_NAME_MAP[modelId]) {
    return {
      vscodeModelName: VSCODE_MODEL_NAME_MAP[modelId],
      strategy: 'mapped',
    };
  }

  const normalized = modelId.trim();

  if (/\(copilot\)$/i.test(normalized)) {
    return {
      vscodeModelName: normalized,
      strategy: 'passthrough',
    };
  }

  const gptMatch = normalized.match(/^gpt-(\d+)-(\d+)$/i);
  if (gptMatch) {
    return {
      vscodeModelName: `GPT-${gptMatch[1]}.${gptMatch[2]} (copilot)`,
      strategy: 'derived',
    };
  }

  const claudeMatch = normalized.match(
    /^claude-(opus|sonnet|haiku)-(\d+)-(\d+)$/i
  );
  if (claudeMatch) {
    const family =
      claudeMatch[1][0].toUpperCase() + claudeMatch[1].slice(1).toLowerCase();
    return {
      vscodeModelName: `Claude ${family} ${claudeMatch[2]}.${claudeMatch[3]} (copilot)`,
      strategy: 'derived',
    };
  }

  const geminiMatch = normalized.match(/^gemini-(\d+)-(\d+)-(pro|flash)$/i);
  if (geminiMatch) {
    const tier =
      geminiMatch[3][0].toUpperCase() + geminiMatch[3].slice(1).toLowerCase();
    return {
      vscodeModelName: `Gemini ${geminiMatch[1]}.${geminiMatch[2]} ${tier} (copilot)`,
      strategy: 'derived',
    };
  }

  return {
    vscodeModelName: `${normalized} (copilot)`,
    strategy: 'derived',
  };
}

export function toVsCodeModelName(modelId) {
  return toVsCodeModelInfo(modelId).vscodeModelName;
}

export function readFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!frontmatterMatch) {
    throw new Error('Missing YAML frontmatter');
  }

  return frontmatterMatch[1];
}

export function readFrontmatterModel(content) {
  const frontmatter = readFrontmatter(content);
  const modelMatch = frontmatter.match(/^model:\s+['"]?(.+?)['"]?$/m);
  return modelMatch ? modelMatch[1] : null;
}

export function resolveRuntimeInvocation({
  repoRoot = process.cwd(),
  pluginPath = null,
  userConfigPath = DEFAULT_USER_CONFIG_FILE,
  repoConfigPath = null,
  overrides = { mode: null, allModel: null, agents: {} },
  agentName,
  prompt = '',
} = {}) {
  const resolution = resolveForgeModels({
    repoRoot,
    pluginPath,
    userConfigPath,
    repoConfigPath,
    overrides,
  });

  const modelId = resolution.resolvedAgents[agentName];

  if (!modelId) {
    throw new Error(`No resolved model found for agent ${agentName}.`);
  }

  const modelInfo = toVsCodeModelInfo(modelId);

  return {
    agentName,
    prompt,
    modelId,
    vscodeModelName: modelInfo.vscodeModelName,
    vscodeModelStrategy: modelInfo.strategy,
    resolution,
  };
}

export function validateForgeModels({ resolution, repoRoot }) {
  const errors = [];
  const warnings = [];

  for (const [agentName, modelId] of Object.entries(
    resolution.resolvedAgents
  )) {
    const modelInfo = toVsCodeModelInfo(modelId);
    const relativePath = AGENT_FILE_MAP[agentName];

    if (modelInfo.strategy === 'derived') {
      warnings.push(
        `${agentName}: VS Code model name for ${modelId} was derived as ${modelInfo.vscodeModelName}. Add an explicit mapping if this is not accepted by Copilot.`
      );
    }

    if (!relativePath) {
      warnings.push(`${agentName}: no mapped agent file for VS Code sync.`);
      continue;
    }

    const filePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(filePath)) {
      errors.push(
        `${agentName}: mapped agent file is missing at ${relativePath}.`
      );
      continue;
    }

    const content = readTextFile(filePath);
    let currentModel = null;

    try {
      currentModel = readFrontmatterModel(content);
    } catch (error) {
      errors.push(`${agentName}: ${error.message} in ${relativePath}.`);
      continue;
    }

    if (!currentModel) {
      warnings.push(
        `${agentName}: no model frontmatter found in ${relativePath}. Run sync-models -- --write.`
      );
      continue;
    }

    if (currentModel !== modelInfo.vscodeModelName) {
      warnings.push(
        `${agentName}: ${relativePath} has model ${currentModel}, expected ${modelInfo.vscodeModelName}. Run sync-models -- --write.`
      );
    }
  }

  return { errors, warnings };
}

export function formatResolutionSummary(resolution) {
  const rows = Object.entries(resolution.resolvedAgents)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([agentName, modelName]) => ({
      agentName,
      modelName,
      vscodeModelName: toVsCodeModelName(modelName),
    }));

  return {
    sources: resolution.sources,
    rows,
  };
}
