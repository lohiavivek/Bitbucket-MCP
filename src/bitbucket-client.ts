import axios, { AxiosInstance } from "axios";

export interface BitbucketConfig {
  workspace: string;
  apiToken: string;
  baseUrl?: string;
}

export interface PullRequest {
  id: number;
  title: string;
  description: string;
  state: string;
  author: { display_name: string; uuid: string };
  source: { branch: { name: string }; repository: { full_name: string } };
  destination: { branch: { name: string } };
  reviewers: Array<{ display_name: string; uuid: string }>;
  created_on: string;
  updated_on: string;
  links: { html: { href: string } };
}

export interface Comment {
  id: number;
  content: { raw: string; html: string };
  author: { display_name: string; uuid: string };
  created_on: string;
  updated_on: string;
  inline?: { from: number | null; to: number; path: string };
}

export interface Task {
  id: number;
  content: { raw: string };
  state: "UNRESOLVED" | "RESOLVED";
  creator: { display_name: string; uuid: string };
  created_on: string;
}

export interface PipelineStep {
  uuid: string;
  name: string;
  state: { name: string; result?: { name: string } };
  script_commands?: Array<{ name: string; action: string }>;
}

export interface Repository {
  slug: string;
  name: string;
  description: string;
  is_private: boolean;
  updated_on: string;
  links: { html: { href: string } };
}

export class BitbucketClient {
  private client: AxiosInstance;
  readonly defaultWorkspace: string;

  constructor(config: BitbucketConfig) {
    this.defaultWorkspace = config.workspace;
    this.client = axios.create({
      baseURL: config.baseUrl ?? "https://api.bitbucket.org/2.0",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiToken}`,
      },
    });
  }

  private ws(workspace?: string): string {
    return workspace ?? this.defaultWorkspace;
  }

  // ── Repositories ───────────────────────────────────────────────────────────

  async getRepositories(
    workspace?: string,
    options: { page?: number; pagelen?: number } = {}
  ): Promise<{ values: Repository[]; size: number }> {
    const res = await this.client.get(`/repositories/${this.ws(workspace)}`, {
      params: { pagelen: options.pagelen ?? 50, page: options.page ?? 1 },
    });
    return res.data;
  }

  // ── Pull Requests ──────────────────────────────────────────────────────────

  async getPullRequests(
    repoSlug: string,
    options: {
      state?: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED";
      page?: number;
      pagelen?: number;
      workspace?: string;
    } = {}
  ): Promise<{ values: PullRequest[]; size: number; page: number }> {
    const params: Record<string, string | number> = {
      pagelen: options.pagelen ?? 25,
      page: options.page ?? 1,
    };
    if (options.state) params["state"] = options.state;

    const res = await this.client.get(
      `/repositories/${this.ws(options.workspace)}/${repoSlug}/pullrequests`,
      { params }
    );
    return res.data;
  }

  async getPullRequestDetails(
    repoSlug: string,
    prId: number,
    workspace?: string
  ): Promise<PullRequest> {
    const res = await this.client.get(
      `/repositories/${this.ws(workspace)}/${repoSlug}/pullrequests/${prId}`
    );
    return res.data;
  }

  async createPullRequest(
    repoSlug: string,
    options: {
      title: string;
      sourceBranch: string;
      destinationBranch: string;
      description?: string;
      reviewers?: string[];
      closeSourceBranch?: boolean;
      workspace?: string;
    }
  ): Promise<PullRequest> {
    const body: Record<string, unknown> = {
      title: options.title,
      source: { branch: { name: options.sourceBranch } },
      destination: { branch: { name: options.destinationBranch } },
      close_source_branch: options.closeSourceBranch ?? false,
    };
    if (options.description) body["description"] = options.description;
    if (options.reviewers?.length) {
      body["reviewers"] = options.reviewers.map((uuid) => ({ uuid }));
    }

    const res = await this.client.post(
      `/repositories/${this.ws(options.workspace)}/${repoSlug}/pullrequests`,
      body
    );
    return res.data;
  }

  // ── Comments ───────────────────────────────────────────────────────────────

  async getPullRequestComments(
    repoSlug: string,
    prId: number,
    workspace?: string
  ): Promise<{ values: Comment[] }> {
    const res = await this.client.get(
      `/repositories/${this.ws(workspace)}/${repoSlug}/pullrequests/${prId}/comments`,
      { params: { pagelen: 50 } }
    );
    return res.data;
  }

  async addPullRequestComment(
    repoSlug: string,
    prId: number,
    options: {
      content: string;
      inline?: { path: string; to: number; from?: number };
      workspace?: string;
    }
  ): Promise<Comment> {
    const body: Record<string, unknown> = {
      content: { raw: options.content },
    };
    if (options.inline) body["inline"] = options.inline;

    const res = await this.client.post(
      `/repositories/${this.ws(options.workspace)}/${repoSlug}/pullrequests/${prId}/comments`,
      body
    );
    return res.data;
  }

  async updatePullRequestComment(
    repoSlug: string,
    prId: number,
    commentId: number,
    content: string,
    workspace?: string
  ): Promise<Comment> {
    const res = await this.client.put(
      `/repositories/${this.ws(workspace)}/${repoSlug}/pullrequests/${prId}/comments/${commentId}`,
      { content: { raw: content } }
    );
    return res.data;
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async getPullRequestTasks(
    repoSlug: string,
    prId: number,
    workspace?: string
  ): Promise<{ values: Task[] }> {
    const res = await this.client.get(
      `/repositories/${this.ws(workspace)}/${repoSlug}/pullrequests/${prId}/tasks`
    );
    return res.data;
  }

  async createPullRequestTask(
    repoSlug: string,
    prId: number,
    content: string,
    workspace?: string
  ): Promise<Task> {
    const res = await this.client.post(
      `/repositories/${this.ws(workspace)}/${repoSlug}/pullrequests/${prId}/tasks`,
      { content: { raw: content } }
    );
    return res.data;
  }

  async updatePullRequestTask(
    repoSlug: string,
    prId: number,
    taskId: number,
    options: { content?: string; state?: "UNRESOLVED" | "RESOLVED"; workspace?: string }
  ): Promise<Task> {
    const body: Record<string, unknown> = {};
    if (options.content !== undefined)
      body["content"] = { raw: options.content };
    if (options.state !== undefined) body["state"] = options.state;

    const res = await this.client.put(
      `/repositories/${this.ws(options.workspace)}/${repoSlug}/pullrequests/${prId}/tasks/${taskId}`,
      body
    );
    return res.data;
  }

  // ── Pipelines ──────────────────────────────────────────────────────────────

  async getPullRequestCommitStatuses(
    repoSlug: string,
    prId: number,
    workspace?: string
  ): Promise<{ values: Array<{ state: string; name: string; url: string; description: string; key: string }> }> {
    const res = await this.client.get(
      `/repositories/${this.ws(workspace)}/${repoSlug}/pullrequests/${prId}/statuses`
    );
    return res.data;
  }

  async getPipeline(
    repoSlug: string,
    pipelineUuid: string,
    workspace?: string
  ): Promise<{
    uuid: string;
    state: { name: string; result?: { name: string } };
    target: { commit?: { hash: string }; ref_name?: string };
    created_on: string;
  }> {
    const res = await this.client.get(
      `/repositories/${this.ws(workspace)}/${repoSlug}/pipelines/${pipelineUuid}`
    );
    return res.data;
  }

  async getPipelineSteps(
    repoSlug: string,
    pipelineUuid: string,
    workspace?: string
  ): Promise<{ values: PipelineStep[] }> {
    const res = await this.client.get(
      `/repositories/${this.ws(workspace)}/${repoSlug}/pipelines/${pipelineUuid}/steps`
    );
    return res.data;
  }

  async getPipelineStepLog(
    repoSlug: string,
    pipelineUuid: string,
    stepUuid: string,
    workspace?: string
  ): Promise<string> {
    const res = await this.client.get(
      `/repositories/${this.ws(workspace)}/${repoSlug}/pipelines/${pipelineUuid}/steps/${stepUuid}/log`,
      { responseType: "text" }
    );
    return res.data as string;
  }
}
