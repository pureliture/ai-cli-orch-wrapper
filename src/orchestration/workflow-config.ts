/**
 * Workflow config resolution
 *
 * Resolves named and ad-hoc workflow definitions into fully-resolved
 * configurations with provider mappings derived from config.roles.
 */

import type { AcoConfig } from '../config/aco-config.js';

export interface WorkflowDefinitionInput {
  plannerRole: string;
  plannerAgent: string;
  reviewerRole: string;
  reviewerAgent: string;
  maxIterations: number;
  plannerLaunchArgs?: string[];
  reviewerLaunchArgs?: string[];
}

export interface WorkflowOverrides {
  plannerRole?: string;
  plannerAgent?: string;
  reviewerRole?: string;
  reviewerAgent?: string;
  maxIterations?: number;
  plannerLaunchArgs?: string[];
  reviewerLaunchArgs?: string[];
  roleOverrides?: Record<string, string>;
}

export interface ResolvedWorkflowDefinition {
  workflowName: string;
  plannerRole: string;
  plannerAgent: string;
  plannerProvider: string;
  reviewerRole: string;
  reviewerAgent: string;
  reviewerProvider: string;
  maxIterations: number;
  plannerLaunchArgs: string[];
  reviewerLaunchArgs: string[];
  roleMappings: Record<string, string>;
}

function validateDefinition(def: Partial<WorkflowDefinitionInput>, name: string): asserts def is WorkflowDefinitionInput {
  if (
    !def.plannerRole ||
    !def.plannerAgent ||
    !def.reviewerRole ||
    !def.reviewerAgent ||
    !def.maxIterations ||
    def.maxIterations < 1
  ) {
    throw new Error(`Invalid workflow '${name}': missing required fields (plannerRole, plannerAgent, reviewerRole, reviewerAgent, maxIterations >= 1)`);
  }
}

function resolveProvider(
  roleName: string,
  roles: Record<string, string>,
  roleOverrides?: Record<string, string>,
): string {
  if (roleOverrides && roleOverrides[roleName] !== undefined) {
    return roleOverrides[roleName];
  }
  const provider = roles[roleName];
  if (!provider) {
    throw new Error(`Unknown role '${roleName}': not found in config.roles`);
  }
  return provider;
}

export function resolveNamedWorkflow(
  config: AcoConfig,
  workflowName: string,
  overrides?: WorkflowOverrides,
): ResolvedWorkflowDefinition {
  const workflows = config.workflows ?? {};
  const def = workflows[workflowName];
  if (!def) {
    throw new Error(`Invalid workflow '${workflowName}': not found in config.workflows`);
  }

  validateDefinition(def, workflowName);

  const plannerRole = overrides?.plannerRole ?? def.plannerRole;
  const plannerAgent = overrides?.plannerAgent ?? def.plannerAgent;
  const reviewerRole = overrides?.reviewerRole ?? def.reviewerRole;
  const reviewerAgent = overrides?.reviewerAgent ?? def.reviewerAgent;
  const maxIterations = overrides?.maxIterations ?? def.maxIterations;
  const plannerLaunchArgs = overrides?.plannerLaunchArgs ?? def.plannerLaunchArgs ?? [];
  const reviewerLaunchArgs = overrides?.reviewerLaunchArgs ?? def.reviewerLaunchArgs ?? [];

  const roleOverrides = overrides?.roleOverrides;
  const roles = config.roles ?? {};

  const roleMappings = { ...roles };
  if (roleOverrides) {
    for (const [k, v] of Object.entries(roleOverrides)) {
      roleMappings[k] = v;
    }
  }

  return {
    workflowName,
    plannerRole,
    plannerAgent,
    plannerProvider: resolveProvider(plannerRole, roleMappings),
    reviewerRole,
    reviewerAgent,
    reviewerProvider: resolveProvider(reviewerRole, roleMappings),
    maxIterations,
    plannerLaunchArgs,
    reviewerLaunchArgs,
    roleMappings,
  };
}

export function resolveAdHocWorkflow(
  config: AcoConfig,
  overrides: WorkflowOverrides,
): ResolvedWorkflowDefinition {
  const def: Partial<WorkflowDefinitionInput> = {
    plannerRole: overrides.plannerRole,
    plannerAgent: overrides.plannerAgent,
    reviewerRole: overrides.reviewerRole,
    reviewerAgent: overrides.reviewerAgent,
    maxIterations: overrides.maxIterations,
    plannerLaunchArgs: overrides.plannerLaunchArgs,
    reviewerLaunchArgs: overrides.reviewerLaunchArgs,
  };

  validateDefinition(def, 'ad-hoc');

  const roleOverrides = overrides.roleOverrides;
  const roles = config.roles ?? {};

  const roleMappings = { ...roles };
  if (roleOverrides) {
    for (const [k, v] of Object.entries(roleOverrides)) {
      roleMappings[k] = v;
    }
  }

  return {
    workflowName: 'ad-hoc',
    plannerRole: def.plannerRole,
    plannerAgent: def.plannerAgent,
    plannerProvider: resolveProvider(def.plannerRole, roleMappings),
    reviewerRole: def.reviewerRole,
    reviewerAgent: def.reviewerAgent,
    reviewerProvider: resolveProvider(def.reviewerRole, roleMappings),
    maxIterations: def.maxIterations,
    plannerLaunchArgs: def.plannerLaunchArgs ?? [],
    reviewerLaunchArgs: def.reviewerLaunchArgs ?? [],
    roleMappings,
  };
}
