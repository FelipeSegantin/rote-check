// Rastreamento de "mensagem lida" no chat. Ainda não existe um campo de
// leitura no banco, então isso fica guardado no navegador (por
// dispositivo — não sincroniza entre aparelhos, mas já resolve o caso
// comum de "tem mensagem nova que eu não vi").
const PREFIXO = "rotecheck_chat_lido_";

export function marcarComoLido(coletaId) {
  try {
    localStorage.setItem(`${PREFIXO}${coletaId}`, new Date().toISOString());
  } catch {
    // localStorage indisponível (modo privado etc.) — segue sem marcar.
  }
}

function ultimaLeitura(coletaId) {
  try {
    return localStorage.getItem(`${PREFIXO}${coletaId}`);
  } catch {
    return null;
  }
}

// Agrupa uma lista de mensagens (de várias coletas OU de vários coletores —
// as duas conversas usam essa mesma função) na mais recente de cada
// conversa — base pra decidir o que está "não lido". Cada mensagem só tem
// coleta_id OU coletor_id preenchido (nunca os dois), então essa chave
// identifica a conversa nos dois casos.
export function mapaUltimasMensagens(mensagens) {
  const mapa = {};
  for (const m of mensagens) {
    const chave = m.coleta_id || m.coletor_id;
    const atual = mapa[chave];
    if (!atual || new Date(m.criado_em) > new Date(atual.criado_em)) {
      mapa[chave] = m;
    }
  }
  return mapa;
}

// Tem mensagem não lida numa conversa (de coleta ou de coletor) quando a
// última mensagem não foi enviada por mim e chegou depois da última vez
// que eu abri esse chat.
export function temNaoLida(chaveConversa, ultimaMsg, meuId) {
  if (!ultimaMsg || ultimaMsg.remetente_id === meuId) return false;
  const lida = ultimaLeitura(chaveConversa);
  if (!lida) return true;
  return new Date(ultimaMsg.criado_em) > new Date(lida);
}
