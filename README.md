# Zotero Assistant

A powerful integration plugin that seamlessly connects Zotero with Obsidian, allowing you to manage citations, bibliographies, notes, and PDF annotations directly within your Obsidian vault.

## Features

### Core Functionality
- **Citation Insertion**: Insert formatted citations from Zotero directly into your notes
- **Bibliography Generation**: Generate complete bibliographies with customizable CSL styles
- **Note Import**: Import Zotero notes and annotations into your Obsidian vault
- **PDF Annotations**: Extract highlights and annotations from PDFs in your Zotero library
- **Template System**: Customize output formats using Nunjucks templates

### Advanced Features
- **AI-Powered Summaries**: Automatic PDF summarization using AI models (compatible with OpenAI API)
- **Linkable Citations**: Clickable citations that can link to Zotero items, URLs, or DOI pages
- **Library Note Updates**: Update existing notes from Zotero based on citekeys in frontmatter
- **Image Extraction**: Extract rectangle annotations from PDFs as images
- **OCR Support**: Optional OCR processing for extracted images

## Prerequisites

- **Zotero** with the Better BibTeX plugin installed
- **Better BibTeX** configured with Quick Copy set to BibLaTeX format
- **Obsidian** version 1.11.4 or higher

## Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/RandyAllenEEE/obsidian-zotero-assistant/releases/latest).
2. Copy the files into `.obsidian/plugins/obsidian-zotero-assistant/` in your vault.
3. Restart Obsidian and enable Zotero Assistant. Start Zotero with Better BibTeX enabled before importing.

For upgrades, replace the three release files and keep `data.json`. When moving from this fork's old `obsidian-zotero-integration` ID, disable the old installation, back up its folder, copy its settings to the new folder, and update external command references from `obsidian-zotero-integration:` to `obsidian-zotero-assistant:`. For buttons that use the full command name, update the `Zotero Integration:` display-name prefix to `Zotero Assistant:`.

### Publishing

Run the checks in [the release workflow](.github/workflows/release.yml) and push the updated default branch. Once its checks pass, push only the `X.Y.Z` tag that matches `manifest.json`. The tag run rebuilds, packages, and verifies the attachments before publishing the GitHub Release. If GitHub does not queue that run on the fork, dispatch the same workflow on the existing version tag. A dispatch on a branch only runs checks.

Update the npm version with `npm version X.Y.Z --no-git-tag-version`, run `npm run bump`, and update the release notes before pushing the default branch.

## Setup

### Basic Configuration

1. Open Obsidian Settings → Zotero Assistant
2. Select your database (Zotero or Juris-M)
3. If using a custom port in Zotero, enter it in the "Port number" field
4. Set your preferred note import location

### AI Summary Configuration (Optional)

1. Obtain an API key from your preferred OpenAI-compatible service
2. Enter your API URL and model name in the AI Summary Settings section
3. Customize the AI prompt to suit your needs

## Usage

### Commands Available

Access these via the Command Palette (Ctrl/Cmd+P):

- **Insert notes into current document**: Insert Zotero notes into the current document
- **Import notes**: Import Zotero notes into your vault
- **Import Here**: Import notes to the current folder
- **Update Item Note**: Update existing note from Zotero using citekey in frontmatter
- **Trigger AI Summary**: Generate AI summary for the current markdown file
- **Data explorer**: Explore Zotero data in a dedicated view

### Citation Formats

Create custom citation formats in the settings:

1. Click "Add Citation Format"
2. Provide a name for the format
3. Select output format (LaTeX, BibLaTeX, Pandoc, etc.)
4. Choose bibliography style (CSL)
5. For formatted citations, choose an optional citation link target: Zotero item, URL, or DOI

When a formatted citation link target is enabled, the plugin uses Zotero item data returned by Better BibTeX. If the selected item does not provide the requested link target, the citation is inserted without a link and a notice is shown. Multi-item citations are also inserted without a link to avoid linking the whole citation to a single item.

### Export Formats

Define custom export formats for note imports:

1. Click "Add Export Format"
2. Name your format
3. Define the output path template
4. Configure the template content

After a successful import, the plugin manages `citekey`, `latest_import_time`, and `zotero_pdf` in the note frontmatter. Templates do not need to declare these fields; if they do, the plugin writes the final values after rendering.

The **Update Item Note** command refreshes the active note in place using its frontmatter `citekey`. A dedicated update format can be configured in settings. For existing configurations without one, the plugin uses the first custom import format and then falls back to the Import Here format.

## Internationalization

The plugin supports both English and Chinese interfaces. The language will automatically match your Obsidian application language setting.

## Troubleshooting

### Common Issues

- **Connection Error**: Verify Zotero is running and Better BibTeX is enabled
- **Empty Results**: Check that Better BibTeX Quick Copy is configured
- **Citation Not Found**: Ensure citekey exists in your Zotero library
- **Item Note Cannot Be Updated**: Ensure the note has valid YAML frontmatter and a non-empty `citekey`

### Getting Help

If you encounter issues:

1. Check that Zotero and Better BibTeX are properly installed and configured
2. Verify that the correct port is specified in settings
3. Ensure your Zotero application is running
4. Consult the console for error messages (Ctrl+Shift+I)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

Distributed under the [GNU General Public License version 3](LICENSE.md).
The corresponding source and build files are available in the **Source code**
archive of the matching [GitHub Release](https://github.com/RandyAllenEEE/obsidian-zotero-assistant/releases).
The [PDF utility installer notices](PDF_UTILITY_NOTICES.txt) are included in
the built plugin.

## Support

If you find this plugin helpful, consider starring the repository or contributing to its development.
