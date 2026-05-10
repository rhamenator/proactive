# Installation

Choose the path that matches what you need to install.

- [Really quick start (non-technical, step-by-step)](really-quick-start.md): fastest end-to-end guide for local setup, server containers, and mobile binary builds.
- [One-page runbook (printable)](one-page-runbook.md): copy/paste command checklist with expected outcomes for build and deployment.
- [CI operator runbook (release and deploy only)](ci-operator-runbook.md): release workflow, artifact checks, production deployment, migration, smoke test, and rollback.
- [Local installation](local-install.md): full backend, admin dashboard, mobile dev server, database migration, and demo seed data.
- [Mobile build workstation setup](mobile-install.md): Expo setup on a developer/build machine. This prepares the mobile workspace but does not build signed mobile binaries.
- [Configuration reference](configuration.md): environment files, ports, API URLs, and database notes.
- [Deployment guide](deployment.md): production-oriented deployment flow for backend, admin dashboard, Docker containers, and mobile release delivery.

Recommended first install:

```bash
npm run setup:local
```

Recommended mobile app setup on a developer/build machine:

```bash
npm run setup:mobile
```

Platform-specific direct entrypoints:

- Linux: `scripts/install-local.sh`, `scripts/install-mobile.sh`
- macOS: `bash scripts/install-local-macos.sh`, `bash scripts/install-mobile-macos.sh`
- Windows PowerShell: `powershell -ExecutionPolicy Bypass -File scripts/install-local.ps1`, `powershell -ExecutionPolicy Bypass -File scripts/install-mobile.ps1`
