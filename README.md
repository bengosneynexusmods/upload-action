# NexusMods Upload GitHub Action

This GitHub Action zips a specified directory in your repository and uploads it to NexusMods using the NexusMods API. It is designed to automate the process of packaging and uploading mod files as part of your CI/CD workflow.

## Features
- Zips a directory in your repository
- Supports excluding files from the zip
- Uploads the zip file to NexusMods

## Inputs
| Name      | Description                        | Required | Default |
|-----------|------------------------------------|----------|---------|
| api_key   | API key for NexusMods              | Yes      |         |
| mod_id    | Mod ID on NexusMods                | Yes      |         |
| game_id   | Game ID on NexusMods               | Yes      |         |
| directory | Directory to zip                   | Yes      | .       |
| exclude   | Files to exclude from the zip      | No       |         |
| filename  | Name of the zip file               | Yes      |         |

## Usage
Add the following step to your workflow:

```yaml
- name: Upload to NexusMods
  uses: <owner>/<repo>@<tag>
  with:
    api_key: ${{ secrets.NEXUSMODS_API_KEY }}
    mod_id: <your_mod_id>
    game_id: <your_game_id>
    directory: <directory_to_zip>
    exclude: <files_to_exclude> # optional
    filename: <output_zip_name>
```

## Example
```yaml
- name: Upload mod to NexusMods
  uses: your-org/nexusmods-upload-action@v1
  with:
    api_key: ${{ secrets.NEXUSMODS_API_KEY }}
    mod_id: 12345
    game_id: skyrim
    directory: ./dist
    exclude: '*.log'
    filename: my-mod.zip
```

## License
MIT
