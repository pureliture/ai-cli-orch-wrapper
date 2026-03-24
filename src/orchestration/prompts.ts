/**
 * Workflow prompts
 *
 * Builds planner and reviewer prompts tied to exact artifact file paths.
 */

export interface PlannerPromptInput {
  workflowName: string;
  iterationNumber: number;
  planPath: string;
  previousReviewPath?: string;
}

export interface ReviewerPromptInput {
  workflowName: string;
  iterationNumber: number;
  planPath: string;
  reviewPath: string;
  reviewStatusPath: string;
}

export function buildPlannerPrompt(input: PlannerPromptInput): string {
  const lines = [
    `Workflow: ${input.workflowName}`,
    `Iteration: ${input.iterationNumber}`,
    '',
    'You are the planner for this workflow iteration.',
    `Please write the deliverable to this exact file: ${input.planPath}`,
    'Do not keep the plan only in terminal output; persist it to the file path above.',
  ];

  if (input.previousReviewPath) {
    lines.push(`Before revising the plan, read the previous review from: ${input.previousReviewPath}`);
  }

  lines.push(
    'The output file must be a concrete plan that the reviewer can inspect on disk.',
  );

  return lines.join('\n');
}

export function buildReviewerPrompt(input: ReviewerPromptInput): string {
  return [
    `Workflow: ${input.workflowName}`,
    `Iteration: ${input.iterationNumber}`,
    '',
    'You are the reviewer for this workflow iteration.',
    `Read the plan from this exact file: ${input.planPath}`,
    `Write human-readable review feedback to: ${input.reviewPath}`,
    `Write machine-readable status to review.status.json at: ${input.reviewStatusPath}`,
    'Only these status values are valid: approved or changes_requested.',
    'Use one of these exact JSON shapes:',
    '{"schemaVersion":1,"status":"approved","summary":"..."}',
    '{"schemaVersion":1,"status":"changes_requested","summary":"..."}',
  ].join('\n');
}
