# Bitbucket MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)

An open-source [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that gives AI agents (Claude, etc.) access to Bitbucket pull request and pipeline operations.

## Tools

| Tool | Description | Scopes required |
|------|-------------|-----------------|
| `createPullRequest` | Create a new pull request | `write:pullrequest:bitbucket` |
| `getPullRequests` | Get a list of pull requests | `read:pullrequest:bitbucket` |
| `getPullRequestDetails` | Fetch details about a pull request | `read:pullrequest:bitbucket` |
| `getPullRequestComments` | List comments on a pull request | `read:pullrequest:bitbucket` |
| `addPullRequestComment` | Add a comment to a PR or to a specific file line | `write:pullrequest:bitbucket` |
| `updatePullRequestComment` | Edit an existing PR comment created by an agent | `write:pullrequest:bitbucket` |
| `getPullRequestTasks` | List tasks on a pull request | `read:pullrequest:bitbucket` |
| `createPullRequestTask` | Add a task to a pull request | `write:pullrequest:bitbucket` |
| `updatePullRequestTask` | Update a pull request task | `write:pullrequest:bitbucket` |
| `analyzePullRequestCommitStatusFailures` | Analyze failed commit statuses on a PR | `read:pullrequest:bitbucket`, `read:pipeline:bitbucket` |
| `analyzePipelineStepFailure` | Analyze why a pipeline step failed (fetches log) | `read:pipeline:bitbucket` |

## Setup

### 1. Create a Bitbucket API Token

Go to **Bitbucket → Personal Settings → API tokens** and create a token with:
- **Repositories:** Read
- **Pull requests:** Read, Write
- **Pipelines:** Read

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your credentials
```

| Variable | Description |
|----------|-------------|
| `BITBUCKET_WORKSPACE` | Your workspace slug (e.g. `myteam`) |
| `BITBUCKET_API_TOKEN` | The API token created above |

### 3. Build and run

```bash
npm install
npm run build
npm start
```

### 4. Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-mcp/dist/index.js"],
      "env": {
        "BITBUCKET_WORKSPACE": "your-workspace",
        "BITBUCKET_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Connect to Claude Code

Add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-mcp/dist/index.js"],
      "env": {
        "BITBUCKET_WORKSPACE": "your-workspace",
        "BITBUCKET_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Development

```bash
# Run without building (uses tsx)
BITBUCKET_WORKSPACE=myteam BITBUCKET_API_TOKEN=xxx npm run dev
```

## Contributing

Contributions are welcome! Please open an issue to discuss what you'd like to change before submitting a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Open a pull request

## License

[MIT](LICENSE) — Vivek Lohia
