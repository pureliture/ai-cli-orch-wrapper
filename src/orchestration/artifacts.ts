/**
 * Workflow artifact helpers
 *
 * Creates deterministic repo-local workflow run and iteration paths.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const WORKFLOW_ARTIFACT_ROOT = '.wrapper/workflows';

export interface AcoWorkflowRunArtifacts {
  workflowRootDir: string;
  runDir: string;
  iterationsDir: string;
  runFilePath: string;
  stateFilePath: string;
}

export interface AcoIterationArtifacts {
  iterationDir: string;
  plannerPromptPath: string;
  planPath: string;
  reviewerPromptPath: string;
  reviewPath: string;
  reviewStatusPath: string;
  iterationFilePath: string;
}

function createRunId(): string {
  return `run-${Date.now()}`;
}

function ensureDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}

function writeJsonFile(path: string, data: Record<string, unknown>): void {
  ensureDirectory(dirname(path));
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function createAcoWorkflowRunArtifacts(
  repoRoot: string,
  workflowName: string,
  runId = createRunId(),
): AcoWorkflowRunArtifacts {
  const absoluteRepoRoot = resolve(repoRoot);
  const workflowRootDir = join(absoluteRepoRoot, WORKFLOW_ARTIFACT_ROOT, workflowName);
  const runDir = join(workflowRootDir, 'runs', runId);
  const iterationsDir = join(runDir, 'iterations');

  ensureDirectory(iterationsDir);

  return {
    workflowRootDir,
    runDir,
    iterationsDir,
    runFilePath: join(runDir, 'run.json'),
    stateFilePath: join(runDir, 'state.json'),
  };
}

export function createAcoIterationArtifacts(
  runDir: string,
  iterationNumber: number,
): AcoIterationArtifacts {
  const iterationSegment = String(iterationNumber).padStart(2, '0');
  const iterationDir = join(runDir, 'iterations', iterationSegment);

  ensureDirectory(iterationDir);

  return {
    iterationDir,
    plannerPromptPath: join(iterationDir, 'planner.prompt.md'),
    planPath: join(iterationDir, 'plan.md'),
    reviewerPromptPath: join(iterationDir, 'reviewer.prompt.md'),
    reviewPath: join(iterationDir, 'review.md'),
    reviewStatusPath: join(iterationDir, 'review.status.json'),
    iterationFilePath: join(iterationDir, 'iteration.json'),
  };
}

export function writeRunSnapshot(path: string, data: Record<string, unknown>): void {
  writeJsonFile(path, data);
}

export function writeRunState(path: string, data: Record<string, unknown>): void {
  writeJsonFile(path, data);
}
