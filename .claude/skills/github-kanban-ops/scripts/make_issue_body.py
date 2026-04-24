#!/usr/bin/env python3
"""Generate a minimal Kanban-style GitHub issue title or body."""

from __future__ import annotations

import argparse
import textwrap


TYPE_PREFIXES = {
    "epic": "epic",
    "task": "task",
    "bug": "bug",
    "chore": "chore",
}


def section(title: str, body: str) -> str:
    return f"## {title}\n\n{body.strip()}\n"


def join_sections(*parts: str) -> str:
    return "\n\n".join(part.rstrip() for part in parts).strip() + "\n"


def bullet_list(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def build_title(args: argparse.Namespace) -> str:
    title = args.title or args.summary
    if not title:
        title = f"Describe the {args.type}"
    return f"{TYPE_PREFIXES[args.type]}: {title}"


def parent_text(args: argparse.Namespace) -> str:
    if not args.parent:
        return "No parent epic."
    if args.parent.lower().startswith("parent"):
        return args.parent
    return f"Parent epic: {args.parent}"


def build_epic(args: argparse.Namespace) -> str:
    children = args.children or ["[ ] Child issue 1", "[ ] Child issue 2"]
    parts = [
        section("Summary", args.summary or "Describe the multi-issue outcome."),
        section("Outcome", args.outcome or "Describe the target result."),
        section("Scope", args.scope or "Included:\n- Included item\n\nExcluded:\n- Out-of-scope item"),
        section("Child Issues", "\n".join(f"- {item}" for item in children)),
        section(
            "Exit Criteria",
            bullet_list(
                args.acceptance
                or [
                    "[ ] Required child issues are complete.",
                    "[ ] Related PRs are merged or explicitly carried over.",
                    "[ ] Test plan or validation notes are captured.",
                    "[ ] Remaining follow-ups are split into separate issues.",
                ]
            ),
        ),
        section("Notes", args.notes or "Add related PRs, docs, or decisions."),
    ]
    return join_sections(*parts)


def build_task(args: argparse.Namespace) -> str:
    parts = [
        section("Summary", args.summary or "Describe the task."),
        section("Outcome", args.outcome or "Describe the expected user or system result."),
        section("Parent", parent_text(args)),
        section("Scope", args.scope or "- Work item 1\n- Work item 2"),
        section(
            "Acceptance Criteria",
            bullet_list(
                args.acceptance
                or [
                    "[ ] Criterion 1",
                    "[ ] Criterion 2",
                    "[ ] Validation method is documented.",
                ]
            ),
        ),
        section("Notes", args.notes or "Add implementation notes, constraints, or links."),
    ]
    return join_sections(*parts)


def build_bug(args: argparse.Namespace) -> str:
    reproduction = args.reproduction or ["Step 1", "Step 2", "Observed failure"]
    parts = [
        section("Summary", args.summary or "Describe the defect."),
        section("Actual Behavior", args.actual or "What is happening now?"),
        section("Expected Behavior", args.expected or "What should happen instead?"),
        section("Reproduction", bullet_list(reproduction)),
        section("Impact", args.impact or "Describe severity, scope, and affected users."),
        section("Parent", parent_text(args)),
        section(
            "Acceptance Criteria",
            bullet_list(
                args.acceptance
                or [
                    "[ ] Bug no longer reproduces.",
                    "[ ] Relevant regression coverage or validation exists.",
                ]
            ),
        ),
        section("Notes", args.notes or "Add logs, PR review links, or affected files."),
    ]
    return join_sections(*parts)


def build_chore(args: argparse.Namespace) -> str:
    parts = [
        section("Summary", args.summary or "Describe the maintenance work."),
        section("Operational Goal", args.outcome or "Describe the operational improvement."),
        section("Constraints", args.scope or "List limits, dependencies, or windows."),
        section("Parent", parent_text(args)),
        section(
            "Definition of Done",
            bullet_list(
                args.acceptance
                or [
                    "[ ] Operational work is complete.",
                    "[ ] Follow-up actions are captured if needed.",
                ]
            ),
        ),
        section("Notes", args.notes or "Add operational context or links."),
    ]
    return join_sections(*parts)


def build_issue(args: argparse.Namespace) -> str:
    issue_type = args.type
    if issue_type == "epic":
        return build_epic(args)
    if issue_type == "task":
        return build_task(args)
    if issue_type == "bug":
        return build_bug(args)
    if issue_type == "chore":
        return build_chore(args)
    raise ValueError(f"Unsupported type: {issue_type}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a minimal Kanban-style GitHub issue title or body.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """\
            Example:
              make_issue_body.py --type task --title "Add streaming logs" \\
                --summary "Expose live worker logs in the CLI." \\
                --outcome "Users can inspect task progress without opening raw log files." \\
                --scope "Stream stdout/stderr for active worker processes." \\
                --acceptance "[ ] Active task output appears in order." \\
                --notes "Keep archived log storage unchanged." \\
                --parent "#123" --format all
            """
        ),
    )
    parser.add_argument("--type", required=True, choices=["epic", "task", "bug", "chore"])
    parser.add_argument("--title", help="Concise issue title without the type prefix.")
    parser.add_argument("--summary")
    parser.add_argument("--outcome")
    parser.add_argument("--scope")
    parser.add_argument("--notes")
    parser.add_argument("--parent")
    parser.add_argument("--actual")
    parser.add_argument("--expected")
    parser.add_argument("--impact")
    parser.add_argument("--acceptance", action="append")
    parser.add_argument("--reproduction", action="append")
    parser.add_argument("--children", action="append")
    parser.add_argument("--format", choices=["body", "title", "all"], default="body")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.format == "title":
        print(build_title(args))
        return
    if args.format == "all":
        print(f"TITLE: {build_title(args)}\n")
    print(build_issue(args), end="")


if __name__ == "__main__":
    main()
