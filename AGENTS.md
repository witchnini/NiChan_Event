# AGENTS.md

## Context7

Use Context7 MCP to fetch current documentation whenever a task asks about a library, framework, SDK, API, CLI tool, or cloud service. This includes React, Vite, Prisma, Express, Tailwind, and similar tools.

Do not use Context7 for refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

### Steps

1. Start with `resolve-library-id` using the library name and the user's question, unless the user provides an exact library ID in `/org/project` format.
2. Pick the best match by exact name, description relevance, snippet count, source reputation, and benchmark score.
3. Run `query-docs` with the selected library ID and the full user question.
4. Answer using the fetched docs.
