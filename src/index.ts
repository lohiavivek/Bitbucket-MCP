#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BitbucketClient } from "./bitbucket-client.js";

// ── Config from env ──────────────────────────────────────────────────────────

const defaultWorkspace = process.env["BITBUCKET_WORKSPACE"];

if (!defaultWorkspace) {
  console.error("Missing required env var: BITBUCKET_WORKSPACE");
  process.exit(1);
}

// Optional default token (used for getRepositories or as fallback)
const defaultToken = process.env["BITBUCKET_API_TOKEN"];

// Per-repo tokens: BITBUCKET_TOKEN_<REPO_SLUG_UPPER> e.g. BITBUCKET_TOKEN_CW_BACKEND
const repoTokens: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  const match = key.match(/^BITBUCKET_TOKEN_(.+)$/);
  if (match && value) {
    // Convert env key back to repo slug: CW_BACKEND → cw-backend
    const slug = match[1].toLowerCase().replace(/_/g, "-");
    repoTokens[slug] = value;
  }
}

if (!defaultToken && Object.keys(repoTokens).length === 0) {
  console.error(
    "No tokens configured. Set BITBUCKET_API_TOKEN (default) or BITBUCKET_TOKEN_<REPO_SLUG> per repo."
  );
  process.exit(1);
}

const bb = new BitbucketClient({ workspace: defaultWorkspace, defaultToken, repoTokens });

// ── Shared param: workspace ──────────────────────────────────────────────────

const workspaceParam = z
  .string()
  .optional()
  .describe(
    `Bitbucket workspace slug. Defaults to "${defaultWorkspace}" if omitted.`
  );

// ── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "@lohiavivek/bitbucket-mcp",
  version: "1.1.0",
});

// ── Tool: getRepositories ────────────────────────────────────────────────────

server.tool(
  "getRepositories",
  "List all repositories in a Bitbucket workspace",
  {
    workspace: workspaceParam,
    page: z.number().int().positive().optional().describe("Page number"),
    pagelen: z.number().int().min(1).max(100).optional().describe("Results per page (max 100)"),
  },
  async ({ workspace, page, pagelen }) => {
    const result = await bb.getRepositories(workspace, { page, pagelen });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: getPullRequests ────────────────────────────────────────────────────

server.tool(
  "getPullRequests",
  "Get a list of pull requests for a repository",
  {
    workspace: workspaceParam,
    repoSlug: z.string().describe("Repository slug (e.g. 'my-repo')"),
    state: z
      .enum(["OPEN", "MERGED", "DECLINED", "SUPERSEDED"])
      .optional()
      .describe("Filter by PR state (default: OPEN)"),
    page: z.number().int().positive().optional().describe("Page number"),
    pagelen: z.number().int().min(1).max(50).optional().describe("Results per page (max 50)"),
  },
  async ({ workspace, repoSlug, state, page, pagelen }) => {
    const result = await bb.getPullRequests(repoSlug, { state, page, pagelen, workspace });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: getPullRequestDetails ──────────────────────────────────────────────

server.tool(
  "getPullRequestDetails",
  "Fetch details about a specific pull request",
  {
    workspace: workspaceParam,
    repoSlug: z.string().describe("Repository slug"),
    prId: z.number().int().positive().describe("Pull request ID"),
  },
  async ({ workspace, repoSlug, prId }) => {
    const pr = await bb.getPullRequestDetails(repoSlug, prId, workspace);
    return {
      content: [{ type: "text", text: JSON.stringify(pr, null, 2) }],
    };
  }
);

// ── Tool: createPullRequest ──────────────────────────────────────────────────

server.tool(
  "createPullRequest",
  "Create a new pull request",
  {
    workspace: workspaceParam,
    repoSlug: z.string().describe("Repository slug"),
    title: z.string().describe("PR title"),
    sourceBranch: z.string().describe("Source branch name"),
    destinationBranch: z.string().describe("Destination branch name"),
    description: z.string().optional().describe("PR description (markdown)"),
    reviewers: z.array(z.string()).optional().describe("List of reviewer UUIDs"),
    closeSourceBranch: z.boolean().optional().describe("Close source branch after merge"),
  },
  async ({ workspace, repoSlug, title, sourceBranch, destinationBranch, description, reviewers, closeSourceBranch }) => {
    const pr = await bb.createPullRequest(repoSlug, {
      title, sourceBranch, destinationBranch, description, reviewers, closeSourceBranch, workspace,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(pr, null, 2) }],
    };
  }
);

// ── Tool: getPullRequestComments ─────────────────────────────────────────────

server.tool(
  "getPullRequestComments",
  "List all comments on a pull request",
  {
    workspace: workspaceParam,
    repoSlug: z.string().describe("Repository slug"),
    prId: z.number().int().positive().describe("Pull request ID"),
  },
  async ({ workspace, repoSlug, prId }) => {
    const result = await bb.getPullRequestComments(repoSlug, prId, workspace);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: addPullRequestComment ──────────────────────────────────────────────

server.tool(
  "addPullRequestComment",
  "Add a comment to a pull request or to a specific file line that was changed",
  {
    workspace: workspaceParam,
    repoSlug: z.string().describe("Repository slug"),
    prId: z.number().int().positive().describe("Pull request ID"),
    content: z.string().describe("Comment text (markdown)"),
    inlinePath: z.string().optional().describe("File path for inline comment"),
    inlineTo: z.number().int().optional().describe("Line number (to) for inline comment"),
    inlineFrom: z.number().int().optional().describe("Line number (from) for inline comment range"),
  },
  async ({ workspace, repoSlug, prId, content, inlinePath, inlineTo, inlineFrom }) => {
    const inline =
      inlinePath && inlineTo !== undefined
        ? { path: inlinePath, to: inlineTo, from: inlineFrom }
        : undefined;
    const comment = await bb.addPullRequestComment(repoSlug, prId, { content, inline, workspace });
    return {
      content: [{ type: "text", text: JSON.stringify(comment, null, 2) }],
    };
  }
);

// ── Tool: updatePullRequestComment ───────────────────────────────────────────

server.tool(
  "updatePullRequestComment",
  "Edit an existing pull request comment that was created by this agent",
  {
    workspace: workspaceParam,
    repoSlug: z.string().describe("Repository slug"),
    prId: z.number().int().positive().describe("Pull request ID"),
    commentId: z.number().int().positive().describe("Comment ID to update"),
    content: z.string().describe("New comment text (markdown)"),
  },
  async ({ workspace, repoSlug, prId, commentId, content }) => {
    const comment = await bb.updatePullRequestComment(repoSlug, prId, commentId, content, workspace);
    return {
      content: [{ type: "text", text: JSON.stringify(comment, null, 2) }],
    };
  }
);

// ── Tool: getPullRequestTasks ────────────────────────────────────────────────

server.tool(
  "getPullRequestTasks",
  "List all tasks on a pull request",
  {
    workspace: workspaceParam,
    repoSlug: z.string().describe("Repository slug"),
    prId: z.number().int().positive().describe("Pull request ID"),
  },
  async ({ workspace, repoSlug, prId }) => {
    const result = await bb.getPullRequestTasks(repoSlug, prId, workspace);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: createPullRequestTask ──────────────────────────────────────────────

server.tool(
  "createPullRequestTask",
  "Add a task to a pull request",
  {
    workspace: workspaceParam,
    repoSlug: z.string().describe("Repository slug"),
    prId: z.number().int().positive().describe("Pull request ID"),
    content: z.string().describe("Task description"),
  },
  async ({ workspace, repoSlug, prId, content }) => {
    const task = await bb.createPullRequestTask(repoSlug, prId, content, workspace);
    return {
      content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
    };
  }
);

// ── Tool: updatePullRequestTask ──────────────────────────────────────────────

server.tool(
  "updatePullRequestTask",
  "Update a pull request task (edit content or mark as resolved/unresolved)",
  {
    workspace: workspaceParam,
    repoSlug: z.string().describe("Repository slug"),
    prId: z.number().int().positive().describe("Pull request ID"),
    taskId: z.number().int().positive().describe("Task ID to update"),
    content: z.string().optional().describe("New task description"),
    state: z.enum(["UNRESOLVED", "RESOLVED"]).optional().describe("New task state"),
  },
  async ({ workspace, repoSlug, prId, taskId, content, state }) => {
    const task = await bb.updatePullRequestTask(repoSlug, prId, taskId, { content, state, workspace });
    return {
      content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
    };
  }
);

// ── Tool: analyzePullRequestCommitStatusFailures ─────────────────────────────

server.tool(
  "analyzePullRequestCommitStatusFailures",
  "Analyze failed commit statuses (CI checks) on a pull request and summarize what is failing",
  {
    workspace: workspaceParam,
    repoSlug: z.string().describe("Repository slug"),
    prId: z.number().int().positive().describe("Pull request ID"),
  },
  async ({ workspace, repoSlug, prId }) => {
    const statuses = await bb.getPullRequestCommitStatuses(repoSlug, prId, workspace);
    const failed = statuses.values.filter(
      (s) => s.state === "FAILED" || s.state === "STOPPED"
    );

    if (failed.length === 0) {
      return {
        content: [{ type: "text", text: "All commit statuses are passing — no failures found." }],
      };
    }

    const lines = [
      `Found ${failed.length} failing commit status(es) on PR #${prId}:`,
      "",
      ...failed.map(
        (s, i) =>
          `${i + 1}. **${s.name}** [${s.state}]\n   - Key: ${s.key}\n   - Description: ${s.description || "N/A"}\n   - URL: ${s.url}`
      ),
    ];

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }
);

// ── Tool: analyzePipelineStepFailure ─────────────────────────────────────────

server.tool(
  "analyzePipelineStepFailure",
  "Analyze why a specific pipeline step failed by fetching its log output",
  {
    workspace: workspaceParam,
    repoSlug: z.string().describe("Repository slug"),
    pipelineUuid: z.string().describe("Pipeline UUID (with or without curly braces)"),
    stepUuid: z.string().optional().describe("Step UUID. If omitted, the first failed step is selected automatically."),
    logTailLines: z.number().int().positive().optional().describe("Number of trailing log lines to include (default: 100)"),
  },
  async ({ workspace, repoSlug, pipelineUuid, stepUuid, logTailLines }) => {
    const tailLines = logTailLines ?? 100;
    const normalizedPipelineUuid = pipelineUuid.startsWith("{") ? pipelineUuid : `{${pipelineUuid}}`;

    const [pipeline, stepsResult] = await Promise.all([
      bb.getPipeline(repoSlug, normalizedPipelineUuid, workspace),
      bb.getPipelineSteps(repoSlug, normalizedPipelineUuid, workspace),
    ]);

    let targetStepUuid = stepUuid
      ? stepUuid.startsWith("{") ? stepUuid : `{${stepUuid}}`
      : undefined;

    if (!targetStepUuid) {
      const failedStep = stepsResult.values.find(
        (s) =>
          s.state.result?.name === "FAILED" ||
          s.state.result?.name === "ERROR" ||
          s.state.name === "STOPPED"
      );
      if (!failedStep) {
        return {
          content: [{
            type: "text",
            text: `Pipeline ${normalizedPipelineUuid} has no failed steps.\nPipeline state: ${pipeline.state.name}${pipeline.state.result ? ` / ${pipeline.state.result.name}` : ""}`,
          }],
        };
      }
      targetStepUuid = failedStep.uuid;
    }

    const targetStep = stepsResult.values.find((s) => s.uuid === targetStepUuid);

    let log = "";
    try {
      log = await bb.getPipelineStepLog(repoSlug, normalizedPipelineUuid, targetStepUuid, workspace);
    } catch {
      log = "(Log unavailable)";
    }

    const tail = log.split("\n").slice(-tailLines).join("\n");

    const summary = [
      `## Pipeline Step Failure Analysis`,
      ``,
      `**Pipeline:** ${normalizedPipelineUuid}`,
      `**Pipeline state:** ${pipeline.state.name}${pipeline.state.result ? ` / ${pipeline.state.result.name}` : ""}`,
      `**Branch:** ${pipeline.target.ref_name ?? "N/A"}`,
      `**Commit:** ${pipeline.target.commit?.hash?.slice(0, 12) ?? "N/A"}`,
      ``,
      `**Failed step:** ${targetStep?.name ?? targetStepUuid}`,
      `**Step state:** ${targetStep?.state.name ?? "N/A"}${targetStep?.state.result ? ` / ${targetStep.state.result.name}` : ""}`,
      ``,
      `### Last ${tailLines} lines of log:`,
      "```",
      tail,
      "```",
    ];

    return {
      content: [{ type: "text", text: summary.join("\n") }],
    };
  }
);

// ── Start server ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Bitbucket MCP server running on stdio");
