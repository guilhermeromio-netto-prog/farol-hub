// Fronteira do gerador de roteiros — Farol · byGui
//
// Hoje o roteiro é montado por REGRAS locais (planner.js) com dados reais de clima,
// feriados e custos estimados de dados.json. Não há IA envolvida.
//
// Para ligar uma IA no futuro (ex.: via proxy serverless), crie js/ia.js exportando
// uma função com a MESMA assinatura e o MESMO formato de retorno de montarCaderno():
//   export async function gerarComIA(brief, dados, { signal, onEtapa }) { ...; return plan; }
// e troque apenas o corpo de gerarRoteiro() abaixo. Nenhuma tela precisa mudar.
import { montarCaderno } from './planner.js';

/** Metadados exibidos na interface sobre a origem do roteiro (sem rótulos de IA falsos). */
export const ORIGEM_ROTEIRO = {
  id: 'regras',
  rotulo: 'Roteiro sugerido',
  explicacao: 'Montado por regras a partir dos seus interesses, do meio de transporte, do clima registrado e de faixas de custo estimadas.',
};

/**
 * Gera o caderno de viagem.
 * @param {object} brief  briefing do formulário (ver planner.briefPadrao)
 * @param {object} dados  conteúdo de dados.json
 * @param {{signal?:AbortSignal, onEtapa?:(t:string)=>void}} opcoes
 * @returns {Promise<object>} plan
 */
export function gerarRoteiro(brief, dados, opcoes = {}) {
  return montarCaderno(brief, dados, opcoes);
}
