# Choose where a visit begins

Visitors enter the archive at curated beginnings. **Annotate + Demarcate** is a small local tool for choosing them. It needs the private archive and never runs on the hosted site.

## 1. Start the tool

```sh
just curate
```

Open the address it prints, by default **http://127.0.0.1:8001**.

## 2. Pick a candidate

The tool lists one candidate per conversation. Select one, browse or search its source conversation, and choose **Begin at This Turn** to move its boundary. You can add further candidates at any turn.

**Preview in App** shows the source as the experience will display it, with private name aliases applied.

## 3. Describe it

Give each beginning a public title and description. A separate private annotation is for your own notes; it never reaches visitors or the model.

Choose which candidates the experience offers, then save.

## 4. See it in the experience

Restart the experience server (`just api` or `just explore`). The new beginnings appear on the landing view.

Saves go to `content/curation/beginnings.local.json`, which Git ignores. If someone else saved in the meantime, the tool refuses to overwrite their work; reload and try again.
