# Bad Decisions intro score

`bad-decisions-score.mp3` is an original procedural composition for this
project: a 120 BPM breakbeat, warm bass, and minor-key organ stabs. All
instruments and percussion are synthesized by the included generator; it
contains no third-party samples or recordings.

Regenerate with Python 3, NumPy, and FFmpeg:

```sh
python scripts/generate-intro-score.py
```

The generator reads `EXPLAINER_STEPS` from `src/lib/explainer.ts`. The current
arrangement is 27.4 seconds (the MP3 container includes 28.6ms of encoder
padding). It lowers the music for “When you hear this…”, leaves 13.2–16.4s
silent for the host's actual chosen question sting, returns quietly under the
example, then brings the groove back for the closing QR screen and fades out.
The soundtrack does not include that question sting; the live screen plays
it separately using the host's selection and volume.

The checked-in MP3 is stereo, 44.1 kHz, 192 kbit/s. FFmpeg loudness measurement
on the decoded file: **−23.3 LUFS integrated, −8.55 dBTP**. The deliberate duck
and cue silence give it a wider loudness range than an uninterrupted song.
