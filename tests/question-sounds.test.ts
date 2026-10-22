import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { DEFAULT_SOUND, QUESTION_SOUNDS, SOUND_GROUPS, isSoundId, soundFile } from "../src/lib/question-sounds.ts";

const folder = new URL("../public/sounds/question/", import.meta.url);

test("every sound has its recording, small enough to load fast on venue wifi, and a credit", () => {
  const credits = readFileSync(new URL("CREDITS.txt", folder), "utf8");
  for (const { id } of QUESTION_SOUNDS) {
    const file = new URL(`${id}.mp3`, folder);
    assert.ok(existsSync(file), `${id}.mp3`);
    assert.ok(statSync(file).size < 150_000, `${id}.mp3 is small`);
    assert.match(credits, new RegExp(`^${id}\\.mp3 .*freesound\\.org.*CC0`, "m"), `${id} is credited`);
    assert.equal(soundFile(id), `/sounds/question/${id}.mp3`);
  }
  const files = readdirSync(folder).filter((name) => name.endsWith(".mp3"));
  assert.deepEqual(files.sort(), QUESTION_SOUNDS.map(({ id }) => `${id}.mp3`).sort(), "no recording left over");
});

test("each sound has one id, a name, a line and a group the list shows", () => {
  assert.equal(new Set(QUESTION_SOUNDS.map(({ id }) => id)).size, QUESTION_SOUNDS.length);
  for (const { label, emoji, blurb, group } of QUESTION_SOUNDS) {
    assert.ok(label && emoji && blurb, label);
    assert.ok(SOUND_GROUPS.includes(group), group);
  }
  for (const group of SOUND_GROUPS) assert.ok(QUESTION_SOUNDS.some((sound) => sound.group === group), group);
  assert.ok(isSoundId(DEFAULT_SOUND));
  for (const junk of ["custom", "doom", "", "../ooh", null, 3]) assert.equal(isSoundId(junk), false, String(junk));
});
