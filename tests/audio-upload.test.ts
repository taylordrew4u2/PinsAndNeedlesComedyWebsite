import { test } from "node:test";
import assert from "node:assert/strict";
import { AUDIO_ACCEPT, AUDIO_EXTENSIONS, audioTypeOf, audioUploadName, uploadedFileName } from "../src/lib/audio-upload.ts";

test("common sound files are taken, under their standard type, however the browser spells it", () => {
  assert.equal(audioTypeOf("audio/mpeg", "sting.mp3"), "audio/mpeg");
  assert.equal(audioTypeOf("audio/mp3", "sting.mp3"), "audio/mpeg");
  assert.equal(audioTypeOf("audio/x-m4a", "sting.m4a"), "audio/mp4");
  assert.equal(audioTypeOf("audio/mp4", "sting.mp4"), "audio/mp4");
  assert.equal(audioTypeOf("audio/x-wav", "sting.wav"), "audio/wav");
  assert.equal(audioTypeOf("audio/wave", "sting.wav"), "audio/wav");
  assert.equal(audioTypeOf("audio/ogg; codecs=opus", "sting.ogg"), "audio/ogg");
  assert.equal(audioTypeOf("audio/webm", "sting.webm"), "audio/webm");
  assert.equal(audioTypeOf("audio/aac", "sting.aac"), "audio/aac");
});

test("a file with no type is judged by its extension; anything else that is not a sound is refused", () => {
  assert.equal(audioTypeOf("", "Voice Memo.M4A"), "audio/mp4");
  assert.equal(audioTypeOf("application/octet-stream", "horn.mp3"), "audio/mpeg");
  assert.equal(audioTypeOf("", "notes.txt"), null);
  assert.equal(audioTypeOf("", "noextension"), null);
  assert.equal(audioTypeOf("image/png", "sting.mp3"), null);
  assert.equal(audioTypeOf("video/mp4", "clip.mp4"), null);
  assert.equal(audioTypeOf("audio/midi", "tune.mid"), null);
});

test("a sound is stored under an extension that is served as audio", () => {
  assert.equal(audioUploadName("horn.mp3", "audio/mpeg"), "horn.mp3");
  assert.equal(audioUploadName("Voice Memo.M4A", "audio/mp4"), "Voice Memo.M4A");
  assert.equal(audioUploadName("clip.mp4", "audio/mp4"), "clip.m4a");
  assert.equal(audioUploadName("take.webm", "audio/webm"), "take.weba");
  assert.equal(audioUploadName("recording", "audio/wav"), "recording.wav");
  assert.equal(audioUploadName("odd.mp3", "audio/ogg"), "odd.ogg");
  for (const [extension, type] of Object.entries(AUDIO_EXTENSIONS)) {
    assert.equal(AUDIO_EXTENSIONS[audioUploadName("x", type).split(".").pop()!], type, extension);
  }
});

test("the file picker offers every sound type and extension", () => {
  for (const entry of ["audio/mpeg", "audio/x-m4a", "audio/wav", "audio/ogg", "audio/webm", "audio/aac", ".mp3", ".m4a", ".wav"]) {
    assert.ok(AUDIO_ACCEPT.split(",").includes(entry), entry);
  }
});

test("an uploaded sound shows under the name the host gave it", () => {
  assert.equal(uploadedFileName("/uploads/mf3k2a1b-x9y8z7-air-horn.mp3"), "air-horn.mp3");
  assert.equal(uploadedFileName("/api/media/mf3k2a1b-x9y8z7-My-Sting.m4a"), "My-Sting.m4a");
  assert.equal(uploadedFileName("https://store.public.blob.vercel-storage.com/uploads/mf3k2a1b-x9y8-gong.wav?download=1"), "gong.wav");
  assert.equal(uploadedFileName("https://example.com/sounds/air-horn-loud.mp3"), "air-horn-loud.mp3");
  assert.equal(uploadedFileName("/uploads/caf%C3%A9.mp3"), "café.mp3");
  assert.equal(uploadedFileName(""), "your sound");
});
