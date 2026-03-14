/**
 * Soil types used for crop recommendations and user profile.
 * Values must match backend Crop model soilTypes enum for recommendations to work.
 */
export const SOIL_TYPES = [
  { value: 'alluvial', label: 'Alluvial Soil' },
  { value: 'black', label: 'Black Soil' },
  { value: 'red', label: 'Red Soil' },
  { value: 'laterite', label: 'Laterite Soil' },
  { value: 'mountain', label: 'Mountain Soil' },
  { value: 'saline', label: 'Saline Soil' },
  { value: 'desert', label: 'Desert Soil' },
] as const;

export type SoilTypeValue = (typeof SOIL_TYPES)[number]['value'];

export function getSoilTypeLabel(value: string): string {
  return SOIL_TYPES.find((s) => s.value === value)?.label ?? value;
}
