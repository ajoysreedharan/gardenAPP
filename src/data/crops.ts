import type { PlantKind, SpotSize } from '../domain/types';
import type { Season } from '../domain/seasons';

export type SowMethod = 'transplant' | 'direct' | 'sapling';
export interface Crop { id: string; name: string; kind: PlantKind; seasons: Season[]; method: SowMethod; daysToHarvest: number; minSize: SpotSize; creeper?: boolean }

const ALL: Season[] = ['monsoon', 'winter', 'summer'];
const SM: Season[] = ['summer', 'monsoon'];

// Starter list of common Pune home-garden crops. Days to harvest are rough.
export const CROPS: Crop[] = [
  { id: 'tomato', name: 'Tomato', kind: 'fruitveg', seasons: ['winter', 'summer'], method: 'transplant', daysToHarvest: 75, minSize: 'medium' },
  { id: 'chilli', name: 'Chilli', kind: 'fruitveg', seasons: ALL, method: 'transplant', daysToHarvest: 80, minSize: 'medium' },
  { id: 'brinjal', name: 'Brinjal', kind: 'fruitveg', seasons: ['monsoon', 'winter'], method: 'transplant', daysToHarvest: 80, minSize: 'medium' },
  { id: 'capsicum', name: 'Capsicum', kind: 'fruitveg', seasons: ['winter'], method: 'transplant', daysToHarvest: 80, minSize: 'medium' },
  { id: 'bhindi', name: 'Bhindi (okra)', kind: 'fruitveg', seasons: SM, method: 'direct', daysToHarvest: 50, minSize: 'medium' },
  { id: 'karela', name: 'Karela (bitter gourd)', kind: 'fruitveg', seasons: SM, method: 'direct', daysToHarvest: 60, minSize: 'large', creeper: true },
  { id: 'dudhi', name: 'Dudhi (bottle gourd)', kind: 'fruitveg', seasons: SM, method: 'direct', daysToHarvest: 60, minSize: 'large', creeper: true },
  { id: 'cucumber', name: 'Cucumber', kind: 'fruitveg', seasons: SM, method: 'direct', daysToHarvest: 50, minSize: 'medium', creeper: true },
  { id: 'beans', name: 'Beans', kind: 'fruitveg', seasons: ['monsoon', 'winter'], method: 'direct', daysToHarvest: 55, minSize: 'medium' },
  { id: 'peas', name: 'Peas', kind: 'fruitveg', seasons: ['winter'], method: 'direct', daysToHarvest: 65, minSize: 'medium' },
  { id: 'radish', name: 'Radish', kind: 'fruitveg', seasons: ['winter'], method: 'direct', daysToHarvest: 35, minSize: 'medium' },
  { id: 'carrot', name: 'Carrot', kind: 'fruitveg', seasons: ['winter'], method: 'direct', daysToHarvest: 75, minSize: 'medium' },
  { id: 'palak', name: 'Palak (spinach)', kind: 'leafy', seasons: ['winter', 'monsoon'], method: 'direct', daysToHarvest: 35, minSize: 'small' },
  { id: 'methi', name: 'Methi (fenugreek)', kind: 'leafy', seasons: ['winter'], method: 'direct', daysToHarvest: 25, minSize: 'small' },
  { id: 'coriander', name: 'Coriander', kind: 'leafy', seasons: ['winter'], method: 'direct', daysToHarvest: 35, minSize: 'small' },
  { id: 'amaranth', name: 'Amaranth (chauli)', kind: 'leafy', seasons: SM, method: 'direct', daysToHarvest: 30, minSize: 'small' },
  { id: 'lettuce', name: 'Lettuce', kind: 'leafy', seasons: ['winter'], method: 'direct', daysToHarvest: 45, minSize: 'small' },
  { id: 'spring-onion', name: 'Spring onion', kind: 'leafy', seasons: ['winter'], method: 'direct', daysToHarvest: 50, minSize: 'small' },
  { id: 'marigold', name: 'Marigold', kind: 'flowering', seasons: ALL, method: 'transplant', daysToHarvest: 60, minSize: 'small' },
  { id: 'zinnia', name: 'Zinnia', kind: 'flowering', seasons: SM, method: 'direct', daysToHarvest: 50, minSize: 'small' },
  { id: 'guava', name: 'Guava', kind: 'fruitveg', seasons: ALL, method: 'sapling', daysToHarvest: 365, minSize: 'large' },
  { id: 'lemon', name: 'Lemon', kind: 'fruitveg', seasons: ALL, method: 'sapling', daysToHarvest: 365, minSize: 'large' },
  { id: 'papaya', name: 'Papaya', kind: 'fruitveg', seasons: ALL, method: 'sapling', daysToHarvest: 365, minSize: 'large' },
];

export function cropById(id: string): Crop | undefined {
  return CROPS.find((c) => c.id === id);
}
