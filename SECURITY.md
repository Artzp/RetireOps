# Security Policy

## Supported Versions

RetireOps is preparing for open beta. Security fixes target the `main` branch unless a maintainer announces a supported release branch.

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability.

Report security concerns by emailing the maintainers or by using GitHub private vulnerability reporting if it is enabled for the repository. Include:

- A clear description of the issue and affected component
- Steps to reproduce or proof-of-concept details
- Impact assessment, including whether user data, authentication, or deployment secrets are affected
- Suggested remediation if you have one

We aim to acknowledge reports within 5 business days during beta.

## Security Expectations

- Never commit real `.env` files, API keys, database dumps, OAuth secrets, JWT secrets, or production credentials.
- Use `.env.example` for placeholders only.
- Rotate any secret immediately if it may have been committed or exposed in logs, screenshots, or issue comments.
- Treat retirement-planning inputs as sensitive personal financial data.
