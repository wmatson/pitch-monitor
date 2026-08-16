# Pitchline

A static, browser-local vocal pitch monitor. Sing into the microphone and follow the purple correction arrow on the VexFlow grand staff.

## Local development

```bash
npm install
npm run dev
```

Open the printed local URL. Microphone access requires a secure context (localhost is allowed; GitHub Pages is HTTPS). On desktop, plain staff clicks play the written note; Shift-click raises it by a semitone and Alt/Option-click lowers it by a semitone. Mobile modifier playback is best-effort.

## Verification and build

```bash
npm test
npm run build
npm run preview
```

The production output is `dist/` and is built with `base: './'`, so it works beneath a GitHub repository subpath.

## GitHub Pages

`.github/workflows/pages.yml` runs tests, builds the static site, uploads `dist/`, and deploys it with the GitHub Pages environment. In the repository settings, set Pages → Build and deployment → Source to **GitHub Actions**. Push to `main` to deploy.

## Musical assumptions

- Equal temperament with A4 = 440 Hz.
- The key controls select major keys from C through seven sharps or seven flats.
- Enharmonic spelling prefers sharp accidentals in sharp keys and flat accidentals in flat keys; chromatic naturals are used to cancel a key-signature alteration.
- The staff uses treble and bass notation with conventional ledger-line extension. The trace keeps continuous cents-level measurements while its color and annotations are recomputed from the current key.
- Audio is processed in the browser. Pitchy handles McLeod pitch detection; smplr supplies sampled piano playback.
