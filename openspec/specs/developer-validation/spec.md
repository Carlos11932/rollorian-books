# Developer Validation Specification

## Purpose

Define the local quality gates that MUST pass before a TypeScript change is pushed for PR review.

## Requirements

### Requirement: Dedicated Typecheck Command

The project MUST expose a dedicated static typecheck command that validates TypeScript and TSX changes without running a production build.

#### Scenario: Developer runs the static typecheck gate

- GIVEN a developer has a local checkout of the project
- WHEN they run `npm run typecheck`
- THEN TypeScript diagnostics MUST be evaluated with `tsc --noEmit`
- AND no production build artifacts SHALL be generated

### Requirement: Pre-PR Verification for TypeScript Changes

The project MUST treat `npm run typecheck` as part of local verification for any change that touches TypeScript or TSX files before the change is pushed or updated in a pull request.

#### Scenario: TypeScript changes are prepared for a pull request

- GIVEN a change modifies one or more `.ts` or `.tsx` files
- WHEN the developer prepares the branch for a pull request
- THEN local verification MUST include `npm run typecheck`
- AND the branch SHOULD also run the repo's normal lint and test commands for the affected flow

#### Scenario: Tests pass but typecheck fails

- GIVEN lint or test commands pass for a TypeScript change
- WHEN `npm run typecheck` reports an error
- THEN the change MUST still be treated as failing verification
- AND the developer MUST fix the type error before relying on PR build feedback
