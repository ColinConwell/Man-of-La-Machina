# 001 — Conversation Memory and Context as an Intervention

Research date: September 14, 2026. Historical focus: the archive’s currently assigned April 1–May 19, 2026 interval. These dates are curatorial metadata, not independently verified service telemetry. Scope: consumer Microsoft Copilot first, then other conversational products, developer interfaces, and research. This report contains no private transcript excerpts.

## Finding

The history visible to a person, the information retained by an application, and the input received by a model are different things. A transcript alone cannot establish what a commercial assistant remembered at a particular turn. The prototype should therefore treat memory construction as an explicit experimental choice. It should not label any proposed summary policy “the original Copilot memory.”

## 1. What We Can Establish About Consumer Copilot

Microsoft announced personalized memory for consumer Copilot on April 4, 2025. Its examples concern remembering preferences and other useful personal details, with user control. This predates the archive’s assigned interval and establishes that memory was a product capability by then. It does **not** establish the participant’s account eligibility, settings, rollout cohort, or the contents of memory during a particular exchange. [Microsoft, “Your AI Companion,” April 4, 2025](https://blogs.microsoft.com/blog/2025/04/04/your-ai-companion/).

Microsoft’s consumer privacy-controls page is unusually useful for historical interpretation: it explicitly identifies itself as documentation for the older Copilot version and dates the updated experience to August 18, 2026, after the archive interval. It describes personalization memory separately from model-training controls. Users can ask what Copilot knows about them and request remembering or forgetting. Turning personalization off removes remembered information while leaving conversation history available; switching it back on begins collecting new memories. These are product-level operations, not a disclosed algorithm for assembling each prompt. [Microsoft, Copilot Privacy Controls, accessed September 14, 2026](https://support.microsoft.com/en-us/microsoft-copilot/microsoft-copilot-privacy-controls).

The consumer privacy FAQ describes saved conversation history with an 18-month default retention period and the ability to return to previous conversations. Storage duration does not establish that all stored text is sent to the model. This documentation explicitly distinguishes personal-account Copilot from work/school Microsoft 365 Copilot. [Microsoft, Privacy FAQ for Microsoft Copilot](https://support.microsoft.com/en-us/Microsoft-Copilot/privacy-faq-for-microsoft-copilot).

### Evidence Boundaries

| Question | What the available primary documentation supports |
| --- | --- |
| Could Copilot remember information across conversations in this period? | Yes, as an announced consumer feature; actual use by this account remains unknown. |
| Could a person reopen an old conversation? | Yes; this establishes history persistence, not full replay into inference. |
| Was the complete conversation supplied on each turn? | Not established. |
| Was a rolling summary produced, and at what threshold? | Not established for these consumer conversations. |
| What did a summary preserve, omit, or reinterpret? | Not recoverable from the transcript alone. |
| Which model, context-window size, hidden instructions, retrieval system, and product experiments applied? | Not established by the reviewed sources or the archive. |

Avoid substituting documentation for another product. Microsoft 365 Copilot announced its own memory rollout in July 2025; that announcement concerns a work assistant and does not disclose the consumer assistant’s internals. Likewise, GitHub Copilot and Copilot Studio are different interfaces with different context-management controls. [Microsoft 365 Copilot Memory announcement](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/introducing-copilot-memory-a-more-productive-and-personalized-ai-for-the-way-you/4432059).

If historical reconstruction becomes a research goal, request contemporaneous account settings, exports, screenshots of memory, product version/platform, and any available model labels. Record missing evidence as unknown. Even a later answer to “what do you remember?” would be an output of the later system, not a faithful dump of its earlier prompt.

## 2. A Vocabulary for Memory

This taxonomy is a design synthesis, not a claim that every vendor implements each layer.

| Layer | What it does | What changing it would test |
| --- | --- | --- |
| Model parameters | Encode learned statistical structure from training. | Different underlying models or training; not ordinary per-conversation remembering. |
| Working context | Supplies messages, instructions, documents, and tool results to a particular inference. | Which evidence is available now, in what order and role. |
| Chat archive | Persists a human-readable record. | Availability for later inspection or retrieval; storage alone does not ensure recall. |
| Summary or compaction | Replaces some detail with a shorter representation. | Which facts, interpretations, uncertainty, and voices survive compression. |
| Retrieved episodic memory | Selects relevant earlier passages or events. | Search scope, relevance criteria, recency, and missing connections. |
| Profile or semantic memory | Stores extracted preferences, facts, or evolving descriptions. | What becomes a durable claim about the person. |
| Notes and project memory | Persists task-specific state outside a request. | Scope, isolation, correction, and contamination across activities. |
| Prompt/KV caching | Reuses processing of context. | Primarily computational reuse; it should not be presented as a user-editable autobiographical memory policy. |

An API can expose stateful convenience features while the application remains responsible for choosing the relevant history. OpenAI documents manually passing prior messages, durable conversation objects, and response chaining; it also distinguishes persistence from the finite context window. These API facilities do not automatically reproduce ChatGPT’s personalization. [OpenAI, Conversation State](https://developers.openai.com/api/docs/guides/conversation-state).

## 3. Comparison Across Interfaces and Time

| Interface | Historically documented behavior | Later/current evidence and implications |
| --- | --- | --- |
| Consumer Copilot | Memory announced April 2025; pre-August-2026 controls distinguish personalization from history. | The September 2026 documentation warns about the August version change. Exact per-turn assembly remains undisclosed in the reviewed material. See the consumer sources above. |
| ChatGPT | February 2024 announcement introduced remembered information; April 10, 2025 update distinguished saved memories and reference to chat history; June 2025 expanded lighter continuity to free users. Deleting a chat and deleting a saved memory were separate operations. | The current FAQ describes an evolving memory synthesis whose visible summary is not exhaustive, including information from chats, files, and connected apps. Do not project this current description backward unchanged. [Dated announcement and updates](https://openai.com/index/memory-and-new-controls-for-chatgpt/), [current Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq). |
| Claude | September 11, 2025 announcement described editable memory summaries for Team/Enterprise and separate project memories; an October 23 update expanded availability to Pro/Max. | July 10, 2026 release notes explicitly say categorized entries replaced the daily summary; August 25 adds editable topics and wider integration. This is a concrete example of a memory architecture changing after the archive interval. [Claude memory announcement](https://claude.com/blog/memory), [dated release notes](https://support.claude.com/en/articles/12138966-release-notes). |
| Gemini app | February 13, 2025 announced reference to earlier chats for eligible Advanced users, initially in English. | August 13, 2025 broadened personalization from past chats and announced Temporary Chats. Availability and settings matter; app personalization should not be inferred from the model’s advertised context size. [February announcement](https://blog.google/feed/gemini-referencing-past-chats/), [August announcement](https://blog.google/products-and-platforms/products/gemini/temporary-chats-privacy-controls/). |

Provider APIs offer additional implementation choices. OpenAI now documents automatic threshold-based compaction and an explicit compact endpoint. Their existence is useful for a provider-specific adapter, but is not evidence of historical consumer Copilot behavior. [OpenAI conversation-state guide, Compaction section](https://developers.openai.com/api/docs/guides/conversation-state#compaction).

Anthropic’s September 2025 engineering article describes compaction, structured notes outside the active context, and selective retrieval as different strategies. It emphasizes the tradeoff between retaining useful detail and overcrowding the input. Its Claude Code examples describe that particular agent, not all Claude interfaces or Copilot. A model-agnostic prototype can make the representation explicit while permitting provider-specific mechanisms as separately labeled alternatives. [Anthropic, Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents).

## 4. What Research Adds

MemGPT proposed moving information between memory tiers, borrowing an operating-system metaphor to work beyond a fixed context window. This supports separating stored material from currently active material; it does not prove that any particular consumer product uses MemGPT. [Packer et al., 2023/2024](https://arxiv.org/abs/2310.08560).

“Lost in the Middle” found position-dependent retrieval performance in the models and tasks studied, with relevant material in the middle often harder to use. The implication is to measure ordering and recall rather than assuming that fitting more text guarantees its effective use. It is not a universal performance estimate for every current model. [Liu et al., 2023](https://arxiv.org/abs/2307.03172).

LongMemEval separates information extraction, multi-session reasoning, temporal reasoning, updates, and abstention. Its indexing–retrieval–reading framework offers a useful evaluation structure: a response can fail because evidence was never stored, never retrieved, or misread after retrieval. Those failures require different remedies. [Wu et al., ICLR 2025](https://arxiv.org/abs/2410.10813).

## 5. What the Prototype Currently Does

Code inspection on September 14, 2026: [context builder](../packages/domain/context.py), [domain contracts](../packages/domain/models.py), and [context workbench](../apps/web/src/features/ContextWorkbench.tsx).

The prototype selects eligible messages through a cutoff, applies context breadth and inclusion controls, protects the local intervention turn, and removes older unprotected messages to fit a conservative budget. The budget uses an intentionally conservative UTF-8 byte bound, not each provider’s tokenizer. The summary option includes eligible **previously authored summary documents**. It does not generate a fresh summary of omitted history. Consequently, choosing a wider breadth can increase eligible history without changing the final included turns once the budget is reached.

This is transparent selection and truncation, not a reconstruction of the original assistant’s memory. Current generated continuations remain separate from the recorded archive. The record contains neither the original system prompt nor a verified snapshot of original memory.

## 6. Proposed Intervention: How the Past Is Represented

The following is a proposed next experiment, **not an implemented feature or a historical claim**. Retain the current verbatim baseline and introduce a separate **Memory Representation** control. Breadth answers “which past is eligible?”; representation answers “how is that past carried forward?”

| Policy | Representation | Principal tradeoff |
| --- | --- | --- |
| Recent verbatim | Existing bounded window of original turns. | Clear attribution; older details disappear. |
| Recent turns + extracts | Exact, attributed excerpts from eligible older turns. | Inspectable omissions; selection still shapes interpretation. |
| Recent turns + structured summary | A visible summary separating human statements, assistant interpretations, practical facts, unresolved questions, and uncertainty. | More coverage, with risks of distortion and false coherence. |
| Recent turns + edited memory | The same summary, editable before generation and explicitly labeled as an intervention. | Direct tests of a changed memory; it must never be mistaken for recorded evidence. |

Use one shared, inspectable representation across providers first. Automatic prose summarization introduces a second model and prompt into the experiment. Record both separately from the continuation model. Provider-native compaction may later be offered as an additional condition; opaque compressed state cannot offer the same claim-level inspection as an editable summary.

### Required Invariants Before Shipping

1. **Cutoff first.** Apply chronology, selected breadth, review permissions, and withheld groups before retrieval or summarization. A summary built from the full archive and merely hidden afterward can leak the future.
2. **Attribution survives.** Keep “the assistant suggested X” distinct from “the human believed X.” Preserve negation, revisions, dates, and unresolved contradictions. Repetition by the assistant must not manufacture corroboration.
3. **Every derived claim has dependencies.** Retain source message IDs and covered ranges. Removing a source group invalidates summaries that depend on it; stale cached summaries must not survive a policy change.
4. **Protect recent turns.** Budget recent verbatim context, derived memory, instructions, and output separately. Show actual included/omitted coverage; do not silently sacrifice the intervention turn to fit a summary.
5. **Expose the transformation.** Show summary text, provenance, edits, token/count estimate method, policy version, summarizer model, prompt hash, and generation time in the preview and export receipt. A saved summary is not proof of what a previous service saw.
6. **Preserve privacy and scope.** Pseudonymize before external summarization; isolate branch memories; never write generated memories back into the archive or another visitor’s session. Cache keys must include filtered source IDs, content and alias versions, cutoff, policy, and summarizer settings.
7. **Keep inspection and execution identical.** Use the same prepared memory object in the preview and provider payload. Reject stale previews after edits, with an actionable retry message.

### Evaluation Plan

Start with invented fixtures containing an early preference, a later correction, a negated claim, an assistant-only interpretation, an excluded personal disclosure, and a fact after the cutoff. Test the memory object and final provider payload for provenance, update handling, absence of withheld/future details, and isolation between branches. Assert semantic outcomes rather than just a selected button’s appearance.

Then compare continuations at the same cutoff, with the same intervention, provider/model settings, and input budget, varying only representation. Repeat trials when sampling cannot be fixed. Evaluate recall, attribution, temporal consistency, abstention when evidence is missing, sensitivity to corrections, and differences in framing. Keep memory quality and continuation quality as separate measurements. Human review should assess whether compression turns an uncertain, dialogic journey into an unjustifiably settled narrative.

The manuscript-level question is therefore tangible: if the companion carries forward a different account of the past, what futures become easier to say—and easier to follow? That is a research hypothesis for this prototype, not a conclusion about the original person or service.

## 7. Limits and Follow-Up

This is a targeted primary-source review, not a systematic literature review. Product pages change; dated announcements establish availability claims, while current support pages describe the experience at access time. No exact original context window, summary prompt, memory snapshot, or enabled setting was established. Further work should collect historical evidence where available and implement the smallest inspectable memory experiment above before adding autonomous long-term memory.
