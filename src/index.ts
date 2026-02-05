import { getInput, info, debug, setFailed } from "@actions/core";
import { statSync, createReadStream } from "fs";
import fetch from "node-fetch";
import process from "process";
import path from "path";

import { paths } from "./openapi.schema";

const apiBase = process.env.NEXUSMODS_API_BASE?.trim() || "https://api.nexusmods.com/v3";

async function fetchWithAuth(
  url: Parameters<typeof fetch>[0],
  apiKey: string,
  options?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  const headers = {
    "Content-Type": "application/json",
    apikey: apiKey,
    ...options?.headers,
  };

  const init = { headers, ...options };
  debug(`Fetching URL: ${url} with options: ${JSON.stringify(init, null, 2)}`);

  return fetch(url, init);
}

type ModDetailsParams = paths["/games/{game_domain}/mods/{mod_id}"]["get"]["parameters"]["path"];
type ModDetailsResponse =
  paths["/games/{game_domain}/mods/{mod_id}"]["get"]["responses"]["200"]["content"]["application/json"];

async function getModDetails(params: ModDetailsParams, apiKey: string): Promise<ModDetailsResponse> {
  const { game_domain, mod_id } = params;
  const url = `${apiBase}/games/${game_domain}/mods/${mod_id}`;
  const response = await fetchWithAuth(url, apiKey);

  if (!response.ok) {
    throw new Error(`Failed to get mod details: ${response.status} - ${await response.text()}`);
  }

  return (await response.json()) as ModDetailsResponse;
}

type RequestUploadParams = paths["/uploads"]["post"]["requestBody"]["content"]["application/json"];
type RequestUploadResponse = paths["/uploads"]["post"]["responses"]["201"]["content"]["application/json"];

async function requestUpload(params: RequestUploadParams, apiKey: string): Promise<RequestUploadResponse> {
  const { filename, size_bytes } = params;
  const url = `${apiBase}/uploads`;

  info(`Requesting upload URL from: ${url}`);
  const response = await fetchWithAuth(url, apiKey, {
    method: "POST",
    body: JSON.stringify({
      filename: path.basename(filename),
      size_bytes: String(size_bytes),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get upload URL: ${response.status} - ${await response.text()}`);
  }

  return (await response.json()) as RequestUploadResponse;
}

async function uploadFile(uploadUrl: string, filePath: string, fileSize: number): Promise<void> {
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(fileSize),
    },
    body: createReadStream(filePath),
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }
}

type FinaliseUploadParams = paths["/uploads/{id}/finalise"]["post"]["parameters"]["path"];
type FinaliseUploadResponse =
  paths["/uploads/{id}/finalise"]["post"]["responses"]["200"]["content"]["application/json"];

async function finaliseUpload(params: FinaliseUploadParams, apiKey: string): Promise<FinaliseUploadResponse> {
  const { id } = params;
  const url = `${apiBase}/uploads/${id}/finalise`;
  info(`Finalising upload at: ${url}`);

  const response = await fetchWithAuth(url, apiKey, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to finalise upload: ${response.status} - ${await response.text()}`);
  }

  return (await response.json()) as FinaliseUploadResponse;
}

type GetUploadParams = paths["/uploads/{id}"]["get"]["parameters"]["path"];
type GetUploadResponse = paths["/uploads/{id}"]["get"]["responses"]["200"]["content"]["application/json"];

async function pollUploadState(
  params: GetUploadParams,
  apiKey: string,
  pollIntervalMs = 2000,
  maxAttempts = 60,
): Promise<void> {
  const { id } = params;
  const url = `${apiBase}/uploads/${id}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetchWithAuth(url, apiKey, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload state: ${response.status} - ${await response.text()}`);
    }

    const data = (await response.json()) as GetUploadResponse;
    info(`Polling upload ${id}: state = ${data.state}`);

    if (data.state === "available") {
      return;
    }

    if (data.state === "failed") {
      throw new Error(`Upload processing failed for ${id}`);
    }

    const delay = Math.min(pollIntervalMs * Math.pow(1.5, attempt), 30000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`Upload processing timed out after ${maxAttempts} attempts for ${id}`);
}

type ClaimFileParams = paths["/mod_files"]["post"]["requestBody"]["content"]["application/json"];
type ClaimFileResponse = paths["/mod_files"]["post"]["responses"]["201"]["content"]["application/json"];
type ClaimFileCategory = ClaimFileParams["file_category"];

async function claimFile(params: ClaimFileParams, apiKey: string): Promise<ClaimFileResponse> {
  const { upload_id, mod_uid, name, version, file_category } = params;
  const url = `${apiBase}/mod_files`;
  info(`Claiming file at: ${url}`);

  const response = await fetchWithAuth(url, apiKey, {
    method: "POST",
    body: JSON.stringify({
      upload_id,
      mod_uid,
      name,
      version,
      file_category,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to claim file: ${response.status} - ${await response.text()}`);
  }

  return (await response.json()) as ClaimFileResponse;
}

export async function run(): Promise<void> {
  info("Starting NexusMods upload action");

  try {
    const apiKey = getInput("api_key", { required: true });
    const modId = parseInt(getInput("mod_id", { required: true }), 10);
    const gameDomain = getInput("game_domain", { required: true });
    const filename = getInput("filename", { required: true });
    const version = getInput("version", { required: true });
    const name = getInput("name") || path.basename(filename);
    const fileCategory = (getInput("file_category") || "main") as ClaimFileCategory;

    const { size: fileSize } = statSync(filename);

    // Step 1: Get UUID from mod details
    const { uid: mod_uid } = await getModDetails({ game_domain: gameDomain, mod_id: modId }, apiKey);

    // Step 2: Request upload location
    const { presigned_url, uuid } = await requestUpload({ size_bytes: fileSize, filename }, apiKey);
    info(`Received upload UUID: ${uuid}`);

    // Step 3: Upload file data
    await uploadFile(presigned_url, filename, fileSize);
    info("File data uploaded successfully");

    // Step 4: Finalise upload
    const finaliseResult = await finaliseUpload({ id: uuid }, apiKey);
    info(`Finalised upload: ${finaliseResult.uuid} (state: ${finaliseResult.state})`);

    // Step 5: Poll until upload is available
    await pollUploadState({ id: uuid }, apiKey);
    info("Upload is now available");

    // Step 6: Claim file (associate with mod)
    await claimFile({ upload_id: uuid, mod_uid, name, version, file_category: fileCategory }, apiKey);

    info("File uploaded successfully to NexusMods.");
  } catch (error) {
    if (error instanceof Error) {
      setFailed(error.message);
    } else {
      setFailed(String(error));
    }
  }
}

run();
