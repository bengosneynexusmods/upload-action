# NexusMods Upload GitHub Action

# THIS AND THE API IT'S USING ARE CURRENTLY PRE-RELEASE AND WILL MOST LIKELY NOT WORK!

This GitHub Action uploads a file to NexusMods using the NexusMods v3 API. It is designed to automate the process of uploading mod files as part of your CI/CD workflow.

## Features

- Uploads a file to NexusMods

## Inputs

| Name          | Description                          | Required | Default              |
| ------------- | ------------------------------------ | -------- | -------------------- |
| api_key       | API key for NexusMods                | Yes      |                      |
| game_doamin   | Game domainname on NexusMods         | Yes      |                      |
| mod_id        | Mod ID on NexusMods                  | Yes      |                      |
| filename      | Path to the file to upload           | Yes      |                      |
| version       | Version string for the uploaded file | Yes      |                      |
| name          | Display name for the file            | No       | basename of filename |
| file_category | File category for the uploaded file  | No       | main                 |

## Usage

First, use another action to create a zip file. Then, use this action to upload the zip file to NexusMods:

## Example

```yaml
- name: Zip files
  run: zip -r my-mod.zip ./dist

- name: Upload to NexusMods
  uses: <owner>/<repo>@<tag>
  with:
    api_key: ${{ secrets.NEXUSMODS_API_KEY }}
    mod_id: <mod_id>
    game_domain: <game_doaminname>
    filename: my-mod.zip
    version: 1.0.0
    name: My Mod # optional
    file_category: main # optional
```

## Development

### Requirements

This project requires Node v20 or higher

### Running locally

First run `npm install`, then create a `.env` file with the following required environment variables:

- `INPUT_API_KEY`
- `INPUT_MOD_UID`
- `INPUT_FILENAME`
- `INPUT_VERSION`

Optional environment variables:

- `INPUT_NAME`
- `INPUT_FILE_CATEGORY`
- `NEXUSMODS_API_BASE` - Override the API base URL (defaults to `https://api.nexusmods.com/v3`)
- `ACTIONS_STEP_DEBUG=true` - Enable debug output

Then run `npm run local-action` to build and run the action locally.

Before committing you must build the project with `npm run build`.

### OpenAPI schema

This is generated using openapi-typescript via the following command:

`npm run openapi-spec`

## License

MIT
