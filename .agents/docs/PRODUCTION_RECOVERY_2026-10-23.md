# Production Recovery — October 23, 2026

## Verified State

The production health endpoint returned HTTP 502 before this work. Deployment `80658ad4-d720-401b-bcb6-d7817c42d8f6`, for commit `eae426c3a2df3e8d256520698e9f55be6e098c92`, built its Docker image successfully and then crashed in `load_private_bundle`. The original exception wrapper concealed the failing storage or validation stage. No source passages or credentials were printed during this investigation.

The local private bundle matches the original documented release checksum and passes the current schema and semantic validation. This does not establish that the deployed variables still select that release. OAuth reads expose variable names but withhold values; the local Railway API token is unauthorized.

## Diagnostic Revision

Commit `940813d0f249450f6f4c588ea6c80fa4d401faff` was pushed from an isolated clean worktree. It adds fixed stage/code diagnostics for configuration, storage access, object reading, checksum, schema and semantic failures, retaining checksum enforcement, bounded reads, stream closure and exception sanitization. Only the diagnostics, fixture tests and a narrow changelog entry were included.

Verification: 162 backend tests passed and two were skipped in the clean tree; public-tree checks and strict MkDocs compilation passed. [GitHub application checks passed](https://github.com/ColinConwell/Man-of-La-Machina/actions/runs/40009895613). Railway deployment `6db989cd-1dc3-43da-9e51-78ce2256592b` failed at BUILD_IMAGE before producing Docker or application logs; its only build line announced the builder. That failed build did not exercise the new runtime diagnostics. The later successful deployment includes them, but no diagnostic failure was triggered.

## Platform Recovery Evidence

[Railway status](https://status.railway.com) and its [bucket and GitHub recovery guide](https://blog.railway.com/p/security-disclosure-recommendation-redeploy-buckets-and-reconnect-github-after-the-credential-reset) report that the October 21 incident invalidated all bucket credentials and GitHub connection tokens. The existing private-transcripts bucket reports a credential issue time of October 21, 2026, at 22:45:02 UTC, matching the reset. Its name, objects and endpoint are unchanged according to the vendor. Stale copied credentials are therefore a plausible cause of the original startup failure, but this is an inference because deployed values and the original exception were unavailable.

The production service's two content credential variables were updated to references to the same bucket's ACCESS_KEY_ID and SECRET_ACCESS_KEY. No credentials were rotated, exposed, copied locally or written to Git; no objects, release keys or checksums were changed. Deployment was initially skipped. The subsequent successful fresh deployment applied these references and loaded the private bundle successfully.

[Railway's October 23 recovery guide](https://blog.railway.com/p/security-disclosure-recommendation-recover-failing-deploys) requires the repository owner's GitHub account to reconnect after the reset. The connector cannot perform that account OAuth reconnection, and no browser was available to the diagnosis subagent. The user then confirmed that they had reconnected GitHub. The service source was reconnected to the same repository and main branch, producing a fresh build rather than reusing the failed image.

## Approval Boundary

Automatic approval review rejected blindly redeploying the failed image: it had never completed image construction and the retry did not contain an evidenced repair. No equivalent retry or workaround was performed. The subsequent credential-reference update followed new, verified vendor recovery guidance and did not deploy.

## Verified Recovery

At approximately 15:28 America/New_York on October 23, fresh deployment `dfd69788-8d6b-4266-bae0-b1a1a36a1cf9` reached SUCCESS. Railway confirmed its source commit was `940813d0f249450f6f4c588ea6c80fa4d401faff`; runtime logs reported application startup complete and Uvicorn listening on port 8000. The build produced image digest `sha256:9d0846ca43045c4869878c884b8c2889df475f6cd6b78738675387f2bfcde78d`.

Both apex and www health endpoints returned HTTP 200 with status ok; the apex homepage returned HTTP 200. The environment file, raw bundle, curator review, OpenAPI and design-preview paths all returned HTTP 404.

A live Playwright smoke verified the exact production domain at 1440 × 1000 and 390 × 844. It loaded three beginnings, selected the first beginning, verified nonempty recorded text without printing it, and revealed the recorded continuation, increasing visible recorded messages from one to six. It selected Archive, Western Gothic and Context Lab and verified the applied theme state. The mobile view had no horizontal overflow. No page errors, console errors, alert elements or generation/provider requests occurred. Screenshots masked private passages, source details and context panels; the temporary evidence directory remains outside the repository. No private screenshots or source text were committed.

The successful deployment after current bucket references and GitHub reconnection verifies operational recovery. It does not retroactively reveal the old wrapped exception: stale copied bucket credentials remain the supported explanation for the original runtime failure, while the pre-build failure disappeared after the confirmed GitHub reconnection. No content pin, object, schema, semantic-validation rule or stored source was changed.

Live paid model generation, functional read-aloud and full production browser regression coverage were not exercised in this repair. The browser check covered restored reading and theme selection, not the separate planned redesign.

