export interface ApiGitProxyRequest {
    url: string;
    gitconfig?: string;
}

export interface ApiGitProxyGithubUserResponse {
  type: string;
  [key: string]: any;
}

export interface ApiGitProxyGitlabGroupResponse {
  id: number;
  [key: string]: any;
}

export type ApiGitProxyGitlabUserResponse = ApiGitProxyGitlabGroupResponse[];

export interface ApiGitProxyGitRepo {
  id: number;
  name: string;
  [key: string]: any;
}

export interface ApiGitProxyGithubReposResponse {
  total_count: number;
  incomplete_results: boolean;
  items: ApiGitProxyGitRepo[];
}

export type ApiGitProxyGitlabReposResponse = ApiGitProxyGitRepo[];

export interface ApiGitProxyGitBranch {
  name: string;
  commit: {
    [key: string]: any;
  },
  protected: boolean;
  [key: string]: any;
}

export type ApiGitProxyGitBranchesResponse = ApiGitProxyGitBranch[];

export interface ApiGitProxyGithubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    committer: {
      date: string;
      [key: string]: any;
    }
    [key: string]: any;
  }
  author?: {
    name: string;
    avatar_url: string;
    html_url: string;
    [key: string]: any;
  }
  [key: string]: any;
}
export type ApiGitProxyGithubCommitsResponse = ApiGitProxyGithubCommit[];

export interface ApiGitProxyGitlabCommit {
  id: string;
  message: string;
  short_id: string;
  web_url: string;
  author_name: string;
  avatar_url: string;
  committed_date: string;
  [key: string]: any;
}

export type ApiGitProxyGitlabCommitsResponse = ApiGitProxyGitlabCommit[];


