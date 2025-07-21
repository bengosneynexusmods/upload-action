import { getInput, info, setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import { statSync, createReadStream } from "fs";
import { resolve } from "path";
import fetch from "node-fetch";
import process from "process";

async function zip(directory, exclude, filename) {
  info(`Zipping directory: ${directory}`);

  const zipFilePath = resolve(process.cwd(), filename);
  const zipArgs = ["-r", zipFilePath, "."];

  if (exclude) {
    zipArgs.push("--exclude", exclude);
  }

  await exec("zip", zipArgs, { cwd: directory });

  const stats = statSync(zipFilePath);
  const fileSize = stats.size;

  return { zipFilePath, fileSize };
}

async function fetchPresignedURL(modId, gameId, apiKey, fileSize, filename) {
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

async function uploadFile(uploadUrl, filePath) {
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

export async function run() {
  info("Starting NexusMods upload action...");
  try {
    const apiKey = getInput("api_key", { required: true });
    const modId = getInput("mod_id", { required: true });
    const gameId = getInput("game_id", { required: true });
    const directory = getInput("directory", { required: true });
    const exclude = getInput("exclude") || "";
    const filename = getInput("filename", { required: true });

    const { zipFilePath, fileSize } = await zip(directory, exclude, filename);

    const uploadUrl = await fetchPresignedURL(
      modId,
      gameId,
      apiKey,
      fileSize,
      filename,
    );

    await uploadFile(uploadUrl, zipFilePath);

    info("File uploaded successfully to NexusMods.");
  } catch (error) {
    setFailed(error.message);
  }
}
