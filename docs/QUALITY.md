# Release quality evidence

Evidence date: 2026-09-06

## Automated checks

| Gate | Result |
|---|---|
| Unit/integration tests | 18 passed, 0 failed |
| oxlint | Passed |
| TypeScript `--noEmit` | Passed |
| vinext production build | Passed |
| Production dependency audit | 0 known vulnerabilities |
| Repository source secret scan | Passed |
| Premium UI static audit | Passed in strict mode |

## Browser and accessibility checks

The authenticated owner dashboard was exercised in the in-app Chromium browser at
390×844 and 1440×900.

- No document-level horizontal overflow at either viewport.
- One `h1` and one `main` landmark on the tested dashboard views.
- Zero visible unnamed interactive controls.
- Zero visible controls below the documented 44px mobile target after remediation.
- New-job dialog exposes an accessible title/description and labelled controls;
  Escape closes it and restores focus to the trigger.
- Offline fallback was exercised independently and contains a clear recovery action.
- Reduced-motion CSS is present.

Lighthouse 12.8.2 reported:

| Profile | Accessibility | Best practices |
|---|---:|---:|
| Mobile | 100 | 100 |
| Desktop | 100 | 100 |

Lighthouse performance scoring was intentionally excluded from acceptance because
the audit target was the instrumented development server. The production build is
the relevant bundle evidence: role-based lazy loading removed the previous 500 KiB
chunk warning, and the largest emitted application chunk is approximately 388 KiB
before transfer compression.

## Known environment limitation

The local Lighthouse process generated complete JSON reports but returned a Windows
cleanup error while deleting its temporary Chrome profile. The reports were parsed
successfully and contained complete category/audit data. CI does not depend on this
machine-specific cleanup behavior.
