import type { HaiwenGraphUpdate } from "../state";

export type HaiwenNode = () => Promise<HaiwenGraphUpdate>;

const typedPlaceholder: HaiwenNode = async () => ({});

export const profileEnrichment = typedPlaceholder;
export const schoolMatching = typedPlaceholder;
export const roadmapGeneration = typedPlaceholder;
export const reportValidation = typedPlaceholder;
export const leadScore = typedPlaceholder;
