#!/usr/bin/env node

import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

import { parseCliArgs, resolveRuntimeInvocation } from './lib/forge-models.mjs';

function parseRunArgs(argv) {
  const sentinelIndex = argv.indexOf('--');
  const runtimeArgs =
    sentinelIndex === -1 ? argv : argv.slice(0, sentinelIndex);
  const commandArgs = sentinelIndex === -1 ? [] : argv.slice(sentinelIndex + 1);
  const parsed = parseCliArgs(runtimeArgs);
  const runtime = {
    agentName: null,
    prompt: '',
    dryRun: false,
    hostConfigPath: null,
  };

  for (let index = 0; index < runtimeArgs.length; index += 1) {
    const arg = runtimeArgs[index];

    if (arg === '--agent') {
      runtime.agentName = runtimeArgs[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--prompt') {
      runtime.prompt = runtimeArgs[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      runtime.dryRun = true;
      continue;
    }

    if (arg === '--host-config') {
      runtime.hostConfigPath = runtimeArgs[index + 1];
      index += 1;
    }
  }

  if (!runtime.agentName) {
    throw new Error('Missing required --agent argument.');
  }

  if (commandArgs.length === 0 && !runtime.hostConfigPath) {
    throw new Error(
      'Missing host command. Pass it after --, or provide --host-config .forge-host.json.'
    );
  }

  return {
    ...parsed,
    runtime,
    commandArgs,
  };
}

function loadHostConfig(configPath, repoRoot) {
  const resolvedPath = path.resolve(repoRoot, configPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Missing host config file: ${resolvedPath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Failed to parse host config ${resolvedPath}: ${error.message}`
    );
  }

  if (!parsed.command || typeof parsed.command !== 'string') {
    throw new Error(
      `Host config ${resolvedPath} must define a string command.`
    );
  }

  if (parsed.args && !Array.isArray(parsed.args)) {
    throw new Error(
      `Host config ${resolvedPath} must define args as an array if present.`
    );
  }

  return {
    command: parsed.command,
    args: parsed.args ?? [],
    path: resolvedPath,
  };
}

function substituteToken(token, payload) {
  return token
    .replaceAll('{agent}', payload.agent)
    .replaceAll('{modelId}', payload.modelId)
    .replaceAll('{vscodeModel}', payload.vscodeModel)
    .replaceAll('{prompt}', payload.prompt);
}

try {
  const { options, overrides, runtime, commandArgs } = parseRunArgs(
    process.argv.slice(2)
  );
  const invocation = resolveRuntimeInvocation({
    repoRoot: options.repoRoot,
    pluginPath: options.pluginPath,
    userConfigPath: options.userConfigPath,
    repoConfigPath: options.repoConfigPath,
    overrides,
    agentName: runtime.agentName,
    prompt: runtime.prompt,
  });

  const payload = {
    agent: invocation.agentName,
    modelId: invocation.modelId,
    vscodeModel: invocation.vscodeModelName,
    prompt: invocation.prompt,
  };

  const hostCommand = runtime.hostConfigPath
    ? (() => {
        const config = loadHostConfig(runtime.hostConfigPath, options.repoRoot);
        return [config.command, ...config.args];
      })()
    : commandArgs;

  const resolvedCommand = hostCommand.map((token) =>
    substituteToken(token, payload)
  );

  if (runtime.dryRun) {
    console.log('Forge run-agent dry run');
    console.log('');
    console.log(`- agent: ${payload.agent}`);
    console.log(`- modelId: ${payload.modelId}`);
    console.log(`- vscodeModel: ${payload.vscodeModel}`);
    if (runtime.hostConfigPath) {
      console.log(`- hostConfig: ${runtime.hostConfigPath}`);
    }
    console.log(`- command: ${resolvedCommand.join(' ')}`);
    process.exit(0);
  }

  const child = spawn(resolvedCommand[0], resolvedCommand.slice(1), {
    stdio: 'inherit',
    env: {
      ...process.env,
      FORGE_AGENT: payload.agent,
      FORGE_MODEL_ID: payload.modelId,
      FORGE_VSCODE_MODEL: payload.vscodeModel,
      FORGE_PROMPT: payload.prompt,
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
