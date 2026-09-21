import { GitProxyRequest, GitProxyGithubUserResponse, GitProxyGitlabUserResponse, GitProxyGitlabGroupResponse, GitProxyGitRepo, GitProxyGithubReposResponse, GitProxyGitlabReposResponse, GitProxyGitBranch, GitProxyGitBranchesResponse, GitProxyGitCommit, GitProxyGitCommitsResponse } from "./ui-types";
import { ApiGitProxyRequest, ApiGitProxyGithubUserResponse, ApiGitProxyGitlabUserResponse, ApiGitProxyGitlabGroupResponse, ApiGitProxyGitRepo, ApiGitProxyGithubReposResponse, ApiGitProxyGitlabReposResponse, ApiGitProxyGitBranch, ApiGitProxyGitBranchesResponse, ApiGitProxyGithubCommit, ApiGitProxyGithubCommitsResponse, ApiGitProxyGitlabCommit, ApiGitProxyGitlabCommitsResponse } from "./api-types";

export function toApiGitProxyRequest(request: GitProxyRequest): ApiGitProxyRequest {
    return {
        url: request.url,
        gitconfig: request.gitConfig
    };
}

export function toGitProxyGithubUserResponse(response: ApiGitProxyGithubUserResponse): GitProxyGithubUserResponse {
    return {
        ...response,
        type: response.type,
    };
}

export function toGitProxyGitlabGroupResponse(response: ApiGitProxyGitlabGroupResponse): GitProxyGitlabGroupResponse {
    return {
        ...response,
        id: response.id,
    };
}

export function toGitProxyGitlabUserResponse(response: ApiGitProxyGitlabUserResponse): GitProxyGitlabUserResponse {
    return response.map(user => ({
        ...user,
        id: user.id,
    }));
}

export function toGitProxyGitRepo(response: ApiGitProxyGitRepo): GitProxyGitRepo {
    return {
        ...response,
        id: response.id,
        name: response.name,
    };
}

export function toGitProxyGithubReposResponse(response: ApiGitProxyGithubReposResponse): GitProxyGithubReposResponse {
    return {
        totalCount: response.total_count,
        incompleteResults: response.incomplete_results,
        items: response.items.map(toGitProxyGitRepo),
    };
}

export function toGitProxyGitlabReposResponse(response: ApiGitProxyGitlabReposResponse): GitProxyGitlabReposResponse {
    return response.map(toGitProxyGitRepo);
}

export function toGitProxyGitBranch(response: ApiGitProxyGitBranch): GitProxyGitBranch {
    return {
        ...response,
        name: response.name,
        commit: response.commit,
        protected: response.protected,
    };
}

export function toGitProxyGitBranchesResponse(response: ApiGitProxyGitBranchesResponse): GitProxyGitBranchesResponse {
    return response.map(toGitProxyGitBranch);
}

export function toGitProxyGithubCommit(response: ApiGitProxyGithubCommit): GitProxyGitCommit {
    return {
        message: response.commit.message,
        htmlUrl: response.html_url,
        sha: (response.sha ?? "").slice(0, 7),
        commitId: response.sha,
        author: {
            name: response.author?.login ?? '',
            avatarUrl: response.author?.avatar_url ?? '',
            htmlUrl: response.author?.html_url ?? '',
        },
        isChecked: false,
        date: response.commit.committer.date,
    };
}

export function toGitProxyGithubCommitsResponse(response: ApiGitProxyGithubCommitsResponse): GitProxyGitCommitsResponse {
    const result = response.map(toGitProxyGithubCommit);
    return result;
}

export function toGitProxyGitlabCommit(response: ApiGitProxyGitlabCommit): GitProxyGitCommit {
    return {
        message: response.message,
        htmlUrl: response.web_url,
        sha: response.short_id,
        commitId: response.id,
        author: {
            name: response.author_name,
            avatarUrl: response.avatar_url,
            htmlUrl: response.web_url,
        },
        isChecked: false,
        date: response.committed_date,
    };
}

export function toGitProxyGitlabCommitsResponse(response: ApiGitProxyGitlabCommitsResponse): GitProxyGitCommitsResponse {
    return response.map(toGitProxyGitlabCommit);
}