# Artefact

This folder holds documentation and reference information about the research implementation.
It does **not** contain source code — the actual code lives in its own repository. The
purpose here is to capture enough context about the implementation to understand, cite, and
reproduce its outputs.

## Structure

The layout below is a rough starting point and can be adapted to suit the needs of the
specific research.

- `source_code_info/` - references and notes about the source code (repository links, version tags, architecture notes, dependency lists, build environment details)
- `data/` - input data used by the implementation, or references to where it can be obtained
- `results/` - generated outputs and reports produced by the implementation

## What belongs in `source_code_info/`

This folder is for information *about* the code, not the code itself. Typical contents:

- A link to the source repository and the specific commit or release tag used
- A brief description of the architecture and main components
- A list of dependencies and the runtime environment (language version, OS, hardware)
- Instructions for accessing or cloning the repository
- Any known limitations or configuration notes

## Maintenance

Keep references in `source_code_info/` up to date whenever the codebase changes in a way
that affects reproducibility. Large or sensitive data should not be committed (see
`.gitignore`). Commit messages should be clear and meaningful.
