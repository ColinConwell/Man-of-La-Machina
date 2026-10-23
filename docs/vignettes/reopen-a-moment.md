# Reopen a moment

This vignette follows one visit: entering the archive at a pause, deciding what the model may remember, and writing the next human turn.

Start the experience with `just explore`, or with [invented material](invented-material.md).

## 1. Choose a beginning

The experience offers three curated moments: **April 1**, the advice in **Rain in Spain** (May 8), and **Naming Mirrows** (May 10). Choose one. The transcript opens at that turn, with everything before it available to read.

To begin somewhere else, browse by thread, search the transcript, or move along the timeline. The timeline zooms from the whole journey down to single messages. Every turn has an **Enter here** action.

## 2. Decide what the model sees

Open **Context**. By default the model inherits the recent scene. Widen it to the thread, chapter, or whole journey, and the panel shows how many earlier turns fit the budget.

Withhold what you want the model not to know: a tagged group of turns, or individual messages. You can also replace the human turn at the cutoff instead of adding a new one.

## 3. Write the next turn

Write as the human participant. Before sending, **Preview context** shows the exact ordered material the model will receive, with a SHA-256 receipt.

**Generation settings** chooses the provider and model. **Demo** needs no credentials. The others (OpenAI, Anthropic, Gemini, xAI, OpenRouter, or a local server) read API keys from the server's `.env.local`; keys never reach the browser.

## 4. Read the continuation

The companion's reply streams in beside the recorded history, labeled as generated. Continue for up to five exchanges. Any generated turn can show its receipt, and **Compare** sets the branch against what was actually recorded.

## 5. Keep or discard it

**Export branch & receipts** saves the whole branch as JSON. **Reset** erases it. Branches live only in server memory and expire after two hours; nothing you write is stored on disk or in the browser.

Next: [Compare two contexts](compare-two-contexts.md) holds your turn fixed and varies only the past.
