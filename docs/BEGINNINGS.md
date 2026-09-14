# Beginning candidates and local annotations

The backend creates one candidate per conversation (17 for the current archive). The selected beginnings are April 1, **Rain in Spain · May 8**, and **Naming Mirrows · May 10**. Rain in Spain now starts on the companion's second recorded turn, before the participant's reply. Existing links to other individual turns still resolve to those turns.

Candidates reference stable message IDs; they contain no copied transcript. The backend validates every boundary and projects only selected public titles, descriptions, context modes, and entry IDs into `/api/v1/experience`. Private annotations never enter that response, model context, or the content-version hash. Anchor boundaries and beginning boundaries update together.

## Annotate locally

With the private normalized archive already available:

```sh
just curate
# Or: .venv/bin/python -m tools.curator
```

Open **http://127.0.0.1:8001/**. Select a candidate, browse or search its source conversation, and choose **Begin at This Turn**. Add further candidates at arbitrary source turns. Edit the public title/description and a separate private annotation, choose which candidates to offer, then save.

**Annotate + Demarcate • Local Development** includes a paragraph-ordered, pseudonymized **Preview in App**. **Reveal in Finder** and **Open Original** act on the archived DOCX on macOS. Original files are opened by the native application; the local server does not expose a raw-document download. Unknown IDs, paths outside the source directory, and foreign-origin requests are rejected. A preview warns if the file changed since import.

Saves go to `content/curation/beginnings.local.json`, which is ignored by Git. The tool writes atomically with owner-only permissions and rejects stale saves rather than overwriting concurrent edits. Reload to resolve a save conflict. Source text is displayed with the same private aliases as the main experience.

Restart the local experience API after saving. The annotation process binds only to loopback, rejects remote clients and foreign origins, and requires a per-process token for its API. It cannot start in hosted mode. Its source is under `tools/curator/`, outside the Docker build allowlist and Python distribution; none of its routes are mounted by the experience API.

## Server configuration

The server uses the same backend defaults until explicitly configured otherwise. To apply an edited catalog on Railway, set the private service variable `MACHINA_BEGINNINGS_JSON` to the contents of the ignored file and redeploy. Alternatively, set `MACHINA_BEGINNINGS_FILE` to a private file provisioned on the server. Do not put the catalog in Git, a frontend environment variable, or a static asset directory.

Precedence is `MACHINA_BEGINNINGS_JSON`, then `MACHINA_BEGINNINGS_FILE`, then the local ignored file, then the backend defaults. An explicit `MACHINA_PROFILE` still overrides the resulting experience profile. Editing locally does not publish anything automatically. An invalid catalog fails validation at startup; correct it or remove the override to restore backend defaults.

Only fields labelled public are eligible for website display. Candidate lists and private notes remain behind the backend boundary. As with the transcript, the local alias mechanism is applied before any selected metadata is served.

## Context controls and regression checks

Changing breadth or retained material automatically rebuilds a context preview, without creating a visitor branch or calling a model. The workbench reports the number of eligible historical turns and the number that fit. Scene and Thread coincide near a conversation's beginning. Chapter and Journey can also coincide after the oldest optional turns are removed by the context budget; that limitation is now visible. **Preview context** opens the exact receipt, including exclusions. Stale requests cannot replace a newer preview.

```sh
.venv/bin/python -m pytest -q
just check-controls
```

The browser regression command builds the frontend and starts two temporary servers with invented conversations. It verifies all beginnings, exact context changes for all breadths, preview/generation agreement, rapid changes, failed-preview recovery, tags, context modes, keyboard/mobile interaction, and local annotation saves. GitHub Actions runs it on pushes and pull requests without access to the private archive. `just check-browser` remains the full-archive exploration suite and requires the local API and frontend to be running.
