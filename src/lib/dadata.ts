export type DadataAddressSuggestion = {
  value: string;
  unrestricted_value: string;
  lat: number | null;
  lng: number | null;
  /** Short street + house for UI */
  label: string;
};

type DadataRawSuggestion = {
  value?: string;
  unrestricted_value?: string;
  data?: {
    geo_lat?: string | null;
    geo_lon?: string | null;
    street_with_type?: string | null;
    house?: string | null;
    city_with_type?: string | null;
    settlement_with_type?: string | null;
  };
};

type DadataSuggestResponse = {
  suggestions?: DadataRawSuggestion[];
};

const parseCoord = (raw: string | null | undefined): number | null => {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const buildLabel = (row: DadataRawSuggestion): string => {
  const street = row.data?.street_with_type?.trim() || "";
  const house = row.data?.house?.trim() || "";
  if (street && house) return `${street}, ${house}`;
  if (street) return street;
  return (row.value || row.unrestricted_value || "").trim();
};

/** Server-side DaData address suggest (API key never sent to the browser). */
export const suggestAddresses = async (
  query: string,
  count = 7,
): Promise<DadataAddressSuggestion[]> => {
  const token = process.env.DADATA_API_KEY?.trim();
  if (!token) {
    throw new Error("DADATA_API_KEY не задан в .env");
  }

  const q = query.trim();
  if (q.length < 2) return [];

  const response = await fetch(
    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({
        query: q,
        count: Math.min(20, Math.max(1, count)),
        // Café is in SPb — prefer city + region for delivery zone.
        locations: [
          { city: "Санкт-Петербург" },
          { region: "Ленинградская" },
        ],
        from_bound: { value: "street" },
        to_bound: { value: "house" },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`DaData ошибка ${response.status}`);
  }

  const json = (await response.json()) as DadataSuggestResponse;
  const rows = Array.isArray(json.suggestions) ? json.suggestions : [];

  return rows
    .map((row) => {
      const value = (row.value || "").trim();
      const unrestricted = (row.unrestricted_value || value).trim();
      if (!value && !unrestricted) return null;
      return {
        value: value || unrestricted,
        unrestricted_value: unrestricted || value,
        lat: parseCoord(row.data?.geo_lat),
        lng: parseCoord(row.data?.geo_lon),
        label: buildLabel(row) || value || unrestricted,
      } satisfies DadataAddressSuggestion;
    })
    .filter((row): row is DadataAddressSuggestion => Boolean(row));
};
