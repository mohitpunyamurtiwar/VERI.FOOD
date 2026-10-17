# Labelwise

A responsive, photo-first packaged-food label analyzer. This project is a static browser app with no account, backend, product database, or build step.

## Run locally

Open a terminal in this folder and run the included local server:

```sh
node serve.cjs
```

Then open `http://127.0.0.1:8000` in a browser. ES modules do not work when `index.html` is opened directly from a `file:` URL.

## User flow

1. Name one or more products and attach label photos by type.
2. Rotate photos as needed. Select an OCR language and read the ingredient, nutrition, or allergen image, or enter the label manually.
3. Review the editable fields. OCR results require a review confirmation; low confidence words are highlighted. Corrected facts are marked as user entered.
4. Run the transparent, rule-based overview, inspect sources and unknowns, then compare products on a stated serving basis.
5. Use **Download PDF report** and select **Save as PDF** in the browser print dialog. The print view uses the same report and includes comparisons when present.

## Implementation map

- `src/main.js` — page state, image upload, editable review flow, product comparison, and rendering.
- `src/core/ocr.js` — replaceable browser OCR adapter and image orientation/contrast preprocessing.
- `src/core/rules.js` — structured ingredient aliases, classification rules, reference values, and nutrient fields.
- `src/core/analysis.js` — data completeness, ingredient matching, provenance, cautious assessment, and fair basis conversion.
- `src/core/pdf.js` — print-to-PDF entry point.
- `serve.cjs` — small local-only static server for running the app without a package install.
- `styles.css` — responsive, accessible layout and print styling.

## External services and setup

There is no product lookup and no API credential or environment variable to configure. Barcode scanning and cloud storage are not used. On first OCR use, the browser loads Tesseract.js and the selected OCR language data from jsDelivr; an internet connection is needed for that initial download. Recognition runs locally in the browser. If the library, language model, or image decoder is unavailable, the app reports that and manual label entry remains available. English and English paired with Hindi, Spanish, French, or German are offered. Rotate, crop in a photo editor, improve lighting, and retry for difficult images; OCR confidence is never treated as confirmation.

Uploaded images and dietary filters are kept in page memory only. They are not submitted to a service or stored in local storage. **Start over** revokes photo previews and clears the current session's analysis. Closing the tab also clears it.

## Analysis limits

Nutrition values come only from the entered or recognized package panel; the app does not derive nutrition from ingredients or fill missing fields with zero. Daily Value percentages are calculated only when a package value and a selected jurisdiction's reference value are available. The ingredient alias list is intentionally small and editable in `src/core/rules.js`; unmatched names remain unknown. General nutrition comparison cues are labeled as app heuristics, not official guidelines or medical advice. An allergen match or no match cannot establish personal safety.

PDF export uses the browser's local print dialog rather than a hosted PDF service. This keeps images local and makes the printable report match the visible report. The user selects **Save as PDF** in that dialog.
