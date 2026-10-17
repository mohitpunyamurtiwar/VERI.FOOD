import { ALLERGENS, DV_STANDARDS, NUTRIENTS, ingredientLines, normalizeIngredient } from './rules.js';

const numeric = raw => {
  if (raw === '' || raw == null) return null;
  const m = String(raw).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

export function completeness(product) {
  const d = product.data;
  const ingredientCount = ingredientLines(d.ingredients).length;
  const nutrientCount = NUTRIENTS.filter(n => numeric(d.nutrients[n.key]) !== null).length;
  const hasAllergenText = Boolean(d.contains.trim() || d.mayContain.trim());
  const parts = [Boolean(product.name.trim()), ingredientCount > 0, ingredientCount > 0, hasAllergenText, Boolean(d.serving.trim()), Boolean(d.servings.trim()),
    nutrientCount >= 1, nutrientCount >= 4, nutrientCount >= 7];
  const score = Math.round(parts.filter(Boolean).length / parts.length * 100);
  const missing = [];
  if (!ingredientCount) missing.push('ingredient list');
  if (!hasAllergenText) missing.push('allergen statements');
  if (!d.serving.trim()) missing.push('serving size');
  if (!d.servings.trim()) missing.push('servings per package');
  if (nutrientCount < 4) missing.push('more nutrition values');
  return { score, missing, ingredientCount, nutrientCount };
}

function checkAllergenStatements(product) {
  const contains = product.data.contains.trim();
  const mayContain = product.data.mayContain.trim();
  return {
    contains: contains ? contains.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : [],
    mayContain: mayContain ? mayContain.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : [],
    missing: !contains && !mayContain
  };
}

function assessNutrition(product) {
  const v = Object.fromEntries(NUTRIENTS.map(n => [n.key, numeric(product.data.nutrients[n.key])]));
  const known = Object.entries(v).filter(([, value]) => value !== null).length;
  if (known < 3 || !product.data.serving.trim()) return {
    label: 'Not enough information', confidence: 'Low', tone: 'unknown', reasons: ['At least three nutrition values and a serving size are needed for this general label overview.'],
    factors: ['No single ingredient count or additive decides this assessment.']
  };
  const reasons = [], factors = [];
  let signals = 0, favorable = 0, caution = 0;
  if (v.addedSugars !== null) { signals++; if (v.addedSugars >= 10) { caution++; reasons.push(`Added sugars are ${v.addedSugars} g per stated serving. Compare with similar products and your usual portion.`); factors.push('Added sugars: higher comparison cue (10 g or more per stated serving).'); } else { favorable++; factors.push('Added sugars: below the app’s 10 g per serving comparison cue.'); } }
  else if (v.sugars !== null) { signals++; factors.push('Total sugars are shown; added sugars were not listed, so the source of the sugars is unclear.'); }
  if (v.sodium !== null) { signals++; if (v.sodium >= 600) { caution++; reasons.push(`Sodium is ${v.sodium} mg per stated serving. Compare the same serving basis across products.`); factors.push('Sodium: higher comparison cue (600 mg or more per stated serving).'); } else { favorable++; factors.push('Sodium: below the app’s 600 mg per serving comparison cue.'); } }
  if (v.satFat !== null) { signals++; if (v.satFat >= 5) { caution++; reasons.push(`Saturated fat is ${v.satFat} g per stated serving.`); factors.push('Saturated fat: higher comparison cue (5 g or more per stated serving).'); } else { favorable++; factors.push('Saturated fat: below the app’s 5 g per serving comparison cue.'); } }
  if (v.fiber !== null) { signals++; if (v.fiber >= 3) { favorable++; reasons.push(`The label lists ${v.fiber} g fiber per serving.`); factors.push('Fiber: 3 g or more per stated serving.'); } else factors.push('Fiber: less than 3 g per stated serving.'); }
  if (v.protein !== null) { signals++; factors.push(`The label lists ${v.protein} g protein per serving.`); }
  if (product.data.ingredients.trim()) { signals++; factors.push('Ingredient list reviewed in package order; ratings are rule-based, not medical judgments.'); }
  if (signals < 2 || known < 3) return { label: 'Not enough information', confidence: 'Low', tone: 'unknown', reasons: ['The available fields do not support a balanced overview.'], factors };
  const balance = favorable - caution;
  let label, tone;
  if (caution >= 2 || balance <= -2) { label = 'Less favorable on these values'; tone = 'caution'; }
  else if (caution === 0 && favorable >= 2) { label = 'More favorable on these values'; tone = 'good'; }
  else { label = 'Mixed picture'; tone = 'mixed'; }
  if (!reasons.length) reasons.push('No higher comparison cues were found among the values entered; unentered values remain unknown.');
  const confidence = known >= 6 && product.data.serving.trim() ? 'Moderate' : 'Low';
  return { label, confidence, tone, reasons, factors };
}

function suitability(product, filter) {
  if (!filter.trim()) return null;
  const terms = filter.toLowerCase().split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const ingredients = `${product.data.ingredients} ${product.data.contains}`.toLowerCase();
  const may = product.data.mayContain.toLowerCase();
  const matched = terms.filter(term => ingredients.includes(term));
  const possible = terms.filter(term => may.includes(term));
  const unknown = terms.filter(term => !matched.includes(term) && !possible.includes(term) && (!product.data.ingredients.trim() || !product.data.contains.trim() || !product.data.mayContain.trim()));
  const notFound = terms.filter(term => !matched.includes(term) && !possible.includes(term) && !unknown.includes(term));
  return { matched, possible, unknown, notFound };
}

export function analyzeProduct(product, filter = '') {
  const comp = completeness(product);
  const allergens = checkAllergenStatements(product);
  const ingredients = ingredientLines(product.data.ingredients).map(label => {
    const rule = normalizeIngredient(label);
    return { label, normalized: rule.name, role: rule.role, rating: rule.rating, confidence: Math.round(rule.confidence * 100), reason: rule.reason, evidence: rule.evidence, origin: product.data.origins.ingredients || 'manual' };
  });
  const assessment = assessNutrition(product);
  const nutrientRows = NUTRIENTS.map(n => {
    const value = numeric(product.data.nutrients[n.key]);
    const standard = product.data.dvStandard ? DV_STANDARDS[product.data.dvStandard] : null;
    const dailyValue = n.dv?.[product.data.dvStandard] ?? null;
    return { ...n, value, dvPercent: value !== null && dailyValue ? Math.round(value / dailyValue * 100) : null,
      dvStandard: dailyValue ? standard?.label : null, basis: product.data.serving || 'Serving size not provided', source: value === null ? 'Not on label / not entered' : (product.data.origins.nutrients === 'ocr' ? `Package photo · OCR ${product.ocrConfidence ?? '—'}% · reviewed by user` : 'User entered or corrected package value') };
  });
  return { productId: product.id, name: product.name || 'Unnamed product', date: new Date(), completeness: comp,
    ingredients, allergens: { ...allergens,
      containsOrigin: product.data.origins.contains === 'ocr' ? `Package photo · OCR ${product.ocrConfidence ?? '—'}% · reviewed by user` : product.data.contains.trim() ? 'Entered or corrected by user' : 'Not provided',
      mayContainOrigin: product.data.origins.mayContain === 'ocr' ? `Package photo · OCR ${product.ocrConfidence ?? '—'}% · reviewed by user` : product.data.mayContain.trim() ? 'Entered or corrected by user' : 'Not provided' },
    assessment, nutrients: nutrientRows, serving: product.data.serving.trim() || null, servings: product.data.servings.trim() || null,
    servingSource: product.data.origins.serving === 'ocr' ? `Package photo · OCR ${product.ocrConfidence ?? '—'}% · reviewed by user` : product.data.serving.trim() ? 'Entered or corrected by user' : 'Not provided',
    servingsSource: product.data.origins.servings === 'ocr' ? `Package photo · OCR ${product.ocrConfidence ?? '—'}% · reviewed by user` : product.data.servings.trim() ? 'Entered or corrected by user' : 'Not provided',
    ocrConfidence: product.ocrConfidence, ocrLanguage: product.ocrLanguage || null, ocrText: product.ocrText || '', ocrUncertain: product.uncertain || [],
    suitability: suitability(product, filter), photos: product.photos, missing: comp.missing,
    provenance: 'Product label, reviewed and entered in this browser. Ingredient classifications come from the app’s small rule list; no product database was queried.' };
}

export function compareProducts(results, basis = 'serving') {
  return results.map(result => ({
    id: result.productId, name: result.name,
    basis: basis === '100g' ? (result.serving?.toLowerCase().includes('ml') ? 'Unavailable (volume)' : 'Per 100 g') : (result.serving || 'Serving not stated'),
    values: Object.fromEntries(result.nutrients.map(n => {
      if (basis === 'serving') return [n.key, n.value === null ? null : { value: n.value, unit: n.unit, display: `${n.value} ${n.unit}` }];
      const match = result.serving?.match(/([\d.]+)\s*(g|kg)\b/i);
      if (!match || n.value === null) return [n.key, null];
      const grams = Number(match[1]) * (/kg/i.test(match[2]) ? 1000 : 1);
      if (!grams) return [n.key, null];
      const normalized = Math.round(n.value * 100 / grams * 100) / 100;
      return [n.key, { value: normalized, unit: n.unit, display: `${normalized} ${n.unit}` }];
    }))
  }));
}

export const parseNumeric = numeric;
