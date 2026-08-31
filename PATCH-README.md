# Kakashi-Web v11.25.10

## Fix
This patch moves checkpoint handling back into the source loading path by removing the v11.25.8 runtime checkpoint wrapper from `version.js`.

The underlying source `next()` flow already has the correct fallback behavior: save the resumable mission, then advance to the next card. The previous runtime patch replaced the checkpoint branch in a way that could leave `next()` without advancing, causing the lesson to freeze after card 5.

## Apply
Replace the repository `version.js` with the supplied file.

Important: this version intentionally stops loading `patch-11.25.8.js`. Keep your existing 11.25.7/11.25.9 files in the repo for now; they are not removed by this ZIP.

## Note
This is the transitional source cleanup for 11.25.10. The next structural cleanup should fold the 11.25.7/11.25.9 behavior into the owning source files and remove the historical patch files.
