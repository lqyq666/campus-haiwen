import { chatModels, getCapabilities, isDemo } from "@/lib/ai/models";

export async function GET() {
  const headers = {
    "Cache-Control": "public, max-age=86400, s-maxage=86400",
  };

  const curatedCapabilities = await getCapabilities();

  if (isDemo) {
    return Response.json(
      { capabilities: curatedCapabilities, models: chatModels },
      { headers }
    );
  }

  return Response.json(curatedCapabilities, { headers });
}
