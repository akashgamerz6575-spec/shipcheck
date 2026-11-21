# Contributing to ShipCheck

Thank you for your interest in contributing to **ShipCheck**! We welcome bug reports, feature requests, documentation improvements, and code contributions.

## Code of Conduct

Please be respectful, collaborative, and constructive when engaging with contributors and maintainers.

## Development Workflow

1. **Fork & Clone:**
   ```bash
   git clone https://github.com/akashgamerz6575-spec/shipcheck.git
   cd shipcheck
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Add your VITE_FLAGSMITH_ENV_KEY if testing live Flagsmith experiments
   ```

4. **Start Dev Server:**
   ```bash
   npm run dev
   # Opens http://localhost:5173
   ```

5. **Verify Changes:**
   ```bash
   npm run build
   node scripts/verify_analyzer.mjs
   ```

## Pull Requests

1. Create a descriptive branch: `git checkout -b feat/your-feature-name`
2. Keep pull requests focused on a single change.
3. Ensure `npm run build` succeeds with zero errors before opening a PR.
4. Reference any relevant issues in your PR description.
