# Compare two contexts

The project separates two kinds of intervention: a different next move, and a different inherited past. This vignette tests the second. You write one turn and send it twice, with the same model and settings, while withholding a little more history from one of the two.

## 1. Set up condition A

Enter the archive and arrange **Context** as in [Reopen a moment](reopen-a-moment.md). That selection is condition **A**.

## 2. Choose what B withholds

In the composer, switch to **Compare two contexts**. Choose what condition **B** also withholds: tagged groups that A still includes, or individual turns under **Turns**. The composer estimates how much B removes before you send anything.

## 3. Generate both replies

Write the turn and choose **Generate both replies**. The Branch tab shows your turn once, marked as held fixed, with the two replies side by side.

## 4. Read the difference

Each column has its own receipt (**Inspect receipt A** or **B**), item and token counts, and a short hash. The composition bar draws both contexts on one scale: the shared span lines up, A marks what B withheld, and B shows the gap.

Withholding frees budget, so B can admit older turns that A had to drop. Those are counted and drawn separately.

## Good to know

- A pair counts as one exchange toward the five-exchange limit.
- Neither reply joins the branch. Your next single turn continues from the branch as it was.
- If B would withhold nothing that A includes, the server refuses the pair.
- In Demo mode the deterministic reply changes when practical details are withheld, so you can try this without a provider key.
