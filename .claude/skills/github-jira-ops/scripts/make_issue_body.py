#!/usr/bin/env python3
"""Generate a Jira-style GitHub issue title or body."""

from __future__ import annotations

import argparse
import textwrap


TYPE_LABELS = {
    "epic": "Epic",
    "story": "Story",
    "task": "Task",
    "bug": "Bug",
    "spike": "Spike",
    "chore": "Chore",
}


def section(title: str, body: str) -> str:
    return f"## {title}\n\n{body.strip()}\n"


def join_sections(*parts: str) -> str:
    return "\n\n".join(part.rstrip() for part in parts).strip() + "\n"


def bullet_list(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def sprint_label(sprint: str | None) -> str:
    if not sprint:
        return ""
    return sprint if sprint.lower().startswith("sprint ") else f"Sprint {sprint}"


def build_title(args: argparse.Namespace) -> str:
    title = args.title or args.summary
    if not title:
        title = f"Describe the {args.type}"
    prefixes = []
    if args.sprint:
        prefixes.append(f"[{sprint_label(args.sprint)}]")
    prefixes.append(f"[{TYPE_LABELS[args.type]}]")
    return f"{''.join(prefixes)} {title}"


def sprint_section(args: argparse.Namespace) -> str | None:
    if not args.sprint:
        return None
    return section("Sprint", sprint_label(args.sprint))


def parent_text(args: argparse.Namespace) -> str:
    if not args.parent:
        return "Parent epic: #<issue-number>\n\nAlso add this issue as a GitHub native sub-issue of the parent epic when supported."
    if args.parent.lower().startswith("parent"):
        parent = args.parent
    else:
        parent = f"Parent epic: {args.parent}"
    return f"{parent}\n\nAlso add this issue as a GitHub native sub-issue of the parent epic when supported."


def build_epic(args: argparse.Namespace) -> str:
    children = args.children or ["[ ] Child issue 1", "[ ] Child issue 2"]
    parts = [
        section("Summary", args.summary or "Describe the multi-issue outcome."),
        section("Outcome", args.outcome or "Describe the target result."),
    ]
    sprint = sprint_section(args)
    if sprint:
        parts.append(sprint)
    parts.extend([
        section("Scope", args.scope or "Included:\n- Included item\n\nExcluded:\n- Out-of-scope item"),
        section("Child Issues", "\n".join(f"- {item}" for item in children)),
        section(
            "Exit Criteria",
            bullet_list(
                args.acceptance
                or [
                    "[ ] All P0 child issues are complete.",
                    "[ ] Related PRs are merged or explicitly carried over.",
                    "[ ] Test plan or validation notes are captured.",
                    "[ ] Remaining follow-ups are split into separate issues.",
                ]
            ),
        ),
        section("Notes", args.notes or "Add related PRs, OpenSpec changes, docs, or decisions."),
    ])
    return join_sections(*parts)


def build_story_or_task(args: argparse.Namespace, kind: str) -> str:
    parts = [
        section("Summary", args.summary or f"Describe the {kind}."),
        section("Outcome", args.outcome or "Describe the expected user or system result."),
        section("Parent", parent_text(args)),
        section("Scope", args.scope or "- Work item 1\n- Work item 2"),
        section("Acceptance Criteria", bullet_list(args.acceptance or ["[ ] Criterion 1", "[ ] Criterion 2", "[ ] Validation method is documented."])),
        section("Notes", args.notes or "Add implementation notes, constraints, or links."),
    ]
    sprint = sprint_section(args)
    if sprint:
        parts.insert(1, sprint)
    return join_sections(*parts)


def build_bug(args: argparse.Namespace) -> str:
    reproduction = args.reproduction or ["Step 1", "Step 2", "Observed failure"]
    parts = [
        section("Summary", args.summary or "Describe the defect."),
    ]
    sprint = sprint_section(args)
    if sprint:
        parts.append(sprint)
    parts.extend([
        section("Actual Behavior", args.actual or "What is happening now?"),
        section("Expected Behavior", args.expected or "What should happen instead?"),
        section("Reproduction", bullet_list(reproduction)),
        section("Impact", args.impact or "Describe severity, scope, and affected users."),
        section("Parent", parent_text(args)),
        section("Acceptance Criteria", bullet_list(args.acceptance or ["[ ] Bug no longer reproduces.", "[ ] Relevant regression coverage or validation exists."])),
        section("Notes", args.notes or "Add logs, PR review links, or affected files."),
    ])
    return join_sections(*parts)


def build_spike(args: argparse.Namespace) -> str:
    parts = [
        section("Question", args.summary or "What needs to be learned or decided?"),
    ]
    sprint = sprint_section(args)
    if sprint:
        parts.append(sprint)
    parts.extend([
        section("Scope", args.scope or "State what the investigation will and will not cover."),
        section("Expected Output", args.outcome or "Decision memo, recommendation, prototype, or findings."),
        section("Time Box", args.time_box or "Define the investigation time box."),
        section("Acceptance Criteria", bullet_list(args.acceptance or ["Questions are answered.", "Findings are documented."])),
        section("Parent", parent_text(args)),
        section("Notes", args.notes or "Add related issues, PRs, or docs."),
    ])
    return join_sections(*parts)


def build_chore(args: argparse.Namespace) -> str:
    parts = [
        section("Summary", args.summary or "Describe the maintenance work."),
    ]
    sprint = sprint_section(args)
    if sprint:
        parts.append(sprint)
    parts.extend([
        section("Operational Goal", args.outcome or "Describe the operational improvement."),
        section("Constraints", args.scope or "List limits, dependencies, or windows."),
        section("Parent", parent_text(args)),
        section("Definition of Done", bullet_list(args.acceptance or ["[ ] Operational work is complete.", "[ ] Follow-up actions are captured if needed."])),
        section("Notes", args.notes or "Add operational context or links."),
    ])
    return join_sections(*parts)


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
        description="Generate a Jira-style GitHub issue title or body.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """\
            Example:
              make_issue_body.py --type task --sprint v2.1 --title "Add streaming logs" --parent "#123" --format all
            """
        ),
    )
    parser.add_argument("--type", required=True, choices=["epic", "story", "task", "bug", "spike", "chore"])
    parser.add_argument("--sprint", help='Sprint identifier, e.g. "v2.1" or "Sprint v2.1".')
    parser.add_argument("--title", help="Concise issue title without [Sprint][Type] prefixes.")
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
