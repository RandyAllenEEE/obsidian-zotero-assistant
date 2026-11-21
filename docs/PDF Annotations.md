## What is the PDF Utility?

The built-in download checks the SHA-256 of the pinned upstream release for
your platform before extracting its executable. Failed downloads and failed
checks leave an existing installation available. You can still select a local
executable in the plugin settings.

Obsidian Zotero Assistant uses an [external tool](https://github.com/mgmeyers/pdf-annots2json) to extract annotations from PDF files. This tool is not 100% perfect, but generally works well.

Currently, the extraction tool supports:
- Windows (x64)
- Linux (x64)
- Mac (Intel & Apple Silicon)

Please [file an issue](https://github.com/mgmeyers/obsidian-zotero-integration/issues) if annotation extraction doesn't work on your platform, or if you encounter any issues with it.

## What annotations are supported?

- Highlights
- Underlines
- Strikethroughs
- Notes
- Rectangles

## How do I export images from PDFs

Rectangle annotations will be converted to images and saved in the `Image Output Path` set under `Export Formats`.

![](Screen%20Shot%202022-03-28%20at%2011.02.59%20AM.png)
