# Contributing

Read [AGENTS.md](AGENTS.md), [SPEC.md](SPEC.md) and [ARCHITECTURE.md](ARCHITECTURE.md) before changing behavior. Follow the existing narrow Phase 1 scope and keep unknown browser capabilities explicit.

Use Node.js 22.12+ and the pnpm version in `package.json`. Run `corepack enable`, then `pnpm install --frozen-lockfile`. WXT prepares generated types during installation. No production API key or online translation endpoint is required to build or run deterministic tests.

Before submitting a change:

1. State the interface, safety invariants, failure modes and relevant acceptance checks.
2. Add focused tests for meaningful behavior changes. Use synthetic text; do not capture real private pages.
3. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, both browser builds, `pnpm lint:firefox`, `pnpm verify:manifests` and `pnpm scan:secrets`.
4. Run `pnpm test:e2e:chrome` for permissions, messaging, content lifecycle, engine or popup changes; install Chromium using `pnpm exec playwright install chromium` first.
5. For packaging changes run both ZIP commands followed by `pnpm verify:packages`. Inspect the generated manifests and permission inventory.
6. Update [TEST_PLAN.md](TEST_PLAN.md) with exact browser evidence and gaps when support claims change. Update privacy/docs with permission or data-flow changes.

Pull requests should explain the concrete trigger, resulting behavior and checks actually run. Distinguish fake-backed persistence evidence from a real native-model test. A passing DOM mock does not establish framework or browser compatibility.

Do not commit `.output`, `.wxt`, `node_modules`, browser profiles, traces containing personal information, credentials or production secrets. Keep dependencies locked and review changes to install/build scripts. The test native replacement belongs only in the test harness; adding a production fake to make unsupported browsers appear successful is unacceptable.

Phase 1 does not authorize a public cloud service, analytics, broader install permissions or store publication. Propose these as explicit design changes with evidence and updated consent/disclosures. Security reports follow [SECURITY.md](SECURITY.md).
