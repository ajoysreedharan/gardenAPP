export type ISODate = string; // 'YYYY-MM-DD', local calendar date
export type AreaId = 'terrace' | 'balconyA' | 'balconyB';
export type SpotType = 'pot' | 'bed';
export type SpotSize = 'small' | 'medium' | 'large';
export type PlantKind = 'fruitveg' | 'leafy' | 'flowering';

export interface Spot { id: string; area: AreaId; type: SpotType; size: SpotSize; note?: string; createdAt: ISODate }
export interface Plant { id: string; spotId: string; cropId: string; kind: PlantKind; plantedOn: ISODate; expectedEnd?: ISODate; endedOn?: ISODate }

export type CareType = 'fertilize' | 'soil';
export interface CareRule { id: string; spotId: string; type: CareType; intervalDays: number | 'afterCrop'; initialDue: ISODate }

export type LogKind = 'fertilize' | 'soil' | 'spray' | 'till' | 'prune' | 'harvest' | 'plant' | 'crop_end' | 'note';
export interface LogEntry { id: string; date: ISODate; kind: LogKind; spotId?: string; place?: string; text?: string; taskId?: string; courseId?: string }

export interface PlanTask {
  id: string; title: string; due: ISODate; spotIds: string[]; doneSpotIds: string[];
  place?: string; estMin: number; createdAt: ISODate; doneOn?: ISODate; source: 'user' | 'prep';
}
export interface Problem { id: string; spotId: string; text: string; seenOn: ISODate; photo?: Blob; resolvedOn?: ISODate }
export interface SprayCourse { id: string; problemId: string; spotId: string; product: string; total: number; intervalDays: number; startDue: ISODate; doneDates: ISODate[] }
export interface Seed { id: string; cropId: string; form: 'seed' | 'sapling'; note?: string }

export interface Durations { fertilize: Record<SpotType, number>; soil: Record<SpotType, number>; spray: number; till: number; plan: number }
export interface Settings { budgetMin: number; durations: Durations; lastBackupOn?: ISODate }
