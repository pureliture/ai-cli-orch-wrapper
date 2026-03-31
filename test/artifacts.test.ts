/**
 * Workflow artifact and prompt tests
 *
 * Wave 0 tests for repo-local workflow artifacts and planner/reviewer prompt
 * contracts used by the orchestration loop.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'wrapper-artifacts-test-'));
}

test('createAcoWorkflowRunArtifacts creates repo-local run paths under .wrapper/workflows', async () => {
  const { WORKFLOW_ARTIFACT_ROOT, createAcoWorkflowRunArtifacts } = await import('../dist/orchestration/artifacts.js');

  const repoRoot = makeTempDir();
  const artifacts = createAcoWorkflowRunArtifacts(repoRoot, 'plan-review', 'run-fixed-01');

  assert.equal(WORKFLOW_ARTIFACT_ROOT, '.wrapper/workflows');
  assert.equal(artifacts.workflowRootDir, join(repoRoot, '.wrapper', 'workflows', 'plan-review'));
  assert.equal(artifacts.runDir, join(repoRoot, '.wrapper', 'workflows', 'plan-review', 'runs', 'run-fixed-01'));
  assert.equal(artifacts.runFilePath, join(repoRoot, '.wrapper', 'workflows', 'plan-review', 'runs', 'run-fixed-01', 'run.json'));
  assert.equal(artifacts.stateFilePath, join(repoRoot, '.wrapper', 'workflows', 'plan-review', 'runs', 'run-fixed-01', 'state.json'));
  assert.equal(artifacts.iterationsDir, join(repoRoot, '.wrapper', 'workflows', 'plan-review', 'runs', 'run-fixed-01', 'iterations'));
  assert.ok(existsSync(artifacts.iterationsDir), 'iterations directory should be created');
  assert.ok(artifacts.runDir.startsWith(repoRoot), 'run directory must stay inside the provided repo root');
});

test('createAcoIterationArtifacts returns zero-padded iteration 01 paths', async () => {
  const { createAcoWorkflowRunArtifacts, createAcoIterationArtifacts } = await import('../dist/orchestration/artifacts.js');

  const repoRoot = makeTempDir();
  const runArtifacts = createAcoWorkflowRunArtifacts(repoRoot, 'plan-review', 'run-fixed-01');
  const iteration = createAcoIterationArtifacts(runArtifacts.runDir, 1);

  assert.equal(iteration.iterationDir, join(runArtifacts.runDir, 'iterations', '01'));
  assert.equal(iteration.plannerPromptPath, join(runArtifacts.runDir, 'iterations', '01', 'planner.prompt.md'));
  assert.equal(iteration.planPath, join(runArtifacts.runDir, 'iterations', '01', 'plan.md'));
  assert.equal(iteration.reviewerPromptPath, join(runArtifacts.runDir, 'iterations', '01', 'reviewer.prompt.md'));
  assert.equal(iteration.reviewPath, join(runArtifacts.runDir, 'iterations', '01', 'review.md'));
  assert.equal(iteration.reviewStatusPath, join(runArtifacts.runDir, 'iterations', '01', 'review.status.json'));
  assert.equal(iteration.iterationFilePath, join(runArtifacts.runDir, 'iterations', '01', 'iteration.json'));
  assert.ok(existsSync(iteration.iterationDir), 'iteration directory should be created');
});

test('createAcoIterationArtifacts uses iteration 02 and does not overwrite iteration 01', async () => {
  const { createAcoWorkflowRunArtifacts, createAcoIterationArtifacts } = await import('../dist/orchestration/artifacts.js');

  const repoRoot = makeTempDir();
  const runArtifacts = createAcoWorkflowRunArtifacts(repoRoot, 'plan-review', 'run-fixed-01');
  const iterationOne = createAcoIterationArtifacts(runArtifacts.runDir, 1);
  writeFileSync(iterationOne.planPath, 'plan-v1', 'utf8');

  const iterationTwo = createAcoIterationArtifacts(runArtifacts.runDir, 2);

  assert.equal(iterationTwo.iterationDir, join(runArtifacts.runDir, 'iterations', '02'));
  assert.equal(iterationTwo.planPath, join(runArtifacts.runDir, 'iterations', '02', 'plan.md'));
  assert.equal(readFileSync(iterationOne.planPath, 'utf8'), 'plan-v1');
});

test('writeRunSnapshot and writeRunState preserve workflow metadata', async () => {
  const { createAcoWorkflowRunArtifacts, writeRunSnapshot, writeRunState } = await import('../dist/orchestration/artifacts.js');

  const repoRoot = makeTempDir();
  const runArtifacts = createAcoWorkflowRunArtifacts(repoRoot, 'plan-review', 'run-fixed-01');

  const snapshot = {
    workflowName: 'plan-review',
    providers: {
      planner: 'claude_code',
      reviewer: 'gemini_cli',
    },
    agents: {
      planner: 'developer',
      reviewer: 'reviewer',
    },
    cwd: repoRoot,
    startedAt: '2026-03-24T13:45:00Z',
  };
  const state = {
    currentIteration: 2,
    finalStatus: 'approved',
  };

  writeRunSnapshot(runArtifacts.runFilePath, snapshot);
  writeRunState(runArtifacts.stateFilePath, state);

  assert.deepEqual(JSON.parse(readFileSync(runArtifacts.runFilePath, 'utf8')), snapshot);
  assert.deepEqual(JSON.parse(readFileSync(runArtifacts.stateFilePath, 'utf8')), state);
});

test('buildPlannerPrompt and buildReviewerPrompt mention exact artifact paths and statuses', async () => {
  const { buildPlannerPrompt, buildReviewerPrompt } = await import('../dist/orchestration/prompts.js');

  const plannerPrompt = buildPlannerPrompt({
    workflowName: 'plan-review',
    iterationNumber: 2,
    planPath: '/repo/.wrapper/workflows/plan-review/runs/run-01/iterations/02/plan.md',
    previousReviewPath: '/repo/.wrapper/workflows/plan-review/runs/run-01/iterations/01/review.md',
  });
  const reviewerPrompt = buildReviewerPrompt({
    workflowName: 'plan-review',
    iterationNumber: 2,
    planPath: '/repo/.wrapper/workflows/plan-review/runs/run-01/iterations/02/plan.md',
    reviewPath: '/repo/.wrapper/workflows/plan-review/runs/run-01/iterations/02/review.md',
    reviewStatusPath: '/repo/.wrapper/workflows/plan-review/runs/run-01/iterations/02/review.status.json',
  });

  assert.ok(plannerPrompt.includes('/repo/.wrapper/workflows/plan-review/runs/run-01/iterations/02/plan.md'));
  assert.ok(plannerPrompt.includes('/repo/.wrapper/workflows/plan-review/runs/run-01/iterations/01/review.md'));
  assert.ok(plannerPrompt.includes('write the deliverable to'));
  assert.ok(plannerPrompt.includes('Write the file directly'));
  assert.ok(plannerPrompt.includes('Do not spend time exploring unrelated files'));

  assert.ok(reviewerPrompt.includes('/repo/.wrapper/workflows/plan-review/runs/run-01/iterations/02/plan.md'));
  assert.ok(reviewerPrompt.includes('/repo/.wrapper/workflows/plan-review/runs/run-01/iterations/02/review.md'));
  assert.ok(reviewerPrompt.includes('/repo/.wrapper/workflows/plan-review/runs/run-01/iterations/02/review.status.json'));
  assert.ok(reviewerPrompt.includes('review.status.json'));
  assert.ok(reviewerPrompt.includes('Write both files directly'));
  assert.ok(reviewerPrompt.includes('approved'));
  assert.ok(reviewerPrompt.includes('changes_requested'));
});
