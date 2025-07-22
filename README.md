# NexusMods Upload GitHub Action

# THIS AND THE API IT'S USING ARE CURRENTLY PRE-RELEASE AND WILL MOST LIKELY NOT WORK!

This GitHub Action uploads a zip file to NexusMods using the NexusMods API. It is designed to automate the process of uploading mod files as part of your CI/CD workflow.

## Features

- Uploads a zip file to NexusMods

## Inputs

| Name     | Description                    | Required |
| -------- | ------------------------------ | -------- |
| api_key  | API key for NexusMods          | Yes      |
| mod_id   | Mod ID on NexusMods            | Yes      |
| game_id  | Game ID on NexusMods           | Yes      |
| filename | Name of the zip file to upload | Yes      |
| file_id  | File ID on NexusMods           | Yes      |

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
    mod_id: <your_mod_id>
    game_id: <your_game_id>
    filename: my-mod.zip
```

## Development

### Requirements

This project requires Node v20 or higher

### Running localy

First run `npm install`, then set the following required enviroment variables:

- `INPUT_API_KEY`
- `INPUT_MOD_ID`
- `INPUT_GAME_ID`
- `INPUT_FILENAME`
- `INPUT_FILE_ID`

The `NEXUSMODS_DOMAIN` enviroment variable will override the api domain.

Then running `npm run local-action` will compile the typescript and run the action localy.

## License

MIT
