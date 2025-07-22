# NexusMods Upload GitHub Action


This GitHub Action uploads a zip file to NexusMods using the NexusMods API. It is designed to automate the process of uploading mod files as part of your CI/CD workflow.


## Features

- Uploads a zip file to NexusMods

## Inputs

| Name      | Description                   | Required | Default |
| --------- | ----------------------------- | -------- | ------- |
| api_key   | API key for NexusMods         | Yes      |         |
| mod_id    | Mod ID on NexusMods           | Yes      |         |
| game_id   | Game ID on NexusMods          | Yes      |         |
| filename  | Name of the zip file to upload| Yes      |         |

## Usage

First, use another action to create a zip file. Then, use this action to upload the zip file to NexusMods:

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

## Example

```yaml
- name: Zip files
  run: zip -r my-mod.zip ./dist

- name: Upload mod to NexusMods
  uses: your-org/nexusmods-upload-action@v1
  with:
    api_key: ${{ secrets.NEXUSMODS_API_KEY }}
    mod_id: 12345
    game_id: skyrim
    filename: my-mod.zip
```

## License

MIT
