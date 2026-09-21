import { createEpinioClient } from "./client";
import { ApiGitProxyRequest, ApiGitProxyGithubUserResponse, ApiGitProxyGitlabUserResponse, ApiGitProxyGitlabGroupResponse, ApiGitProxyGithubReposResponse, ApiGitProxyGitlabReposResponse, ApiGitProxyGitBranch, ApiGitProxyGitBranchesResponse, ApiGitProxyGithubCommitsResponse, ApiGitProxyGitlabCommitsResponse } from "../models/gitproxy/api-types";
    
export function gitProxyApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const gitConfigsBasePath = '/api/v1/gitproxy';

    return {
        getGithubUser: async (request: ApiGitProxyRequest): Promise<ApiGitProxyGithubUserResponse> => {
            return await epinioClient.post(gitConfigsBasePath, request);
        },
        getGitlabUser: async (request: ApiGitProxyRequest): Promise<ApiGitProxyGitlabUserResponse> => {
            return await epinioClient.post(gitConfigsBasePath, request);
        },
        getGitlabGroup: async (request: ApiGitProxyRequest): Promise<ApiGitProxyGitlabGroupResponse> => {
            return await epinioClient.post(gitConfigsBasePath, request);
        },
        getGithubRepos: async (request: ApiGitProxyRequest): Promise<ApiGitProxyGithubReposResponse> => {
            return await epinioClient.post(gitConfigsBasePath, request);
        },
        getGitlabRepos: async (request: ApiGitProxyRequest): Promise<ApiGitProxyGitlabReposResponse> => {
            return await epinioClient.post(gitConfigsBasePath, request);
        },
        getGitBranches: async (request: ApiGitProxyRequest): Promise<ApiGitProxyGitBranchesResponse> => {
            return await epinioClient.post(gitConfigsBasePath, request);
        },
        getGithubBranch: async (request: ApiGitProxyRequest): Promise<ApiGitProxyGitBranch> => {
            return await epinioClient.post(gitConfigsBasePath, request);
        },
        getGithubCommits: async (request: ApiGitProxyRequest): Promise<ApiGitProxyGithubCommitsResponse> => {
            return await epinioClient.post(gitConfigsBasePath, request);
        },
        getGitlabCommits: async (request: ApiGitProxyRequest): Promise<ApiGitProxyGitlabCommitsResponse> => {
            return await epinioClient.post(gitConfigsBasePath, request);
        },
    };
}