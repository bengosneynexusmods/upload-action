import { getInput, info, debug, setFailed } from "@actions/core";
import { statSync, createReadStream } from "fs";
import fetch from "node-fetch";
import process from "process";
import path from "path";

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

type RequestUploadResponse = {
  presigned_url: string;
  uuid: string;
};

async function requestUpload(apiKey: string, fileSize: number, filename: string): Promise<RequestUploadResponse> {
  const url = `${apiBase}/uploads`;

  info(`Requesting upload URL from: ${url}`);
  const response = await fetchWithAuth(url, apiKey, {
    method: "POST",
    body: JSON.stringify({
      filename: path.basename(filename),
      size_bytes: String(fileSize),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get upload URL: ${response.status} - ${await response.text()}`);
  }

  return (await response.json()) as RequestUploadResponse;
}

async function uploadFile(uploadUrl: string, filePath: string): Promise<void> {
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: createReadStream(filePath),
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }
}

type FinaliseUploadResponse = {
  uuid: string;
  state: string;
};

async function finaliseUpload(uuid: string, apiKey: string): Promise<FinaliseUploadResponse> {
  const url = `${apiBase}/uploads/${uuid}/finalise`;
  info(`Finalising upload at: ${url}`);

  const response = await fetchWithAuth(url, apiKey, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to finalise upload: ${response.status} - ${await response.text()}`);
  }

  return (await response.json()) as FinaliseUploadResponse;
}

type GetUploadResponse = {
  uuid: string;
  state: string;
};

async function pollUploadState(uuid: string, apiKey: string, pollIntervalMs = 2000, maxAttempts = 60): Promise<void> {
  const url = `${apiBase}/uploads/${uuid}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetchWithAuth(url, apiKey, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload state: ${response.status} - ${await response.text()}`);
    }

    const data = (await response.json()) as GetUploadResponse;
    info(`Polling upload ${uuid}: state = ${data.state}`);

    if (data.state === "available") {
      return;
    }

    if (data.state === "failed") {
      throw new Error(`Upload processing failed for ${uuid}`);
    }

    const delay = Math.min(pollIntervalMs * Math.pow(1.5, attempt), 30000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`Upload processing timed out after ${maxAttempts} attempts for ${uuid}`);
}

async function claimFile(
  apiKey: string,
  uploadId: string,
  modUid: string,
  name: string,
  version: string,
  fileCategory: string,
): Promise<void> {
  const url = `${apiBase}/mod_files`;
  info(`Claiming file at: ${url}`);

  const response = await fetchWithAuth(url, apiKey, {
    method: "POST",
    body: JSON.stringify({
      upload_id: uploadId,
      mod_uid: modUid,
      name: name,
      version: version,
      file_category: fileCategory,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to claim file: ${response.status} - ${await response.text()}`);
  }
}

export async function run(): Promise<void> {
  info("Starting NexusMods upload action");

  try {
    const apiKey = getInput("api_key", { required: true });
    const modUid = getInput("mod_uid", { required: true });
    const filename = getInput("filename", { required: true });
    const version = getInput("version", { required: true });
    const name = getInput("name") || path.basename(filename);
    const fileCategory = getInput("file_category") || "main";

    const { size: fileSize } = statSync(filename);

    // Step 1: Request upload location
    const { presigned_url, uuid } = await requestUpload(apiKey, fileSize, filename);
    info(`Received upload UUID: ${uuid}`);

    // Step 2: Upload file data
    await uploadFile(presigned_url, filename);
    info("File data uploaded successfully");

    // Step 3: Finalise upload
    const finaliseResult = await finaliseUpload(uuid, apiKey);
    info(`Finalised upload: ${finaliseResult.uuid} (state: ${finaliseResult.state})`);

    // Step 4: Poll until upload is available
    await pollUploadState(uuid, apiKey);
    info("Upload is now available");

    // Step 5: Claim file (associate with mod)
    await claimFile(apiKey, uuid, modUid, name, version, fileCategory);

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
