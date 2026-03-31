/**
 * Named workflow command
 *
 * Resolves a committed workflow from .wrapper.json and executes it.
 */

import { readAcoConfig } from '../config/aco-config.js';
import { resolveNamedWorkflow } from '../orchestration/workflow-config.js';
import { runWorkflow } from '../orchestration/workflow-runner.js';
import { parseWorkflowOverrides } from './workflow-run.js';

export async function workflowCommand(args: string[]): Promise<void> {
  const workflowName = args[0];
  if (!workflowName) {
    throw new Error('missing workflow name');
  }

  const config = readAcoConfig();
  if (!config.workflows || !config.workflows[workflowName]) {
    throw new Error(`unknown workflow '${workflowName}'`);
  }

  const overrides = parseWorkflowOverrides(args.slice(1));
  const workflow = resolveNamedWorkflow(config, workflowName, overrides);
  const result = await runWorkflow(workflow);

  if (result.exitCode === 2) {
    console.log(`Workflow reached max iterations without approval. Inspect artifacts under ${result.runDir} and rerun with overrides if needed.`);
  }

  process.exit(result.exitCode);
}
