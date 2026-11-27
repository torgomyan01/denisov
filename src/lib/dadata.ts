export type DadataAddressSuggestion = {
  value: string;
  unrestricted_value: string;
  lat: number | null;
  lng: number | null;
  /** Short street + house for UI */
  label: string;
  street?: string;
  streetFiasId?: string | null;
  house?: string;
};

type DadataRawSuggestion = {
  value?: string;
  unrestricted_value?: string;
  data?: {
    geo_lat?: string | null;
    geo_lon?: string | null;
    street_with_type?: string | null;
    street_fias_id?: string | null;
    house?: string | null;
    block_type?: string | null;
    block?: string | null;
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

const formatHouse = (data: DadataRawSuggestion["data"]): string => {
  const house = data?.house?.trim() || "";
  const block = data?.block?.trim() || "";
  const blockType = data?.block_type?.trim() || "";
  if (!house) return "";
  if (!block) return house;
  return blockType ? `${house} ${blockType} ${block}` : `${house} ${block}`;
};

const buildLabel = (row: DadataRawSuggestion): string => {
  const street = row.data?.street_with_type?.trim() || "";
  const house = formatHouse(row.data);
  if (street && house) return `${street}, ${house}`;
  if (street) return street;
  return (row.value || row.unrestricted_value || "").trim();
};

const SPB_LOCATIONS = [
  { city: "Санкт-Петербург" },
  { region: "Ленинградская" },
];

const callDadataSuggest = async (
  body: Record<string, unknown>,
): Promise<DadataAddressSuggestion[]> => {
  const token = process.env.DADATA_API_KEY?.trim();
  if (!token) {
    throw new Error("DADATA_API_KEY не задан в .env");
  }

  const response = await fetch(
    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`DaData ошибка ${response.status}`);
  }

  const json = (await response.json()) as DadataSuggestResponse;
  const rows = Array.isArray(json.suggestions) ? json.suggestions : [];

  return rows
    .map((row): DadataAddressSuggestion | null => {
      const value = (row.value || "").trim();
      const unrestricted = (row.unrestricted_value || value).trim();
      if (!value && !unrestricted) return null;
      const street = row.data?.street_with_type?.trim() || "";
      const streetFiasId = row.data?.street_fias_id?.trim() || null;
      const house = formatHouse(row.data);
      return {
        value: value || unrestricted,
        unrestricted_value: unrestricted || value,
        lat: parseCoord(row.data?.geo_lat),
        lng: parseCoord(row.data?.geo_lon),
        label: buildLabel(row) || value || unrestricted,
        street,
        streetFiasId,
        house,
      };
    })
    .filter((row): row is DadataAddressSuggestion => row !== null);
};

/** Server-side DaData address suggest (API key never sent to the browser). */
export const suggestAddresses = async (
  query: string,
  count = 7,
): Promise<DadataAddressSuggestion[]> => {
  const q = query.trim();
  if (q.length < 2) return [];

  return callDadataSuggest({
    query: q,
    count: Math.min(20, Math.max(1, count)),
    locations: SPB_LOCATIONS,
    from_bound: { value: "street" },
    to_bound: { value: "house" },
  });
};

/** Server-side DaData street-only suggest in SPb & LO. */
export const suggestStreets = async (
  query: string,
  count = 7,
): Promise<DadataAddressSuggestion[]> => {
  const q = query.trim();
  if (q.length < 2) return [];

  return callDadataSuggest({
    query: q,
    count: Math.min(20, Math.max(1, count)),
    locations: SPB_LOCATIONS,
    from_bound: { value: "street" },
    to_bound: { value: "street" },
  });
};

/** Server-side DaData house suggest restricted to a selected street. */
export const suggestHouses = async (params: {
  streetFiasId?: string | null;
  street: string;
  query: string;
  count?: number;
}): Promise<DadataAddressSuggestion[]> => {
  const q = params.query.trim();
  const street = params.street.trim();
  const fiasId = params.streetFiasId?.trim() || "";
  const count = Math.min(20, Math.max(1, params.count ?? 10));

  if (!q) return [];

  if (fiasId) {
    return callDadataSuggest({
      query: q,
      count,
      locations: [{ street_fias_id: fiasId }],
      from_bound: { value: "house" },
      to_bound: { value: "house" },
    });
  }

  if (!street) return [];

  return callDadataSuggest({
    query: `${street}, ${q}`,
    count,
    locations: SPB_LOCATIONS,
    from_bound: { value: "street" },
    to_bound: { value: "house" },
  });
};
