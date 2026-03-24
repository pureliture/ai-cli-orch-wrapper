/**
 * Workflow runner
 *
 * Shared planner-reviewer loop execution over the CAO client seam.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { CaoHttpClient } from './cao-client.js';
import {
  createIterationArtifacts,
  createWorkflowRunArtifacts,
  writeRunSnapshot,
  writeRunState,
} from './artifacts.js';
import { buildPlannerPrompt, buildReviewerPrompt } from './prompts.js';
import { readReviewStatusFile } from './status-file.js';
import type { ResolvedWorkflowDefinition } from './workflow-config.js';

export interface WorkflowRunResult {
  exitCode: 0 | 1 | 2;
  runDir: string;
  finalStatus: 'approved' | 'max_iterations' | 'failed';
  iterationCount: number;
}

type WorkflowClient = Pick<
  CaoHttpClient,
  'checkHealth' | 'createSession' | 'sendInput' | 'waitForCompletion' | 'getOutput' | 'exitTerminal'
>;

function writeJsonFile(path: string, data: Record<string, unknown>): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function now(): string {
  return new Date().toISOString();
}

async function safeExitTerminal(client: WorkflowClient, terminalId?: string): Promise<void> {
  if (!terminalId) {
    return;
  }

  await client.exitTerminal(terminalId);
}

export async function runWorkflow(
  workflow: ResolvedWorkflowDefinition,
  options?: {
    repoRoot?: string;
    client?: WorkflowClient;
    pollIntervalMs?: number;
    timeoutMs?: number;
  },
): Promise<WorkflowRunResult> {
  const repoRoot = resolve(options?.repoRoot ?? process.cwd());
  const client = options?.client ?? new CaoHttpClient(process.env.WRAPPER_CAO_BASE_URL);
  const runArtifacts = createWorkflowRunArtifacts(repoRoot, workflow.workflowName);
  const runId = basename(runArtifacts.runDir);
  const startedAt = now();

  writeRunSnapshot(runArtifacts.runFilePath, {
    workflowName: workflow.workflowName,
    providers: {
      planner: workflow.plannerProvider,
      reviewer: workflow.reviewerProvider,
    },
    agents: {
      planner: workflow.plannerAgent,
      reviewer: workflow.reviewerAgent,
    },
    roles: {
      planner: workflow.plannerRole,
      reviewer: workflow.reviewerRole,
    },
    roleMappings: workflow.roleMappings,
    cwd: repoRoot,
    startedAt,
    maxIterations: workflow.maxIterations,
    runId,
  });

  writeRunState(runArtifacts.stateFilePath, {
    workflowName: workflow.workflowName,
    runId,
    status: 'running',
    finalStatus: null,
    currentIteration: 0,
    iterationCount: 0,
    lastReviewStatus: null,
    nextAction: 'Workflow run initialized.',
    startedAt,
    updatedAt: startedAt,
  });

  try {
    await client.checkHealth();
  } catch (error) {
    const failedAt = now();
    writeRunState(runArtifacts.stateFilePath, {
      workflowName: workflow.workflowName,
      runId,
      status: 'failed',
      finalStatus: 'failed',
      currentIteration: 0,
      iterationCount: 0,
      lastReviewStatus: null,
      nextAction: 'Start cao-server and rerun the workflow.',
      startedAt,
      updatedAt: failedAt,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      exitCode: 1,
      runDir: runArtifacts.runDir,
      finalStatus: 'failed',
      iterationCount: 0,
    };
  }

  let previousReviewPath: string | undefined;

  for (let iterationNumber = 1; iterationNumber <= workflow.maxIterations; iterationNumber += 1) {
    const iterationStartedAt = now();
    const iterationArtifacts = createIterationArtifacts(runArtifacts.runDir, iterationNumber);
    const plannerPrompt = buildPlannerPrompt({
      workflowName: workflow.workflowName,
      iterationNumber,
      planPath: iterationArtifacts.planPath,
      previousReviewPath,
    });
    writeFileSync(iterationArtifacts.plannerPromptPath, plannerPrompt, 'utf8');

    let plannerTerminalId: string | undefined;
    let reviewerTerminalId: string | undefined;
    const plannerSessionName = `${workflow.workflowName}-${runId}-planner-${String(iterationNumber).padStart(2, '0')}`;
    const reviewerSessionName = `${workflow.workflowName}-${runId}-reviewer-${String(iterationNumber).padStart(2, '0')}`;

    try {
      const plannerTerminal = await client.createSession({
        provider: workflow.plannerProvider,
        agentProfile: workflow.plannerAgent,
        sessionName: plannerSessionName,
        workingDirectory: repoRoot,
        launchArgs: workflow.plannerLaunchArgs,
      });
      plannerTerminalId = plannerTerminal.id;

      await client.sendInput(plannerTerminal.id, plannerPrompt);
      await client.waitForCompletion(plannerTerminal.id, {
        pollIntervalMs: options?.pollIntervalMs,
        timeoutMs: options?.timeoutMs,
      });

      if (!existsSync(iterationArtifacts.planPath)) {
        throw new Error(`Missing plan artifact: ${iterationArtifacts.planPath}`);
      }

      const reviewerPrompt = buildReviewerPrompt({
        workflowName: workflow.workflowName,
        iterationNumber,
        planPath: iterationArtifacts.planPath,
        reviewPath: iterationArtifacts.reviewPath,
        reviewStatusPath: iterationArtifacts.reviewStatusPath,
      });
      writeFileSync(iterationArtifacts.reviewerPromptPath, reviewerPrompt, 'utf8');

      const reviewerTerminal = await client.createSession({
        provider: workflow.reviewerProvider,
        agentProfile: workflow.reviewerAgent,
        sessionName: reviewerSessionName,
        workingDirectory: repoRoot,
        launchArgs: workflow.reviewerLaunchArgs,
      });
      reviewerTerminalId = reviewerTerminal.id;

      await client.sendInput(reviewerTerminal.id, reviewerPrompt);
      await client.waitForCompletion(reviewerTerminal.id, {
        pollIntervalMs: options?.pollIntervalMs,
        timeoutMs: options?.timeoutMs,
      });

      const reviewStatus = readReviewStatusFile(iterationArtifacts.reviewStatusPath);
      const iterationCompletedAt = now();

      writeJsonFile(iterationArtifacts.iterationFilePath, {
        iterationNumber,
        startedAt: iterationStartedAt,
        completedAt: iterationCompletedAt,
        planner: {
          sessionName: plannerSessionName,
          terminalId: plannerTerminalId,
        },
        reviewer: {
          sessionName: reviewerSessionName,
          terminalId: reviewerTerminalId,
        },
        reviewStatus: reviewStatus.status,
        summary: reviewStatus.summary,
      });

      if (reviewStatus.status === 'approved') {
        writeRunState(runArtifacts.stateFilePath, {
          workflowName: workflow.workflowName,
          runId,
          status: 'approved',
          finalStatus: 'approved',
          currentIteration: iterationNumber,
          iterationCount: iterationNumber,
          lastReviewStatus: reviewStatus.status,
          nextAction: 'Workflow approved.',
          startedAt,
          updatedAt: iterationCompletedAt,
        });

        return {
          exitCode: 0,
          runDir: runArtifacts.runDir,
          finalStatus: 'approved',
          iterationCount: iterationNumber,
        };
      }

      previousReviewPath = iterationArtifacts.reviewPath;
      writeRunState(runArtifacts.stateFilePath, {
        workflowName: workflow.workflowName,
        runId,
        status: iterationNumber === workflow.maxIterations ? 'max_iterations' : 'running',
        finalStatus: iterationNumber === workflow.maxIterations ? 'max_iterations' : null,
        currentIteration: iterationNumber,
        iterationCount: iterationNumber,
        lastReviewStatus: reviewStatus.status,
        nextAction: iterationNumber === workflow.maxIterations
          ? 'Max iterations reached. Inspect artifacts in the run directory and rerun with overrides if needed.'
          : 'Reviewer requested changes. Proceeding to the next iteration.',
        startedAt,
        updatedAt: iterationCompletedAt,
      });
    } catch (error) {
      const failedAt = now();
      const message = error instanceof Error ? error.message : String(error);

      writeJsonFile(iterationArtifacts.iterationFilePath, {
        iterationNumber,
        startedAt: iterationStartedAt,
        completedAt: failedAt,
        planner: {
          sessionName: plannerSessionName,
          terminalId: plannerTerminalId ?? null,
        },
        reviewer: {
          sessionName: reviewerSessionName,
          terminalId: reviewerTerminalId ?? null,
        },
        status: 'failed',
        error: message,
      });

      writeRunState(runArtifacts.stateFilePath, {
        workflowName: workflow.workflowName,
        runId,
        status: 'failed',
        finalStatus: 'failed',
        currentIteration: iterationNumber,
        iterationCount: iterationNumber,
        lastReviewStatus: null,
        nextAction: 'Inspect artifacts and fix the failure before rerunning.',
        startedAt,
        updatedAt: failedAt,
        error: message,
      });

      return {
        exitCode: 1,
        runDir: runArtifacts.runDir,
        finalStatus: 'failed',
        iterationCount: iterationNumber,
      };
    } finally {
      await safeExitTerminal(client, plannerTerminalId);
      await safeExitTerminal(client, reviewerTerminalId);
    }
  }

  const completedAt = now();
  writeRunState(runArtifacts.stateFilePath, {
    workflowName: workflow.workflowName,
    runId,
    status: 'max_iterations',
    finalStatus: 'max_iterations',
    currentIteration: workflow.maxIterations,
    iterationCount: workflow.maxIterations,
    lastReviewStatus: 'changes_requested',
    nextAction: 'Max iterations reached. Inspect artifacts in the run directory and rerun with overrides if needed.',
    startedAt,
    updatedAt: completedAt,
  });

  return {
    exitCode: 2,
    runDir: runArtifacts.runDir,
    finalStatus: 'max_iterations',
    iterationCount: workflow.maxIterations,
  };
}
