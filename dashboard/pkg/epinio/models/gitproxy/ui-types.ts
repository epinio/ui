export interface GitProxyRequest {
    url: string;
    gitConfig?: string;
}

export interface GitProxyGithubUserResponse {
  type: string;
  [key: string]: any;
}

export interface GitProxyGitlabGroupResponse {
  id: number;
  [key: string]: any;
}

export type GitProxyGitlabUserResponse = GitProxyGitlabGroupResponse[];

export interface GitProxyGitRepo {
  id: number;
  name: string;
  [key: string]: any;
}

export interface GitProxyGithubReposResponse {
  totalCount: number;
  incompleteResults: boolean;
  items: GitProxyGitRepo[];
}

export type GitProxyGitlabReposResponse = GitProxyGitRepo[];

export interface GitProxyGitBranch {
  name: string;
  commit: {
    [key: string]: any;
  },
  protected: boolean;
  [key: string]: any;
}

export type GitProxyGitBranchesResponse = GitProxyGitBranch[];

export interface GitProxyGitCommit {
  message: string;
  htmlUrl: string;
  sha: string;
  commitId: string;
  author: {
    name: string;
    avatarUrl: string;
    htmlUrl: string;
  }
  isChecked: boolean;
  date: string;
} 

export type GitProxyGitCommitsResponse = GitProxyGitCommit[];