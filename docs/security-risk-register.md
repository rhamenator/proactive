# Security Risk Register

## `image-size` parser denial of service

Status: temporarily accepted through **2027-02-07**

Advisories:

- [GHSA-5p2g-fcmc-qvqq / CVE-2025-71329](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)
- [GHSA-w3rx-r6r6-pgpr / CVE-2025-71330](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)

Review performed: 2026-08-07

The installed chain is `expo@57.0.9` → `@expo/metro@56.0.0` → `metro@0.84.4` → `image-size@1.2.1`. The npm registry's latest `image-size` release is 2.0.2. Both GitHub-reviewed advisories currently list all versions through 2.0.2 as affected and list no patched version, so neither an override nor a compatible Expo/Metro upgrade can remove the finding today.

Exposure is limited to the Metro development/build tool reading trusted image assets from this repository. The backend and deployed mobile runtime do not send user-uploaded images to `image-size`; the affected JXL, HEIF, and ICNS parsers therefore have no identified untrusted production input path. A malicious repository asset could still hang a developer or CI build, so repository write access and review remain the compensating controls.

Required next review:

1. Check the two advisories and the npm registry for a patched `image-size` release.
2. Check Expo, `@expo/metro`, Metro, and React Native for a compatible dependency chain.
3. Prefer the upstream compatible chain; do not force a major transitive override without a mobile bundle/build test.
4. Remove both narrow allowlist entries as soon as the resolved dependency is outside the affected range.
5. If no fix exists by 2027-02-07, re-document the exact chain and exposure and use another explicit expiration. Never replace these entries with a package-wide or severity-wide ignore.
