// Dados de exemplo usados só pelo modo demonstração (ver mockSupabase.js).
// Não é usado quando o app tem VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY reais.

export const SENHA_DEMO = "demo123";

export const perfis = [
  {
    id: "demo-cliente",
    papel: "cliente",
    nome: "Ana Ferreira",
    estabelecimento: "Papelaria Ferreira",
    email: "demo.cliente@rotecheck.app",
    telefone: "(14) 99123-4567",
    // Propositalmente igual ao CNPJ do cliente esperado "AME" (MOTO) lá
    // embaixo — mesmo com o nome do estabelecimento diferente ("Papelaria
    // Ferreira" não bate com "AME"), o aviso de moto aparece assim mesmo,
    // porque agora casa primeiro pelo CNPJ. É só pra mostrar esse caso no
    // modo demonstração; não reflete o CNPJ real da Ana.
    cnpj: "07.506.784/0001-73",
    cep: "17010-000",
    endereco: "Rua Batista de Carvalho, 120, Centro, Bauru - SP",
    foto_url: null,
    aprovado: true,
  },
  {
    id: "demo-cliente-pendente",
    papel: "cliente",
    nome: "Roberto Nunes",
    estabelecimento: "Mercado Bom Preço",
    email: "roberto.nunes@rotecheck.app",
    telefone: "(14) 99666-8899",
    cnpj: "98.765.432/0001-10",
    cep: "17012-000",
    endereco: "Av. Duque de Caxias, 500, Vila Falcão, Bauru - SP",
    foto_url: null,
    aprovado: false,
  },
  {
    id: "demo-despachante",
    papel: "despachante",
    nome: "Marcos Lima",
    email: "demo.despachante@rotecheck.app",
    telefone: "(14) 99876-1234",
    foto_url: null,
    aprovado: true,
  },
  {
    id: "demo-gerente",
    papel: "gerente",
    nome: "Renata Souza",
    email: "demo.gerente@rotecheck.app",
    telefone: "(14) 99555-7788",
    foto_url: null,
    aprovado: true,
  },
  // Os 4 coletores abaixo têm os nomes de verdade do roteiro (planilha
  // ROTEIRO ATUALIZADO 2026) — cada um já tem seu roteiro fixo em
  // paradasFixas mais abaixo.
  {
    id: "demo-coletor",
    papel: "coletor",
    nome: "Ronald Silva",
    email: "demo.coletor@coletor.rotecheck.internal",
    usuario_coletor: "demo.coletor",
    telefone: "(14) 99222-3344",
    foto_url: null,
    aprovado: true,
    // Já começou o expediente hoje — só pra mostrar, no modo demo, os dois
    // estados (iniciado/não iniciado) juntos na aba Chat → Coletores dos
    // painéis de gerente/despachante. Os outros coletores abaixo ficam
    // "não iniciado" (sem esse campo).
    dia_iniciado_em: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: "demo-coletor-2",
    papel: "coletor",
    nome: "Pablo Souza",
    email: "demo.coletor2@coletor.rotecheck.internal",
    usuario_coletor: "demo.coletor2",
    telefone: "(14) 99333-2211",
    foto_url: null,
    aprovado: true,
  },
  {
    id: "demo-coletor-julio",
    papel: "coletor",
    nome: "Júlio Ramos",
    email: "demo.julio@coletor.rotecheck.internal",
    usuario_coletor: "demo.julio",
    telefone: "(14) 99111-5566",
    foto_url: null,
    aprovado: true,
  },
  {
    id: "demo-coletor-nei",
    papel: "coletor",
    nome: "Nei Andrade",
    email: "demo.nei@coletor.rotecheck.internal",
    usuario_coletor: "demo.nei",
    telefone: "(14) 99888-4477",
    foto_url: null,
    aprovado: true,
  },
  {
    id: "demo-coletor-pendente",
    papel: "coletor",
    nome: "Bruno Martins",
    email: "demo.coletor3@coletor.rotecheck.internal",
    usuario_coletor: "bruno.martins",
    telefone: "(14) 99777-6655",
    foto_url: null,
    aprovado: false,
  },
  {
    id: "demo-despachante-pendente",
    papel: "despachante",
    nome: "Camila Rocha",
    email: "camila.rocha@rotecheck.app",
    telefone: "(14) 99444-1122",
    foto_url: null,
    aprovado: false,
  },
];

const agora = Date.now();
const horas = (n) => new Date(agora + n * 3600 * 1000).toISOString();

// Início do dia local de hoje — os horários "de hoje" (coletas, mensagens,
// rota e trajeto de GPS mais abaixo) não podem cair antes disso, senão os
// filtros de "hoje" espalhados pelo app (ColetorHome, MapaRota etc.)
// excluem esses exemplos por engano. Isso só faz diferença quando o app é
// aberto de madrugada — "há N horas" cruzando a meia-noite pro dia
// anterior; no resto do dia o resultado é igual ao de horas(n).
const inicioDeHoje = new Date();
inicioDeHoje.setHours(0, 0, 0, 0);
const horasHoje = (n) => new Date(Math.max(agora + n * 3600 * 1000, inicioDeHoje.getTime())).toISOString();

export const coletas = [
  {
    id: "coleta-1",
    cliente_id: "demo-cliente",
    coletor_id: "demo-coletor",
    local: "Rua Batista de Carvalho, 120 - Centro",
    veiculo_tipo: "fiorino",
    tipo_produto: "caixa",
    horario_solicitado: horasHoje(-3),
    observacao: "Deixar na portaria se não tiver ninguém.",
    foto_url: null,
    status: "coletada",
    risco_atraso: false,
    motivo_recusa: null,
    criado_em: horasHoje(-4),
  },
  {
    id: "coleta-2",
    cliente_id: "demo-cliente",
    coletor_id: "demo-coletor",
    local: "Av. Nações Unidas, 890 - Jardim Panorama",
    veiculo_tipo: "van",
    tipo_produto: "fragil",
    horario_solicitado: horasHoje(1),
    observacao: "",
    foto_url: null,
    status: "aceita",
    risco_atraso: false,
    motivo_recusa: null,
    criado_em: horasHoje(-1),
  },
  {
    id: "coleta-3",
    cliente_id: "demo-cliente",
    coletor_id: null,
    local: "Rua Rio Branco, 55 - Vila América",
    veiculo_tipo: "moto",
    tipo_produto: "envelope",
    horario_solicitado: horasHoje(0.5),
    observacao: "Pedido de última hora.",
    foto_url: null,
    status: "pendente",
    risco_atraso: true,
    motivo_recusa: null,
    criado_em: horasHoje(-0.2),
  },
  {
    id: "coleta-4",
    cliente_id: "demo-cliente",
    coletor_id: null,
    local: "Rua Araújo Leite, 200 - Centro",
    veiculo_tipo: "fiorino",
    tipo_produto: "caixa",
    horario_solicitado: horasHoje(-6),
    observacao: "",
    foto_url: null,
    status: "recusada",
    risco_atraso: false,
    motivo_recusa: "Coleta de última hora — sem tempo hábil dentro do horário pedido.",
    criado_em: horasHoje(-7),
  },
];

// Chat existe só entre cliente e equipe (gerente/despachante) — não tem
// comunicação nenhuma entre cliente e coletor, nem o coletor tem acesso a
// chat.
export const mensagens = [
  {
    id: "msg-1",
    coleta_id: "coleta-2",
    remetente_id: "demo-cliente",
    texto: "Oi! O produto já está embalado e pronto.",
    criado_em: horasHoje(-0.9),
  },
  {
    id: "msg-2",
    coleta_id: "coleta-2",
    remetente_id: "demo-despachante",
    texto: "Perfeito, o coletor já está a caminho.",
    criado_em: horasHoje(-0.85),
  },
];

// Rota do dia de cada coletor — sequência pronta de paradas (coletas_ordem)
// definida pelo despachante/gerente, pra o coletor ver a ordem certinha em
// vez de uma lista solta.
export const rotas = [
  {
    id: "rota-1",
    coletor_id: "demo-coletor",
    data: new Date(agora).toISOString().slice(0, 10),
    coletas_ordem: ["coleta-1", "coleta-2"],
    editado_manualmente: false,
    criado_em: horasHoje(-5),
  },
];

// Frota cadastrada pelo gerente — controle de placa/tipo/disponibilidade.
export const veiculos = [
  {
    id: "veiculo-1",
    placa: "FIO1A23",
    tipo: "fiorino",
    status: "disponivel",
    criado_em: horas(-200),
  },
  {
    id: "veiculo-2",
    placa: "VAN2B34",
    tipo: "van",
    status: "manutencao",
    observacao: "Batida no para-choque traseiro.",
    criado_em: horas(-150),
  },
  {
    id: "veiculo-3",
    placa: "MOT3C45",
    tipo: "moto",
    status: "disponivel",
    criado_em: horas(-90),
  },
];

// Pontos de GPS de exemplo pro coletor demo — um trajeto de hoje (pra
// mostrar o "ao vivo") e outro de ontem (pra mostrar o histórico revisitável
// funcionando de cara, sem precisar esperar o coletor andar de verdade).
// Formam um percurso em zigue-zague pelo centro de Bauru, minuto a minuto.
// Recebe o horário-base já pronto (em ms) em vez de um offset em horas a
// partir de "agora", pra não arriscar cruzar a meia-noite e o trajeto de
// "ontem" acabar caindo em outro dia dependendo da hora em que o app roda.
function trajeto(rotuloId, baseMs, latInicial, lonInicial) {
  const pontos = [];
  let lat = latInicial;
  let lon = lonInicial;
  for (let i = 0; i < 18; i++) {
    lat += (i % 3 === 0 ? 1 : -0.4) * 0.0009;
    lon += 0.0013;
    pontos.push({
      id: `gps-${rotuloId}-${i}`,
      coletor_id: "demo-coletor",
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      registrado_em: new Date(baseMs + i * 60 * 1000).toISOString(),
    });
  }
  return pontos;
}

// "Ontem" com hora fixa (10h) em vez de "agora - 24h", pra garantir que cai
// no dia anterior de verdade não importa em que horário o app for aberto.
const ontemMeioDia = new Date();
ontemMeioDia.setDate(ontemMeioDia.getDate() - 1);
ontemMeioDia.setHours(10, 0, 0, 0);

export const posicoesGps = [
  // Hoje: começou há 2h (ou desde a meia-noite, se o app for aberto de
  // madrugada — ver horasHoje acima), ponto mais recente há pouco (ainda
  // "andando").
  ...trajeto("hoje", Math.max(agora - 2 * 3600 * 1000, inicioDeHoje.getTime()), -22.315, -49.075),
  // Ontem: trajeto completo do dia anterior, só pra consulta histórica.
  ...trajeto("ontem", ontemMeioDia.getTime(), -22.318, -49.07),
];
export const pushSubscriptions = [];

// Prints salvos de saídas do coletor (ver ColetorHome.jsx — "Iniciar
// rota"/"Finalizar rota") — começa vazio, cada um é gerado de verdade ao
// finalizar uma saída, pra dar pra testar o fluxo completo em vez de só
// mostrar um exemplo fixo.
export const printsRotas = [];

// Convites de equipe (despachante/gerente só entram com um destes — ver
// Cadastro.jsx). Um já pronto aqui só pra dar pra ver a tela de "Convites"
// funcionando no modo demonstração sem precisar gerar um primeiro.
export const convites = [
  {
    id: "convite-demo-1",
    codigo: "DESP-DEMO1",
    papel: "despachante",
    criado_por: "demo-gerente",
    usado: false,
    usado_por: null,
    usado_em: null,
    criado_em: horas(-20),
  },
];

// Paradas fixas (roteiro semanal) — importado da planilha "ROTEIRO
// ATUALIZADO 2026" que o Felipe mandou. Cada uma é um lugar que o
// coletor já atende sempre, todo dia (dias_semana com os 6 dias) ou só
// em dias certos da semana (ex.: terça e quinta). horario_saida e
// veiculo já vêm da planilha — nada disso é escolhido no app. Endereços
// que NÃO têm uma linha aqui são "por demanda": o cliente pede pelo app
// normalmente.
export const paradasFixas = [
  { id: "parada-1", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:45", veiculo: "CARRO", nome: "BETA ETIQUETAS", endereco: "DUQUE DE CAXIAS 18-38", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-2", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:45", veiculo: "CARRO", nome: "AMAZONIA BRASILEIRA", endereco: "JORGE SCHNEYDER FILHO 8-56", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-3", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:45", veiculo: "CARRO", nome: "ELEMENTS", endereco: "DAVID PEREIRA COIMBRA 1-82", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-4", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:45", veiculo: "CARRO", nome: "NSM FERRARI", endereco: "CAPITAO ALCIDES 3-49", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-5", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:00", veiculo: "CARRO", nome: "UNIMED BAURU", endereco: "GUSTAVO MACIEL 11-30", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-6", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:00", veiculo: "CARRO", nome: "GABEL", endereco: "PRIMEIRO DE AGOSTO 4-20", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-7", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:00", veiculo: "CARRO", nome: "HOSP BENEFICENCIA", endereco: "RIO BRANCO 13-83", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-8", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:30", veiculo: "CARRO", nome: "OI MATILDA", endereco: "ALFREDO FONTÃO 3-19", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-9", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:30", veiculo: "CARRO", nome: "QUEEN SEMIJOIAS", endereco: "NOSSA SRA DE FATIMA 10-24", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-10", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:30", veiculo: "CARRO", nome: "FAGA", endereco: "JOSE ANTONIO BRAGA 5-56", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-11", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:30", veiculo: "CARRO", nome: "MED FIRST", endereco: "AZARIAS LEITE 17-28 BOX SL S2", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-12", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:30", veiculo: "CARRO", nome: "PATRAL", endereco: "DOMICIANO SILVA 1-46", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 5, ativa: true },
  { id: "parada-13", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:30", veiculo: "CARRO", nome: "DT WITZLER", endereco: "TREZE DE MAIO 14-05", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 6, ativa: true },
  { id: "parada-14", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "16:30", veiculo: "CARRO", nome: "DROGAVET", endereco: "GETULIO VARGAS 10-40", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-15", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "16:30", veiculo: "CARRO", nome: "COCKER SHOES", endereco: "AVDR MARQUES DE PINEDO 12-83", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-16", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "16:30", veiculo: "CARRO", nome: "BIOCOSMETICOS", endereco: "NEDER ISSA 2-40", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-17", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "16:30", veiculo: "CARRO", nome: "GLOW BEAUTY", endereco: "NEDER ISSA 1-80 - SL 02", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-18", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "16:30", veiculo: "CARRO", nome: "MOCA DO POP", endereco: "NEDER ISSA 1-80 - SL 03", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 5, ativa: true },
  { id: "parada-19", coletor_id: "demo-coletor", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "16:30", veiculo: "CARRO", nome: "FITO NATUREZA", endereco: "GUSTAVO MACIEL 19-85", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 6, ativa: true },
  { id: "parada-20", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:00", veiculo: "CARRO", nome: "PAGUE MENOS", endereco: "GETULIO VARGAS 15-06", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-21", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:00", veiculo: "CARRO", nome: "LUZ DA LUA", endereco: "BAURU SHOPPING PISO 2", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-22", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:00", veiculo: "CARRO", nome: "AUTHENTIC", endereco: "BAURU SHOPPING PISO 2", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-23", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:00", veiculo: "CARRO", nome: "DAMYLLER", endereco: "BAURU SHOPPING PISO 2", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-24", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:00", veiculo: "CARRO", nome: "CENTAURO", endereco: "BAURU SHOPPING PISO 2", dias_semana: [2, 5], ordem: 5, ativa: true },
  { id: "parada-25", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:00", veiculo: "CARRO", nome: "LUIZA BARCELOS", endereco: "BAURU SHOPPING PISO 1", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 6, ativa: true },
  { id: "parada-26", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:00", veiculo: "CARRO", nome: "TXC", endereco: "BAURU SHOPPING PISO 1", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 7, ativa: true },
  { id: "parada-27", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "13:00", veiculo: "CARRO", nome: "MENINA SHOES", endereco: "BAURU SHOPPING PISO 1", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 8, ativa: true },
  { id: "parada-28", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "14:30", veiculo: "CARRO", nome: "GAFEL", endereco: "AGOSTINHO FORNETTI 6-50", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-29", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "14:30", veiculo: "CARRO", nome: "BAURUINFO", endereco: "GERSON FRANCA 9-49", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-30", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "15:30", veiculo: "CARRO", nome: "ILUMAC", endereco: "LUIZ PEREIRA DA SILVA 1-325", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-31", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "15:30", veiculo: "CARRO", nome: "CETRO", endereco: "BUSINESS PARK", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-32", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 4, horario_saida: "16:45", veiculo: "CARRO", nome: "DISBAUTO", endereco: "JOSE PINELLI 2-10", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-33", coletor_id: "demo-coletor-2", base: "AGF RIO BRANCO", saida_numero: 4, horario_saida: "16:45", veiculo: "CARRO", nome: "CEDIS", endereco: "VIA HORACIO FREDERICO PYLES", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-34", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "14:00", veiculo: "CARRO", nome: "HOSP ESTADUAL", endereco: "PROTOCOLO / TRANSPORTE", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-35", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "14:00", veiculo: "CARRO", nome: "MEDCONTROL", endereco: "JACY STEVAUX VILLACA 2-66", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-36", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "14:00", veiculo: "CARRO", nome: "ACUSTICA ORLANDI", endereco: "WILMA BERGAMO A. ARRAGE 2-29", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-37", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "14:00", veiculo: "CARRO", nome: "CH HINKE", endereco: "ALBERTO SEGALLA 1-75", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-38", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "14:00", veiculo: "CARRO", nome: "PROTEC HORSE", endereco: "JOSE FERREIRA MARQUES 4-26", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 5, ativa: true },
  { id: "parada-39", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "14:00", veiculo: "CARRO", nome: "SIN IMPLANTE", endereco: "OCTAVIO P BRISOLLA 12-55", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 6, ativa: true },
  { id: "parada-40", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:30", veiculo: "CARRO", nome: "BAUMMER", endereco: "CRUZEIRO DO SUL 6-60", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-41", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:30", veiculo: "CARRO", nome: "TILIBRA", endereco: "AYMORES 6-09", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-42", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:30", veiculo: "CARRO", nome: "BRUNA", endereco: "MONTEIRO LOBATO 4-45", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-43", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "15:30", veiculo: "CARRO", nome: "ALG BRASIL", endereco: "HERMINIO PINTO 8-65", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-44", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "16:45", veiculo: "CARRO", nome: "ALFER", endereco: "ANTONIO ALVES 16-29", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-45", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "16:45", veiculo: "CARRO", nome: "PSICOVITA", endereco: "SAINT MARTIN 24-78", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-46", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "16:45", veiculo: "CARRO", nome: "NEODENT", endereco: "OCTAVIO P BRISOLLA 7-46", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-47", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "16:45", veiculo: "CARRO", nome: "DENTAL ORTOLINE", endereco: "ANTONIO GARCIA 10-06", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-48", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "16:45", veiculo: "CARRO", nome: "DONNA SHAPE", endereco: "JOAQUIM SILVA MARTHA 12-41", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 5, ativa: true },
  { id: "parada-49", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 4, horario_saida: "17:30", veiculo: "CARRO", nome: "GAS", endereco: "ALPHEU JOSE RIBAS SAMPAIO 3-52", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-50", coletor_id: "demo-coletor-julio", base: "AGF RIO BRANCO", saida_numero: 5, horario_saida: "17:50", veiculo: "CARRO", nome: "LETICIA MAGALHAES", endereco: "PRIMEIRO DE AGOSTO 4-47", dias_semana: [2], ordem: 1, ativa: true },
  { id: "parada-51", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "11:00", veiculo: "CARRO", nome: "TAMAROZZI", endereco: "RONISE MOTTA PEGORARO 1-57", dias_semana: [1, 3, 5], ordem: 1, ativa: true },
  { id: "parada-52", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "11:00", veiculo: "CARRO", nome: "RAFAEL GROSSI", endereco: "ALAMEDA DAS MAGNOLIAS 2-56", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-53", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "11:00", veiculo: "CARRO", nome: "CENTAURO", endereco: "SHOPPING BOULEVARD PISO 2", dias_semana: [2, 5], ordem: 3, ativa: true },
  { id: "parada-54", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "11:00", veiculo: "CARRO", nome: "AUTHENTIC / ART WALK", endereco: "SHOPPING BOULEVARD PISO 2 e 3", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-55", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 1, horario_saida: "11:00", veiculo: "CARRO", nome: "MENINA SHOES", endereco: "SHOPPING BOULEVARD PISO 3", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 5, ativa: true },
  { id: "parada-56", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "14:00", veiculo: "MOTO", nome: "N&A CONDOMINIOS", endereco: "OCTAVIO P BRISOLLA 1-06", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-57", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "14:00", veiculo: "MOTO", nome: "COHAB", endereco: "NACOES UNIDAS 30-31", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-58", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "14:00", veiculo: "MOTO", nome: "ELO INFRAESTRUTURA", endereco: "OCTAVIO P BRISOLLA 11-29", dias_semana: [4], ordem: 3, ativa: true },
  { id: "parada-59", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "14:00", veiculo: "MOTO", nome: "FOB/USP", endereco: "OCTAVIO P BRISOLLA 9-75", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-60", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 2, horario_saida: "14:00", veiculo: "MOTO", nome: "FINCH / MANDALITI", endereco: "GETULIO VARGAS 3-03", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 5, ativa: true },
  { id: "parada-61", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "14:45", veiculo: "MOTO", nome: "GILAR", endereco: "RODRIGUES DE ABREU 4-40", dias_semana: [5], ordem: 1, ativa: true },
  { id: "parada-62", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "14:45", veiculo: "MOTO", nome: "FULL IMAGE", endereco: "QUINZE DE NOVEMBRO 10-49", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-63", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "14:45", veiculo: "MOTO", nome: "PHARMACIS", endereco: "QUINZE DE NOVEMBRO 13-86", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-64", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "14:45", veiculo: "MOTO", nome: "CARTORIO", endereco: "ANTONIO ALVES 18-30", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-65", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 3, horario_saida: "14:45", veiculo: "MOTO", nome: "DAE", endereco: "PADRE JOAO 11-25", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 5, ativa: true },
  { id: "parada-66", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 4, horario_saida: "15:30", veiculo: "CARRO", nome: "MARCIA GASPARINI", endereco: "MAJOR FRAGA 2-130", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-67", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 4, horario_saida: "15:30", veiculo: "CARRO", nome: "EYELENS", endereco: "CMDR JOSE SILVA MARTHA 29-54", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-68", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 4, horario_saida: "15:30", veiculo: "CARRO", nome: "LASER TECK", endereco: "ALASKA 13-84", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-69", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 4, horario_saida: "15:30", veiculo: "CARRO", nome: "MF PERES", endereco: "JOAO URIAS BATISTA 3-29", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-70", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 4, horario_saida: "15:30", veiculo: "CARRO", nome: "CETRO", endereco: "NEWTON PRADO 8-30", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 5, ativa: true },
  { id: "parada-71", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 4, horario_saida: "15:30", veiculo: "CARRO", nome: "AVOZON", endereco: "BERNARDINO DE CAMPOS 5-49", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 6, ativa: true },
  { id: "parada-72", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 5, horario_saida: "16:15", veiculo: "MOTO", nome: "BAUMMER", endereco: "GETULIO VARGAS 13-40", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-73", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 5, horario_saida: "16:15", veiculo: "MOTO", nome: "AMERICA PARTS", endereco: "SEMI GEBARA 1-49", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-74", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 5, horario_saida: "16:15", veiculo: "MOTO", nome: "ABRAMIDES", endereco: "OCTAVIO P BRISOLLA 15-32", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-75", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 5, horario_saida: "16:15", veiculo: "MOTO", nome: "PASCHOALOTTO", endereco: "DURVAL G DE AZEVEDO 2-144", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-76", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 5, horario_saida: "16:15", veiculo: "MOTO", nome: "FINCH/MANDALITI", endereco: "GETULIO VARGAS 3-03", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 5, ativa: true },
  { id: "parada-77", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 5, horario_saida: "16:15", veiculo: "MOTO", nome: "GABRIELA OLIVEIRA", endereco: "GUSTAVO MACIEL 23-18", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 6, ativa: true },
  { id: "parada-78", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 5, horario_saida: "16:15", veiculo: "MOTO", nome: "MAT STA ISABEL", endereco: "ANTONIO ALVES 26-27", dias_semana: [2, 4], ordem: 7, ativa: true },
  { id: "parada-79", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 5, horario_saida: "16:15", veiculo: "MOTO", nome: "AJUNTA", endereco: "ARAUJO LEITE 25-15", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 8, ativa: true },
  { id: "parada-80", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 6, horario_saida: "17:15", veiculo: "MOTO", nome: "ARS CURANDI", endereco: "GERSON FRANCA 13-75", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 1, ativa: true },
  { id: "parada-81", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 6, horario_saida: "17:15", veiculo: "MOTO", nome: "PS FERRAMENTAS", endereco: "VIRGILIO MALTA x CAP G DUARTE", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 2, ativa: true },
  { id: "parada-82", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 6, horario_saida: "17:15", veiculo: "MOTO", nome: "ACURYS", endereco: "GERSON FRANCA 16-55", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 3, ativa: true },
  { id: "parada-83", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 6, horario_saida: "17:15", veiculo: "MOTO", nome: "WELLBE", endereco: "CMDR JOSE SILVA MARTHA 3-20", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 4, ativa: true },
  { id: "parada-84", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 6, horario_saida: "17:15", veiculo: "MOTO", nome: "PINHO ADVOGADOS", endereco: "VIVALDO GUIMARAES 9-53", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 5, ativa: true },
  { id: "parada-85", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 6, horario_saida: "17:15", veiculo: "MOTO", nome: "FREITAS MARTINHO", endereco: "RUBENS PAGANI 3-20", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 6, ativa: true },
  { id: "parada-86", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 6, horario_saida: "17:15", veiculo: "MOTO", nome: "ADV NEVES COSTA", endereco: "RIO BRANCO 25-50", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 7, ativa: true },
  { id: "parada-87", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 6, horario_saida: "17:15", veiculo: "MOTO", nome: "UNIMED CENTRO-OESTE", endereco: "RIO BRANCO 27-65", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 8, ativa: true },
  { id: "parada-88", coletor_id: "demo-coletor-nei", base: "AGF RIO BRANCO", saida_numero: 6, horario_saida: "17:15", veiculo: "MOTO", nome: "AMERICA PARTS", endereco: "SEMI GEBARA 1-49", dias_semana: [1, 2, 3, 4, 5, 6], ordem: 9, ativa: true },
];

// Confirmações de parada fixa (roteiro): registra, por dia, quais paradas
// fixas já foram confirmadas (com foto) pelo coletor — começa vazio, cada
// coletor vai preenchendo ao longo do próprio expediente.
export const confirmacoesParadaFixa = [];

// Clientes esperados (por demanda) — importado da mesma planilha "ROTEIRO
// ATUALIZADO 2026", só que dos endereços SEM X e sem dia fixo marcado —
// esses são os que pedem coleta pelo app (não têm parada_fixa). Serve só
// pra saber de antemão qual veículo normalmente passa em cada um (CARRO ou
// MOTO) — usado pra avisar na tela de "Nova coleta" quando o veículo é
// moto (caixa grande não cabe). Quando o mesmo nome aparece em mais de um
// lugar da planilha com veículos diferentes, ficou o MOTO (melhor avisar
// à toa do que deixar de avisar).
//
// A partir de agora, casa primeiro pelo CNPJ (campo `cnpj` aqui embaixo,
// que veio da planilha de cadastro de clientes que o Felipe mandou — só
// preenchido pra quem deu pra casar o nome com confiança) comparando com o
// CNPJ do cadastro do cliente; só cai pra casar pelo nome do
// estabelecimento quando não tem CNPJ batendo (cliente não preencheu CNPJ
// ainda, ou esse nome não bateu com confiança na planilha).
export const clientesEsperados = [
  { id: "cliente-esperado-1", nome: "ABCZ", endereco: "SEVERINO LINS 3-25 TR 1-SL1110", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-2", nome: "ABRAMIDES", endereco: "DR JÕAO DE GOES MANSO SAYAO NETTO 7-79", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-3", nome: "ACURYS", endereco: "GERSON FRANCA 16-55", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-4", nome: "ADCOS (GRUPO MRS)", endereco: "BAURU SHOPPING PISO 1", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-5", nome: "AES BRASIL (AUREN)", endereco: "BUSINESS PARK", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-6", nome: "AGUARDANDO...", endereco: "RUY MANDES DE ROSIS 1-145", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-7", nome: "ALAN SOARES", endereco: "AFFONSO JOSE AIELLO 10-95 SL 18", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-8", nome: "AMANTINI", endereco: "NACOES UNIDAS 37-80", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-9", nome: "AME", endereco: "ANVAR DABUS 5-31", veiculo: "MOTO", coletor_id: "demo-coletor-nei", cnpj: "07506784000173" },
  { id: "cliente-esperado-10", nome: "AME BASE", endereco: "RUBENS ARRUDA QD 7 S/N", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-11", nome: "ANDRIZA MP", endereco: "GETULIO VARGAS 21-120", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-12", nome: "APAS", endereco: "MARIA JOSE 1-71", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-13", nome: "ARDENTE", endereco: "SEVERINO LINS 3-25 TR 2-SL1606/1607", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-14", nome: "AVALLONE", endereco: "LUIZ ALEIXO 7-17", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-15", nome: "AZ ELETRICOS", endereco: "NOSSA SRA DE FATIMA 4-54", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-16", nome: "BAUMMER", endereco: "GETULIO VARGAS 13-40", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-17", nome: "BAURU SAUDE", endereco: "SEVERINO LINS 3-25 TR 2-SL1109", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-18", nome: "BELO ENCANTO", endereco: "JOAQUIM FIDELIS 4-28 - LJ 10", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-19", nome: "BIOAGE", endereco: "NEDER ISSA 1-80 - SL 05", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-20", nome: "BIOPHARMA", endereco: "QUINZE DE NOVEMBRO 11-56", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-21", nome: "BRAYO", endereco: "JAVOLENO VAZ 3-49", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-22", nome: "BRUNA PENTEADO", endereco: "CHRISTIANO PAGANI 8-58", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-23", nome: "CARMEN STEFFENS", endereco: "SHOPPING BOULEVARD PISO 3", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-24", nome: "CDA - LAB BAURU", endereco: "ANTONIO ALVES 17-38", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-25", nome: "CEARA MAGAZINE", endereco: "RIO BRANCO 22-16", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-26", nome: "CENTRINHO", endereco: "SILVIO MARCHIONE 3-20", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-27", nome: "CEV BRASIL", endereco: "MANOEL PEREIRA ROLLA 11-08", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-28", nome: "CIÊNCIA NA CAIXA", endereco: "JOSE CARLOS CARVALHO 1-55", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-29", nome: "CLARA FERREIRA", endereco: "NOSSA SRA FATIMA 1-105", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-30", nome: "CLINICA ASO", endereco: "GUILHERME DE ALMEIDA 5-06", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-31", nome: "CLISOUND", endereco: "JOSE CLIMAITES 1-36", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-32", nome: "COCKER SHOES", endereco: "AVDR MARQUES DE PINEDO 12-83", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-33", nome: "COHAB", endereco: "NACOES UNIDAS 30-31", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-34", nome: "COMPAC", endereco: "ADOLPHO MIRAGLIA 4-80", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-35", nome: "CONTROL SOLUTION", endereco: "AURELIANO CARDIA 7-18", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-36", nome: "CPO BAURU", endereco: "HERMINIO PINTO 13-59", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-37", nome: "CREA", endereco: "FUAS DE MATTOS SABINO 1-15", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-38", nome: "DENYTEX", endereco: "ALBERTO SEGALLA 1-81", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-39", nome: "DERMABEAUTY", endereco: "SAINT MARTIN 28-77", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-40", nome: "DFTM CONCEPT", endereco: "FLORIANO PEIXOTO 9-57", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-41", nome: "ECOSYS", endereco: "CMDR JOSE SILVA MARTHA 24-28", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-42", nome: "EDAN", endereco: "NOSSA SRA FATIMA 11-63", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-43", nome: "EMP DAS ALIAÇAS", endereco: "RIO BRANCO 11-08", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-44", nome: "EMPORIO Z", endereco: "JOAQUIM SILVA MARTHA 28-71", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-45", nome: "ESAPIENS", endereco: "JOAQUIM ANACLETO BUENO 1-42", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-46", nome: "ESPACO HAIR", endereco: "SEBASTIAO LINS 2-35", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-47", nome: "EXOTICA", endereco: "VIVALDO GUIMARAES 15-55", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-48", nome: "EXOTICA PRAÇA", endereco: "PRAÇA PORTUGAL 1-70", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-49", nome: "FINCH / MANDALITI", endereco: "GETULIO VARGAS 3-03", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-50", nome: "FINEZ RACE", endereco: "MARCOS A.GENOVEZ SERRA 3-22", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-51", nome: "FLORISBELLA", endereco: "GUSTAVO MACIEL 20-45", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-52", nome: "FLYTOUR", endereco: "ARAUJO LEITE 23-72", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-53", nome: "FORD", endereco: "INACIO CONCEICAO VIEIRA 13-31", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-54", nome: "FORMULA ANIMAL", endereco: "MARCONDES SALGADO 9-84", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-55", nome: "FUNCRAF", endereco: "JOSE FERREIRA MARQUES 10-44", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-56", nome: "GABRIELA OLIVEIRA", endereco: "AGENOR MEIRA 6-55", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-57", nome: "GAS", endereco: "ALPHEU JOSE RIBAS SAMPAIO 3-52", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-58", nome: "GEOWIS CALÇADOS", endereco: "ANTONIO ALVES 24-05", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-59", nome: "GMAD", endereco: "AURELIANO CARDIA 6-60", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-60", nome: "GOLD SILVER", endereco: "BATISTA DE CARVALHO 6-74", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-61", nome: "GWM CAMINHO", endereco: "INACIO CONCEICAO VIEIRA 13-31", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-62", nome: "HALFA", endereco: "JORGE PIMENTEL 4-35", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-63", nome: "HIGH PRO", endereco: "HOMERO CHERMONT 1-59", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-64", nome: "HOS MANUEL DE ABREU", endereco: "SALVADOR FILARDI 6-88", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-65", nome: "HOSP BENEFICENCIA", endereco: "TV LIBERDADE", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-66", nome: "HOSPITAL BASE", endereco: "MONS CLARO 8-88 (DIRETORIA)", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-67", nome: "HOTEL INTERCITY", endereco: "GETULIO VARGAS 15-06", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-68", nome: "HUB 18", endereco: "FRANCº VAN DER MAAS 13-30", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-69", nome: "IEV BRASIL", endereco: "ANTONIO ALVES 19-26", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-70", nome: "IKATEC", endereco: "SERGIO ANCANGELO 1-49", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-71", nome: "IMPACTO", endereco: "BATISTA ANTONIO ANGELIS 2-20", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-72", nome: "INFINITY BY BAUMMER", endereco: "GETULIO VARGAS 13-40", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-73", nome: "INIZIO PRATAS", endereco: "SEVERINO LINS 3-25 TR 2-SL2102", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-74", nome: "IOMCA", endereco: "GUSTAVO MACIEL 19-52", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-75", nome: "JABU", endereco: "QUINZE DE NOVEMBRO 13-50", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-76", nome: "JADE NEVES", endereco: "SAINT MARTIN 22-11 - LJ 1", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-77", nome: "JAY JAY STORE", endereco: "ANVAR DABUS 5-20", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-78", nome: "JM SERVIÇOS", endereco: "ARAUJO LEITE 24-44", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-79", nome: "JMG / CONSISTE", endereco: "PERNAMBUCO 10-22 - 2º ANDAR", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-80", nome: "JOICE GONZAGA", endereco: "QUINZE DE NOVEMBRO 10-71", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-81", nome: "JOLIE CAFÉ", endereco: "SAINT MARTIN 25-45", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-82", nome: "JOLLY BAURU", endereco: "SEVERINO LINS 3-25 TR 1-SL1001", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-83", nome: "JU BENATTI", endereco: "SAINT MARTIN 22-11 - LJ 3", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-84", nome: "JUMP", endereco: "GERSON FRANCA 17-114", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-85", nome: "KID'S BAZAR LILIAN", endereco: "EI KUROZAWA 2-68", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-86", nome: "LA TIENDA", endereco: "JOAQUIM DA SILVA MARTHA 1948 SL 4", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-87", nome: "LC EMBALAGENS", endereco: "AV SOROCABANA 1-06", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-88", nome: "LEVI'S", endereco: "SHOPPING BOULEVARD PISO 3", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-89", nome: "LF MAIA", endereco: "JAMIL GEBARA 1-55", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-90", nome: "LISSIÊ", endereco: "JOAQUIM SILVA MARTHA 11-59", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-91", nome: "LOJA DUFRIO", endereco: "ANTONIO ALVES 6-31", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-92", nome: "MAGNA", endereco: "CMDR JOSE SILVA MARTHA 9-10", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-93", nome: "MAHOGANY", endereco: "BAURU SHOPPING PISO 1", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-94", nome: "MALHARIA CLEO", endereco: "RIO BRANCO 11-53", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-95", nome: "MANY MINDS", endereco: "GUSTAVO MACIEL 22-40", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-96", nome: "MASON EQUIPAMENTOS", endereco: "ADOLPHO MIRAGLIA 11-50", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-97", nome: "MAXIMA PERFORMANCE", endereco: "IGNACIO ALEX. NASRALLA 2-10", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-98", nome: "MAXXILAB", endereco: "NOSSA SRA FATIMA 20-26", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-99", nome: "MED FIRST (END 2)", endereco: "RENE TACOLA 2-72", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-100", nome: "MEIRE CALCADOS", endereco: "JULIO DE MESQUITA FILHO 5-10", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-101", nome: "MIL PEÇAS", endereco: "MARCONDES SALGADO 8-81 SL 3", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-102", nome: "MILAZZO FIAT", endereco: "GETULIO VARGAS 7-55", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-103", nome: "MPA", endereco: "CUSSY JUNIOR 13-55", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-104", nome: "NEW WAY", endereco: "AFFONSO JOSE AIELLO 6-80", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-105", nome: "NUCLEON", endereco: "OCTAVIO P BRISOLLA 16-17", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-106", nome: "NUTRI SAUDE", endereco: "SEVERINO LINS 2-31", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-107", nome: "NUTRIAMIGOS", endereco: "AZARIAS LEITE 15-61", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-108", nome: "OAB", endereco: "NACOES UNIDAS 30-30", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-109", nome: "OLIVEIRA E OLIVI", endereco: "NACOES UNIDAS 30-20", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-110", nome: "OMINIGRAFICA", endereco: "GERSON FRANCA 14-28", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-111", nome: "ONE CARE (DOCA)", endereco: "ANDRE BONACHELA 3-45", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-112", nome: "OTICA BRAGA", endereco: "RIO BRANCO 22-46", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-113", nome: "PAGUE MENOS (M DOTA)", endereco: "JURANDYR LADEIRA 1-12", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-114", nome: "PASCHOALOTTO", endereco: "DURVAL G DE AZEVEDO 2-144", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-115", nome: "PERFORMANCE-MILENA", endereco: "SEVERINO LINS 3-25 TR 1-SL 201/202", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-116", nome: "PHARMATICA", endereco: "DUQUE DE CAXIAS 7-36", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-117", nome: "PITA MELLO", endereco: "SEVERINO LINS 3-25 TR 1-SL1004", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-118", nome: "PNEUSTORE", endereco: "ALAMEDA DAS ACACIAS 8-55", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-119", nome: "POLO PLAY", endereco: "ANTONIO ALVES 24-82", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-120", nome: "POLOAR", endereco: "PRACA PORTUGAL 1-76", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-121", nome: "PSICANALISTA", endereco: "GUILHERME DE ALMEIDA 4-15", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-122", nome: "Q LINDA LINGERIE", endereco: "ANTONIO ALVES 30-15 LOJA 7", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-123", nome: "QUALITY", endereco: "RODRIGUES ALVES 9-71", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-124", nome: "RAGONEZI MOVEIS", endereco: "VIRGILIO MALTA 18-09", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-125", nome: "REGISTRO DE IMOVEIS", endereco: "JULIO MESQUITA Fº 10-31 - SL 8", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-126", nome: "RELEASE", endereco: "LUSO-BRAILEIRA 1-19", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-127", nome: "RENT TELECON", endereco: "BENEDITO MOREIRA PINTO 8-118", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-128", nome: "REPARACAO CAPILAR", endereco: "ARGENTINA 15-09", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-129", nome: "RESOLUTION BUSINESS", endereco: "NACOES UNIDAS 16-47 SALA 508", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-130", nome: "REUSE BY CAMPA", endereco: "SEVERINO LINS 3-25 TR 1-SL 01", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-131", nome: "ROSANITA BOUTIQUE", endereco: "LUIZ BLERIOT 8-40 - LJ 6", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-132", nome: "ROTULABEL", endereco: "NATALINA BONORA 1-45", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-133", nome: "SEBO", endereco: "TREZE DE MAIO 12-48", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-134", nome: "SOL RING", endereco: "RAPOSO TAVARES 4-45 - AP 71", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-135", nome: "TECDESC", endereco: "CMDR JOSE SILVA MARTHA 29-44", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-136", nome: "TOMMY HILFIGER", endereco: "SHOPPING BOULEVARD PISO 3", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-137", nome: "TOP MOTOS", endereco: "ARAUJO LEITE 6-48", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-138", nome: "VIDA NURANI", endereco: "GUSTAVO MACIEL 3-15", veiculo: "CARRO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-139", nome: "VIDA PMO", endereco: "ANTONIO GARCIA 9-34", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-140", nome: "VIDA TOP SAUDE", endereco: "PROF JOSE RANIERI 8-55", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-141", nome: "VIP CAPAS", endereco: "FRANCISCO JOSÉ CARNIELI 2-81", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-142", nome: "VIP SERVICE", endereco: "ANTONIO GARCIA 15-82", veiculo: "CARRO", coletor_id: "demo-coletor" },
  { id: "cliente-esperado-143", nome: "VTRIH GABRIELA", endereco: "AFFONSO JOSE AIELLO 14-45", veiculo: "CARRO", coletor_id: "demo-coletor-2" },
  { id: "cliente-esperado-144", nome: "WITZLER", endereco: "ANTONIO ALVES 35-48", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-145", nome: "XFLY", endereco: "JACY STEVAUX VILLACA 1-91", veiculo: "CARRO", coletor_id: "demo-coletor-julio" },
  { id: "cliente-esperado-146", nome: "ZEN PHARMA", endereco: "GERSON FRANCA 9-01", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-147", nome: "ZENITE PHARMA", endereco: "GETULIO VARGAS 4-73", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },
  { id: "cliente-esperado-148", nome: "ÓTICA BRAGA", endereco: "BANDEIRANTES 9-02", veiculo: "MOTO", coletor_id: "demo-coletor-nei" },];

// Pedidos de "esqueci meu usuário" mandados pelo cliente (ver
// RecuperarUsuario.jsx) — a pessoa não consegue logar pra pedir direto, então
// se identifica por CNPJ + nome do estabelecimento, e um gerente/despachante
// aceita ou recusa em Configurações -> Perfil (ver AbaSolicitacoesUsuario.jsx).
// Começa vazio; cada solicitação ganha os campos: id, cnpj, estabelecimento,
// perfil_id (achado por CNPJ, ou null se não bateu com ninguém), status
// ("pendente" | "aceita" | "recusada"), criado_em, atendido_em, novo_login
// (preenchido só depois que a pessoa define o novo usuário, já aceito).
export const solicitacoesUsuario = [];
