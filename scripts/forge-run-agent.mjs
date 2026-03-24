#!/usr/bin/env node

import { spawn } from 'node:child_process';

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
    }
  }

  if (!runtime.agentName) {
    throw new Error('Missing required --agent argument.');
  }

  if (commandArgs.length === 0) {
    throw new Error(
      'Missing host command. Pass it after --, for example: npm run run-agent -- --agent forge-reviewer --prompt "Review" -- my-host --model {modelId} --prompt {prompt}'
    );
  }

  return {
    ...parsed,
    runtime,
    commandArgs,
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

  const resolvedCommand = commandArgs.map((token) =>
    substituteToken(token, payload)
  );

  if (runtime.dryRun) {
    console.log('Forge run-agent dry run');
    console.log('');
    console.log(`- agent: ${payload.agent}`);
    console.log(`- modelId: ${payload.modelId}`);
    console.log(`- vscodeModel: ${payload.vscodeModel}`);
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
