// Fixture addresses; playwright.config.ts sets these ports before tests load.
export const explorationFixtureURL = `http://127.0.0.1:${process.env.MACHINA_EXPLORATION_FIXTURE_PORT}`;
export const curatorFixtureURL = `http://127.0.0.1:${process.env.MACHINA_CURATOR_FIXTURE_PORT}`;
