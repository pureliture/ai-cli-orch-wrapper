#!/usr/bin/env python3
"""Generate a Jira-style GitHub issue body."""

from __future__ import annotations

import argparse
import textwrap


def section(title: str, body: str) -> str:
    return f"## {title}\n\n{body.strip()}\n"


def join_sections(*parts: str) -> str:
    return "\n".join(part.rstrip() for part in parts).strip() + "\n"


def bullet_list(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def build_epic(args: argparse.Namespace) -> str:
    children = args.children or ["[ ] Child issue 1", "[ ] Child issue 2"]
    return join_sections(
        section("Summary", args.summary or "Describe the multi-issue outcome."),
        section("Outcome", args.outcome or "Describe the target result."),
        section("Scope", args.scope or "List what is included and excluded."),
        section("Child Issues", "\n".join(f"- {item}" for item in children)),
        section("Exit Criteria", bullet_list(args.acceptance or ["Define the conditions for completion."])),
    )


def build_story_or_task(args: argparse.Namespace, kind: str) -> str:
    parent = args.parent or "Link the parent epic or parent issue."
    return join_sections(
        section("Summary", args.summary or f"Describe the {kind}."),
        section("Outcome", args.outcome or "Describe the expected user or system result."),
        section("Parent", parent),
        section("Acceptance Criteria", bullet_list(args.acceptance or ["Criterion 1", "Criterion 2"])),
        section("Notes", args.notes or "Add implementation notes, constraints, or links."),
    )


def build_bug(args: argparse.Namespace) -> str:
    reproduction = args.reproduction or ["Step 1", "Step 2", "Observed failure"]
    return join_sections(
        section("Summary", args.summary or "Describe the defect."),
        section("Actual Behavior", args.actual or "What is happening now?"),
        section("Expected Behavior", args.expected or "What should happen instead?"),
        section("Reproduction", bullet_list(reproduction)),
        section("Impact", args.impact or "Describe severity, scope, and affected users."),
        section("Acceptance Criteria", bullet_list(args.acceptance or ["Bug no longer reproduces.", "Relevant regression coverage exists."])),
    )


def build_spike(args: argparse.Namespace) -> str:
    return join_sections(
        section("Question", args.summary or "What needs to be learned or decided?"),
        section("Scope", args.scope or "State what the investigation will and will not cover."),
        section("Expected Output", args.outcome or "Decision memo, recommendation, prototype, or findings."),
        section("Time Box", args.time_box or "Define the investigation time box."),
        section("Acceptance Criteria", bullet_list(args.acceptance or ["Questions are answered.", "Findings are documented."])),
    )


def build_chore(args: argparse.Namespace) -> str:
    return join_sections(
        section("Summary", args.summary or "Describe the maintenance work."),
        section("Operational Goal", args.outcome or "Describe the operational improvement."),
        section("Constraints", args.scope or "List limits, dependencies, or windows."),
        section("Definition of Done", bullet_list(args.acceptance or ["Operational work is complete.", "Follow-up actions are captured if needed."])),
    )


def build_issue(args: argparse.Namespace) -> str:
    issue_type = args.type
    if issue_type == "epic":
        return build_epic(args)
    if issue_type in {"story", "task"}:
        return build_story_or_task(args, issue_type)
    if issue_type == "bug":
        return build_bug(args)
    if issue_type == "spike":
        return build_spike(args)
    if issue_type == "chore":
        return build_chore(args)
    raise ValueError(f"Unsupported type: {issue_type}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a Jira-style GitHub issue body.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """\
            Example:
              make_issue_body.py --type story --summary "Add streaming logs" --parent "#123"
            """
        ),
    )
    parser.add_argument("--type", required=True, choices=["epic", "story", "task", "bug", "spike", "chore"])
    parser.add_argument("--summary")
    parser.add_argument("--outcome")
    parser.add_argument("--scope")
    parser.add_argument("--notes")
    parser.add_argument("--parent")
    parser.add_argument("--actual")
    parser.add_argument("--expected")
    parser.add_argument("--impact")
    parser.add_argument("--time-box", dest="time_box")
    parser.add_argument("--acceptance", action="append")
    parser.add_argument("--reproduction", action="append")
    parser.add_argument("--children", action="append")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    print(build_issue(args), end="")


if __name__ == "__main__":
    main()
