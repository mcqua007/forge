#!/usr/bin/env node

import { parseCliArgs, resolveRuntimeInvocation } from './lib/forge-models.mjs';

function parseRuntimeArgs(argv) {
  const parsed = parseCliArgs(argv);
  const runtime = {
    agentName: null,
    prompt: '',
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--agent') {
      runtime.agentName = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--prompt') {
      runtime.prompt = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--json') {
      runtime.json = true;
    }
  }

  if (!runtime.agentName) {
    throw new Error('Missing required --agent argument.');
  }

  return {
    ...parsed,
    runtime,
  };
}

try {
  const { options, overrides, runtime } = parseRuntimeArgs(
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

  if (runtime.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log('Forge runtime invocation');
    console.log('');
    console.log(`- agent: ${payload.agent}`);
    console.log(`- modelId: ${payload.modelId}`);
    console.log(`- vscodeModel: ${payload.vscodeModel}`);

    if (payload.prompt) {
      console.log(`- prompt: ${payload.prompt}`);
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
