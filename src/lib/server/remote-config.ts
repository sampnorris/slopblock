import { loadConfigFromString } from "./config.js";

function decodeContent(value: string): string {
  return Buffer.from(value, "base64").toString("utf8");
}

export async function loadRemoteConfig(
  octokit: any,
  owner: string,
  repo: string,
  ref: string,
  configPath = ".github/slopblock.yml"
) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: configPath,
      ref
    });

    if (Array.isArray(data) || data.type !== "file" || typeof data.content !== "string") {
      return loadConfigFromString(undefined);
    }

    return loadConfigFromString(decodeContent(data.content));
  } catch {
    return loadConfigFromString(undefined);
  }
}
