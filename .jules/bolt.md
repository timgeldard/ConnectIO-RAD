## 2024-05-18 - Avoid npm install in monorepos
**Learning:** Do not run `npm install` or `pnpm install` in monorepo workspaces just to run tests locally, as it modifies lockfiles improperly.
**Action:** Validate code logically or use `npx tsc` if tests fail due to missing setup dependencies.
