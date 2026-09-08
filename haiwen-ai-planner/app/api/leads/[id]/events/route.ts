import { z } from "zod";
import { getRuntimeSchoolDataRepositories } from "@/lib/repositories/school-data";

const schema = z.object({
  eventKey: z.string().min(1).optional(),
  type: z.enum([
    "ASSESSMENT_COMPLETED",
    "REPORT_VIEWED",
    "REQUESTED_CONSULTATION",
    "RETURN_VISIT",
  ]),
});
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }
  const { id } = await context.params;
  await getRuntimeSchoolDataRepositories().leadRepository.addLeadEvent({
    eventKey: parsed.data.eventKey,
    id: crypto.randomUUID(),
    leadId: id,
    occurredAt: new Date().toISOString(),
    type: parsed.data.type,
  });
  return Response.json({ ok: true });
}
