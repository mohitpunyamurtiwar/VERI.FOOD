# 🥗 Labelwise

### Food labels, made clearer.

**Labelwise** is a responsive, photo-first tool for reading and comparing packaged-food labels. Review ingredients, nutrition, and allergen information in one place—with transparent, rule-based insights and no account required.

> 📸 Add a label photo · 🔎 Review the details · 📊 Compare products

## ✨ What you can do

- 🛍️ **Organize products** — add products and attach photos of their labels.
- 🔄 **Read label photos** — rotate images and use browser-based OCR for ingredients, nutrition, or allergen panels.
- ✍️ **Review and correct details** — edit extracted information and confirm it before analysis.
- 🧭 **Explore transparent insights** — see ingredient matches, data sources, and what remains unknown.
- ⚖️ **Compare products fairly** — compare nutrition using a stated serving basis.
- 🖨️ **Save a PDF report** — print the report and choose **Save as PDF** in your browser.

## 🚀 Run locally

**Requirements:** [Node.js](https://nodejs.org/) and a modern browser.

1. Open a terminal in the project folder.
2. Start the local server:

   ```sh
   node serve.cjs
   ```

3. Visit **http://127.0.0.1:8000** in your browser.

> 💡 Use the local server rather than opening `index.html` directly. Browser ES modules do not work reliably from a `file:` URL.

## 🧩 Project structure

| File | Purpose |
| --- | --- |
| `src/main.js` | Page state, image uploads, editable review flow, comparisons, and rendering |
| `src/core/ocr.js` | Browser OCR adapter and image orientation/contrast preprocessing |
| `src/core/rules.js` | Ingredient aliases, classification rules, reference values, and nutrient fields |
| `src/core/analysis.js` | Data completeness, ingredient matching, provenance, assessments, and serving-basis conversion |
| `src/core/pdf.js` | Print-to-PDF entry point |
| `serve.cjs` | Small local static server; no package install or build step required |
| `styles.css` | Responsive layout, accessibility, and print styling |

## 🔒 Privacy and external services

- **No account, backend, product database, barcode scanning, or cloud storage.**
- Uploaded photos and dietary filters stay in page memory; they are not sent to a service or saved in local storage.
- On first OCR use, the browser downloads Tesseract.js and the selected language data from jsDelivr. An internet connection is needed for that initial download; recognition runs locally in the browser.
- If OCR is unavailable, manual label entry remains an option.
- **Start over** clears the current analysis and revokes photo previews. Closing the tab also clears the session.

## 🌐 OCR languages

Choose **English**, or English paired with **Hindi, Spanish, French, or German**. OCR confidence is not confirmation: review the extracted text and correct it before analysis. For difficult photos, try rotating or cropping the image and improving the lighting.

## ⚠️ Important limitations

- Nutrition values come only from information entered or read from the package. Missing values are not inferred from ingredients or treated as zero.
- Daily Value percentages are calculated only when package values and a selected jurisdiction's reference values are available.
- The ingredient alias list is intentionally small. Unmatched names remain unknown.
- Comparison cues are **app heuristics**, not official guidelines or medical advice.
- An allergen match—or no match—cannot establish whether a food is safe for a particular person. Always check the package and consult a qualified professional when needed.
- PDF export uses your browser's local print dialog; select **Save as PDF** to save a report.

---

**Labelwise** helps make package information easier to explore. Always check the product package for the latest details.
