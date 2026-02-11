/**
 * GraphQL request utilities for the Zenland SDK
 */

type GraphQLErrorLike = {
  message?: string;
  [key: string]: unknown;
};

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: GraphQLErrorLike[];
};

/**
 * Error thrown when the indexer returns GraphQL errors
 */
export class ZenlandGraphQLError extends Error {
  public readonly errors: GraphQLErrorLike[];

  constructor(message: string, errors: GraphQLErrorLike[]) {
    super(message);
    this.name = "ZenlandGraphQLError";
    this.errors = errors;
  }
}

/**
 * Error thrown when the indexer request fails at the network/HTTP level
 */
export class ZenlandRequestError extends Error {
  public readonly status: number;
  public readonly statusText: string;

  constructor(message: string, status: number, statusText: string) {
    super(message);
    this.name = "ZenlandRequestError";
    this.status = status;
    this.statusText = statusText;
  }
}

export interface GraphQLRequestOptions {
  signal?: AbortSignal;
}

/**
 * Execute a GraphQL request against the Zenland indexer
 */
export async function graphqlRequest<TData, TVariables extends object | undefined>(
  baseUrl: string,
  document: string,
  variables?: TVariables,
  options?: GraphQLRequestOptions,
): Promise<TData> {
  const endpoint = `${baseUrl}/graphql`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ query: document, variables }),
    signal: options?.signal,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ZenlandRequestError(
      `Zenland request failed (${res.status} ${res.statusText})${text ? `: ${text}` : ""}`,
      res.status,
      res.statusText,
    );
  }

  const json = (await res.json()) as GraphQLResponse<TData>;

  if (json.errors?.length) {
    throw new ZenlandGraphQLError(
      json.errors.map((e) => e.message ?? "GraphQL error").join("; "),
      json.errors,
    );
  }

  if (!json.data) {
    throw new Error("Zenland response missing data.");
  }

  return json.data;
}
