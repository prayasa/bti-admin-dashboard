function getRequiredEnvironmentVariable(
  name: string,
  value: string | undefined,
) {
  if (!value?.trim()) {
    throw new Error(
      `[Environment] Variabel ${name} belum dikonfigurasi.`,
    );
  }

  return value.trim();
}

function getValidUrl(name: string, value: string | undefined) {
  const normalizedValue = getRequiredEnvironmentVariable(
    name,
    value,
  );

  try {
    const url = new URL(normalizedValue);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Protocol tidak didukung.");
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(
      `[Environment] Nilai ${name} bukan URL yang valid.`,
    );
  }
}

const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const clientEnv = Object.freeze({
  supabaseUrl: getValidUrl(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabasePublicKey: getRequiredEnvironmentVariable(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY atau NEXT_PUBLIC_SUPABASE_ANON_KEY",
    supabasePublicKey,
  ),
  mapboxToken:
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || null,
});