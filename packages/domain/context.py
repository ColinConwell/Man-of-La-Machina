"""Pure, deterministic context selection; disclosure is distinct from occurrence."""

from packages.domain.models import (
    Bundle,
    ContextOptions,
    GenerationSettings,
    BranchMessage,
    Manifest,
    ManifestItem,
    digest,
)


# A conservative byte bound is deliberately explicit; it never pretends to be a provider tokenizer.
def tokens(body: str) -> int:
    return len(body.encode("utf-8")) + 6


def build_context(
    bundle: Bundle,
    entry_id: str,
    options: ContextOptions,
    settings: GenerationSettings,
    prior: list[BranchMessage],
    text: str,
) -> Manifest:
    by_id = {m.id: m for m in bundle.messages}
    cutoff = by_id[entry_id]
    policy = bundle.profile.policy
    threads = {t.id: t for t in bundle.threads}
    current_thread = threads[cutoff.thread_id]
    if options.replace_cutoff and cutoff.speaker != "human":
        raise ValueError("Only a recorded human turn can be replaced.")
    if set(options.excluded_ids) - by_id.keys():
        raise ValueError(
            "An excluded message ID does not exist in this content version."
        )
    eligible = [
        m
        for m in bundle.messages
        if m.ordinal <= cutoff.ordinal and m.speaker in ("human", "mirrows")
    ]
    exclusions = []
    history = []
    protected_id = cutoff.id
    if options.replace_cutoff:
        predecessors = [
            m
            for m in eligible
            if m.thread_id == cutoff.thread_id and m.ordinal < cutoff.ordinal
        ]
        protected_id = predecessors[-1].id if predecessors else ""
    for m in eligible:
        reason = None
        if options.replace_cutoff and m.id == cutoff.id:
            reason = "replaced by visitor"
        elif (
            options.context_mode == "begin_context_here" and m.ordinal < cutoff.ordinal
        ):
            reason = "context begins at entry"
        elif m.disclosed_at is None:
            reason = "disclosure unknown"
        elif cutoff.disclosed_at is None or m.disclosed_at > cutoff.disclosed_at:
            reason = "later disclosure"
        elif options.breadth in ("scene", "thread") and m.thread_id != cutoff.thread_id:
            reason = "outside breadth"
        elif (
            options.breadth == "chapter"
            and threads[m.thread_id].chapter_code[0] != current_thread.chapter_code[0]
        ):
            reason = "outside chapter"
        elif (
            options.breadth == "scene"
            and m.ordinal < cutoff.ordinal - policy.scene_messages + 1
        ):
            reason = "outside scene window"
        elif m.id != protected_id and (
            m.id in options.excluded_ids or set(m.tags) & set(options.excluded_tags)
        ):
            reason = "visitor withheld"
        if reason:
            exclusions.append({"id": m.id, "reason": reason})
            continue
        protected = m.id == protected_id
        history.append(
            ManifestItem(
                id=m.id,
                source_id=m.provenance.source_id,
                source_version=m.content_hash,
                role="user" if m.speaker == "human" else "assistant",
                origin="historical",
                body=m.body,
                position=0,
                token_estimate=tokens(m.body),
                reason="protected local turn"
                if protected
                else f"{options.breadth} history",
                protected=protected,
                disclosed_at=m.disclosed_at,
                disclosed_end_at=m.disclosed_end_at,
                locator=m.provenance.locator,
                tags=m.tags,
            )
        )
    docs = []
    eligible_ids = {m.id for m in eligible}
    included_ids = {m.id for m in history}
    for d in bundle.documents:
        reason = None
        if d.origin == "annotation":
            reason = "retrospective annotation; documentary viewing only"
        elif d.origin == "summary" and not options.include_summaries:
            reason = "summaries disabled"
        elif d.origin == "document" and not options.include_documents:
            reason = "documents disabled"
        elif options.context_mode == "begin_context_here":
            reason = "context begins at entry"
        elif (
            not d.disclosed_at
            or not cutoff.disclosed_at
            or d.disclosed_at > cutoff.disclosed_at
        ):
            reason = "later or unknown disclosure"
        elif (
            d.disclosed_in_message_id and d.disclosed_in_message_id not in eligible_ids
        ):
            reason = "not disclosed by this boundary"
        elif not d.disclosed_in_message_id and d.disclosed_at == cutoff.disclosed_at:
            reason = "same-day order unresolved"
        elif d.based_on_ids and not set(d.based_on_ids).issubset(included_ids):
            reason = "summary dependencies excluded"
        elif set(d.tags) & set(options.excluded_tags):
            reason = "visitor withheld"
        if reason:
            exclusions.append({"id": d.id, "reason": reason})
        else:
            docs.append(
                ManifestItem(
                    id=d.id,
                    source_id=d.provenance.source_id,
                    source_version=d.content_hash,
                    role="user",
                    origin=d.origin,
                    body=f"[{d.origin}: {d.title}]\n{d.body}",
                    position=0,
                    token_estimate=tokens(f"[{d.origin}: {d.title}]\n{d.body}"),
                    reason="eligible disclosed material",
                    disclosed_at=d.disclosed_at,
                    locator=d.provenance.locator,
                    tags=d.tags,
                )
            )
    framing = ManifestItem(
        id="system-framing",
        source_id=policy.id,
        source_version=str(policy.version),
        role="system",
        origin="instruction",
        body=policy.system_framing,
        position=0,
        token_estimate=tokens(policy.system_framing),
        reason="protected system framing",
        protected=True,
    )
    branch_items = [
        ManifestItem(
            id=m.id,
            source_id=m.id,
            source_version=digest(m.body),
            role="user" if m.speaker == "visitor" else "assistant",
            origin=m.origin,
            body=m.body,
            position=0,
            token_estimate=tokens(m.body),
            reason="prior branch turn",
            protected=True,
        )
        for m in prior
    ]
    if text.strip():
        branch_items.append(
            ManifestItem(
                id="visitor-current",
                source_id="visitor-current",
                source_version=digest(text.strip()),
                role="user",
                origin="visitor",
                body=text.strip(),
                position=0,
                token_estimate=tokens(text.strip()),
                reason="current intervention",
                protected=True,
            )
        )
    items = [framing] + docs + history + branch_items
    # Drop oldest optional context first. Never silently clip exact protected or visitor turns.
    while sum(i.token_estimate for i in items) > policy.max_input_tokens:
        idx = next((n for n, i in enumerate(items) if not i.protected), None)
        if idx is None:
            raise ValueError(
                "The protected conversation exceeds the context budget. Shorten your turn or restart at another boundary."
            )
        removed = items.pop(idx)
        exclusions.append(
            {"id": removed.id, "reason": "token budget; oldest optional item removed"}
        )
    ordered = tuple(
        item.model_copy(update={"position": i}) for i, item in enumerate(items)
    )
    payload = dict(
        content_version=bundle.content_version,
        entry_message_id=entry_id,
        policy_id=policy.id,
        policy_version=policy.version,
        profile_id=bundle.profile.id,
        profile_version=bundle.profile.version,
        settings=settings,
        options=options,
        items=ordered,
        exclusions=tuple(exclusions),
        token_estimate=sum(i.token_estimate for i in ordered),
        max_input_tokens=policy.max_input_tokens,
    )
    serial = {
        k: (
            [i.model_dump(mode="json") for i in v]
            if k == "items"
            else v.model_dump(mode="json")
            if hasattr(v, "model_dump")
            else v
        )
        for k, v in payload.items()
    }
    receipt_hash = digest(serial)
    return Manifest(id="manifest-" + receipt_hash, hash=receipt_hash, **payload)
