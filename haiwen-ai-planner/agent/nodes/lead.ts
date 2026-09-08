import { createLeadHandoffContext } from "@/domain/lead/handoff";
import { calculateLeadScore } from "@/domain/lead/scoring";
import type { HaiwenGraphStateType, HaiwenGraphUpdate } from "../state";

export function leadScore(state: HaiwenGraphStateType): HaiwenGraphUpdate {
  if (
    !(
      state.report &&
      state.studentProfile &&
      "targetCities" in state.studentProfile
    )
  ) {
    return { leadScore: null };
  }
  const score = calculateLeadScore({
    contact: state.leadContact ?? undefined,
    events: state.leadEvents ?? [],
    profile: state.studentProfile as never,
    report: state.report,
  });
  return {
    leadHandoffContext: state.leadContact
      ? createLeadHandoffContext(state.leadContact.leadId, state.report, score)
      : null,
    leadScore: score,
  };
}
