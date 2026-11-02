# Experiment With Narration In Sound Studio

Sound Studio is a separate local workspace for trying voices, layered readings, and evolving effects. It shares the app's visual style and aliased reading content. It does not change the main app or Landscape Studio.

From the repository, prepare the studio once with `just sound-setup`, then launch it with `just sound`. Use `just sound-alignment` to install optional local word alignment. The launcher prints the available local address.

1. Open **Generate**. Paste text, import a text file, or browse the archive and essay. Review the exact narration text. Choose a provider and voice, or use an app baseline preset for Cedar or Marin.
2. Generate a take, or import a recording in **Library**. Existing review recordings can be copied into the studio there. Supply the text for imported audio before aligning it.
3. Add recordings to **Compose**. Duplicate layers, adjust gain and timing, and add effects in the right-hand rack. Open an effect's explanation to explore its mechanism and a starting experiment.
4. Add automation points, or analyze the text under **Text Features And Timing**, align the words, and map a sentence feature to a parameter. Sentiment and emotion labels are interpretations that you can edit.
5. Use **Play Layers**, **Dry**, and the effect enable switches to compare. Pitch shifting, time stretching, convolution, and aligned alternatives require a render before auditioning. Browser previews and saved renders can sound different; each effect explains its engines.
6. Choose **Render Mix** to produce saved audio. Listen in **Batches** or **Library**, inspect its measurements and receipt, and export WAV, FLAC, or MP3. **Save** stores a versioned project recipe; reopening the studio restores the last saved project.

For comparisons, add inputs and voice configurations to a batch, or vary one parameter. **Preview Batch** shows every job and the request and character totals before starting. Provider generation uses the configured provider account. Prices are shown only when a local estimate has been configured. Pausing holds pending jobs; cancelling cannot guarantee that a provider has stopped billing an in-flight request.

Audio stays local by default. Private S3 upload and download become available when the existing content-store credentials are configured on the server. **Manage Copies** separates local deletion, verified cache eviction, remote manifest deletion, and remote deletion of unshared audio. Referenced recordings are protected.

Listening review is still needed to judge intelligibility, emotional effect, and artistic quality. For setup details and limitations, see the [maintainer guide](https://github.com/colinconwell/Man-of-La-Machina/blob/main/.agents/docs/SOUND_STUDIO.md).
