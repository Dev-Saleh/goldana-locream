/**
 * Storage Utilities for Gold Calculator
 * 
 * This module provides centralized localStorage operations with consistent
 * error handling and default value management.
 */

/**
 * Generic localStorage getter with default value support
 * @param {string} key - The localStorage key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @param {string} type - Type of value ('number', 'string', 'object')
 * @returns {any} The stored value or default value
 */
function getStorageValue(key, defaultValue, type = 'string') {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return defaultValue;
    
    switch (type) {
      case 'number':
        return parseFloat(saved);
      case 'object':
        return JSON.parse(saved);
      case 'string':
      default:
        return saved;
    }
  } catch (error) {
    console.warn(`Error reading from localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Generic localStorage setter with error handling
 * @param {string} key - The localStorage key
 * @param {any} value - Value to store
 * @param {string} type - Type of value ('number', 'string', 'object')
 */
function setStorageValue(key, value, type = 'string') {
  try {
    const valueToStore = type === 'object' ? JSON.stringify(value) : String(value);
    localStorage.setItem(key, valueToStore);
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
  }
}

// Storage Keys Constants
export const STORAGE_KEYS = {
  MANUFACTURING_SETTINGS: 'goldManufacturingSettings',
  BUY_DISCOUNT: 'buyDiscount',
  FLUCTUATION_RANGE: 'fluctuationRange',
  FIXED_MANUFACTURING_FEE: 'fixedManufacturingFee',
  CR_NUMBER: 'crNumber',
  VAT_NUMBER: 'vatNumber'
};

// Default Values
export const DEFAULT_VALUES = {
  BUY_DISCOUNT: 20,
  FLUCTUATION_RANGE: 1,
  FIXED_MANUFACTURING_FEE: 500,
  CR_NUMBER: '2053175911',
  VAT_NUMBER: '2053175911'
};

// Specific storage functions for each setting
export const StorageManager = {
  // Manufacturing Settings
  getManufacturingSettings: (defaultSettings) => 
    getStorageValue(STORAGE_KEYS.MANUFACTURING_SETTINGS, defaultSettings, 'object'),
  
  setManufacturingSettings: (settings) => 
    setStorageValue(STORAGE_KEYS.MANUFACTURING_SETTINGS, settings, 'object'),

  // Buy Discount
  getBuyDiscount: () => 
    getStorageValue(STORAGE_KEYS.BUY_DISCOUNT, DEFAULT_VALUES.BUY_DISCOUNT, 'number'),
  
  setBuyDiscount: (value) => 
    setStorageValue(STORAGE_KEYS.BUY_DISCOUNT, value, 'number'),

  // Fluctuation Range
  getFluctuationRange: () => 
    getStorageValue(STORAGE_KEYS.FLUCTUATION_RANGE, DEFAULT_VALUES.FLUCTUATION_RANGE, 'number'),
  
  setFluctuationRange: (value) => 
    setStorageValue(STORAGE_KEYS.FLUCTUATION_RANGE, value, 'number'),

  // Fixed Manufacturing Fee
  getFixedManufacturingFee: () => 
    getStorageValue(STORAGE_KEYS.FIXED_MANUFACTURING_FEE, DEFAULT_VALUES.FIXED_MANUFACTURING_FEE, 'number'),
  
  setFixedManufacturingFee: (value) => 
    setStorageValue(STORAGE_KEYS.FIXED_MANUFACTURING_FEE, value, 'number'),

  // CR Number
  getCRNumber: () => 
    getStorageValue(STORAGE_KEYS.CR_NUMBER, DEFAULT_VALUES.CR_NUMBER, 'string'),
  
  setCRNumber: (value) => 
    setStorageValue(STORAGE_KEYS.CR_NUMBER, value, 'string'),

  // VAT Number
  getVATNumber: () => 
    getStorageValue(STORAGE_KEYS.VAT_NUMBER, DEFAULT_VALUES.VAT_NUMBER, 'string'),
  
  setVATNumber: (value) => 
    setStorageValue(STORAGE_KEYS.VAT_NUMBER, value, 'string')
};
