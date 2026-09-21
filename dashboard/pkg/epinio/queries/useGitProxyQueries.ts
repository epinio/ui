import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { gitProxyApi } from "../api/gitproxy";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ResourceQueryOptions } from "../models/resource/ui-types";
import { toApiListResourceRequestParams } from "../models/resource/mappers";
import { toApiGitProxyRequest, toGitProxyGithubUserResponse, toGitProxyGitlabGroupResponse, toGitProxyGitlabUserResponse, toGitProxyGithubReposResponse, toGitProxyGitlabReposResponse, toGitProxyGitBranch, toGitProxyGitBranchesResponse, toGitProxyGithubCommitsResponse, toGitProxyGitlabCommitsResponse } from "../models/gitproxy/mappers";
import { GitProxyRequest, GitProxyGitRepo, GitProxyGitBranch } from "../models/gitproxy/ui-types";
import { GitConfig } from "../models/gitconfig/ui-types";

// hostFromUrl reduces a stored instance URL to its bare host (no scheme, no
// path), so it can be interpolated into `https://<host>/...` API calls. Accepts
// values with or without a scheme, e.g. 'https://ghe.corp.com' or 'ghe.corp.com'.
function hostFromUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).host;
  } catch {
    return '';
  }
}

export function useGitBaseUrl(type: Ref<'github' | 'gitlab'>, gitConfig: Ref<GitConfig | null>) {
    const url = computed(() => {
        if (!gitConfig.value) {
            return type.value === 'github' ? 'api.github.com' : 'gitlab.com';
        }

        const provider = gitConfig.value?.provider;
        const url = gitConfig.value?.url;

        if (provider === 'github') {
            return 'api.github.com';
        } else if (provider === 'gitlab') {
            return 'gitlab.com';
        } else if (provider === 'github_enterprise_self_hosted' || provider === 'github_enterprise_cloud' || provider === 'gitlab_enterprise' || provider === 'git') {
            const host = hostFromUrl(url);
            if (!host) return null;
            // GitHub Enterprise Server serves its REST API under /api/v3. GitLab (and a
            // generic git host) already carry /api/v4 in the request paths, so no prefix.
            return provider === 'github_enterprise_self_hosted' ? `${host}/api/v3` : host;
        }

        return null;
    });
    return url;
}

export function useGitProxyUserType(store: any, type: Ref<'github' | 'gitlab'>, username: Ref<string>, gitConfig: Ref<string | null>, baseUrl: Ref<string>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['gitProxyUser', cluster.value?.id, type.value, username.value, gitConfig.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            let userType: string | null = null;
            if (type.value === 'github') {
                const payload: GitProxyRequest = {
                    url: `https://${baseUrl.value}/users/${username.value}`
                }
                if (gitConfig.value) payload.gitConfig = gitConfig.value;
                const githubUserResponse = await gitProxyApi(epinioClient).getGithubUser(toApiGitProxyRequest(payload));
                const githubUser = toGitProxyGithubUserResponse(githubUserResponse);
                userType = githubUser.type === 'User' ? 'user' : githubUser.type === 'Organization' ? 'org' : null;
            } else if (type.value === 'gitlab') {
                const payload: GitProxyRequest = { url: `https://${baseUrl.value}/api/v4/groups/${username.value}` };
                if (gitConfig.value) payload.gitConfig = gitConfig.value;

                try {
                    const gitlabGroupResponse = await gitProxyApi(epinioClient).getGitlabGroup(toApiGitProxyRequest(payload));
                    const gitlabGroup = toGitProxyGitlabGroupResponse(gitlabGroupResponse);
                    if (gitlabGroup.id) userType = 'group';
                } catch {
                // 404 - not a group, try user
                }
                    payload.url = `https://${baseUrl.value}/api/v4/users?username=${username.value}`;
                try {
                    const gitlabUserResponse = await gitProxyApi(epinioClient).getGitlabUser(toApiGitProxyRequest(payload));
                    const gitlabUser = toGitProxyGitlabUserResponse(gitlabUserResponse);
                    if (gitlabUser.length > 0) userType = 'user';
                } catch {
                // user not found either
                }
            }
            return {username: username.value, userType};
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: keepPreviousData,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true, // disable to ensure age updates in the ui when polling tables
        retry: false
    }, epinioQueryClient);
}

export function useGitProxyRepos(store: any, type: Ref<'github' | 'gitlab'>, gitUser: Ref<{ username: string, userType: string | null } | null>, gitConfig: Ref<string | null>, baseUrl: Ref<string>, query: Ref<string>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['gitProxyRepos', cluster.value?.id, type.value, gitUser.value?.username, gitUser.value?.userType, gitConfig.value,  query.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const payload: GitProxyRequest = { url: '' };
            if (gitConfig.value) payload.gitConfig = gitConfig.value;

            if (type.value === 'github') {
                payload.url = `https://${baseUrl.value}/search/repositories?q=${gitUser.value?.userType}:${gitUser.value?.username}${query.value ? `+${query.value}` : ''}`;
                const githubReposResponse = await gitProxyApi(epinioClient).getGithubRepos(toApiGitProxyRequest(payload));
                const githubRepos = toGitProxyGithubReposResponse(githubReposResponse);
                return githubRepos.items;
            } else if (type.value === 'gitlab') {
                if (!query.value) payload.url = `https://${baseUrl.value}/api/v4/projects?${gitConfig.value ? 'membership=true&' : ''}simple=true${gitUser.value?.username ? `&search=${gitUser.value?.username}` : ''}`;
                else payload.url = `https://${baseUrl.value}/api/v4/${gitConfig.value ? '' : `${gitUser.value?.userType}s/${encodeURIComponent(gitUser.value?.username || '')}/`}projects?${gitConfig.value ? 'membership=true&' : ''}simple=true&search=${query.value}`;
                const gitlabReposResponse = await gitProxyApi(epinioClient).getGitlabRepos(toApiGitProxyRequest(payload));
                const gitlabRepos = toGitProxyGitlabReposResponse(gitlabReposResponse);
                return gitlabRepos;
            }

            return null;
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: keepPreviousData,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true,
        retry: false
    }, epinioQueryClient);
}

export function useGitProxyBranches(store: any, type: Ref<'github' | 'gitlab'>, gitUser: Ref<{ username: string, userType: string | null } | null>, gitConfig: Ref<string | null>, baseUrl: Ref<string>, repo: Ref<GitProxyGitRepo>, query: Ref<string>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['gitProxyBranches', cluster.value?.id, type.value, gitUser.value?.username, gitUser.value?.userType, gitConfig.value, repo.value, query.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const payload: GitProxyRequest = { url: '' };
            if (gitConfig.value) payload.gitConfig = gitConfig.value;

            if (type.value === 'github') {
                payload.url = `https://${baseUrl.value}/repos/${gitUser.value?.username}/${repo.value?.name}/branches`;
                if (query.value) {
                    payload.url += `/${query.value}`;
                    const githubBranchResponse = await gitProxyApi(epinioClient).getGithubBranch(toApiGitProxyRequest(payload));
                    return [toGitProxyGitBranch(githubBranchResponse)];
                } else {
                    const githubBranchesResponse = await gitProxyApi(epinioClient).getGitBranches(toApiGitProxyRequest(payload));
                    return toGitProxyGitBranchesResponse(githubBranchesResponse);
                }
            } else if (type.value === 'gitlab') {
                payload.url = `https://${baseUrl.value}/api/v4/projects/${encodeURIComponent(repo.value?.id)}/repository/branches${query.value ? `?search=${query.value}` : ''}`;
                const gitlabBranchesResponse = await gitProxyApi(epinioClient).getGitBranches(toApiGitProxyRequest(payload));
                return toGitProxyGitBranchesResponse(gitlabBranchesResponse);
            }

            return null;
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: keepPreviousData,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true,
        retry: false
    }, epinioQueryClient);
}

export function useGitProxyCommits(store: any, type: Ref<'github' | 'gitlab'>, gitUser: Ref<{ username: string, userType: string | null } | null>, gitConfig: Ref<string | null>, baseUrl: Ref<string>, repo: Ref<GitProxyGitRepo>, branch: Ref<GitProxyGitBranch>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['gitProxyCommits', cluster.value?.id, type.value, gitUser.value?.username, gitUser.value?.userType, gitConfig.value, repo.value, branch.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const payload: GitProxyRequest = { url: '' };
            if (gitConfig.value) payload.gitConfig = gitConfig.value;

            if (type.value === 'github') {
                payload.url = `https://${baseUrl.value}/repos/${gitUser.value?.username}/${repo.value?.name}/commits?sha=${branch.value?.name}`;
                const githubCommitsResponse = await gitProxyApi(epinioClient).getGithubCommits(toApiGitProxyRequest(payload));
                return toGitProxyGithubCommitsResponse(githubCommitsResponse);
            } else if (type.value === 'gitlab') {
                payload.url = `https://${baseUrl.value}/api/v4/projects/${encodeURIComponent(repo.value?.id)}/repository/commits?ref_name=${branch.value?.name}`;
                const gitlabCommitsResponse = await gitProxyApi(epinioClient).getGitlabCommits(toApiGitProxyRequest(payload));
                return toGitProxyGitlabCommitsResponse(gitlabCommitsResponse);
            }

            return null;
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: keepPreviousData,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true,
        retry: false
    }, epinioQueryClient);
}