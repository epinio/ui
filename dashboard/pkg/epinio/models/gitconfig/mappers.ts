import { ApiGitConfig, ApiListGitConfigsResponse, ApiGitConfigCreateRequest } from "./api-types";
import { GitConfig, ListGitConfigsResponse, GitConfigCreateRequest } from "./ui-types";

export function toGitConfig(apiGitConfig: ApiGitConfig): GitConfig {
    return {
        meta: apiGitConfig.meta,
        description: apiGitConfig.description,
        provider: apiGitConfig.provider,
        url: apiGitConfig.url,
        username: apiGitConfig.username,
        password: apiGitConfig.password,
        certs: apiGitConfig.certs,
        skipssl: apiGitConfig.skipssl,
        global: apiGitConfig.global,
        boundApps: apiGitConfig.bound_apps,
    };
}

export function toListGitConfigsResponse(apiResponse: ApiListGitConfigsResponse): ListGitConfigsResponse {
    const { items, ...paginationMetadata } = apiResponse;
    return {
        items: apiResponse.items.map(toGitConfig),
        ...paginationMetadata,
    };
}

function mapGitConfigRequest(
  uiRequest: Partial<GitConfigCreateRequest>
): Partial<ApiGitConfigCreateRequest> {
  const payload: Partial<ApiGitConfigCreateRequest> = {};


  if (uiRequest.id !== undefined) {
    payload.id = uiRequest.id;
  }

  if (uiRequest.provider !== undefined) {
    payload.provider = uiRequest.provider;
  }

  if (uiRequest.url !== undefined) {
    payload.url = uiRequest.url;
  }

  if (uiRequest.username !== undefined) {
    payload.username = uiRequest.username;
  }

  if (uiRequest.password !== undefined) {
    payload.password = uiRequest.password;
  }

  if (uiRequest.certs !== undefined) {
    payload.certs = btoa(uiRequest.certs);
  }

  if (uiRequest.skipssl !== undefined) {
    payload.skipssl = uiRequest.skipssl;
  }

  if (uiRequest.global !== undefined) {
    payload.global = uiRequest.global;
  }

  return payload;
}

export function toApiGitConfigCreateRequest(
  uiRequest: GitConfigCreateRequest
): ApiGitConfigCreateRequest {
  return mapGitConfigRequest(uiRequest) as ApiGitConfigCreateRequest;
}
