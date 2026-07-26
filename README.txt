Kaishi Quest v3.4.1 Repair

This repair fixes:
1. Sprite images not displaying.
2. PWA remaining on an older cached version.

Apply:
- Replace the memoryScene() function with PATCH_APP_JS.txt.
- Merge PATCH_STYLES.css into styles.css.
- Set APP_VERSION to 3.4.1.
- Update the service worker cache name to v3.4.1.
- Deploy and then refresh/clear the PWA cache once.
