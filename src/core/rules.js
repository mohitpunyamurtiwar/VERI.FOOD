// Curated, deliberately small rule set. Add aliases and evidence records here.
export const INGREDIENT_RULES = [
  { name: 'whole grain oats', aliases: ['oats', 'rolled oats', 'whole oats'], role: 'Whole grain', rating: 'beneficial', confidence: 0.94, reason: 'Whole grain oats contribute dietary fiber. The amount depends on the recipe and serving size.', evidence: 'Ingredient wording on package; no product-specific fiber claim inferred.' },
  { name: 'whole wheat flour', aliases: ['wholemeal wheat flour', 'whole wheat'], role: 'Whole grain', rating: 'beneficial', confidence: 0.88, reason: 'Whole wheat ingredients can contribute fiber; the nutrition panel is needed to know the amount.', evidence: 'Ingredient wording on package.' },
  { name: 'chickpeas', aliases: ['garbanzo beans', 'garbanzo'], role: 'Legume', rating: 'beneficial', confidence: 0.88, reason: 'Chickpeas contribute protein and fiber, although this list does not establish the amount in a serving.', evidence: 'Ingredient wording on package.' },
  { name: 'lentils', aliases: ['red lentils', 'green lentils'], role: 'Legume', rating: 'beneficial', confidence: 0.88, reason: 'Lentils contribute protein and fiber; check the nutrition panel for product-specific amounts.', evidence: 'Ingredient wording on package.' },
  { name: 'beans', aliases: ['black beans', 'kidney beans', 'white beans'], role: 'Legume', rating: 'beneficial', confidence: 0.84, reason: 'Beans can contribute protein and fiber; check the nutrition panel for product-specific amounts.', evidence: 'Ingredient wording on package.' },
  { name: 'almonds', aliases: ['almond'], role: 'Nut ingredient', rating: 'neutral', confidence: 0.95, reason: 'A food ingredient. It is also a tree nut allergen for some people.', evidence: 'Ingredient wording and allergen statement on package.' },
  { name: 'peanuts', aliases: ['peanut'], role: 'Legume ingredient', rating: 'neutral', confidence: 0.96, reason: 'A food ingredient. It is a major allergen for some people.', evidence: 'Ingredient wording and allergen statement on package.' },
  { name: 'milk', aliases: ['milk powder', 'skim milk', 'whey'], role: 'Dairy ingredient', rating: 'neutral', confidence: 0.94, reason: 'A functional or food ingredient. Milk is a major allergen for some people.', evidence: 'Ingredient wording and allergen statement on package.' },
  { name: 'sugar', aliases: ['cane sugar', 'brown sugar', 'raw sugar'], role: 'Sweetener', rating: 'neutral', confidence: 0.94, reason: 'A sweetener. The nutrition panel gives the product’s total and, when shown, added sugar per serving.', evidence: 'Ingredient wording on package.' },
  { name: 'salt', aliases: ['sea salt', 'sodium chloride'], role: 'Flavoring / preservative', rating: 'neutral', confidence: 0.93, reason: 'A common flavoring ingredient. Use the nutrition panel to compare sodium per serving.', evidence: 'Ingredient wording on package.' },
  { name: 'sunflower oil', aliases: ['high oleic sunflower oil'], role: 'Cooking oil', rating: 'neutral', confidence: 0.9, reason: 'A cooking oil. The nutrition panel provides the product-specific fat amounts.', evidence: 'Ingredient wording on package.' },
  { name: 'palm oil', aliases: ['palm kernel oil'], role: 'Cooking oil', rating: 'neutral', confidence: 0.9, reason: 'A cooking oil. The saturated-fat amount on the nutrition panel is more useful for nutritional comparison.', evidence: 'Ingredient wording on package.' },
  { name: 'citric acid', aliases: ['acidity regulator (citric acid)'], role: 'Acidity regulator', rating: 'neutral', confidence: 0.93, reason: 'A commonly used acidity regulator. Its presence alone does not establish a health concern.', evidence: 'Ingredient wording on package.' },
  { name: 'lecithin', aliases: ['soy lecithin', 'sunflower lecithin'], role: 'Emulsifier', rating: 'neutral', confidence: 0.88, reason: 'An emulsifier used to help ingredients mix. Soy lecithin may be relevant to a soy allergy; verify the full package.', evidence: 'Ingredient wording on package.' },
  { name: 'maltodextrin', aliases: ['corn maltodextrin'], role: 'Thickener / carrier', rating: 'neutral', confidence: 0.88, reason: 'A carbohydrate used for texture or as a carrier. The nutrition facts show the product’s carbohydrate context.', evidence: 'Ingredient wording on package.' },
  { name: 'natural flavor', aliases: ['natural flavors', 'natural flavour', 'natural flavours'], role: 'Flavoring', rating: 'unknown', confidence: 0.76, reason: 'This package term does not reveal the exact flavoring components. Contact the manufacturer if a specific component matters to you.', evidence: 'Ingredient wording on package; exact composition not available.' },
  { name: 'modified food starch', aliases: ['modified starch', 'modified corn starch'], role: 'Thickener', rating: 'neutral', confidence: 0.85, reason: 'A starch used for texture. Its presence alone does not establish a health concern.', evidence: 'Ingredient wording on package.' },
  { name: 'aspartame', aliases: ['e951'], role: 'Sweetener', rating: 'neutral', confidence: 0.93, reason: 'A low-calorie sweetener. This label alone cannot establish personal suitability; consult applicable guidance if relevant to you.', evidence: 'Ingredient wording on package; no product-specific exposure calculation made.' },
  { name: 'unidentified', aliases: [], role: 'Not confidently identified', rating: 'unknown', confidence: 0.3, reason: 'This name did not match the current ingredient reference list. It may still be a familiar food ingredient; check the label wording or review it manually.', evidence: 'Rule-based match against the app’s limited ingredient reference list.' }
];

const fold = s => s.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();

export function normalizeIngredient(label) {
  const key = fold(label);
  for (const rule of INGREDIENT_RULES) {
    if (rule.name === 'unidentified') continue;
    if (fold(rule.name) === key || rule.aliases.some(alias => fold(alias) === key)) return rule;
  }
  return INGREDIENT_RULES.at(-1);
}

export function ingredientLines(value) {
  return value.split(/\n|,(?![^()]*\))/).map(s => s.replace(/^\s*[-•·]\s*/, '').trim()).filter(Boolean);
}

export const NUTRIENTS = [
  { key: 'kilojoules', label: 'Energy', unit: 'kJ', dv: null },
  { key: 'calories', label: 'Calories', unit: 'kcal', dv: null },
  { key: 'totalFat', label: 'Total fat', unit: 'g', dv: { us: 78, eu: 70 } },
  { key: 'satFat', label: 'Saturated fat', unit: 'g', dv: { us: 20, eu: 20 } },
  { key: 'transFat', label: 'Trans fat', unit: 'g', dv: null },
  { key: 'carbohydrate', label: 'Carbohydrate', unit: 'g', dv: { us: 275, eu: 260 } },
  { key: 'sugars', label: 'Total sugars', unit: 'g', dv: null },
  { key: 'addedSugars', label: 'Added sugars', unit: 'g', dv: { us: 50, eu: null } },
  { key: 'protein', label: 'Protein', unit: 'g', dv: { us: 50, eu: 50 } },
  { key: 'sodium', label: 'Sodium', unit: 'mg', dv: { us: 2300, eu: 2000 } },
  { key: 'fiber', label: 'Dietary fiber', unit: 'g', dv: { us: 28, eu: 25 } },
  { key: 'vitaminD', label: 'Vitamin D', unit: 'mcg', dv: { us: 20, eu: 5 } },
  { key: 'calcium', label: 'Calcium', unit: 'mg', dv: { us: 1300, eu: 800 } },
  { key: 'iron', label: 'Iron', unit: 'mg', dv: { us: 18, eu: 14 } },
  { key: 'potassium', label: 'Potassium', unit: 'mg', dv: { us: 4700, eu: 2000 } },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg', dv: { us: 90, eu: 80 } }
];

export const DV_STANDARDS = {
  us: { label: 'United States FDA Daily Values (2020)', jurisdiction: 'United States', year: '2020' },
  eu: { label: 'European Union reference intakes (1169/2011)', jurisdiction: 'European Union', year: '2011' }
};

export const ALLERGENS = ['milk', 'eggs', 'fish', 'shellfish', 'crustacean', 'tree nuts', 'peanuts', 'wheat', 'soy', 'sesame', 'mustard', 'celery', 'lupin', 'sulfites'];
