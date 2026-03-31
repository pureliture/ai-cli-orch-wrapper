/**
 * Ad-hoc workflow command
 *
 * Parses runtime workflow overrides and executes a one-off workflow run.
 */

import { readAcoConfig } from '../config/aco-config.js';
import {
  resolveAdHocWorkflow,
  type WorkflowOverrides,
} from '../orchestration/workflow-config.js';
import { runWorkflow } from '../orchestration/workflow-runner.js';

function readFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

function parseRoleOverride(value: string): { roleName: string; provider: string } {
  const separatorIndex = value.indexOf('=');
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new Error(`invalid --role value '${value}'; expected <name>=<provider>`);
  }

  return {
    roleName: value.slice(0, separatorIndex),
    provider: value.slice(separatorIndex + 1),
  };
}

export function parseWorkflowOverrides(args: string[]): WorkflowOverrides {
  const overrides: WorkflowOverrides = {};
  const roleOverrides: Record<string, string> = {};
  const plannerLaunchArgs: string[] = [];
  const reviewerLaunchArgs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--planner-role') {
      overrides.plannerRole = readFlagValue(args, index, '--planner-role');
      index += 1;
    } else if (arg === '--planner-agent') {
      overrides.plannerAgent = readFlagValue(args, index, '--planner-agent');
      index += 1;
    } else if (arg === '--reviewer-role') {
      overrides.reviewerRole = readFlagValue(args, index, '--reviewer-role');
      index += 1;
    } else if (arg === '--reviewer-agent') {
      overrides.reviewerAgent = readFlagValue(args, index, '--reviewer-agent');
      index += 1;
    } else if (arg === '--max-iterations') {
      const rawValue = readFlagValue(args, index, '--max-iterations');
      const parsed = Number.parseInt(rawValue, 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`invalid value for --max-iterations: '${rawValue}'`);
      }
      overrides.maxIterations = parsed;
      index += 1;
    } else if (arg === '--role') {
      const rawValue = readFlagValue(args, index, '--role');
      const parsed = parseRoleOverride(rawValue);
      roleOverrides[parsed.roleName] = parsed.provider;
      index += 1;
    } else if (arg === '--planner-launch-arg') {
      plannerLaunchArgs.push(readFlagValue(args, index, '--planner-launch-arg'));
      index += 1;
    } else if (arg === '--reviewer-launch-arg') {
      reviewerLaunchArgs.push(readFlagValue(args, index, '--reviewer-launch-arg'));
      index += 1;
    } else {
      throw new Error(`unknown flag '${arg}'`);
    }
  }

  if (plannerLaunchArgs.length > 0) {
    overrides.plannerLaunchArgs = plannerLaunchArgs;
  }

  if (reviewerLaunchArgs.length > 0) {
    overrides.reviewerLaunchArgs = reviewerLaunchArgs;
  }

  if (Object.keys(roleOverrides).length > 0) {
    overrides.roleOverrides = roleOverrides;
  }

  return overrides;
}

export async function workflowRunCommand(args: string[]): Promise<void> {
  const overrides = parseWorkflowOverrides(args);
  const missingRequiredFlags: string[] = [];

  if (!overrides.plannerRole) {
    missingRequiredFlags.push('--planner-role');
  }

  if (!overrides.reviewerRole) {
    missingRequiredFlags.push('--reviewer-role');
  }

  if (missingRequiredFlags.length > 0) {
    throw new Error(`missing required flags: ${missingRequiredFlags.join(', ')}`);
  }

  const config = readAcoConfig();
  const workflow = resolveAdHocWorkflow(config, {
    plannerRole: overrides.plannerRole,
    plannerAgent: overrides.plannerAgent ?? 'developer',
    reviewerRole: overrides.reviewerRole,
    reviewerAgent: overrides.reviewerAgent ?? 'reviewer',
    maxIterations: overrides.maxIterations ?? 3,
    plannerLaunchArgs: overrides.plannerLaunchArgs,
    reviewerLaunchArgs: overrides.reviewerLaunchArgs,
    roleOverrides: overrides.roleOverrides,
  });
  const result = await runWorkflow(workflow);

  if (result.exitCode === 2) {
    console.log(`Workflow reached max iterations without approval. Inspect artifacts under ${result.runDir} and rerun with overrides if needed.`);
  }

  process.exit(result.exitCode);
}
