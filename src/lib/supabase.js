import { createClient } from "@supabase/supabase-js";
import { criarClienteDemo } from "./mockSupabase";
import { storageSessaoAdaptativo } from "./sessaoStorage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sem credenciais reais, o app entra em modo demonstração: usa dados de
// exemplo guardados em memória em vez de travar com tela em branco. Assim
// que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY forem preenchidas (no
// .env local ou nas variáveis de ambiente do Netlify) e o app for
// reconstruído, ele volta a falar com o Supabase de verdade.
export const DEMO_MODE = !supabaseUrl || !supabaseAnonKey;

if (DEMO_MODE) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas — rodando em modo demonstração, com dados de exemplo."
  );
}

export const supabase = DEMO_MODE
  ? criarClienteDemo()
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Guarda a sessão no localStorage ou no sessionStorage conforme a
        // checkbox "Manter-me conectado" da tela de Login (ver
        // sessaoStorage.js) — assim quem marcar continua logado mesmo
        // fechando e reabrindo o app, sem precisar digitar a senha de novo.
        storage: storageSessaoAdaptativo,
      },
    });
