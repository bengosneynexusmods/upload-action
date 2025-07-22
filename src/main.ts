import { getInput, info, setFailed } from "@actions/core";
import { statSync, createReadStream } from "fs";
import fetch from "node-fetch";
import process from "process";

async function fetchPresignedURL(
  modId: string,
  gameId: string,
  apiKey: string,
  fileSize: number,
  filename: string,
): Promise<string> {
  const domain = process.env.NEXUSMODS_DOMAIN || "www.nexusmods.com";
  const url = `https://${domain}/api/game/${gameId}/mod/${modId}/file/url?total_size=${fileSize}&filename=${filename}`;

  info(`Requesting upload URL from: ${url}`);
  const response = await fetch(url, {
    headers: {
      cookie: `nexusmods_session=${apiKey};`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get upload URL: ${response.status} - ${await response.text()}`,
    );
  }
  const data = await response.json();
  const uploadUrl = data.presigned_url;
  if (!uploadUrl) {
    throw new Error("No presigned_url in response");
  }

  return uploadUrl;
}

async function uploadFile(uploadUrl: string, filePath: string): Promise<void> {
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/zip",
    },
    body: createReadStream(filePath),
  });

  if (!uploadRes.ok) {
    throw new Error(
      `Upload failed: ${uploadRes.status} ${await uploadRes.text()}`,
    );
  }
}

export async function run(): Promise<void> {
  info("Starting NexusMods upload action");

  try {
    const apiKey = getInput("api_key", { required: true });
    const modId = getInput("mod_id", { required: true });
    const gameId = getInput("game_id", { required: true });
    const filename = getInput("filename", { required: true });

    const { size: fileSize } = statSync(filename);

    const uploadUrl = await fetchPresignedURL(
      modId,
      gameId,
      apiKey,
      fileSize,
      filename,
    );

    await uploadFile(uploadUrl, filename);

    info("File uploaded successfully to NexusMods.");
  } catch (error) {
    if (error instanceof Error) {
      setFailed(error.message);
    } else {
      setFailed(String(error));
    }
  }
}
