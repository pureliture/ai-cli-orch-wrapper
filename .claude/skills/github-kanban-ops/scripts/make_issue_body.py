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
    parts = [
        section("Summary", args.summary),
        section("Outcome", args.outcome),
        section("Scope", args.scope),
        section("Child Issues", "\n".join(f"- {item}" for item in args.children)),
        section(
            "Exit Criteria",
            bullet_list(args.acceptance),
        ),
        section("Notes", args.notes or "No additional notes."),
    ]
    return join_sections(*parts)


def build_task(args: argparse.Namespace) -> str:
    parts = [
        section("Summary", args.summary),
        section("Outcome", args.outcome),
        section("Parent", parent_text(args)),
        section("Scope", args.scope),
        section(
            "Acceptance Criteria",
            bullet_list(args.acceptance),
        ),
        section("Notes", args.notes or "No additional notes."),
    ]
    return join_sections(*parts)


def build_bug(args: argparse.Namespace) -> str:
    parts = [
        section("Summary", args.summary),
        section("Actual Behavior", args.actual),
        section("Expected Behavior", args.expected),
        section("Reproduction", bullet_list(args.reproduction)),
        section("Impact", args.impact),
        section("Parent", parent_text(args)),
        section(
            "Acceptance Criteria",
            bullet_list(args.acceptance),
        ),
        section("Notes", args.notes or "No additional notes."),
    ]
    return join_sections(*parts)


def build_chore(args: argparse.Namespace) -> str:
    parts = [
        section("Summary", args.summary),
        section("Operational Goal", args.outcome),
        section("Constraints", args.scope),
        section("Parent", parent_text(args)),
        section(
            "Definition of Done",
            bullet_list(args.acceptance),
        ),
        section("Notes", args.notes or "No additional notes."),
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


def validate_args(parser: argparse.ArgumentParser, args: argparse.Namespace) -> None:
    missing: list[str] = []

    if args.format in {"title", "all"} and not (args.title or args.summary):
        missing.append("--title or --summary")

    if args.format in {"body", "all"}:
        if not args.summary:
            missing.append("--summary")

        if args.type in {"epic", "task", "chore"}:
            for attr, flag in [
                ("outcome", "--outcome"),
                ("scope", "--scope"),
            ]:
                if not getattr(args, attr):
                    missing.append(flag)
            if not args.acceptance:
                missing.append("--acceptance")

        if args.type == "epic" and not args.children:
            missing.append("--children")

        if args.type == "bug":
            for attr, flag in [
                ("actual", "--actual"),
                ("expected", "--expected"),
                ("impact", "--impact"),
            ]:
                if not getattr(args, attr):
                    missing.append(flag)
            if not args.reproduction:
                missing.append("--reproduction")
            if not args.acceptance:
                missing.append("--acceptance")

    if missing:
        unique_missing = list(dict.fromkeys(missing))
        parser.error(
            "missing required arguments for placeholder-free output: "
            + ", ".join(unique_missing)
        )


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
    args = parser.parse_args()
    validate_args(parser, args)
    return args


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
