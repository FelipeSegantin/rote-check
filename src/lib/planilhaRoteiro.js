import * as XLSX from "xlsx";

// Lê a planilha "ROTEIRO ATUALIZADO" (aba "MATRIZ") do jeito que o Felipe
// já usa hoje, e devolve a lista de paradas fixas prontas pra gravar no
// banco — mesma lógica de um script de importação de uma sessão anterior
// (parse_roteiro.py), só que rodando aqui no navegador em vez de precisar
// alguém rodar localmente. Fica nesse arquivo separado (em vez de dentro
// do componente) pra ficar fácil de testar sozinho.
//
// Formato esperado da planilha, linha por linha:
//   - Coluna A é um número (1, 2, 3...): começa o bloco de um coletor novo
//     (coluna B tem o nome dele). Bloco com o MESMO nome do anterior (caso
//     do "NEI", que aparece em dois blocos) continua a numeração de saída
//     em vez de reiniciar.
//   - Coluna A = "AGF RIO BRANCO": linha de cabeçalho de saída. Se a coluna
//     D tiver "(Nª SAÍDA - VEÍCULO)", define o horário (coluna C) e veículo
//     válidos pras próximas paradas, até a saída seguinte.
//   - Linha com nome (coluna B) e endereço (coluna D) preenchidos: é uma
//     parada. Coluna A = "X" quer dizer "todo dia" (segunda a sábado); um
//     "(3ª/6ª)" etc. dentro do nome define dias específicos; sem nenhum
//     dos dois, não é parada fixa (é por demanda, ignorada aqui).

const FEIRA_PARA_DIA = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };
const TODOS_OS_DIAS = [1, 2, 3, 4, 5, 6];
const DIA_PATTERN = /(\d)\s*[ªº°]/g;

function extrairDiasDoNome(nomeBruto) {
  const m = nomeBruto.match(/\(([^)]*\d[ªº°][^)]*)\)/);
  if (!m) return { dias: null, nomeLimpo: nomeBruto };
  const dentro = m[1];
  const feiras = [...dentro.matchAll(DIA_PATTERN)].map((x) => Number(x[1]));
  const diasSet = new Set(feiras.map((f) => FEIRA_PARA_DIA[f]).filter(Boolean));
  const dias = [...diasSet].sort((a, b) => a - b);
  if (dias.length === 0) return { dias: null, nomeLimpo: nomeBruto };
  const nomeLimpo = (nomeBruto.slice(0, m.index) + nomeBruto.slice(m.index + m[0].length)).trim();
  return { dias, nomeLimpo };
}

// Coluna de horário pode vir como número serial do Excel (fração do dia),
// texto ("13:45"), ou Date — trata os três pra não depender de como o
// Excel formatou a célula.
function celulaParaHorario(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") {
    const totalMinutos = Math.round((valor % 1) * 24 * 60);
    const h = Math.floor(totalMinutos / 60);
    const min = totalMinutos % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  if (valor instanceof Date) {
    return `${String(valor.getHours()).padStart(2, "0")}:${String(valor.getMinutes()).padStart(2, "0")}`;
  }
  const m = String(valor).match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return null;
}

function celulaTexto(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

// Devolve { paradas, erro }. "paradas" tem o nome do coletor exatamente
// como está escrito na planilha (ex.: "RONALD") — quem chama essa função é
// que casa isso com os coletores cadastrados no sistema.
export function parseRoteiroPlanilha(arrayBuffer) {
  let workbook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  } catch (e) {
    return { paradas: [], erro: "Não consegui abrir esse arquivo — confirma que é um .xlsx válido." };
  }

  const nomeAba = workbook.SheetNames.find((n) => n.trim().toUpperCase() === "MATRIZ");
  if (!nomeAba) {
    return { paradas: [], erro: 'Essa planilha não tem uma aba chamada "MATRIZ" — confirma que é o arquivo certo.' };
  }
  const ws = workbook.Sheets[nomeAba];
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  const paradas = [];
  let coletorAtual = null;
  let ultimoNomeColetor = null;
  let saidaNumero = 0;
  let saidaHorario = null;
  let saidaVeiculo = null;
  let ordemNaSaida = 0;

  for (const linha of linhas) {
    const a = linha[0];
    const b = linha[1];
    const c = linha[2];
    const d = linha[3];
    const aTexto = celulaTexto(a);

    // Cabeçalho de coletor: coluna A é um número.
    if (aTexto && /^\d+$/.test(aTexto)) {
      const nomeColetor = celulaTexto(b);
      if (nomeColetor !== ultimoNomeColetor) {
        coletorAtual = nomeColetor;
        ultimoNomeColetor = nomeColetor;
        saidaNumero = 0;
      } else {
        // mesmo nome do bloco anterior (caso do "NEI") — continua a
        // numeração de saída em vez de reiniciar.
        coletorAtual = nomeColetor;
      }
      continue;
    }

    // Cabeçalho de saída/base.
    if (aTexto.toUpperCase() === "AGF RIO BRANCO") {
      const dTexto = celulaTexto(d);
      if (dTexto.toUpperCase().includes("SAÍDA")) {
        const m = dTexto.match(/\((\d+)ª\s*SAÍDA\s*-\s*(\w+)\)/i);
        if (m) {
          saidaNumero = Number(m[1]);
          saidaVeiculo = m[2].trim().toUpperCase();
          saidaHorario = celulaParaHorario(c);
          ordemNaSaida = 0;
        }
      }
      continue;
    }

    // Linha de parada: nome (B) e endereço (D) preenchidos.
    const bTexto = celulaTexto(b);
    const dTexto = celulaTexto(d);
    if (bTexto && dTexto) {
      const marcadoX = aTexto.toUpperCase() === "X";
      const { dias: diasDoNome, nomeLimpo } = extrairDiasDoNome(bTexto);

      let dias;
      if (marcadoX) dias = TODOS_OS_DIAS;
      else if (diasDoNome) dias = diasDoNome;
      else continue; // por demanda — não é parada fixa, ignora aqui

      if (!coletorAtual) continue; // linha de parada sem coletor definido ainda — planilha fora do formato esperado

      ordemNaSaida += 1;
      paradas.push({
        coletorPlanilha: coletorAtual,
        base: "AGF RIO BRANCO",
        saida_numero: saidaNumero || 1,
        horario_saida: saidaHorario,
        veiculo: saidaVeiculo || "CARRO",
        nome: nomeLimpo,
        endereco: dTexto,
        dias_semana: dias,
        ordem: ordemNaSaida,
      });
    }
  }

  if (paradas.length === 0) {
    return { paradas: [], erro: "Não encontrei nenhuma parada nessa planilha — confirma que é o arquivo certo antes de tentar de novo." };
  }

  return { paradas, erro: null };
}
