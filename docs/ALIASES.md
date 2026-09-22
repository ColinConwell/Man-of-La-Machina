# Private personal-name aliases

The application creates an aliased projection of its private archive before serving it or constructing model context. Original source documents and the pinned storage object remain unchanged. The substitution engine is application code; actual names, aliases, spelling variants, and contextual rules belong only in private configuration.

## Edit locally

Edit `content/curation/aliases.local.json`, then restart the API. This file is ignored by Git and excluded from Docker, Railway uploads, and Python source distributions. It is never a web asset. `MACHINA_ALIASES_FILE` can select a different private file.

The JSON has these fields:

- `version`: currently `1`.
- `people`: a list of objects containing `names` (all known names, surnames, nicknames, and misspellings), `alias` (the replacement label), and `role` (`participant` for exactly one person, otherwise `other`). The participant's alias also supplies the historical speaker label.
- `contextual`: a dictionary of identifying phrases and their fully aliased replacements. Use this when a contact's name is also a common word. Include enough surrounding words to distinguish personal references.
- `preserve`: phrases to retain verbatim, such as a cultural reference that shares a contact's name. Longer matching phrases take precedence over shorter names.

Matching is case-insensitive, respects word boundaries and possessives, and handles bounded whitespace between parts of a full name. Replacement labels use the configured spelling and case. Rules are applied together, so one replacement does not cascade into another. Configuration rejects duplicate rules and replacement labels containing names that would themselves need substitution.

The initial private mapping covers personal contacts and observed variants. Cultural references remain intact. This is an editable curation mechanism, not automatic discovery of every person: review new material for additional names, ambiguous references, and misspellings before publishing a content update.

## Edit on Railway

The web service's private variable `MACHINA_ALIASES_JSON` contains the same JSON configuration. Edit that variable and redeploy the service. It takes precedence over a local file. No archive rebuild, upload, GitHub push, or frontend rebuild is needed for an alias-only update.

The local file and Railway variable are independent copies. To transfer edits, copy the complete JSON directly between these private locations; never put it in an issue, commit, build argument, `VITE_` variable, or CI secret used to generate browser assets. The application has no alias-management or configuration-download endpoint.

Hosted startup fails if the alias configuration is missing or invalid, and errors do not print its contents. Redeployment also clears existing ephemeral branches and receipts, so sessions do not mix alias versions.

## What is covered

About and Essay use the same aliases at the server boundary. Their source files and TeX name-macro mapping remain private; see [editorial readings](EDITORIAL.md). Changes to a name in the shared alias configuration apply to these readings after restarting the service, without rebuilding the essay. HTML replacements are escaped, and citation targets remain linked.

Substitution covers transcript text, source filenames and credits, annotations, titles, accessibility descriptions, profile text, search results, and model context. Human speakers use a generic role identifier. Visitor input is aliased before it enters context or saved branch messages. Provider output passes through a streaming filter that retains enough lookahead to handle names split across chunks; interrupted name fragments are withheld. Provider metadata and displayed errors are also filtered.

Message hashes and the served content version describe the aliased projection. Context and transport receipts describe the material actually sent to the provider. Exports contain aliased material, with no reverse mapping. The original source hashes still identify the private documentary files.

Alias labels are necessarily visible in the experience; the original-to-alias mapping is never sent to visitors. The Git guard also rejects alias-shaped JSON accidentally staged under another filename. Tests use invented identities and never load the actual local mapping.

## Generated Events and Saved Experiments

The event timeline and independent results dashboard apply the same configured aliases when serving generated text, evidence, prompts, context, reviews, native request displays, and downloads. The dashboard loads the same server environment and private alias configuration as the main app. Experiment instructions no longer introduce the participant's original name into otherwise aliased context.

Saved experiment receipts and timeline assets remain immutable on disk. When display substitution changes an artifact, the response includes `display_projection` metadata. Existing source, manifest, and payload hashes identify the original saved records; a changed native payload also receives `display_payload_hash` for its projected display. Dashboard previews label this distinction. Browser downloads contain the alias projection, never a raw-file bypass. For byte-for-byte historical request audits, use the private on-disk receipts with the existing audit scripts.
