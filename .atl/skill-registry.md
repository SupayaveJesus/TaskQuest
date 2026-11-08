# Skill Registry

**Delegator use only.** Agents that launch subagents resolve compact rules here and inject them into their prompts. Subagents do not independently read this registry or individual user skills.

## User Skills

| Trigger | Skill | Path |
| --- | --- | --- |
| Creating, opening, or preparing PRs for review | branch-pr | `C:\Users\Jesus\.config\opencode\skills\branch-pr\SKILL.md` |
| PRs over 400 lines, stacked PRs, review slices | chained-pr | `C:\Users\Jesus\.config\opencode\skills\chained-pr\SKILL.md` |
| Guides, READMEs, RFCs, onboarding, architecture, review-facing docs | cognitive-doc-design | `C:\Users\Jesus\.config\opencode\skills\cognitive-doc-design\SKILL.md` |
| PR feedback, issue replies, reviews, Slack, GitHub comments | comment-writer | `C:\Users\Jesus\.config\opencode\skills\comment-writer\SKILL.md` |
| Go tests, coverage, Bubbletea, golden files | go-testing | `C:\Users\Jesus\.config\opencode\skills\go-testing\SKILL.md` |
| GitHub issues, bug reports, feature requests | issue-creation | `C:\Users\Jesus\.config\opencode\skills\issue-creation\SKILL.md` |
| Judgment Day, dual/adversarial review, juzgar | judgment-day | `C:\Users\Jesus\.config\opencode\skills\judgment-day\SKILL.md` |
| New skills, agent instructions, AI usage patterns | skill-creator | `C:\Users\Jesus\.config\opencode\skills\skill-creator\SKILL.md` |
| Implementation, commit splitting, chained PRs | work-unit-commits | `C:\Users\Jesus\.config\opencode\skills\work-unit-commits\SKILL.md` |

## Compact Rules

### branch-pr
- Link every PR to an approved issue and apply exactly one `type:*` label.
- Use `type/description` branch names with lowercase permitted characters.
- Use Conventional Commit messages.
- Include the repository PR template, changes table, and test plan.
- Do not merge until automated checks pass; never add a `Co-Authored-By` trailer.

### chained-pr
- Split PRs over 400 changed lines unless a maintainer accepts `size:exception`.
- Keep one independently reviewable work unit per PR, including its tests and docs.
- Follow SDD `delivery_strategy` before apply or PR creation.
- Use stacked PRs for independently landable slices; otherwise use a feature-branch chain and draft tracker.
- Include prior/follow-up dependencies and a diagram marking the current child PR.
- Retarget or rebase polluted diffs; do not mix chain strategies.

### cognitive-doc-design
- Lead with the decision or action, then add context progressively.
- Chunk information into short, clearly labeled sections.
- Prefer checklists, tables, and templates over recall-heavy prose.
- Make review order and intentional exclusions explicit.
- Keep each section focused on one decision or work unit.

### comment-writer
- Start with the actionable point and keep comments to one to three short paragraphs.
- Be warm, direct, and explain the technical reason for requested changes.
- Focus on high-value issues instead of piling on preferences.
- Match the thread language; use Spanish voseo when applicable.
- Do not use em dashes.

### go-testing
- Use table-driven tests and assert behavior or state transitions, not implementation trivia.
- Use `t.TempDir()` for file tests and small interfaces around system boundaries.
- Mark slow or external-command integration tests skippable with `testing.Short()`.
- Test Bubbletea state with `Model.Update()`; reserve `teatest` for interaction flows.
- Keep golden files deterministic and rerun without `-update` after updates.

### issue-creation
- Search for duplicates and use the appropriate bug or feature-request template.
- Fill every required field and expect `status:needs-review` on creation.
- Do not open a PR until a maintainer applies `status:approved`.
- Route questions to Discussions rather than issues.
- Use a Conventional Commit-style issue title.

### judgment-day
- Resolve and inject the same project standards into both blind judge prompts.
- Run two independent judges and wait for both before synthesis.
- Confirm findings only when both judges report the same real critical/warning issue.
- Ask before first-round fixes and re-judge immediately after any fix.
- Downgrade theoretical warnings to INFO; end only APPROVED or ESCALATED.

### skill-creator
- Follow `docs/skill-style-guide.md` when present; otherwise use the inline fallback rules.
- Treat skills as LLM runtime contracts, not human tutorials.
- Use concise YAML frontmatter with trigger-first, one-line descriptions and no Keywords section.
- Keep bodies concise and imperative; move detail to local `assets/` or `references/`.
- Use the required section order and register project skills in `AGENTS.md`.

### work-unit-commits
- Commit deliverable work units, not file-type batches.
- Keep behavior, tests, and relevant docs in the same commit.
- Ensure each commit leaves the repository coherent and reasonably reversible.
- Use outcome-oriented Conventional Commit messages.
- When SDD forecasts over 400 lines, follow the configured delivery strategy.

## Project Conventions

| File | Path | Notes |
| --- | --- | --- |
| — | — | No project convention files or project-level skills were found. |
