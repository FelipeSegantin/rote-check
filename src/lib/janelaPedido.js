// Calcula até que horas dá pra pedir uma coleta por demanda, com base nas
// saídas do roteiro fixo do coletor que atende o cliente (ver
// clientesEsperados.js pra descobrir qual coletor é esse).
//
// Pedido do Felipe: cada saída (ex.: 13:45, 15:00, 15:30, 16:30) aceita
// pedido novo até o próprio horário dela — depois desse horário, o pedido
// só entra na saída seguinte que ainda não tiver passado. Se já passou do
// horário de todas as saídas de hoje, não dá mais pra pedir hoje.

export const MINUTOS_ANTECEDENCIA = 0;

// Mesma regra usada na tela do coletor (ColetorHome.jsx): domingo não tem
// roteiro fixo, então não tem saída nenhuma pra valer como prazo.
export function diaSemanaHoje(data = new Date()) {
  const d = data.getDay(); // 0=domingo...6=sábado
  return d === 0 ? null : d;
}

export function paraMinutos(hhmm) {
  const [h, m] = String(hhmm || "")
    .split(":")
    .map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function paraHHMM(minutos) {
  const h = Math.floor(minutos / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutos % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// paradas: linhas de paradas_fixas (já filtradas pelo coletor_id certo).
// Extrai as saídas únicas (saida_numero + horario_saida) de hoje, na
// ordem em que saem.
function saidasDeHoje(paradas, agora) {
  const diaSemana = diaSemanaHoje(agora);
  if (diaSemana === null) return []; // domingo: sem roteiro, sem saída

  const vistos = new Set();
  const saidas = [];
  for (const p of paradas || []) {
    if (!(p.dias_semana || []).includes(diaSemana)) continue;
    const minutos = paraMinutos(p.horario_saida);
    if (minutos === null) continue;
    const chave = `${p.saida_numero}-${p.horario_saida}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saidas.push({ saida_numero: p.saida_numero, horario_saida: p.horario_saida, minutos });
  }
  saidas.sort((a, b) => a.minutos - b.minutos);
  return saidas;
}

// Retorna o status da janela de pedido pra esse cliente agora:
// - { temRota: false } — cliente não tem rota conhecida (ou rota sem
//   saída hoje, ex.: domingo) — sem restrição de horário, como sempre foi.
// - { temRota: true, disponivel: true, saida, limite } — ainda dá tempo
//   de pedir; "limite" é o horário máximo (HH:MM) e "saida" o horário da
//   saída que esse pedido ainda alcança.
// - { temRota: true, disponivel: false, ultimaSaida } — já passou do
//   prazo de todas as saídas de hoje.
export function calcularJanelaPedido(paradas, agora = new Date()) {
  const saidas = saidasDeHoje(paradas, agora);
  if (saidas.length === 0) return { temRota: false };

  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const proxima = saidas.find((s) => s.minutos - minutosAgora >= MINUTOS_ANTECEDENCIA);

  if (proxima) {
    return {
      temRota: true,
      disponivel: true,
      saida: proxima.horario_saida,
      limite: paraHHMM(proxima.minutos - MINUTOS_ANTECEDENCIA),
    };
  }

  return {
    temRota: true,
    disponivel: false,
    ultimaSaida: saidas[saidas.length - 1].horario_saida,
  };
}
