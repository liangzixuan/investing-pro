# Feature specifications

This is a manual Spec Kit adaptation for bounded product changes.
[Markets home](./001-markets-home/spec.md) is accepted at `9c2aa4f`; its
[completed tasks](./001-markets-home/tasks.md) link actual acceptance evidence.
The active [connected company overview](./002-company-overview/spec.md) is the first
M2 slice, implemented locally with focused/synthetic Brave checks and acceptance
pending; see its
[plan](./002-company-overview/plan.md) and [tasks](./002-company-overview/tasks.md).
No Specify CLI, generated skills, scripts or branch automation are installed.

The [owner's AGENTS.md](../../AGENTS.md) and [product roadmap](../docs/PRODUCT_ROADMAP.md)
remain authoritative. Specifications define bounded changes; they do not replace
the [current work](../docs/CURRENT_WORK.md) checkpoint or release evidence.

We adapted GitHub Spec Kit **v1.0.11**:
[spec template](https://github.com/github/spec-kit/blob/v1.0.11/templates/spec-template.md),
[plan template](https://github.com/github/spec-kit/blob/v1.0.11/templates/plan-template.md),
[tasks template](https://github.com/github/spec-kit/blob/v1.0.11/templates/tasks-template.md).
The upstream [MIT notice](./SPEC_KIT_LICENSE.txt) accompanies these adaptations.

Explicit adaptations:

- Keep upstream stories/acceptance, requirements, technical context, principle
  checks and story-grouped tasks. Reference existing principles instead of adding
  a duplicate constitution.
- Consolidate this small feature's research, data/interface decisions and
  validation instructions into `plan.md`; link existing contracts and guides.
- Omit already-satisfied setup/authentication examples. Required behavior and
  release tests remain explicit despite the template's optional-test wording.
- Keep branch information as metadata. The existing reviewed feature/closure
  sequence governs commits; no per-task commit rule or branch generator applies.
- Review unmet requirements against actual behavior before calling a feature
  complete. A checked task or written spec is not validation evidence.

This adaptation follows the upstream [customization guidance](https://github.github.io/spec-kit/guides/customization.html).
It does not claim the unmodified toolkit produces only three files.
