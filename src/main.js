import { analyzeProduct, compareProducts, completeness, parseNumeric } from './core/analysis.js';
import { NUTRIENTS, DV_STANDARDS } from './core/rules.js';
import { readPhoto, terminateOcr } from './core/ocr.js';
import { downloadReport } from './core/pdf.js';

const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const freshData = () => ({ ingredients: '', contains: '', mayContain: '', serving: '', servings: '', nutrients: Object.fromEntries(NUTRIENTS.map(n => [n.key, ''])), dvStandard: '', origins: {} });
const makeProduct = () => ({ id: crypto.randomUUID(), name: '', data: freshData(), photos: [], result: null, ocrNeedsReview: false, ocrConfidence: null, ocrLanguage: null, ocrText: '', uncertain: [] });
const state = { products: [makeProduct()], activeId: null, uploadType: 'ingredients', filter: '', toastTimer: null };
state.activeId = state.products[0].id;
const active = () => state.products.find(p => p.id === state.activeId) || state.products[0];
const objectUrl = file => URL.createObjectURL(file);
const typeLabel = { ingredients: 'Ingredients', nutrition: 'Nutrition facts', allergens: 'Allergen statement', front: 'Package front', other: 'Other label' };

function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}
function status(message, tone = '') {
  const el = $('#ocr-status'); el.className = `ocr-status ${tone}`; el.innerHTML = `<span class="status-mark">${tone === 'success' ? '✓' : tone === 'error' ? '!' : 'i'}</span><span>${message}</span>`;
}
function formatDate(date) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date); }

function renderProducts() {
  $('#product-count').textContent = state.products.length;
  $('#product-list').innerHTML = state.products.map((p, i) => `
    <div class="product-card" data-id="${esc(p.id)}">
      <div class="product-thumb" aria-hidden="true">${p.photos.length ? '▧' : '◌'}</div>
      <input class="product-name" aria-label="Product ${i + 1} name" placeholder="Product ${i + 1} name" value="${esc(p.name)}" />
      <div class="product-meta">${p.photos.length} photo${p.photos.length === 1 ? '' : 's'} · ${p.result ? 'Analyzed' : 'Ready to review'}</div>
      <button class="review-product-mark ${p.id === state.activeId ? 'active' : ''}" data-action="edit" aria-label="Edit ${esc(p.name || `product ${i + 1}`)}">${p.id === state.activeId ? 'Editing' : 'Edit'}</button>
      <div class="product-reorder"><button data-action="up" aria-label="Move product up" ${i === 0 ? 'disabled' : ''}>↑</button><button data-action="down" aria-label="Move product down" ${i === state.products.length - 1 ? 'disabled' : ''}>↓</button></div>
      <button class="remove-product" data-action="remove" aria-label="Remove ${esc(p.name || `product ${i + 1}`)}" ${state.products.length === 1 ? 'disabled' : ''}>×</button>
    </div>`).join('');
  renderPhotos();
}

function renderPhotos() {
  const product = active();
  $('#photo-count').textContent = `${product.photos.length} photo${product.photos.length === 1 ? '' : 's'}`;
  const tiles = product.photos.map((photo, i) => `<div class="photo-card"><img src="${photo.url}" alt="Preview of ${esc(typeLabel[photo.type])} photo ${i + 1}" style="transform:rotate(${photo.rotation || 0}deg)" /><span class="photo-type">${esc(typeLabel[photo.type])}</span><button class="remove-photo" data-photo-action="rotate" data-index="${i}" aria-label="Rotate image">↻</button><button class="remove-photo" style="top:auto;bottom:3px" data-photo-action="remove" data-index="${i}" aria-label="Remove image">×</button></div>`).join('');
  const types = Object.entries(typeLabel).map(([key, label]) => `<option value="${key}" ${key === state.uploadType ? 'selected' : ''}>${label}</option>`).join('');
  $('#photo-grid').innerHTML = `${tiles}<label class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Add label photo"><span class="drop-icon">↑</span><strong>Drop a photo or browse</strong><small>Choose label type: <select id="photo-type-select" aria-label="Photo label type">${types}</select></small></label>`;
  const zone = $('#dropzone');
  zone.addEventListener('click', e => { if (e.target.id !== 'photo-type-select') $('#file-picker').click(); });
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file-picker').click(); } });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragging'); addFiles(e.dataTransfer.files); });
  $('#photo-type-select').addEventListener('change', e => { state.uploadType = e.target.value; });
  updateCompleteness();
}

function renderForm() {
  const p = active(), d = p.data;
  $('#ingredient-input').value = d.ingredients;
  $('#allergen-input').value = d.contains;
  $('#may-contain-input').value = d.mayContain;
  $('#serving-input').value = d.serving;
  $('#servings-input').value = d.servings;
  $('#ocr-raw').value = p.ocrText;
  $('#ocr-raw-details').classList.toggle('hidden', !p.ocrText);
  setOrigin('serving-origin', d.origins.servings || d.origins.serving, Boolean(d.serving || d.servings));
  $('#nutrition-inputs').innerHTML = NUTRIENTS.map(n => `<div class="nutrition-input"><label for="n-${n.key}">${esc(n.label)} <span class="unit">${esc(n.unit)}</span></label><input id="n-${n.key}" data-nutrient="${n.key}" inputmode="decimal" placeholder="Not listed" value="${esc(d.nutrients[n.key])}" aria-label="${esc(n.label)} in ${n.unit}" /></div>`).join('');
  $('#nutrition-inputs').insertAdjacentHTML('afterend', `<div class="dv-control"><label for="dv-standard">Daily Value standard</label><select id="dv-standard"><option value="">Not selected</option>${Object.entries(DV_STANDARDS).map(([key, standard]) => `<option value="${key}" ${d.dvStandard === key ? 'selected' : ''}>${esc(standard.label)}</option>`).join('')}</select><span>percentages calculated from entered label values</span></div>`);
  $('.dv-control').addEventListener('change', e => { if (e.target.id === 'dv-standard') { d.dvStandard = e.target.value; p.result = null; renderReport(); } });
  $('#filter-input').value = state.filter;
  setOrigin('ingredient-origin', d.origins.ingredients, Boolean(d.ingredients));
  setOrigin('allergen-origin', d.origins.contains, Boolean(d.contains));
  setOrigin('may-origin', d.origins.mayContain, Boolean(d.mayContain));
  setOrigin('nutrition-origin', d.origins.nutrients, NUTRIENTS.some(n => d.nutrients[n.key] !== ''));
  $('#ocr-review-row').classList.toggle('hidden', !p.ocrNeedsReview);
  $('#ocr-confirm').checked = !p.ocrNeedsReview;
  renderUncertainty(p);
  if (p.ocrNeedsReview) status(`Photos read · about ${p.ocrConfidence}% average OCR confidence. Review every field before analysis. Photos were processed in this browser.`, p.uncertain.length ? 'warning' : 'success');
  else status('Add a label photo and select <strong>Read photos</strong>, or enter the information below.');
  updateCompleteness();
}

function setOrigin(id, value, hasValue) {
  const el = $(`#${id}`);
  el.className = `origin-tag ${value || (hasValue ? 'manual' : '')}`;
  el.textContent = !hasValue ? '○ Not entered' : value === 'ocr' ? `▧ Photo text · ${active().ocrConfidence ?? '—'}% OCR confidence` : value === 'edited' ? '✎ Edited or entered by you' : '✎ Entered by you';
}
function renderUncertainty(p) {
  const el = $('#uncertain-words');
  if (!p.uncertain.length) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  el.innerHTML = `<strong>Check highlighted OCR words</strong><div>These words had lower OCR confidence. They are not confirmed until you review them.</div>${p.uncertain.slice(0, 35).map(w => `<span class="uncertain-chip" title="${esc(w.source)} · OCR confidence ${w.confidence}%">${esc(w.text)} · ${w.confidence}%</span>`).join('')}${p.uncertain.length > 35 ? '<span> …and more</span>' : ''}`;
}

function updateCompleteness() {
  const c = completeness(active());
  $('#completeness-value').textContent = c.score;
  $('#completeness-bar').style.width = `${c.score}%`;
  $('#completeness-note').textContent = c.score === 100 ? 'Key label fields are present. Completeness does not indicate product quality.' : `Still missing: ${c.missing.join(', ')}. Completeness is not a safety or quality score.`;
}

function saveFieldOrigin(field, value) {
  const p = active(); p.data.origins[field] = p.data.origins[field] === 'ocr' && value ? 'edited' : value ? 'manual' : '';
  p.result = null; renderReport();
  if (field === 'ingredients') setOrigin('ingredient-origin', p.data.origins.ingredients, Boolean(value));
  if (field === 'contains') setOrigin('allergen-origin', p.data.origins.contains, Boolean(value));
  if (field === 'mayContain') setOrigin('may-origin', p.data.origins.mayContain, Boolean(value));
  if (field === 'nutrients') setOrigin('nutrition-origin', p.data.origins.nutrients, NUTRIENTS.some(n => p.data.nutrients[n.key] !== ''));
  updateCompleteness();
}

function addFiles(fileList) {
  const p = active(); let added = 0;
  for (const file of fileList) {
    if (!(file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name))) { toast(`${file.name}: choose an image file.`); continue; }
    if (file.size > 12 * 1024 * 1024) { toast(`${file.name}: each image must be 12 MB or smaller.`); continue; }
    if (file.size === 0) { toast(`${file.name}: this file is empty.`); continue; }
    const photo = { id: crypto.randomUUID(), file, url: objectUrl(file), type: state.uploadType, rotation: 0 };
    p.photos.push(photo); added++;
  }
  if (added) { p.result = null; renderProducts(); renderReport(); }
}

function rotatePhoto(photo) {
  if (photo.rotation % 180 === 0) photo.rotation = (photo.rotation + 90) % 360; else photo.rotation = (photo.rotation + 90) % 360;
}

function nutritionFromText(text) {
  const out = {};
  const patterns = [
    ['kilojoules', /(?:energy\s*)?(\d+(?:\.\d+)?)\s*kJ\b/i], ['calories', /(?:energy\s*)?(?:calories|kcal)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i], ['totalFat', /(?:total\s+)?fat\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i],
    ['satFat', /(?:saturated\s+fat|sat\.?\s*fat)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i], ['transFat', /trans\s+fat\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i],
    ['carbohydrate', /(?:total\s+)?(?:carbohydrate|carbs?)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i], ['sugars', /(?:total\s+)?sugars?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i],
    ['addedSugars', /added\s+sugars?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i], ['protein', /protein\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i],
    ['sodium', /sodium\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg/i], ['fiber', /(?:dietary\s+)?fiber\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i],
    ['vitaminD', /vitamin\s+d\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:mcg|µg)/i], ['calcium', /calcium\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg/i],
    ['iron', /iron\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg/i], ['potassium', /potassium\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg/i],
    ['vitaminC', /vitamin\s+c\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg/i]
  ];
  for (const [key, re] of patterns) { const match = text.match(re); if (match) out[key] = match[1]; }
  return out;
}

function ocrExtract(report, product = active()) {
  const p = product, d = p.data;
  const byType = type => report.filter(r => r.type === type).map(r => r.text.trim()).filter(Boolean).join('\n');
  let changed = false;
  const ingredients = byType('ingredients');
  const allergens = byType('allergens') || [byType('ingredients'), byType('other')].join('\n');
  const ingredientText = ingredients ? ingredients.replace(/^\s*(ingredients?|ingredients? list)\s*[:\-]?\s*/i, '').trim() : '';
  if (ingredientText && !d.ingredients.trim()) { d.ingredients = ingredientText; d.origins.ingredients = 'ocr'; changed = true; }
  if (!d.contains.trim()) { const m = allergens.match(/\bcontains\s*[:\-]?\s*([^\n.]+)/i); if (m && !/may\s+contain/i.test(m[0])) { d.contains = m[1].trim(); d.origins.contains = 'ocr'; changed = true; } }
  if (!d.mayContain.trim()) { const m = allergens.match(/\bmay\s+contain\s*[:\-]?\s*([^\n.]+)/i); if (m) { d.mayContain = m[1].trim(); d.origins.mayContain = 'ocr'; changed = true; } }
  const nutrition = byType('nutrition');
  if (nutrition) {
    const serving = nutrition.match(/serving\s+size\s*[:\-]?\s*([^\n]+)/i);
    if (serving && !d.serving.trim()) { d.serving = serving[1].trim(); d.origins.serving = 'ocr'; changed = true; }
    const count = nutrition.match(/servings?\s+per\s+(?:container|package|pack)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
    if (count && !d.servings.trim()) { d.servings = count[1]; d.origins.servings = 'ocr'; changed = true; }
    const values = nutritionFromText(nutrition);
    for (const [key, value] of Object.entries(values)) if (!d.nutrients[key]) { d.nutrients[key] = value; changed = true; }
    if (Object.keys(values).length) d.origins.nutrients = 'ocr';
  }
  if (changed) p.result = null;
  return changed;
}

async function runOcr() {
  const p = active();
  if (!p.photos.length) { toast('Add a photo first, or enter the label details below.'); $('#ingredient-input').focus(); return; }
  p.result = null; renderReport();
  const button = $('#run-ocr'); button.disabled = true; button.innerHTML = '<span class="spin">◌</span> Reading…';
  const reports = [], uncertain = [];
  try {
    for (const photo of p.photos) {
      if (photo.type === 'front') continue;
      status(`Reading ${esc(typeLabel[photo.type])} photo ${reports.length + 1} of ${p.photos.filter(x => x.type !== 'front').length}… Photos stay in this browser.`, '');
      const result = await readPhoto(photo, $('#ocr-language').value);
      reports.push(result); uncertain.push(...result.uncertain.map(w => ({ ...w, source: result.name })));
    }
    if (!reports.length) { status('Package-front photos are included in the report. Add an ingredients or nutrition label photo to read text.', 'warning'); return; }
    const confidence = Math.round(reports.reduce((a, r) => a + r.confidence, 0) / reports.length);
    const recognizedText = reports.some(report => report.text.trim());
    p.ocrConfidence = confidence; p.ocrLanguage = $('#ocr-language').value; p.uncertain = uncertain; p.ocrNeedsReview = recognizedText;
    p.ocrText = reports.map(report => `--- ${report.name} · ${typeLabel[report.type]} · OCR confidence ${report.confidence}% ---\n${report.text}`).join('\n\n');
    if (!state.products.includes(p)) return;
    const changed = ocrExtract(reports, p);
    if (active().id !== p.id) { toast(`${p.name || 'Product'} photos have been read. Select Edit for that product to review the text.`); return; }
    renderForm();
    status(!recognizedText ? 'No text was recognized in these photos. Try a straighter, closer, better-lit image, rotate the preview, or enter the label manually.' : `Read ${reports.length} photo${reports.length === 1 ? '' : 's'} · about ${confidence}% average OCR confidence. ${changed ? 'Extracted text is ready to review.' : 'Text was recognized but not mapped to these fields; enter it manually below.'} Photos were processed in this browser.`, !recognizedText || uncertain.length ? 'warning' : 'success');
    if (recognizedText) { $('#ocr-review-row').classList.remove('hidden'); $('#ocr-confirm').checked = false; }
    if (uncertain.length) toast(`${uncertain.length} lower-confidence word${uncertain.length === 1 ? '' : 's'} highlighted for review.`);
  } catch (error) {
    status(esc(error.message || 'OCR is unavailable. You can still enter the label information manually.'), 'error');
  } finally {
    button.disabled = false; button.innerHTML = '<span>✳</span> Read photos';
  }
}

function resultHtml(result) {
  const image = result.photos[0];
  const imageHtml = image ? `<div class="report-image-row"><img src="${image.url}" alt="${esc(result.name)} package photo" /><div class="report-image-caption">Package image preview<br/>Source: user-uploaded photo · ${esc(typeLabel[image.type])}</div></div>` : '';
  const ingredients = result.ingredients;
  const groups = [['beneficial', 'Nutritionally beneficial'], ['neutral', 'Generally neutral'], ['concern', 'Potential concern'], ['unknown', 'Unknown or needs review']];
  const ingredientSections = groups.map(([rating, title]) => {
    const items = ingredients.filter(item => item.rating === rating);
    if (!items.length) return '';
    return `<tr><td colspan="4"><strong>${title}</strong></td></tr>${items.map(item => `<tr><td><strong>${esc(item.label)}</strong><br/><span class="source-note">Normalized: ${esc(item.normalized)} · Role: ${esc(item.role)}</span></td><td><span class="class-pill ${rating}">${title}</span><br/><span class="confidence-label">Match confidence ${item.confidence}%</span></td><td>${esc(item.reason)}</td><td>${item.origin === 'ocr' ? `Package photo · OCR ${result.ocrConfidence ?? '—'}% · reviewed by user` : 'Entered or corrected by user'}<br/><span class="source-note">${esc(item.evidence)}</span></td></tr>`).join('')}`;
  }).join('');
  const nutrientRows = result.nutrients.map(n => `<tr><td><strong>${esc(n.label)}</strong></td><td>${n.value === null ? '<span class="missing">Not provided</span>' : `${esc(n.value)} ${esc(n.unit)}`}</td><td>${esc(n.basis)}</td><td>${n.dvPercent === null ? '<span class="missing">Not shown</span>' : `${n.dvPercent}% <span class="report-dv">calculated · ${esc(n.dvStandard)}</span>`}</td><td>${esc(n.source)}</td></tr>`).join('');
  const allergenHtml = result.allergens.missing ? `<div class="warning-box">No allergen statement was entered or read. Its absence from the provided photos is not proof of safety. For a serious allergy, check the full package and contact the manufacturer when necessary.</div>` : `<div class="result-tile"><span class="tile-label">CONTAINS · package statement</span><p>${result.allergens.contains.length ? esc(result.allergens.contains.join(', ')) : '<span class="missing">Not provided</span>'}</p><span class="source-note">Origin: ${esc(result.allergens.containsOrigin)}</span><span class="tile-label">MAY CONTAIN · precautionary statement</span><p>${result.allergens.mayContain.length ? esc(result.allergens.mayContain.join(', ')) : '<span class="missing">Not provided</span>'}</p><span class="source-note">Origin: ${esc(result.allergens.mayContainOrigin)}</span></div><div class="warning-box">“May contain” is a separate precautionary statement, not an ingredient. Verify the full package if you have a serious allergy.</div>`;
  const suit = result.suitability ? `<div class="filter-result"><strong>Personal filter matches:</strong> ${result.suitability.matched.length ? `Label match: ${esc(result.suitability.matched.join(', '))}. ` : ''}${result.suitability.possible.length ? `Possible match in “may contain”: ${esc(result.suitability.possible.join(', '))}. ` : ''}${result.suitability.unknown.length ? `Could not check: ${esc(result.suitability.unknown.join(', '))}. ` : ''}${result.suitability.notFound.length ? `No exact text match found for: ${esc(result.suitability.notFound.join(', '))}. ` : ''}A missing match does not establish that the product is safe.</div>` : '<p class="source-note">No personal filters selected.</p>';
  const reasons = result.assessment.reasons.map(r => `<li>${esc(r)}</li>`).join('');
  const factors = result.assessment.factors.map(r => `<li>${esc(r)}</li>`).join('');
  const tone = result.assessment.tone === 'caution' ? 'caution' : result.assessment.tone === 'unknown' ? 'unknown' : '';
  return `<article class="product-report" data-result-id="${esc(result.productId)}"><div class="result-overview"><div class="result-tile"><span class="tile-label">${esc(result.name)} · ${formatDate(result.date)}</span><div><span class="assessment-chip ${tone}">${esc(result.assessment.label)}</span></div><p>General label overview · ${esc(result.assessment.confidence)} confidence · not a medical judgment.</p></div><div class="result-tile"><span class="tile-label">DATA COMPLETENESS</span><strong>${result.completeness.score}%</strong><p>Still missing: ${result.missing.length ? esc(result.missing.join(', ')) : 'key fields entered'}.</p><p>Completeness reflects fields present, not quality or safety.</p></div><div class="result-tile"><span class="tile-label">SERVING & IMAGE</span><strong>${esc(result.serving || 'Not provided')}</strong><p>${esc(result.servings || 'Servings per package not provided')} · ${result.photos.length} package photo${result.photos.length === 1 ? '' : 's'} · ${result.nutrients.filter(n => n.value !== null).length} nutrition values recorded</p></div></div>
    <div class="result-block"><h3>Assessment and reasons</h3>${imageHtml}<ul class="source-list">${reasons}</ul><div class="source-note"><strong>Factors shown transparently:</strong><ul class="source-list">${factors}</ul>Comparison cues are simple app rules, not official thresholds, scientific proof, or individualized guidance.</div></div>
    <div class="result-block"><h3>Ingredient list · package order within each group</h3>${ingredients.length ? `<table class="result-table"><thead><tr><th>Label wording & normalized name</th><th>Classification & match confidence</th><th>Plain-language note</th><th>Origin & evidence</th></tr></thead><tbody>${ingredientSections}</tbody></table>` : '<p class="source-note">Ingredient list not provided. No ingredients were inferred from the nutrition panel.</p>'}</div>
    <div class="result-block"><h3>Nutrition facts · per ${esc(result.serving || 'unstated serving')}</h3><p class="source-note">Serving size source: ${esc(result.servingSource)} · Servings per package: ${esc(result.servings || 'not provided')} (${esc(result.servingsSource)}).</p><table class="result-table"><thead><tr><th>Nutrient</th><th>Package value</th><th>Basis</th><th>Daily Value</th><th>Source</th></tr></thead><tbody>${nutrientRows}</tbody></table><p class="source-note">Daily Value percentages are calculated from values entered, only when a jurisdiction standard was selected and a reference value is available. The percentage is not read from the package.</p></div>
    <div class="result-block"><h3>Allergen statements</h3>${allergenHtml}</div><div class="result-block"><h3>Your selected filters</h3>${suit}</div>
    <div class="result-block"><h3>Practical next steps</h3><div class="recommendation">Compare products using the same serving basis${result.nutrients.some(n => n.key === 'addedSugars' && n.value !== null) ? '; check added sugars per serving' : ''}${result.nutrients.some(n => n.key === 'sodium' && n.value !== null) ? '; compare sodium per serving' : ''}${result.nutrients.some(n => n.key === 'fiber' && n.value !== null) ? '; consider fiber per serving' : ''}. Check whether the listed serving size matches the portion you usually eat. Missing label fields should be checked on the full package.</div></div>
    <div class="result-block"><h3>Sources, assumptions & limitations</h3><ul class="source-list"><li>Primary source: user-provided package image and user-reviewed or entered label text. Analysis date: ${formatDate(result.date)}.</li><li>Ingredient source: Labelwise small built-in name and alias reference list; matching rules are shown for each ingredient. No external database query was made.</li><li>${esc(result.provenance)}</li><li>OCR confidence is ${result.ocrConfidence === null ? 'not recorded because no photo was read' : `${result.ocrConfidence}% average (${esc(result.ocrLanguage || 'selected language')})`}; ingredient-match confidence is shown separately for each matched name.</li><li>Nutrition facts are taken only from user-entered or recognized package values. No values were calculated from ingredients. Unknown values remain blank.</li><li>OCR is browser-local when available; its library downloads from jsDelivr on first use. Image files are held in memory for this session and are not uploaded to a label service.</li></ul></div>${result.ocrText ? `<div class="result-block"><h3>OCR review record · reference text only</h3><p class="source-note">This transcription is included for review and was not analyzed directly. The structured label fields above were analyzed after your confirmation. Lower-confidence words remain marked below.</p>${result.ocrUncertain.length ? `<div class="warning-box">Words flagged for a closer look: ${result.ocrUncertain.map(word => `${esc(word.text)} (${word.confidence}% · ${esc(word.source)})`).join(' · ')}</div>` : ''}<pre class="ocr-transcript">${esc(result.ocrText)}</pre></div>` : ''}</article>`;
}

function renderReport() {
  const reports = state.products.map(p => p.result).filter(Boolean);
  if (!reports.length) { $('#report-section').classList.add('hidden'); $('#compare').classList.add('hidden'); $('#report-btn').disabled = true; return; }
  $('#report-section').classList.remove('hidden'); $('#report-btn').disabled = false;
  $('#report-subtitle').textContent = reports.length === 1 ? 'A general overview based on the information provided. Not a medical judgment.' : `${reports.length} products analyzed · source, confidence and missing information are shown for each.`;
  $('#results').innerHTML = reports.map(resultHtml).join('');
  renderComparison();
  document.querySelectorAll('[data-result-id]').forEach(el => {
    const p = state.products.find(x => x.id === el.dataset.resultId);
    if (p?.photos.length) { const im = el.querySelector('.assessment-photo'); if (im) im.src = p.photos[0].url; }
  });
}

function renderComparison() {
  const reports = state.products.map(p => p.result).filter(Boolean);
  const compare = $('#compare');
  if (reports.length < 2) { compare.classList.add('hidden'); compare.classList.remove('print-include'); return; }
  compare.classList.remove('hidden');
  const mode = $('#compare-basis').value;
  const converted = compareProducts(reports, mode);
  const nutrients = NUTRIENTS;
  const head = `<thead><tr><th>Nutrition value</th>${converted.map(p => `<th>${esc(p.name)}<br/><span class="source-note">${esc(p.basis)}</span></th>`).join('')}</tr></thead>`;
  const rows = nutrients.map(n => `<tr><td><strong>${esc(n.label)}</strong></td>${converted.map(p => { const v = p.values[n.key]; return `<td>${v ? esc(v.display) : '<span class="missing">Not available or not comparable</span>'}</td>`; }).join('')}</tr>`).join('');
  const servingWarning = mode === 'serving' && new Set(reports.map(r => r.serving || '')).size > 1 ? '<div class="warning-box">Serving sizes differ. Each value is shown per its own stated serving; those servings are not equivalent. Switch to per 100 g only when both package serving sizes are stated in grams.</div>' : '';
  const names = converted.map(p => p.name);
  const chartNutrients = ['sugars', 'sodium', 'protein', 'fiber'].map(key => nutrients.find(n => n.key === key));
  const charts = chartNutrients.map(n => {
    const vals = converted.map(p => p.values[n.key]);
    const sameBasis = mode === '100g' || new Set(reports.map(r => r.serving || '')).size === 1;
    const valid = vals.map(v => v?.value ?? null);
    if (!sameBasis || valid.filter(v => v !== null).length < 2) return `<div class="chart-wrap"><h3>${esc(n.label)} (${esc(n.unit)})</h3><p class="source-note">${!sameBasis ? 'Chart omitted because serving sizes differ.' : 'At least two comparable values are needed. Missing values are not charted as zero.'}</p></div>`;
    const max = Math.max(...valid.filter(v => v !== null), 1);
    const accessibleValues = converted.map((p, i) => `${p.name}: ${valid[i] === null ? 'not listed' : `${valid[i]} ${n.unit}`}`).join('; ');
    return `<div class="chart-wrap" role="img" aria-label="Horizontal bar chart of ${esc(n.label)} ${mode === '100g' ? 'per 100 grams' : 'per stated serving'}. Values: ${esc(accessibleValues)}"><h3>${esc(n.label)} · ${esc(n.unit)} ${mode === '100g' ? 'per 100 g' : 'per stated serving'}</h3><div class="chart-axis" aria-hidden="true"><span>0 ${esc(n.unit)}</span><span>${Math.round(max / 2)} ${esc(n.unit)}</span><span>${max} ${esc(n.unit)}</span></div>${converted.map((p, i) => `<div class="chart-row"><span>${esc(p.name)}</span><div class="chart-track" aria-hidden="true">${valid[i] === null ? '' : `<span class="chart-bar" style="width:${Math.max(2, valid[i] / max * 100)}%"></span>`}</div><span class="chart-value">${valid[i] === null ? 'Not listed' : `${valid[i]} ${n.unit}`}</span></div>`).join('')}</div>`;
  }).join('');
  const allergyCells = reports.map(r => `<td>${r.allergens.contains.length ? `Contains: ${esc(r.allergens.contains.join(', '))}` : 'Contains: not entered'}<br/>${r.allergens.mayContain.length ? `May contain: ${esc(r.allergens.mayContain.join(', '))}` : 'May contain: not entered'}</td>`).join('');
  const ingredientNames = reports.map(r => `<td>${r.ingredients.length ? esc(r.ingredients.map(i => i.label).join(', ')) : '<span class="missing">Not entered</span>'}</td>`).join('');
  const assessmentCells = reports.map(r => `<td>${esc(r.assessment.label)}<br/><span class="source-note">${esc(r.assessment.confidence)} confidence · ${r.completeness.score}% data completeness</span></td>`).join('');
  $('#comparison').innerHTML = `<div class="comparison-scroll"><table class="comparison-table">${head}<tbody>${rows}<tr><td><strong>Ingredient differences</strong></td>${ingredientNames}</tr><tr><td><strong>Allergen statements</strong></td>${allergyCells}</tr><tr><td><strong>Assessment & completeness</strong></td>${assessmentCells}</tr></tbody></table></div>${servingWarning}<div class="chart-grid">${charts}</div><p class="source-note">Each displayed value comes from the corresponding user-reviewed package label. Per 100 g calculations are derived from the package value and the stated gram serving; this is shown as a calculation. Volume servings cannot be converted to mass.</p>`;
  compare.classList.toggle('print-include', reports.length > 1);
}

function onFieldInput(event) {
  const p = active(), target = event.target;
  if (target.id === 'ingredient-input') { p.data.ingredients = target.value; saveFieldOrigin('ingredients', target.value); }
  if (target.id === 'allergen-input') { p.data.contains = target.value; saveFieldOrigin('contains', target.value); }
  if (target.id === 'may-contain-input') { p.data.mayContain = target.value; saveFieldOrigin('mayContain', target.value); }
  if (target.id === 'serving-input') { p.data.serving = target.value; p.data.origins.serving = p.data.origins.serving === 'ocr' && target.value ? 'edited' : target.value ? 'manual' : ''; setOrigin('serving-origin', p.data.origins.serving, Boolean(p.data.serving || p.data.servings)); p.result = null; updateCompleteness(); renderReport(); }
  if (target.id === 'servings-input') { p.data.servings = target.value; p.data.origins.servings = p.data.origins.servings === 'ocr' && target.value ? 'edited' : target.value ? 'manual' : ''; setOrigin('serving-origin', p.data.origins.servings || p.data.origins.serving, Boolean(p.data.serving || p.data.servings)); p.result = null; updateCompleteness(); renderReport(); }
  if (target.matches('[data-nutrient]')) { p.data.nutrients[target.dataset.nutrient] = target.value; saveFieldOrigin('nutrients', target.value); }
  if (target.id === 'filter-input') { state.filter = target.value; state.products.forEach(product => { product.result = null; }); renderReport(); }
}

function switchProduct(id) {
  if (id === state.activeId) return;
  state.activeId = id; renderProducts(); renderForm();
}

$('#product-list').addEventListener('input', e => {
  if (!e.target.matches('.product-name')) return;
  const p = state.products.find(x => x.id === e.target.closest('.product-card').dataset.id);
  if (p) { p.name = e.target.value; p.result = null; renderReport(); }
});
$('#product-list').addEventListener('click', e => {
  const card = e.target.closest('.product-card'); if (!card) return;
  const p = state.products.find(x => x.id === card.dataset.id); const action = e.target.dataset.action;
  if (action === 'edit') { switchProduct(p.id); return; }
  if (action === 'remove' && state.products.length > 1) {
    p.photos.forEach(photo => URL.revokeObjectURL(photo.url));
    const index = state.products.indexOf(p); state.products.splice(index, 1);
    if (state.activeId === p.id) state.activeId = state.products[Math.max(0, index - 1)].id;
    renderProducts(); renderForm(); renderReport();
  }
  if (action === 'up' || action === 'down') {
    const index = state.products.indexOf(p), next = action === 'up' ? index - 1 : index + 1;
    if (next >= 0 && next < state.products.length) [state.products[index], state.products[next]] = [state.products[next], state.products[index]];
    renderProducts();
  }
});

$('#photo-grid').addEventListener('click', e => {
  const button = e.target.closest('[data-photo-action]'); if (!button) return;
  const p = active(), photo = p.photos[Number(button.dataset.index)]; if (!photo) return;
  if (button.dataset.photoAction === 'rotate') rotatePhoto(photo);
  if (button.dataset.photoAction === 'remove') { URL.revokeObjectURL(photo.url); p.photos.splice(Number(button.dataset.index), 1); p.result = null; }
  renderProducts(); renderReport();
});
$('#file-picker').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
$('#product-list').addEventListener('focusout', e => {
  if (e.target.matches('.product-name')) { const p = state.products.find(x => x.id === e.target.closest('.product-card').dataset.id); if (p) p.name = e.target.value.trim(); }
});
$('#add-product-btn').addEventListener('click', () => {
  state.products.push(makeProduct()); state.activeId = state.products.at(-1).id; renderProducts(); renderForm();
  $('.product-name:last-of-type')?.focus();
});
document.querySelector('.review-fields').addEventListener('input', onFieldInput);
$('#ocr-raw').addEventListener('input', e => { active().ocrText = e.target.value; active().result = null; renderReport(); });
$('#ocr-confirm').addEventListener('change', e => { if (e.target.checked) active().ocrNeedsReview = false; else active().ocrNeedsReview = true; });
$('#run-ocr').addEventListener('click', runOcr);
$('#analyze-btn').addEventListener('click', () => {
  const p = active();
  if (!p.name.trim()) { toast('Give this product a name so it is easy to identify in your report.'); $('.product-name')?.focus(); return; }
  if (p.ocrNeedsReview && !$('#ocr-confirm').checked) { status('Please review the extracted text and check the confirmation box before analysis.', 'warning'); $('#ocr-confirm').focus(); toast('Review the OCR text before continuing.'); return; }
  const hasEnteredLabel = Boolean(p.data.ingredients.trim() || p.data.contains.trim() || p.data.mayContain.trim() || p.data.serving.trim() || p.data.servings.trim() || NUTRIENTS.some(n => p.data.nutrients[n.key]));
  if (!hasEnteredLabel && !p.photos.length) { toast('Add a label photo or enter at least one label detail before analysis.'); $('#ingredient-input').focus(); return; }
  p.ocrNeedsReview = false; p.result = analyzeProduct(p, state.filter);
  renderReport(); $('#report-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#compare-add-btn').addEventListener('click', () => { $('#add-product-btn').click(); $('#products').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
$('#compare-refresh').addEventListener('click', renderComparison);
$('#compare-basis').addEventListener('change', renderComparison);
$('#report-btn').addEventListener('click', () => downloadReport(toast));
$('#reset-btn').addEventListener('click', async () => {
  state.products.forEach(p => p.photos.forEach(photo => URL.revokeObjectURL(photo.url)));
  await terminateOcr();
  state.products = [makeProduct()]; state.activeId = state.products[0].id; state.filter = '';
  $('#report-section').classList.add('hidden'); $('#compare').classList.add('hidden');
  renderProducts(); renderForm(); toast('Current photos and analysis cleared from this session.');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// First paint; nothing is stored in local storage or sent to a product service.
renderProducts(); renderForm();
