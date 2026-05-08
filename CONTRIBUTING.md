# Contributing to RetireOps

Thank you for your interest in contributing to RetireOps! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Corepack enabled (`corepack enable`)
- Docker and Docker Compose (for local development)

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/RetireOps/retireops.git
   cd retireops
   ```

2. Install dependencies:

   ```bash
   corepack pnpm install
   ```

3. Copy environment file:

   ```bash
   cp .env.example .env
   ```

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Start development services:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   corepack pnpm dev
   ```

## Development Workflow

### Branch Naming

Use the following branch naming convention:

- `feat/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

### Running Tests

```bash
# Run all tests
corepack pnpm test

# Run tests in watch mode
corepack pnpm test:watch

# Run tests for a specific package
corepack pnpm --filter @retireops/calculation-engine test
```

### Linting and Formatting

```bash
# Run linter
corepack pnpm lint

# Fix linting issues
corepack pnpm lint:fix

# Format code
corepack pnpm format

# Check formatting
corepack pnpm format:check
```

### Type Checking

```bash
corepack pnpm typecheck
```

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only changes
- `style` - Code style changes (formatting, semicolons, etc.)
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `perf` - Performance improvement
- `test` - Adding or updating tests
- `build` - Changes to build system or dependencies
- `ci` - Changes to CI configuration
- `chore` - Other changes that don't modify src or test files
- `revert` - Reverts a previous commit

### Scope

Optional scope can be one of:

- `tax` - Tax calculation module
- `benefits` - Government benefits (CPP, OAS, GIS)
- `accounts` - Account rules (RRSP, RRIF, TFSA)
- `projection` - Projection engine
- `api` - API gateway
- `web` - Web frontend
- `worker` - Calculation worker
- `shared` - Shared types and utilities
- `deps` - Dependency updates

### Examples

```
feat(tax): add Quebec provincial tax calculation
fix(rrif): correct minimum withdrawal rate for age 85+
docs: update API documentation for projection endpoints
test(benefits): add CPP early/late adjustment test cases
```

## Pull Request Process

1. **Create a feature branch** from `main`:

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/your-feature
   ```

2. **Make your changes** following our coding standards.

3. **Write/update tests** for your changes.

4. **Ensure all tests pass**:

   ```bash
   corepack pnpm test
   corepack pnpm typecheck
   corepack pnpm lint
   ```

5. **Commit your changes** following commit message guidelines.

6. **Push your branch** and create a pull request:

   ```bash
   git push origin feat/your-feature
   ```

7. **Fill out the PR template** completely.

8. **Request review** from at least one maintainer.

9. **Address review feedback** and update your PR as needed.

10. **Merge** once approved and all checks pass.

## Coding Standards

### TypeScript

- Use strict TypeScript settings (enforced by `tsconfig.base.json`)
- Prefer `interface` over `type` for object shapes
- Use explicit return types for exported functions
- Avoid `any` - use `unknown` if type is truly unknown

### Documentation

- Add JSDoc comments for all exported functions, classes, and types
- Reference source-of-truth documents for calculations:
  ```typescript
  /**
   * Calculate RRIF minimum withdrawal
   * @see docs/source-of-truth/02-account-types.md - RRIF-002
   */
  ```

### Error Handling

- Use custom error classes from `@retireops/shared`
- Always include error codes and meaningful messages
- Log errors appropriately

### Code Organization

- Keep files focused and under 300 lines when possible
- Group related functionality in modules
- Use barrel exports (`index.ts`) for public APIs

## Testing Guidelines

### Test File Location

Place test files adjacent to the code they test:

```
src/
  tax/
    federal-tax.ts
    federal-tax.test.ts
```

### Test Structure

```typescript
describe('calculateFederalTax', () => {
  describe('when income is below first bracket', () => {
    it('should apply 15% rate', () => {
      // Test implementation
    });
  });

  describe('when income spans multiple brackets', () => {
    it('should apply progressive rates', () => {
      // Test implementation
    });
  });
});
```

### Test Coverage

- Aim for >90% coverage on calculation modules
- All edge cases should be tested
- Reference source-of-truth test cases:
  ```typescript
  /**
   * @see docs/source-of-truth/04-tax-engine.md - TC-TAX-001
   */
  it('should calculate federal tax for $80,000 income', () => {
    // Implementation matching test case
  });
  ```

## Questions?

If you have questions about contributing, please open an issue or reach out to the maintainers.
