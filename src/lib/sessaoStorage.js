// Controla onde a sessão de login fica guardada: no localStorage (sobrevive
// a fechar o navegador/app e abrir de novo depois — é o padrão, pra ninguém
// precisar digitar a senha toda vez) ou no sessionStorage (some assim que a
// aba/navegador fecha), conforme a checkbox "Manter-me conectado" na tela
// de Login. Usado tanto pelo Supabase de verdade (via a opção `storage` do
// createClient, em supabase.js) quanto pelo modo demonstração (mockSupabase.js),
// pra funcionar igual nos dois.

// A própria preferência (a bandeirinha "manter conectado ou não") sempre
// fica no localStorage — ela não é informação sensível, é só uma escolha de
// UX, e precisa sobreviver mesmo quando a pessoa optou por NÃO manter a
// sessão guardada.
const CHAVE_PREFERENCIA = "rotecheck_manter_conectado";

export function definirManterConectado(manter) {
  try {
    localStorage.setItem(CHAVE_PREFERENCIA, manter ? "1" : "0");
  } catch {
    // localStorage indisponível (modo privado etc.) — segue com o padrão
    // (manter conectado), que é aplicado em manterConectadoAtivo() abaixo.
  }
}

function manterConectadoAtivo() {
  try {
    // Sem preferência salva ainda (primeiro acesso, ou storage
    // indisponível) = mantém conectado por padrão.
    return localStorage.getItem(CHAVE_PREFERENCIA) !== "0";
  } catch {
    return true;
  }
}

// Por fora, um objeto de storage comum (getItem/setItem/removeItem, igual
// localStorage/sessionStorage) — é o formato que o @supabase/supabase-js
// espera na opção `auth.storage`. Por dentro, decide na hora de cada
// leitura/escrita se usa o localStorage ou o sessionStorage, conforme a
// preferência atual.
export const storageSessaoAdaptativo = {
  getItem(chave) {
    try {
      return (manterConectadoAtivo() ? localStorage : sessionStorage).getItem(chave);
    } catch {
      return null;
    }
  },
  setItem(chave, valor) {
    try {
      (manterConectadoAtivo() ? localStorage : sessionStorage).setItem(chave, valor);
    } catch {
      // segue sem persistir (modo privado etc.)
    }
  },
  removeItem(chave) {
    try {
      // Remove dos dois pra não deixar sessão "fantasma" esquecida no outro
      // storage caso a pessoa tenha trocado a preferência entre logins.
      localStorage.removeItem(chave);
      sessionStorage.removeItem(chave);
    } catch {
      // ignora
    }
  },
};
