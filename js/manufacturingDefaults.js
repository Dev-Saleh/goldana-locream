/**
 * Default Manufacturing Settings for Gold Calculator
 * 
 * This module contains the default manufacturing fee settings for different
 * gold karat types and design categories. Each setting includes weight ranges
 * and corresponding manufacturing fees per gram.
 * 
 * Structure:
 * - Karat levels: 18, 21, 24
 * - Design types: ايطالي (Italian), محلي (Local), غوايش (Bracelets), سويسري (Swiss)
 * - Weight ranges: from/to in grams
 * - Manufacturing fees: in SAR per gram
 */

export const DEFAULT_MANUFACTURING_SETTINGS = {
  "18": [
    // Italian Design (ايطالي)
    { design: "ايطالي", from: 1.00, to: 2.00, fee: 200 },
    { design: "ايطالي", from: 2.01, to: 3.00, fee: 175 },
    { design: "ايطالي", from: 3.01, to: 4.00, fee: 150 },
    { design: "ايطالي", from: 4.01, to: 5.00, fee: 125 },
    { design: "ايطالي", from: 5.01, to: 10.00, fee: 100 },
    
    // Local Design (محلي)
    { design: "محلي", from: 1.00, to: 2.00, fee: 180 },
    { design: "محلي", from: 2.01, to: 3.00, fee: 160 },
    { design: "محلي", from: 3.01, to: 4.00, fee: 130 },
    { design: "محلي", from: 4.01, to: 5.00, fee: 100 },
    { design: "محلي", from: 5.01, to: 10.00, fee: 80 }
  ],
  
  "21": [
    // Italian Design (ايطالي)
    { design: "ايطالي", from: 1.00, to: 2.00, fee: 200 },
    { design: "ايطالي", from: 2.01, to: 3.00, fee: 175 },
    { design: "ايطالي", from: 3.01, to: 4.00, fee: 150 },
    { design: "ايطالي", from: 4.01, to: 5.00, fee: 125 },
    { design: "ايطالي", from: 5.01, to: 10.00, fee: 100 },
    
    // Local Design (محلي)
    { design: "محلي", from: 1.00, to: 2.00, fee: 180 },
    { design: "محلي", from: 2.01, to: 3.00, fee: 160 },
    { design: "محلي", from: 3.01, to: 4.00, fee: 130 },
    { design: "محلي", from: 4.01, to: 5.00, fee: 100 },
    { design: "محلي", from: 5.01, to: 10.00, fee: 80 },
    
    // Bracelets (غوايش)
    { design: "غوايش", from: 0.00, to: 100.00, fee: 40 }
  ],
  
  "24": [
    // Local Design (محلي)
    { design: "محلي", from: 0.98, to: 2.50, fee: 100 },
    { design: "محلي", from: 2.51, to: 5.00, fee: 80 },
    
    // Swiss Design (سويسري)
    { design: "سويسري", from: 0.98, to: 2.50, fee: 150 },
    { design: "سويسري", from: 2.51, to: 5.00, fee: 130 }
  ]
};

/**
 * Default design mappings for each karat level
 * Used to set initial design selection when switching karat types
 */
export const DEFAULT_DESIGN_FOR_KARAT = {
  18: 'ايطالي',
  21: 'محلي', 
  24: 'محلي'
};

/**
 * Karat purity multipliers for gold value calculations
 * Based on actual gold purity percentages
 */
export const KARAT_MULTIPLIERS = {
  24: 1.0,    // 100% pure gold
  21: 0.875,  // 87.5% pure gold
  18: 0.75    // 75% pure gold
};
