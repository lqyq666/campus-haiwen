type BusinessLogFields = Record<
  string,
  boolean | number | string | null | undefined
>;

export function logBusinessEvent(
  event: string,
  fields: BusinessLogFields
): void {
  console.info(
    JSON.stringify({
      event,
      ...Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined)
      ),
    })
  );
}
