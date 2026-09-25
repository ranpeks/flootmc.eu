import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_PETx6WMwU5PGKzKZKQJwgw_P5WUw_i4";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const allowedAdminEmails = new Set([
  "admin@flootmc.eu",
  "og_ranpeks@flootmc.eu",
  "betezx@flootmc.eu",
  "x_bartek_x@flootmc.eu",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://flootmc.eu",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function listAllUsers(adminClient: ReturnType<typeof createClient>) {
  const users = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!serviceKey) return json({ error: "Brak konfiguracji funkcji administracyjnej." }, 500);

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Nieprawidłowe żądanie." }, 400);
  }

  if (body.action === "request-reset") {
    const nick = typeof body.nick === "string" ? body.nick.trim().slice(0, 100).toLocaleLowerCase("pl") : "";
    let redirect: URL | null = null;
    try {
      if (typeof body.redirectTo === "string") redirect = new URL(body.redirectTo);
    } catch {
      redirect = null;
    }
    if (nick.length < 3 || !redirect || redirect.origin !== "https://flootmc.eu" || redirect.pathname !== "/reset-hasla/" || redirect.searchParams.get("recovery") !== "1") {
      return json({ error: "Nieprawidłowe żądanie." }, 400);
    }
    try {
      const users = await listAllUsers(adminClient);
      const user = users.find((candidate) => {
        const metadata = candidate.user_metadata ?? {};
        const names = [metadata.nickname, metadata.nick, metadata.username]
          .filter((value) => typeof value === "string")
          .map((value) => value.trim().toLocaleLowerCase("pl"));
        return names.includes(nick) || candidate.email?.toLocaleLowerCase("pl") === nick;
      });
      if (user?.email) {
        const { error } = await publicClient.auth.resetPasswordForEmail(user.email, { redirectTo: redirect.toString() });
        if (error) return json({ sent: false });
      }
    } catch {
      // Keep the response identical for unknown users and transient auth errors.
    }
    return json({ sent: true });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Zaloguj się ponownie." }, 401);
  const { data: { user: caller }, error: callerError } = await publicClient.auth.getUser(token);
  if (callerError || !caller?.email || !allowedAdminEmails.has(caller.email.toLowerCase())) {
    return json({ error: "Brak uprawnień administratora." }, 403);
  }

  if (body.action === "list-users") {
    try {
      const users = await listAllUsers(adminClient);
      return json({ users: users.map((user) => ({
        id: user.id,
        email: user.email ?? "",
        createdAt: user.created_at,
        emailConfirmed: Boolean(user.email_confirmed_at),
        nickname: typeof user.user_metadata?.nickname === "string"
          ? user.user_metadata.nickname
          : typeof user.user_metadata?.nick === "string" ? user.user_metadata.nick : "",
        fullName: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "",
      })) });
    } catch {
      return json({ error: "Nie udało się pobrać użytkowników." }, 502);
    }
  }

  if (body.action === "update-user") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: "Nieprawidłowe konto." }, 400);
    }
    const { data: found, error: findError } = await adminClient.auth.admin.getUserById(userId);
    if (findError || !found.user) return json({ error: "Nie znaleziono konta." }, 404);
    const isConfiguredAdmin = Boolean(found.user.email && allowedAdminEmails.has(found.user.email.toLowerCase()));

    const updates: Record<string, unknown> = {};
    if (typeof body.email === "string" && body.email.trim() && body.email.trim() !== found.user.email) {
      if (isConfiguredAdmin) return json({ error: "Adresu email administratora nie można zmienić z tego panelu, ponieważ jest używany do logowania." }, 400);
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "Podaj prawidłowy adres email." }, 400);
      updates.email = email;
    }
    const userMetadata = { ...(found.user.user_metadata ?? {}) };
    if (typeof body.nickname === "string") {
      const nickname = body.nickname.trim();
      if (isConfiguredAdmin && nickname.toLowerCase() !== String(found.user.user_metadata?.nickname ?? "").toLowerCase()) {
        return json({ error: "Nicka administratora nie można zmienić z tego panelu, ponieważ jest używany do logowania." }, 400);
      }
      if (nickname.length < 3) return json({ error: "Nick musi mieć co najmniej 3 znaki." }, 400);
      if (nickname.length > 40) return json({ error: "Nick może mieć maksymalnie 40 znaków." }, 400);
      userMetadata.nickname = nickname;
      updates.user_metadata = userMetadata;
    }
    if (typeof body.fullName === "string") {
      const fullName = body.fullName.trim();
      if (fullName.length > 100) return json({ error: "Nazwa może mieć maksymalnie 100 znaków." }, 400);
      userMetadata.full_name = fullName;
      updates.user_metadata = userMetadata;
    }
    if (typeof body.password === "string" && body.password.length) {
      if (body.password.length < 6 || body.password.length > 128) return json({ error: "Hasło musi mieć od 6 do 128 znaków." }, 400);
      updates.password = body.password;
    }
    if (!Object.keys(updates).length) return json({ error: "Nie podano zmian." }, 400);
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, updates);
    if (updateError) return json({ error: "Nie udało się zapisać zmian konta." }, 400);
    return json({ saved: true, emailConfirmationRequired: Boolean(updates.email) });
  }

  return json({ error: "Nieznana operacja." }, 400);
});
