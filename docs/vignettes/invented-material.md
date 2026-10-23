# Try it with invented material

The repository ships a small invented archive for tests. It has the same shape as the real one (four chapters, three curated beginnings, an About page and an essay) but every line of it was written for testing. It is the quickest way to see the whole interface.

## 1. Build the frontend

```sh
npm run build --prefix apps/web
```

## 2. Start the fixture server

```sh
.venv/bin/python -m tests.exploration_fixture
```

The server logs its address, by default **http://127.0.0.1:8102**. Open it in a browser.

## 3. Look around

- The landing view offers the three beginnings. Pick one to enter the archive there.
- **About** and **Read the Essay** open the invented reading pages.
- Generation starts in **Demo** mode, a deterministic local stand-in for a model, so nothing is sent to a provider.

From here, follow [Reopen a moment](reopen-a-moment.md) or [Compare two contexts](compare-two-contexts.md). Both work on the invented archive.

## What is different from the real experience

The invented archive is tiny and its dialogue is placeholder text. Context budgets, tags, and timelines behave the same way, but there is less to withhold and fewer turns to navigate. Sessions still live only in server memory and vanish when you stop the server.
