KAISHI QUEST — ANDROID HTML APP

CONTENTS
- 1,500 vocabulary entries converted from the supplied Kaishi deck
- Original word/sentence audio and images
- Adaptive Anki-style scheduling
- Meaning, Japanese production, listening, reading and sentence activities
- Editable mnemonic introduction for every word
- Separate skill-strength tracking
- Offline Progressive Web App support
- Progress import/export
- Known-word mini-story practice

QUICKEST WAY TO RUN ON ANDROID
Opening index.html directly will not work because browsers block local JSON loading.
Serve the folder through any small local/static web server, or upload it to a static host.

OPTION A — HOST IT FREE
1. Extract Kaishi_Quest_Android_HTML_App.zip.
2. Upload the Kaishi_Quest folder to a static web host such as GitHub Pages, Netlify or Cloudflare Pages.
3. Open the resulting HTTPS address in Chrome on Android.
4. In Chrome, choose “Add to Home screen” or “Install app”.
5. Open every type of card at least once while online. Media is cached as it is used; the core app and deck data are cached immediately.

OPTION B — TEST ON A COMPUTER
1. Extract the ZIP.
2. Open a terminal inside the Kaishi_Quest folder.
3. Run: python -m http.server 8000
4. Visit: http://localhost:8000

PROGRESS
Progress is stored in the browser on that device. Use Settings > Export progress regularly. Import the JSON backup after clearing browser storage or moving devices.

MNEMONICS
The included mnemonics are safe starter prompts rather than fabricated kanji etymologies. Edit them inside each word to add a personal sound association or visual story. The selected mnemonic style adds an optional thematic prompt.

AI STAGE
The app includes offline personalised mnemonic styles, adaptive activity selection and known-word story recombination. It intentionally does not embed an API key. Truly generative cloud AI would require a separate protected backend; placing a private API key in HTML would expose it.
