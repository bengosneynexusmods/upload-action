import { getInput, info, debug, setFailed } from "@actions/core";
import { statSync, createReadStream } from "fs";
import fetch from "node-fetch";
import process from "process";
const domain = process.env.NEXUSMODS_DOMAIN || "www.nexusmods.com";
async function fetchWithAuth(url, apiKey, options) {
    const headers = {
        ...options?.headers,
        cookie: `nexusmods_session=${apiKey};`,
        "Content-Type": "application/json",
    };
    const init = { headers, ...options };
    debug(`Fetching URL: ${url} with options: ${JSON.stringify(init, null, 2)}`);
    return fetch(url, init);
}
async function fetchPresignedURL(options) {
    const { modId, gameId, apiKey, fileSize, filename, fileId, version } = options;
    const url = `https://${domain}/api/game/${gameId}/mod/${modId}/file/url?total_size=${fileSize}&filename=${filename}&existing_file_id=${fileId}&version=${version}`;
    info(`Requesting upload URL from: ${url}`);
    const response = await fetchWithAuth(url, apiKey);
    if (!response.ok) {
        throw new Error(`Failed to get upload URL: ${response.status} - ${await response.text()}`);
    }
    return (await response.json());
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
        throw new Error(`Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
    }
}
async function claimFile(options) {
    const { gameId, modId, fileId, apiKey, requestOptions } = options;
    const url = `https://${domain}/api/game/${gameId}/mod/${modId}/file/${fileId}`;
    info(`Claiming file at: ${url}`);
    const response = await fetchWithAuth(url, apiKey, {
        method: "PUT",
        body: JSON.stringify(requestOptions),
    });
    if (!response.ok) {
        throw new Error(`Failed to claim file: ${response.status} - ${await response.text()}`);
    }
}
export async function run() {
    info("Starting NexusMods upload action");
    try {
        const apiKey = getInput("api_key", { required: true });
        const modId = getInput("mod_id", { required: true });
        const gameId = getInput("game_id", { required: true });
        const filename = getInput("filename", { required: true });
        const fileId = getInput("file_id", { required: true });
        const version = getInput("version", { required: true });
        const fileCategory = getInput("fileCategory") || "1";
        const removeOldVersion = getInput("removeOldVersion") || "true";
        const latestModVersion = getInput("latestModVersion") || "true";
        const { size: fileSize } = statSync(filename);
        const { presigned_url, uuid } = await fetchPresignedURL({
            modId,
            gameId,
            apiKey,
            fileSize,
            filename,
            fileId,
            version,
        });
        await uploadFile(presigned_url, filename);
        await claimFile({
            gameId,
            modId,
            fileId,
            apiKey,
            requestOptions: {
                name: filename,
                version: version,
                filesize: fileSize,
                file_uuid: uuid,
                file_category: Number(fileCategory),
                remove_old_version: removeOldVersion === "true",
                latest_mod_version: latestModVersion === "true",
            },
        });
        info("File uploaded successfully to NexusMods.");
    }
    catch (error) {
        if (error instanceof Error) {
            setFailed(error.message);
        }
        else {
            setFailed(String(error));
        }
    }
}
