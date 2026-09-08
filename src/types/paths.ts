export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export interface PathRecord {
  id: string;
  sequence: Direction[];
  pathCoordinates: [number, number][];
  startPos: [number, number];
  targetPos: [number, number];
  gridDimension: number;
  stepsCount: number;
  slipsCount: number;
  accumulatedReward: number;
  reachedGoal: boolean;
  slipProb: number;
  survivorName: string;
  timestamp: string;
}

export interface CustomMapRecord {
  id: string;
  name: string;
  description?: string;
  dimension: number;
  grid: number[][]; // 0: empty, 1: obstacle, 2: hazard, 3: start, 4: target person
  startPos: [number, number];
  targetPos: [number, number];
  createdAt: string;
  source?: "uploaded" | "preset" | "edited";
}
