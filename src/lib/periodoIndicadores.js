// Filtro de período (Tudo/Hoje/Semana/Mês/Ano) da aba Indicadores — fica
// separado num arquivo próprio (em vez de dentro de AbaIndicadores.jsx)
// pra dar pra testar sozinho, mesmo padrão de janelaPedido.js.

export const PERIODOS = [
  { valor: "tudo", label: "Tudo" },
  { valor: "dia", label: "Hoje" },
  { valor: "semana", label: "Semana" },
  { valor: "mes", label: "Mês" },
  { valor: "ano", label: "Ano" },
];

// Calcula o intervalo [início, fim] do período escolhido, com base em
// "agora" — semana começa na segunda-feira (convenção usada no resto do
// app, ver janelaPedido.js). "tudo" devolve null (sem filtro nenhum).
export function calcularIntervaloPeriodo(periodo, agora = new Date()) {
  if (periodo === "dia") {
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
    const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
    return { inicio, fim };
  }
  if (periodo === "semana") {
    const diaSemana = agora.getDay(); // 0=domingo...6=sábado
    const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diasDesdeSegunda, 0, 0, 0, 0);
    const fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6, 23, 59, 59, 999);
    return { inicio, fim };
  }
  if (periodo === "mes") {
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
    return { inicio, fim };
  }
  if (periodo === "ano") {
    const inicio = new Date(agora.getFullYear(), 0, 1, 0, 0, 0, 0);
    const fim = new Date(agora.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { inicio, fim };
  }
  return null; // "tudo"
}

// Filtra uma lista de registros (qualquer um com campo "criado_em") pro
// período escolhido.
export function filtrarNoPeriodo(itens, periodo, agora = new Date()) {
  const intervalo = calcularIntervaloPeriodo(periodo, agora);
  if (!intervalo) return itens;
  return itens.filter((item) => {
    const data = new Date(item.criado_em);
    return data >= intervalo.inicio && data <= intervalo.fim;
  });
}
