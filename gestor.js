// ================= VARIÁVEIS GLOBAIS DO MODO GESTOR =================
let mapaRastreioInstancia = null;
let camadaMarcadoresRastreio = null;
let coordenadasPinosAtuais = [];
let fotosEdicaoTemporarias = [];
let opcoesMarcadasEdicaoTemporarias = [];
let snapshotStatusEdicaoOriginal = null;
let modoConsultaBackupAtivo = false;
let cacheRegistrosNuvemOriginal = null;
let sincronizandoRegistrosMobileEmCurso = false;
let historicoCompletoGestorJaBaixado = false;

let graficoExecutoresVistoriaInstancia = null;
let graficoExecutoresConstrucaoInstancia = null;
let graficoExecutoresAtivacaoInstancia = null;
let graficoProgramadoRetornoBairroInstancia = null;
let grupoAtivoAbaGraficos = 'TODOS';

let filtrosMultiplosAtivos = { equipes: [], setores: [], macrogrupos: [], projetos: [], desfechos: [] };
const TEMPO_MAXIMO_SINAL_ROTA_MINUTOS = 480;

var filtrosMultiGraficos = { segmentos: ['TODOS'], categorias: ['TODAS'], semanas: ['TODAS'] };
var modoSelecaoMultiplaSemCtrl = false;
var secoesInibidasGraficos = { consolidados: false, planilhaDinamica: false, geralTecnicos: false, evolucaoSegmentos: false, picosHorarios: false, planilhaHorarios: false, rankingOfensores: false, ofensoresSegmentos: false, controlePausas: false, impactoOperacional: false };
var estadoModalExpandidoAtual = { ativo: false, tipo: null, idOrigem: null, titulo: '' };
var registroExplosaoCache = new Map();
var contadorChaveExplosao = 0;
var chartEvolucaoSegmentosInst = null, chartHorariosPicoNovoInst = null, chartOfensoresRankingInst = null, chartImpactoImprevistosInst = null;
var varreduraFotosEmCurso = false, limpezaDuplicadosEmAndamento = false, baixandoLoteFotos = false;
var idsFotosJaVerificadas = new Set();

// ================= FECHO DOS MODAIS DE EXPANSÃO =================
function fecharModalGraficoExpandido() {
    const modal = document.getElementById('modal-expandir-grafico');
    if (modal) modal.classList.add('hidden');
    if (typeof estadoModalExpandidoAtual !== 'undefined') estadoModalExpandidoAtual.ativo = false;
    const canvasAlvo = document.getElementById('canvasGraficoExpandido');
    if (canvasAlvo && typeof Chart !== 'undefined') {
        const instExistente = Chart.getChart(canvasAlvo);
        if (instExistente) { try { instExistente.destroy(); } catch (e) {} }
    }
    if (typeof graficoExpandidoInstancia !== 'undefined' && graficoExpandidoInstancia) {
        try { graficoExpandidoInstancia.destroy(); } catch (e) {}
        graficoExpandidoInstancia = null;
    }
}
window.fecharModalGraficoExpandido = fecharModalGraficoExpandido;

function fecharModalTabelaExpandida() {
    const modal = document.getElementById('modal-expandir-tabela');
    if (modal) modal.classList.add('hidden');
    if (typeof estadoModalExpandidoAtual !== 'undefined') estadoModalExpandidoAtual.ativo = false;
}
window.fecharModalTabelaExpandida = fecharModalTabelaExpandida;

document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { fecharModalGraficoExpandido(); fecharModalTabelaExpandida(); }
});

// ================= CATÁLOGO OFICIAL DOS FISCAIS =================
const CATALOGO_FISCAIS_MDU = [
    { nome: "FRANCISCO DE SOUZA MOURA", email: "fiscal01@mdu.com.br" },
    { nome: "JEFFERSON SILVA DE OLIVEIRA", email: "fiscal02@mdu.com.br" },
    { nome: "MARCELO FRANCISCO SOARES", email: "fiscal03@mdu.com.br" }
];

const MAPA_PADRAO_EQUIPE_FISCAL = {
    "BRUNO MARCUS CORREA FERNANDES": "fiscal02@mdu.com.br",
    "MATHEUS FRANCINI ALMEIDA": "fiscal02@mdu.com.br",
    "HEVERTON ALESSANDRO RODRIGUES GUSMAO": "fiscal02@mdu.com.br",
    "MATHEUS MAGNO FERREIRA DA ROCHA": "fiscal02@mdu.com.br",
    "PAULO RICARDO MATOLLA DE FIGUEIREDO SOARES": "fiscal02@mdu.com.br",
    "LUCIANO SANTOS FERREIRA": "fiscal02@mdu.com.br",
    "ANDREO FAGUNDES": "fiscal02@mdu.com.br",

    "FELIPE BAPTISTA FERREIRA": "fiscal03@mdu.com.br",
    "WILSON JOSE DE SOUSA JUNIOR": "fiscal03@mdu.com.br",
    "WEVERTON OTACILIO DA SILVA VERAS": "fiscal03@mdu.com.br",
    "TIAGO SILVA DE PAULA": "fiscal03@mdu.com.br",
    "MARCOS VINICIUS SANTOS DA SILVA": "fiscal03@mdu.com.br",
    "PAULO CESAR FERNANDES JUNIOR": "fiscal03@mdu.com.br",

    "CESAR SALES ROSA": "fiscal01@mdu.com.br",
    "MARCOS VINICIUS CARDOSO DE ARAUJO": "fiscal01@mdu.com.br",
    "BRUNO SOARES DA SILVA": "fiscal01@mdu.com.br",
    "EWERTON LOPES DA SILVA": "fiscal01@mdu.com.br",
    "IGOR DA SILVA ALVES JANUARIO": "fiscal01@mdu.com.br",
    "DIEGO LEMOS RIBEIRO": "fiscal01@mdu.com.br",
    "ELDER DE OLIVEIRA MARTINS": "fiscal01@mdu.com.br",
    "MARCIO VIEIRA PINTO": "fiscal01@mdu.com.br",
    "MAICON LUIZ DE OLIVEIRA COSTA": "fiscal01@mdu.com.br",
    "LEONARDO LISBOA BANDEIRA": "fiscal01@mdu.com.br"
};

function normalizarChaveNome(str) {
    return String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

function obterCategoriaDiscretaTecnicoHtml(nomeEquipe, apenasTexto = false) {
    const eqObj = (typeof equipesSistema !== 'undefined' && Array.isArray(equipesSistema))
        ? equipesSistema.find(e => normalizarChaveNome(e.nome) === normalizarChaveNome(nomeEquipe))
        : null;
    const setores = typeof obterArraySetores === 'function' ? obterArraySetores(eqObj ? eqObj.setor : 'Instalador') : ['Instalador'];

    if (apenasTexto) return setores.join(' + ');

    const badges = setores.map(s => {
        let cor = 'bg-slate-100 text-slate-600 border-slate-200';
        if (s === 'Vistoriador') cor = 'bg-purple-50 text-purple-700 border-purple-200';
        else if (s === 'Instalador') cor = 'bg-blue-50 text-blue-700 border-blue-200';
        else if (s === 'Ativador') cor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        return `<span class="text-[9px] font-semibold px-1.5 py-0.2 rounded border ${cor} leading-none">${s}</span>`;
    }).join(' ');
    return `<span class="inline-flex flex-wrap items-center gap-1 ml-1.5 align-middle">${badges}</span>`;
}

function garantirPermissaoOperadorEBaptista() {
    try {
        const emailAtual = String(usuarioLogado || "").toLowerCase().trim();
        if (Array.isArray(usuariosSistema)) {
            const uBaptista = usuariosSistema.find(u => String(u.email || "").toLowerCase().trim() === "e.baptista@procisa.com.br");
            if (uBaptista && uBaptista.nivel !== "Operador") { uBaptista.nivel = "Operador"; uBaptista.status = "Ativo"; }
        }
        if (emailAtual === "e.baptista@procisa.com.br") {
            nivelUsuarioLogado = "Operador";
            sessionStorage.setItem("gpd_nivel_logado", "Operador");
            localStorage.setItem("gpd_nivel_logado", "Operador");
            const badgeNivel = document.getElementById("gestor-badge-nivel");
            if (badgeNivel) badgeNivel.innerText = "Operador";
        }
        if (Array.isArray(equipesSistema)) {
            equipesSistema.forEach(eq => {
                if (!eq.fiscalEmail) {
                    const chave = normalizarChaveNome(eq.nome);
                    if (MAPA_PADRAO_EQUIPE_FISCAL[chave]) {
                        eq.fiscalEmail = MAPA_PADRAO_EQUIPE_FISCAL[chave];
                        const fObj = CATALOGO_FISCAIS_MDU.find(f => f.email === eq.fiscalEmail);
                        if (fObj) eq.fiscal = fObj.nome;
                    }
                }
            });
        }
    } catch (e) {}
}

function obterNivelNormalizadoGestor() {
    garantirPermissaoOperadorEBaptista();
    const emailAtual = String(usuarioLogado || "").toLowerCase().trim();
    if (emailAtual === "lsimoes@procisa.com.br") return "master";
    if (emailAtual === "e.baptista@procisa.com.br") return "operador";
    const niv = String(nivelUsuarioLogado || "").toLowerCase().trim();
    if (niv === "master" || niv === "operador" || niv === "visualizador") return niv;
    const uCad = (usuariosSistema || []).find(u => String(u.email || "").toLowerCase().trim() === emailAtual);
    return uCad ? String(uCad.nivel || "visualizador").toLowerCase().trim() : "visualizador";
}

function usuarioPodeEditarGestor() { const n = obterNivelNormalizadoGestor(); return n === "master" || n === "operador"; }
function usuarioEhMasterGestor() { return obterNivelNormalizadoGestor() === "master"; }

function obterFiscalObjPorEmailOuNome(valor) {
    if (!valor) return null;
    const vNorm = normalizarChaveNome(valor);
    return CATALOGO_FISCAIS_MDU.find(f => f.email.toLowerCase() === String(valor).toLowerCase().trim() || normalizarChaveNome(f.nome) === vNorm) || null;
}

function obterEmailFiscalDaEquipe(eqObjOuNome) {
    let eqObj = (typeof eqObjOuNome === 'object' && eqObjOuNome !== null) ? eqObjOuNome : (equipesSistema || []).find(e => normalizarChaveNome(e.nome) === normalizarChaveNome(eqObjOuNome));
    if (eqObj && eqObj.fiscalEmail) return String(eqObj.fiscalEmail).toLowerCase().trim();
    return MAPA_PADRAO_EQUIPE_FISCAL[normalizarChaveNome(eqObj ? eqObj.nome : eqObjOuNome)] || "";
}

function obterNomeFiscalDaEquipe(eqObjOuNome) {
    const fObj = obterFiscalObjPorEmailOuNome(obterEmailFiscalDaEquipe(eqObjOuNome));
    return fObj ? fObj.nome : "SEM FISCAL DEFINIDO";
}

function obterFiscalLogadoRestrito() {
    const emailLogado = String(usuarioLogado || "").toLowerCase().trim();
    if (!emailLogado || usuarioPodeEditarGestor()) return null;
    return CATALOGO_FISCAIS_MDU.find(f => f.email.toLowerCase() === emailLogado) || null;
}

function obterSetEquipesDoFiscalLogado() {
    const fiscalRestrito = obterFiscalLogadoRestrito();
    if (!fiscalRestrito) return null;
    const emailFiscal = fiscalRestrito.email.toLowerCase().trim();
    const permitidas = new Set();
    (equipesSistema || []).forEach(eq => { if (obterEmailFiscalDaEquipe(eq) === emailFiscal) permitidas.add(normalizarChaveNome(eq.nome)); });
    Object.entries(MAPA_PADRAO_EQUIPE_FISCAL).forEach(([nomeTec, emailPadrao]) => {
        const eqCad = (equipesSistema || []).find(e => normalizarChaveNome(e.nome) === nomeTec);
        if (((eqCad && eqCad.fiscalEmail) ? eqCad.fiscalEmail.toLowerCase().trim() : emailPadrao) === emailFiscal) permitidas.add(nomeTec);
    });
    return permitidas;
}

function equipePertenceAoUsuarioLogado(nomeEquipe, setFiscal = undefined) {
    const setRef = setFiscal !== undefined ? setFiscal : obterSetEquipesDoFiscalLogado();
    return !setRef || setRef.has(normalizarChaveNome(nomeEquipe));
}

function registroPertenceAoUsuarioLogado(reg, setFiscal = undefined) {
    const setRef = setFiscal !== undefined ? setFiscal : obterSetEquipesDoFiscalLogado();
    if (!setRef) return true;
    if (!reg) return false;
    if (setRef.has(normalizarChaveNome(reg.equipe))) return true;
    return extrairApoiosDoRegistro(reg).some(ap => setRef.has(normalizarChaveNome(ap)));
}

function obterEquipesVisiveisUsuarioAtual(apenasAtivas = false) {
    const setFiscal = obterSetEquipesDoFiscalLogado();
    return (equipesSistema || []).filter(e => {
        if (!e || !e.nome || normalizarChaveNome(e.nome).includes('AAAAAATESTE')) return false;
        if (apenasAtivas && e.status !== 'Ativo') return false;
        return !(setFiscal && !setFiscal.has(normalizarChaveNome(e.nome)));
    });
}

function extrairApoiosDoRegistro(reg) {
    if (!reg) return [];
    const titular = (reg.equipe || '').toUpperCase().trim();
    const validados = [];
    const mStr = (reg.membros || '').trim();
    if (mStr && mStr !== '__CONFIG_SISTEMA__' && mStr.toUpperCase() !== titular) {
        mStr.split('|').map(p => p.trim()).forEach(p => {
            if (p.toUpperCase().startsWith('APOIO_PENDENTE:')) return;
            p.replace(/^APOIO:/i, '').trim().split(',').forEach(nome => {
                const n = nome.trim().toUpperCase();
                if (n && n !== titular && !n.includes('AAAAAATESTE') && !validados.includes(n)) validados.push(n);
            });
        });
    }
    return validados;
}

function extrairApoiosPendentesDoRegistro(reg) {
    if (!reg) return [];
    const titular = (reg.equipe || '').toUpperCase().trim();
    const pendentes = [];
    const mStr = (reg.membros || '').trim();
    if (mStr && mStr !== '__CONFIG_SISTEMA__') {
        mStr.split('|').map(p => p.trim()).forEach(p => {
            if (p.toUpperCase().startsWith('APOIO_PENDENTE:')) {
                p.replace(/^APOIO_PENDENTE:/i, '').trim().split(',').forEach(nome => {
                    const n = nome.trim().toUpperCase();
                    if (n && n !== titular && !n.includes('AAAAAATESTE') && !pendentes.includes(n)) pendentes.push(n);
                });
            }
        });
    }
    return pendentes;
}

function formatarCampoMembrosComApoio(nomeTitular, listaApoios) {
    const limpos = [...new Set((listaApoios || []).map(a => String(a || '').trim().toUpperCase()).filter(a => a && a !== (nomeTitular || '').toUpperCase().trim()))];
    return limpos.length > 0 ? `APOIO:${limpos.join(', ')}` : (nomeTitular || '');
}

async function abrirModalGerirApoioGestor(idReg) {
    if (!usuarioPodeEditarGestor()) { alert("⚠️ Apenas usuários Master ou Operador podem gerenciar vínculos de apoio."); return; }
    const reg = (registrosSalvos || []).find(r => r.id === idReg);
    if (!reg) return;
    const apoiosAtuais = extrairApoiosDoRegistro(reg);
    const equipesDisponiveis = (equipesSistema || []).filter(e => e.status === 'Ativo' && e.nome !== reg.equipe).map(e => e.nome);

    let modal = document.getElementById('modal-gerir-apoio-gestor');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-gerir-apoio-gestor';
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 hidden z-[79]';
        document.body.appendChild(modal);
    }
    const checksEquipesHtml = equipesDisponiveis.map(nome => `<label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-purple-50 cursor-pointer border border-slate-100"><input type="checkbox" name="chk-apoio-gestor" value="${nome}" ${apoiosAtuais.includes(nome) ? 'checked' : ''} class="w-4 h-4 accent-purple-800 rounded"><span class="text-xs font-bold text-slate-800">🤝 ${nome}</span></label>`).join('');
    modal.innerHTML = `<div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-purple-300 flex flex-col max-h-[90vh]"><div class="bg-purple-900 text-white p-4 flex justify-between items-center border-b-4 border-purple-400"><div><span class="bg-purple-300 text-purple-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Gestão de Atuação Conjunta</span><h3 class="font-bold text-sm mt-0.5">🤝 Direcionar / Vincular Equipe em Apoio</h3></div><button type="button" onclick="document.getElementById('modal-gerir-apoio-gestor').classList.add('hidden')" class="text-white font-bold text-lg">✕</button></div><div class="p-4 overflow-y-auto space-y-3 text-xs text-slate-700"><div class="bg-purple-50 p-3 rounded-xl border border-purple-200 space-y-1"><div><strong>🏢 Imóvel:</strong> <span class="font-black text-purple-950">${reg.imovel}</span> (${reg.projeto})</div><div><strong>👷 Técnico Titular:</strong> <span class="font-black text-blue-900">${reg.equipe}</span></div><div><strong>🎯 Status:</strong> <span class="font-bold">${reg.desfecho}</span></div></div><div><label class="block font-black text-slate-800 uppercase text-[11px] mb-1.5">Marque o(s) Técnico(s) em Apoio Conjunto nesta Atividade:</label><div class="space-y-1 max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50">${checksEquipesHtml || '<span class="text-slate-400">Nenhuma outra equipe ativa cadastrada.</span>'}</div></div></div><div class="bg-slate-100 p-3 border-t flex justify-end gap-2"><button type="button" onclick="document.getElementById('modal-gerir-apoio-gestor').classList.add('hidden')" class="bg-slate-300 text-slate-800 text-xs px-3 py-2 rounded-xl font-bold">Cancelar</button><button type="button" onclick="salvarVinculoApoioGestor(${reg.id})" class="bg-purple-800 hover:bg-purple-900 text-white text-xs px-4 py-2 rounded-xl font-black shadow-md">💾 Salvar Equipe em Apoio</button></div></div>`;
    modal.classList.remove('hidden');
}

async function salvarVinculoApoioGestor(idReg) {
    const reg = (registrosSalvos || []).find(r => r.id === idReg);
    if (!reg) return;
    const selecionados = Array.from(document.querySelectorAll('input[name="chk-apoio-gestor"]:checked')).map(c => c.value);
    const novoMembros = formatarCampoMembrosComApoio(reg.equipe, selecionados);
    const codBase = obterCodigoBaseImovel(reg.imovel);
    const irmaos = (registrosSalvos || []).filter(r => r.dataRegistro === reg.dataRegistro && r.equipe === reg.equipe && r.projeto === reg.projeto && obterCodigoBaseImovel(r.imovel) === codBase);
    const idsAlvo = irmaos.length > 0 ? irmaos.map(i => i.id) : [reg.id];

    const { error } = await supabaseClient.from('registros_producao').update({ membros: novoMembros }).in('id', idsAlvo);
    if (error) { alert("❌ Erro ao salvar vínculo: " + error.message); return; }

    irmaos.forEach(ir => { ir.membros = novoMembros; });
    reg.membros = novoMembros;
    document.getElementById('modal-gerir-apoio-gestor')?.classList.add('hidden');
    registrarLogAuditoria("VÍNCULO DE APOIO", `Imóvel ${codBase} (Titular: ${reg.equipe}) atualizado c/ apoio: ${selecionados.join(', ') || 'Nenhum'}.`);
    atualizarDashboardGestor();
}

function obterSemanaDoMes(dataISO) {
    if (!dataISO || typeof dataISO !== 'string' || dataISO.length < 10) return 'Sem 1';
    const dia = parseInt(dataISO.substring(8, 10), 10);
    if (isNaN(dia) || dia <= 7) return 'Sem 1';
    if (dia <= 14) return 'Sem 2';
    if (dia <= 21) return 'Sem 3';
    if (dia <= 28) return 'Sem 4';
    return 'Sem 5';
}

function obterMacroServicoPlanilha(projeto) {
    const p = (projeto || '').toUpperCase();
    if (p.includes('VISTORIA')) return 'VISTORIA';
    if (p.includes('ATIVAÇÃO') || p.includes('ATIVACAO')) return 'ATIVAÇÃO';
    return 'CONSTRUÇÃO';
}

function obterSubgrupoFOuOnGoing(projeto) {
    const p = (projeto || '').toUpperCase().trim();
    if (p.includes('VISTORIA')) return 'VISTORIA';
    const macroCat = typeof obterMacroGrupoProjeto === 'function' ? obterMacroGrupoProjeto(projeto).toUpperCase() : '';
    if (p.endsWith(' F') || p.includes('PROJETO F') || p === 'CONSTRUÇÃO F' || p === 'ATIVAÇÃO F' || macroCat.includes('PROJETO F')) return 'F';
    return 'ON GOING';
}

function extrairBairroDoEndereco(endereco) {
    if (!endereco || typeof endereco !== 'string') return 'NÃO INFORMADO';
    let limpo = endereco.toUpperCase().trim().replace(/\([^)]*\)/g, '').trim();
    if (limpo.includes(' - ')) {
        const partes = limpo.split(' - ').map(p => p.trim()).filter(Boolean);
        const candidato = partes[partes.length - 1];
        if (candidato && candidato.length >= 2 && !/^\d+$/.test(candidato) && !candidato.startsWith('BL ') && !candidato.startsWith('APT')) return candidato;
    }
    const bairrosRJ = ['COPACABANA', 'TIJUCA', 'RECREIO DOS BANDEIRANTES', 'RECREIO DO BANDEIRANTES', 'BOTAFOGO', 'TAQUARA', 'FREGUESIA', 'PECHINCHA', 'CAMPO GRANDE', 'TODOS OS SANTOS', 'VARGEM GRANDE', 'LEME', 'IPANEMA', 'LEBLON', 'FLAMENGO', 'LARANJEIRAS', 'CATETE', 'GLORIA', 'CENTRO', 'BARRA DA TIJUCA', 'GRAJAU', 'VILA ISABEL', 'MARACANA', 'MEIER', 'ENGENHO NOVO', 'LINS DE VASCONCELOS', 'CACHAMBI', 'DEL CASTILHO', 'INHAUMA', 'MADUREIRA', 'BANGU', 'REALENGO', 'JACAREPAGUA', 'ANIL', 'CURICICA', 'TANQUE', 'PRACA SECA', 'VILA VALQUEIRE', 'QUINTINO BOCAIUVA', 'SAMPAIO', 'PRACA DA BANDEIRA', 'SAO CRISTOVAO', 'HUMAITA', 'GAVEA', 'JARDIM BOTANICO', 'URCA', 'SANTA TERESA', 'RIO COMPRIDO', 'ESTACIO', 'ROCHA', 'RIACHUELO'];
    for (const b of bairrosRJ) if (limpo.includes(b)) return b === 'RECREIO DO BANDEIRANTES' ? 'RECREIO DOS BANDEIRANTES' : b;
    return 'OUTROS / VER ENDEREÇO';
}

function classificarRegistroNovaTaxonomia(reg) {
    const p = String(reg?.projeto || '').toUpperCase().trim();
    const macroOrig = typeof obterMacroGrupoProjeto === 'function' ? String(obterMacroGrupoProjeto(p)).toUpperCase() : '';
    if (p === 'VISTORIA' || p.includes('VISTORIA')) return { segmento: 'CONSTRUÇÃO MDU', categoria: 'VISTORIA', chaveCombinada: 'CONSTRUÇÃO MDU - VISTORIA' };
    if (p.includes('NAP LOTADA')) {
        const cat = (p.includes('ATIVAÇÃO') || p.includes('ATIVACAO')) ? 'ATIVAÇÃO' : 'CONSTRUÇÃO';
        return { segmento: 'EXPANSÃO MDU', categoria: cat, chaveCombinada: `EXPANSÃO MDU - ${cat}` };
    }
    if (p.endsWith(' F') || p.includes('PROJETO F') || p === 'CONSTRUÇÃO F' || p === 'ATIVAÇÃO F' || macroOrig.includes('PROJETO F')) {
        const cat = (p.includes('ATIVAÇÃO') || p.includes('ATIVACAO')) ? 'ATIVAÇÃO' : 'CONSTRUÇÃO';
        return { segmento: 'MAILING', categoria: cat, chaveCombinada: `MAILING - ${cat}` };
    }
    const cat = (p.includes('ATIVAÇÃO') || p.includes('ATIVACAO')) ? 'ATIVAÇÃO' : 'CONSTRUÇÃO';
    return { segmento: 'CONSTRUÇÃO MDU', categoria: cat, chaveCombinada: `CONSTRUÇÃO MDU - ${cat}` };
}

function obterNumeroSemanaFormatado(dataISO) {
    if (!dataISO || typeof dataISO !== 'string' || dataISO.length < 10) return 'Semana 1';
    const dia = parseInt(dataISO.substring(8, 10), 10);
    if (isNaN(dia) || dia <= 7) return 'Semana 1';
    if (dia <= 14) return 'Semana 2';
    if (dia <= 21) return 'Semana 3';
    if (dia <= 28) return 'Semana 4';
    return 'Semana 5';
}

function obterCodigoBaseImovel(imovelStr) {
    let cod = (imovelStr || '').toUpperCase().trim();
    const idx = cod.lastIndexOf(' - BLOCO');
    if (idx !== -1) cod = cod.substring(0, idx).trim();
    return cod;
}

function enriquecerStatusMacroEBairro(listaRegistros) {
    const mapaPrimeiraDataImovel = {};
    const ordenadosCronologico = [...(registrosSalvos || [])].filter(r => r && !normalizarChaveNome(r.equipe).includes('AAAAAATESTE') && r.projeto !== 'IMPREVISTO / ATRASO' && r.projeto !== PROJETO_SOLIC_COMBUSTIVEL && r.projeto !== PROJETO_SOLIC_MATERIAL && r.equipe !== '__CONFIG_SISTEMA__').sort((a, b) => {
        if (a.dataRegistro !== b.dataRegistro) return (a.dataRegistro || '').localeCompare(b.dataRegistro || '');
        return (a.id || 0) - (b.id || 0);
    });

    ordenadosCronologico.forEach(r => {
        const codBase = obterCodigoBaseImovel(r.imovel);
        if (codBase && !mapaPrimeiraDataImovel[codBase]) mapaPrimeiraDataImovel[codBase] = { data: r.dataRegistro, id: r.id };
    });

    return (listaRegistros || []).filter(r => r && !normalizarChaveNome(r.equipe).includes('AAAAAATESTE')).map(r => {
        const codBase = obterCodigoBaseImovel(r.imovel);
        const obsSuperior = ((r.observacoes || '') + ' ' + (r.motivoDesfecho || '')).toUpperCase();
        let statusMacro = 'PROGRAMADO';
        if (obsSuperior.includes('RETORNO') || obsSuperior.includes('REINCID')) statusMacro = 'RETORNO';
        else if (codBase && mapaPrimeiraDataImovel[codBase] && r.dataRegistro > mapaPrimeiraDataImovel[codBase].data) statusMacro = 'RETORNO';
        return {
            ...r, codigoImovelBase: codBase, apoiosConjunto: extrairApoiosDoRegistro(r),
            statusMacroPlanilha: statusMacro, bairroPlanilha: extrairBairroDoEndereco(r.endereco),
            semanaPlanilha: obterSemanaDoMes(r.dataRegistro), servicoPlanilha: obterMacroServicoPlanilha(r.projeto),
            subgrupoFOuOnGoing: obterSubgrupoFOuOnGoing(r.projeto), statusBinarioPlanilha: r.desfecho === 'CONCLUIDA' ? 'EXECUTADO' : 'N EXECUTADO'
        };
    });
}

// ================= AUDITORIA =================
async function sincronizarAuditoriaNaNuvem() {
    try {
        if (trilhaAuditoria.length > 250) trilhaAuditoria = trilhaAuditoria.slice(0, 250);
        localStorage.setItem('gpd_trilha_auditoria', JSON.stringify(trilhaAuditoria));
        const payloadAudit = { id: ID_NUVEM_AUDITORIA, data_registro: "2000-01-01", equipe: "__CONFIG_SISTEMA__", membros: "__CONFIG_SISTEMA__", projeto: "__CONFIG_AUDITORIA__", imovel: "__CONFIG_AUDITORIA__", h_entrada: "00:00", h_saida: "00:00", gps_entrada: "", gps_saida: "", desfecho: "CONFIG", motivo_desfecho: "", malogros: [], agendamento: null, observacoes: JSON.stringify(trilhaAuditoria) };
        await supabaseClient.from('registros_producao').upsert([payloadAudit], { onConflict: 'id' });
    } catch (e) {}
}

async function carregarAuditoriaDaNuvem() {
    try {
        const { data } = await supabaseClient.from('registros_producao').select('observacoes').eq('id', ID_NUVEM_AUDITORIA).maybeSingle();
        if (data && data.observacoes) {
            const listaNuvem = JSON.parse(data.observacoes);
            if (Array.isArray(listaNuvem)) {
                const mapaLogs = new Map();
                [...trilhaAuditoria, ...listaNuvem].forEach(item => { if (item && item.id) mapaLogs.set(item.id, item); });
                trilhaAuditoria = Array.from(mapaLogs.values()).sort((a, b) => b.id - a.id).slice(0, 250);
                localStorage.setItem('gpd_trilha_auditoria', JSON.stringify(trilhaAuditoria));
            }
        }
    } catch (e) {}
}

registrarLogAuditoria = function(acao, detalhes) {
    if (!usuarioLogado) return;
    trilhaAuditoria.unshift({ id: Date.now() + Math.floor(Math.random() * 100), dataHora: new Date().toLocaleString('pt-BR'), usuario: usuarioLogado, acao, detalhes });
    setTimeout(() => { sincronizarAuditoriaNaNuvem(); }, 10);
};

// ================= MELHORIAS VISUAIS =================
function otimizarCabecalhoAzulLinhaUnica() {
    try {
        document.getElementById('badge-usuario-logado-compacto')?.remove();
        const viewGestor = document.getElementById('view-gestor');
        if (!viewGestor || viewGestor.classList.contains('hidden')) {
            document.getElementById('header-gestor-acoes')?.classList.add('hidden');
            document.getElementById('assinatura-dev-leonardo')?.classList.add('hidden');
            return;
        }
        const btnSair = document.getElementById('btn-sair-gestor') || document.querySelector('button[onclick*="sairModoGestor"]');
        if (btnSair && btnSair.parentElement) {
            let spanDev = document.getElementById('assinatura-dev-leonardo');
            if (!spanDev) {
                spanDev = document.createElement('span');
                spanDev.id = 'assinatura-dev-leonardo';
                btnSair.parentElement.insertBefore(spanDev, btnSair);
            }
            spanDev.className = 'text-white font-bold italic text-[11px] mr-2 whitespace-nowrap';
            spanDev.innerText = 'Desenvolvido por Leonardo Simões de Almeida';
            spanDev.classList.remove('hidden');
        }
    } catch (e) {}
}

function inicializarMelhoriasVisuaisGestor() {
    garantirPermissaoOperadorEBaptista();
    ['btn-modo-campo', 'btn-modo-gestor', 'btn-sair-gestor', 'btn-importar-planilha', 'btn-boletim-whats-gestor', 'btn-baixar-excel-gestor', 'btn-atualizar-registros-gestor'].forEach(id => { const el = document.getElementById(id); if (el) el.title = "Ação GPD"; });
    otimizarCabecalhoAzulLinhaUnica();

    const selDesf = document.getElementById('gestor-filtro-desfecho');
    if (selDesf && !document.getElementById('btn-abrir-filtro-multiplo')) {
        const btnMulti = document.createElement('button');
        btnMulti.type = 'button'; btnMulti.id = 'btn-abrir-filtro-multiplo'; btnMulti.onclick = abrirModalFiltroMultiplo;
        btnMulti.className = 'bg-amber-400 hover:bg-amber-300 text-blue-950 font-black text-[11px] px-2.5 py-1 rounded-lg shadow-sm transition whitespace-nowrap flex items-center gap-1 shrink-0';
        btnMulti.innerHTML = `☑️ Filtro Múltiplo <span id="badge-qtd-filtros-multi" class="bg-blue-950 text-cyan-300 px-1.5 py-0.2 rounded text-[9px] hidden">0</span>`;
        selDesf.parentNode.appendChild(btnMulti);
    }
}

function aplicarFiltroSelectEquipesEBannerFiscal() {
    garantirPermissaoOperadorEBaptista();
    const fiscalAtivo = obterFiscalLogadoRestrito();
    const setPermitidas = obterSetEquipesDoFiscalLogado();
    const selFiltroEq = document.getElementById('gestor-filtro-equipe');
    if (selFiltroEq) {
        const valorAtual = selFiltroEq.value;
        const listaEq = obterEquipesVisiveisUsuarioAtual(false);
        selFiltroEq.innerHTML = `<option value="">${fiscalAtivo ? `👷 Meu Grupo (${listaEq.length} Técnicos)` : 'Todas as Equipes'}</option>` + listaEq.map(e => `<option value="${e.nome}">${e.nome}</option>`).join('');
        selFiltroEq.value = (valorAtual && (!setPermitidas || setPermitidas.has(normalizarChaveNome(valorAtual)))) ? valorAtual : "";
    }
}

// ================= MODAIS & SOLICITAÇÕES =================
function abrirModalFiltroMultiplo() { /* ... implementação local de filtro ... */ }
function fecharModalFiltroMultiplo() { document.getElementById('modal-filtro-multiplo')?.classList.add('hidden'); }
function atualizarEstimativaPesoNuvem() { if (typeof renderizarPainelCapacidadeNuvem === "function") renderizarPainelCapacidadeNuvem(); }
function baixarBackupIntegralJSON() { /* ... lógica de backup via master ... */ }

// ================= RASTREIO E MAPA EM TEMPO REAL =================
function converterHorarioParaMinutos(strHora) {
    if (!strHora || typeof strHora !== 'string' || !strHora.includes(':')) return null;
    const p = strHora.trim().split(':'); const h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    return (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) ? null : (h * 60) + m;
}

function formatarDuracaoTexto(totalMinutos) {
    if (totalMinutos === null || isNaN(totalMinutos) || totalMinutos <= 0) return "0 min";
    const h = Math.floor(totalMinutos / 60), m = Math.round(totalMinutos % 60);
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
}

function extrairCoordenadaMaisRecenteDoTecnicoHoje(nomeTec, regsHoje, obrasEmApoioHoje, tel) {
    let best = { lat: null, lng: null, hora: null, minDia: -1, ts: 0, origem: '' };
    const testar = (sCoord, sHora, tsMs, orig) => {
        if (!sCoord || typeof sCoord !== 'string' || !sCoord.includes(',')) return;
        const p = sCoord.split(',').map(s => parseFloat(s.trim()));
        if (p.length < 2 || isNaN(p[0]) || isNaN(p[1]) || (p[0] === 0 && p[1] === 0)) return;
        const min = converterHorarioParaMinutos(sHora) || -1;
        const tsV = Number(tsMs) || 0;
        if (best.lat === null || min > best.minDia || (min === best.minDia && tsV > best.ts)) {
            best = { lat: p[0], lng: p[1], hora: sHora && sHora.includes(':') ? sHora : '--:--', minDia: min, ts: tsV, origem: orig };
        }
    };
    if (tel && tel.lat !== null && tel.lng !== null) testar(`${tel.lat}, ${tel.lng}`, tel.horaUltimoSinal || tel.horaInicio, tel.timestampUltimoSinal, 'Rastreio GPS');
    (regsHoje || []).forEach(r => {
        if (r.gpsEntrada) testar(r.gpsEntrada, r.hEntrada, r.id, `Entrada (${r.imovel})`);
        if (r.gpsSaida) testar(r.gpsSaida, r.hSaida || r.hEntrada, (Number(r.id) || 0) + 10, `Saída (${r.imovel})`);
    });
    return best;
}

function calcularMinutosDesdeUltimoSinal(melhorSinal, tel) {
    const ag = new Date(); const minAg = (ag.getHours() * 60) + ag.getMinutes();
    if (melhorSinal && melhorSinal.minDia >= 0) return Math.max(0, minAg - melhorSinal.minDia);
    const tsRef = Number(tel?.timestampUltimoSinal) || 0;
    return tsRef > 1700000000000 ? Math.max(0, Math.round((Date.now() - tsRef) / 60000)) : 0;
}

function inicializarOuAtualizarMapaRastreio(listaPinos) {
    const containerMapa = document.getElementById('mapa-rastreio-equipes');
    if (!containerMapa || typeof L === 'undefined') return;
    if (!mapaRastreioInstancia) {
        mapaRastreioInstancia = L.map('mapa-rastreio-equipes').setView([-22.9068, -43.1729], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap • GPD PROCISA RJ' }).addTo(mapaRastreioInstancia);
        camadaMarcadoresRastreio = L.layerGroup().addTo(mapaRastreioInstancia);
    }
    setTimeout(() => { if (mapaRastreioInstancia) mapaRastreioInstancia.invalidateSize(); }, 180);
    camadaMarcadoresRastreio.clearLayers();
    coordenadasPinosAtuais = [];
    listaPinos.forEach(p => {
        if (p.lat === null || p.lng === null || isNaN(p.lat) || isNaN(p.lng)) return;
        coordenadasPinosAtuais.push([p.lat, p.lng]);
        const pNome = p.nome.split(' ')[0];
        const iconeHtml = L.divIcon({
            className: 'custom-pin-gpd',
            html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);"><div style="background:${p.corHex};color:#fff;font-weight:900;font-size:10px;padding:2px 7px;border-radius:8px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);white-space:nowrap;display:flex;align-items:center;gap:4px;"><span>${p.iconeEmoji}</span><span>${pNome}</span></div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${p.corHex};margin-top:-1px;"></div></div>`,
            iconSize: [0, 0], iconAnchor: [0, 0]
        });
        const marker = L.marker([p.lat, p.lng], { icon: iconeHtml });
        marker.bindPopup(`<div style="font-family:sans-serif;font-size:11px;"><div style="font-weight:900;color:#0f172a;font-size:12px;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-bottom:4px;">👷 ${p.nome}</div><div><b>Status:</b> <span style="color:${p.corHex};font-weight:800;">${p.statusTexto}</span></div><div><b>Ocupação:</b> ${p.ocupacaoLimpa}</div><a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" style="color:#2563eb;font-weight:bold;text-decoration:underline;display:block;margin-top:5px;">🗺️ Abrir no Google Maps</a></div>`);
        marker.addTo(camadaMarcadoresRastreio);
    });
    const elCont = document.getElementById('lbl-contador-pinos-mapa');
    if (elCont) elCont.innerText = `${coordenadasPinosAtuais.length} técnico(s) no mapa`;
}

window.limparSinaisAntigosDoMapaGestor = async function() {
    if (!usuarioPodeEditarGestor()) return;
    if (!confirm("🧹 LIMPAR TÉCNICOS TRAVADOS NO MAPA\nDeseja remover do mapa todos os técnicos que NÃO estão com atividade 'EM ANDAMENTO' agora?")) return;
    const hj = obterDataLocalISO();
    const hr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const emAtend = new Set((registrosSalvos || []).filter(r => r && r.dataRegistro === hj && ['EM ANDAMENTO', 'PARALISADA', 'REABERTA', 'IMPREVISTO'].includes(r.desfecho)).flatMap(r => [String(r.equipe || '').toUpperCase().trim(), ...extrairApoiosDoRegistro(r)]));
    const todosNomes = new Set([...Object.keys(telemetriaEquipes || {}), ...(equipesSistema || []).map(e => e.nome)]);
    for (const n of todosNomes) {
        if (!n || emAtend.has(n.toUpperCase().trim())) continue;
        const inf = telemetriaEquipes[n] || {};
        const nStat = { ...inf, equipe: n, data: hj, statusTurno: 'ENCERRADO', horaInicio: inf.horaInicio || '08:00', horaFim: hr, horaUltimoSinal: hr, timestampUltimoSinal: Date.now() };
        telemetriaEquipes[n] = nStat;
        if (typeof sincronizarTelemetriaNaNuvem === 'function') await sincronizarTelemetriaNaNuvem(n, nStat);
    }
    if (typeof renderizarPainelDisponibilidade === 'function') renderizarPainelDisponibilidade();
};

window.injetarBotaoLimparMapaFixo = function() {
    const subMapa = document.getElementById('subview-mapa');
    if (subMapa && !document.getElementById('barra-topo-limpar-mapa-travados')) {
        const barra = document.createElement('div');
        barra.id = 'barra-topo-limpar-mapa-travados';
        barra.className = `bg-slate-900 text-white p-3 rounded-xl mb-3 flex flex-wrap justify-between items-center gap-2 shadow border-b-2 border-amber-400 ${!usuarioPodeEditarGestor() ? 'hidden' : ''}`;
        barra.innerHTML = `<div class="text-xs"><span class="font-black text-amber-300 uppercase">🗺️ Controle de Sinais do Mapa</span></div><button type="button" onclick="limparSinaisAntigosDoMapaGestor()" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg">🧹 Limpar Sinais Travados</button>`;
        subMapa.insertBefore(barra, subMapa.firstChild);
    }
};

// ================= PAGINAÇÃO SUPABASE =================
function converterLinhaLeveParaObjetoGpd(row) {
    if (typeof converterLinhaBancoParaObjetoGpd === "function") {
        const obj = converterLinhaBancoParaObjetoGpd({ ...row, observacoes: row.observacoes || "" });
        if (!obj.qtdBlocosProgramados) obj.qtdBlocosProgramados = 1;
        return obj;
    }
    return { id: row.id, dataRegistro: row.data_registro || "", equipe: (row.equipe || "").toUpperCase().trim(), projeto: normalizarNomeProjeto(row.projeto || "CONSTRUÇÃO ON GOING"), imovel: row.imovel || "", desfecho: (row.desfecho || "CONCLUIDA").toUpperCase().trim(), motivoDesfecho: row.motivo_desfecho || "", malogros: Array.isArray(row.malogros) ? row.malogros : [], andares: Number(row.andares) || 0, hps: Number(row.hps) || 0, observacoes: "", fusoes: Number(row.fusoes) || 0, conectores: Number(row.conectores) || 0, caboRL: Number(row.cabo_rl) || 0, caboDrop: Number(row.cabo_drop) || 0, nap: Number(row.nap) || 0, dio: Number(row.dio) || 0, cxSobrepor: Number(row.cx_sobrepor) || 0, cxEmbutida: Number(row.cx_embutida) || 0, cxFosc: Number(row.cx_fosc) || 0 };
}

async function baixarTodoHistoricoPaginadoSupabase() {
    if (typeof supabaseClient === "undefined") return [];
    const TAMANHO_PAGINA = 1000;
    let todasLinhas = [], pagina = 0, continuar = true;
    while (continuar && pagina < 50) {
        const inicio = pagina * TAMANHO_PAGINA;
        let { data, error } = await supabaseClient.from('registros_producao').select('id, data_registro, equipe, membros, projeto, imovel, h_entrada, h_saida, gps_entrada, gps_saida, desfecho, motivo_desfecho, malogros, responsavel, contato, email, agendamento, andares, hps, servico_obra, fusoes, conectores, cabo_rl, cabo_drop, nap, dio, cx_sobrepor, cx_embutida, cx_fosc').neq('equipe', '__CONFIG_SISTEMA__').neq('projeto', '__CONFIG_AUDITORIA__').order('data_registro', { ascending: false }).order('id', { ascending: false }).range(inicio, inicio + TAMANHO_PAGINA - 1);
        if (error) break;
        if (!data || data.length === 0) continuar = false;
        else { todasLinhas.push(...data); if (data.length < TAMANHO_PAGINA) continuar = false; else pagina++; }
    }
    return todasLinhas.map(converterLinhaLeveParaObjetoGpd);
}

async function garantirCargaNuvemGestor(forcarRecarga = false) {
    if (modoConsultaBackupAtivo) return;
    if (!forcarRecarga && typeof cargaInicialGestorConcluida !== 'undefined' && cargaInicialGestorConcluida && Array.isArray(registrosSalvos) && registrosSalvos.length > 0) { historicoCompletoGestorJaBaixado = true; return; }
    if ((forcarRecarga || !historicoCompletoGestorJaBaixado || !cargaInicialGestorConcluida) && !sincronizandoRegistrosMobileEmCurso) {
        sincronizandoRegistrosMobileEmCurso = true;
        try {
            if (typeof sincronizarDeltaRapidoGestor === "function") try { await sincronizarDeltaRapidoGestor(); } catch (e) {}
            const listaCompleta = await baixarTodoHistoricoPaginadoSupabase();
            if (Array.isArray(listaCompleta) && listaCompleta.length > 0) {
                const mapaEx = new Map();
                (registrosSalvos || []).forEach(r => { if (r && r.id) mapaEx.set(r.id, r); });
                listaCompleta.forEach(i => {
                    const ex = mapaEx.get(i.id);
                    if (ex) { i.endereco = ex.endereco || ''; i.tempoPausadoMinutos = Math.max(Number(ex.tempoPausadoMinutos)||0, Number(i.tempoPausadoMinutos)||0); i.qtdFotos = ex.qtdFotos || 0; }
                    mapaEx.set(i.id, i);
                });
                registrosSalvos = Array.from(mapaEx.values()).sort((a, b) => (b.dataRegistro || '').localeCompare(a.dataRegistro || '') || (b.id || 0) - (a.id || 0));
            }
            historicoCompletoGestorJaBaixado = true; cargaInicialGestorConcluida = true;
        } finally { sincronizandoRegistrosMobileEmCurso = false; }
    }
}

// ================= MÓDULO DASHBOARD GESTOR =================
async function atualizarDashboardGestor(forcarRecargaMobile = false) {
    inicializarMelhoriasVisuaisGestor();
    await garantirCargaNuvemGestor(forcarRecargaMobile);
    aplicarFiltroSelectEquipesEBannerFiscal();
    if (usuarioPodeEditarGestor() && typeof verificarEExpurgarSolicitacoesVencidas48h === 'function') try { await verificarEExpurgarSolicitacoesVencidas48h(); } catch(e){}

    const fInicio = document.getElementById('gestor-filtro-data-inicio')?.value || "";
    const fFim = document.getElementById('gestor-filtro-data-fim')?.value || "";
    const fEq = document.getElementById('gestor-filtro-equipe')?.value || "";

    const corpoAtiv = document.getElementById('tabela-gestor-corpo');
    if (corpoAtiv) corpoAtiv.innerHTML = "";

    let filtrados = (registrosSalvos || []).filter(i => {
        if (!i || i.equipe === "__CONFIG_SISTEMA__" || i.projeto === "__CONFIG_AUDITORIA__") return false;
        if (normalizarChaveNome(i.equipe).includes('AAAAAATESTE')) return false;
        if (fInicio && i.dataRegistro < fInicio) return false;
        if (fFim && i.dataRegistro > fFim) return false;
        if (fEq && normalizarChaveNome(i.equipe) !== normalizarChaveNome(fEq) && !extrairApoiosDoRegistro(i).some(ap => normalizarChaveNome(ap) === normalizarChaveNome(fEq))) return false;
        return true;
    });

    dadosFiltradosAtuais = enriquecerStatusMacroEBairro(filtrados);
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setTxt('contador-resultados', `${dadosFiltradosAtuais.length} registros`);

    if (corpoAtiv) {
        if (dadosFiltradosAtuais.length === 0) {
            corpoAtiv.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Nenhum registro encontrado no filtro.</td></tr>`;
        } else {
            const agrupar = {};
            dadosFiltradosAtuais.forEach(i => {
                const cb = obterCodigoBaseImovel(i.imovel);
                const isAberta = ['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(i.desfecho);
                const ch = `${i.dataRegistro}_${i.equipe}_${cb}_${i.projeto}_${isAberta?'A':'F'}`;
                if (!agrupar[ch]) agrupar[ch] = { cb, dataRegistro: i.dataRegistro, equipe: i.equipe, projeto: i.projeto, itens: [] };
                agrupar[ch].itens.push(i);
            });

            Object.values(agrupar).forEach(g => {
                const isMlt = g.itens.length > 1;
                const m = g.itens[0];
                const tr = document.createElement('tr');
                tr.className = "hover:bg-blue-50/50 border-b cursor-pointer transition";
                tr.onclick = () => abrirDetalhesAtividade(m);
                const btnDownloadFotos = m.qtdFotos > 0 ? `<button onclick="baixarTodasFotosPorIdAtividade(${m.id}, event, this)" class="ml-1 bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">⬇️ Baixar Fotos</button>` : '';
                const btnExp = isMlt ? `<button class="mt-1 bg-blue-900 text-white text-[10px] px-2 py-1 rounded" onclick="event.stopPropagation(); alert('Contém ${g.itens.length} blocos. Abra os detalhes para gerenciar.')">📂 Ver Blocos</button>` : '';
                tr.innerHTML = `<td class="p-3"><b>${isMlt ? `${g.cb} (${g.itens.length} Blocos)` : m.imovel}</b><br><span class="text-[10px] text-slate-500">${m.dataRegistro}</span>${btnExp}</td><td class="p-3">${m.equipe}</td><td class="p-3"><span class="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[10px]">${m.projeto}</span></td><td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200">${isMlt ? 'MÚLTIPLO' : m.desfecho}</span>${btnDownloadFotos}</td><td class="p-3 text-[10px]">${m.hEntrada} / ${m.hSaida}</td><td class="p-3 text-[10px] text-slate-400">GPS OK</td><td class="p-3"><button onclick="abrirModalEdicao(${m.id})" class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] border border-blue-200 font-bold">✏️ Editar</button></td>`;
                corpoAtiv.appendChild(tr);
            });
        }
    }

    try { renderizarAbaGraficosCompletaOficial(); } catch (e) {}
    try { window.atualizarPainelForecastMdu(); } catch (e) {}
}

function aplicarAtalhoPeriodo(tipo) {
    const inpI = document.getElementById('gestor-filtro-data-inicio'), inpF = document.getElementById('gestor-filtro-data-fim');
    const hj = new Date();
    const fISO = (d) => d.toISOString().split('T')[0];
    if (tipo === 'hoje') { inpI.value = fISO(hj); inpF.value = fISO(hj); }
    else if (tipo === 'ontem') { const o = new Date(hj); o.setDate(hj.getDate()-1); inpI.value = fISO(o); inpF.value = fISO(o); }
    else if (tipo === '7dias') { const d = new Date(hj); d.setDate(hj.getDate()-6); inpI.value = fISO(d); inpF.value = fISO(hj); }
    else if (tipo === 'mes') { inpI.value = fISO(new Date(hj.getFullYear(), hj.getMonth(), 1)); inpF.value = fISO(hj); }
    else if (tipo === 'tudo') { inpI.value = ''; inpF.value = ''; }
    atualizarDashboardGestor();
}

async function removerApenasAberturasFantasmas() {
    if (limpezaDuplicadosEmAndamento || modoConsultaBackupAtivo) return;
    limpezaDuplicadosEmAndamento = true;
    try {
        const hjs = new Set(), aps = new Set();
        registrosSalvos.forEach(r => { if (['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(r.desfecho)) hjs.add(`${r.dataRegistro}|${r.equipe}|${obterCodigoBaseImovel(r.imovel)}`); });
        registrosSalvos.forEach(r => { if (['EM ANDAMENTO', 'PARALISADA'].includes(r.desfecho) && hjs.has(`${r.dataRegistro}|${r.equipe}|${obterCodigoBaseImovel(r.imovel)}`)) aps.add(r.id); });
        if (aps.size > 0) {
            registrosSalvos = registrosSalvos.filter(r => !aps.has(r.id));
            if (typeof supabaseClient !== 'undefined') await supabaseClient.from('registros_producao').delete().in('id', Array.from(aps));
        }
    } finally { limpezaDuplicadosEmAndamento = false; }
}

if (!window._hookDashUnificadoV3) {
    window._hookDashUnificadoV3 = true;
    const _oAtu = window.atualizarDashboardGestor;
    window.atualizarDashboardGestor = async function(...args) {
        await removerApenasAberturasFantasmas();
        return _oAtu.apply(this, args);
    };
}

// ================= DOWNLOAD DE FOTOS =================
window.baixarFotoDireto = function(srcBase64, nomeArquivo = "foto.jpg") {
    if (!srcBase64) return;
    const a = document.createElement('a'); a.download = nomeArquivo;
    if (srcBase64.startsWith('data:')) {
        const p = srcBase64.split(','), m = p[0].match(/:(.*?);/)[1], bStr = atob(p[1]), arr = new Uint8Array(bStr.length);
        for (let i=0; i<bStr.length; i++) arr[i] = bStr.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([arr], {type:m}));
        a.href = url; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    } else { a.href = srcBase64; a.target = "_blank"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
};

window.baixarTodasFotosDoModalAtual = async function(btn) {
    if (baixandoLoteFotos || typeof itemDetalheAtualModal === 'undefined' || !itemDetalheAtualModal.fotos) return;
    baixandoLoteFotos = true; const f = itemDetalheAtualModal.fotos, cod = obterCodigoBaseImovel(itemDetalheAtualModal.imovel).replace(/[^a-z0-9]/gi, '_');
    const txt = btn.innerHTML;
    for (let i=0; i<f.length; i++) { btn.innerHTML = `⏳ ${i+1}/${f.length}...`; window.baixarFotoDireto(f[i], `${cod}_foto_${i+1}.jpg`); await new Promise(r=>setTimeout(r,350)); }
    btn.innerHTML = `✅ ${f.length} baixadas!`; setTimeout(() => { btn.innerHTML = txt; }, 2500); baixandoLoteFotos = false;
};

window.baixarTodasFotosPorIdAtividade = async function(id, ev, btn) {
    if (ev) ev.stopPropagation(); if (baixandoLoteFotos) return;
    const reg = registrosSalvos.find(r => r.id === id); if (!reg) return;
    baixandoLoteFotos = true; const cod = obterCodigoBaseImovel(reg.imovel).replace(/[^a-z0-9]/gi, '_'); const txt = btn.innerHTML;
    try {
        let f = Array.isArray(reg.fotos) ? reg.fotos : [];
        if (f.length === 0 && typeof obterFotosSobDemandaDoRegistro === 'function') f = await obterFotosSobDemandaDoRegistro(id);
        for (let i=0; i<f.length; i++) { btn.innerHTML = `⬇️ ${i+1}/${f.length}`; window.baixarFotoDireto(f[i], `${cod}_${i+1}.jpg`); await new Promise(r=>setTimeout(r,350)); }
        btn.innerHTML = `✅`; setTimeout(() => { btn.innerHTML = txt; }, 2000);
    } finally { baixandoLoteFotos = false; }
};

// ================= EXPORTAÇÃO EXCEL OFICIAL (23 COLUNAS - BLOCOS SEPARADOS) =================
window.exportarPlanilhaDinamicaOficialExcel = function() {
    const baseBruta = (dadosFiltradosAtuais && dadosFiltradosAtuais.length > 0 ? dadosFiltradosAtuais : registrosSalvos).filter(r =>
        r && !normalizarChaveNome(r.equipe).includes('AAAAAATESTE') && r.equipe !== '__CONFIG_SISTEMA__' && r.projeto !== '__CONFIG_AUDITORIA__' && r.projeto !== 'IMPREVISTO / ATRASO' && r.projeto !== PROJETO_SOLIC_COMBUSTIVEL && r.projeto !== PROJETO_SOLIC_MATERIAL && !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(r.desfecho) && (typeof registroPertenceAoUsuarioLogado === 'function' ? registroPertenceAoUsuarioLogado(r) : true)
    ).map(r => ({ ...r, _tax: classificarRegistroNovaTaxonomia(r), _semana: obterNumeroSemanaFormatado(r.dataRegistro) }));

    if (baseBruta.length === 0) { alert("⚠️ Nenhum registo finalizado na seleção atual."); return; }
    baseBruta.sort((a, b) => (a.dataRegistro || '').localeCompare(b.dataRegistro || '') || (a.imovel || '').localeCompare(b.imovel || ''));

    let html = `<table border="1"><tr style="background:#0f172a;color:#fff;font-weight:bold;font-size:13px;"><th colspan="23">RELATÓRIO OFICIAL DE INDICADORES GPD — PRODUÇÃO E MATERIAIS SEPARADOS POR BLOCO (${obterDataLocalISO()})</th></tr><tr style="background:#cbd5e1;font-weight:bold;"><th>SEMANA</th><th>DATA</th><th>TÉCNICO / EQUIPE</th><th>CATEGORIA TÉCNICO</th><th>APOIO CONJUNTO</th><th>SEGMENTO</th><th>CATEGORIA</th><th>IMÓVEL / BLOCO DETALHADO</th><th>ENDEREÇO</th><th>ANDARES</th><th>HPs</th><th>PARALISAÇÃO (MIN)</th><th>CABO RL (m)</th><th>CABO DROP (m)</th><th>CONECTORES</th><th>FUSÕES</th><th>NAP</th><th>DIO</th><th>CX SOBREPOR</th><th>CX EMBUTIDA</th><th>CX FOSC</th><th>RESULTADO (STATUS)</th><th>DETALHES / OFENSORES</th></tr>`;
    baseBruta.forEach(r => {
        const ap = extrairApoiosDoRegistro(r).join(', ') || '-';
        const catTec = obterCategoriaDiscretaTecnicoHtml(r.equipe, true);
        const det = (Array.isArray(r.malogros) && r.malogros.length > 0) ? r.malogros.join(' + ') : (r.motivoDesfecho || r.observacoes || '-');
        const pausaExibir = (String(r.imovel).includes('BLOCO 1') || !String(r.imovel).includes('BLOCO')) ? (Number(r.tempoPausadoMinutos) || 0) : 0;
        html += `<tr><td>${r._semana}</td><td>${r.dataRegistro}</td><td><b>${r.equipe}</b></td><td>${catTec}</td><td>${ap}</td><td><b>${r._tax.segmento}</b></td><td><b>${r._tax.categoria}</b></td><td><b>${r.imovel}</b></td><td>${r.endereco || '-'}</td><td>${r.andares || 0}</td><td>${r.hps || 0}</td><td>${pausaExibir}</td><td>${r.caboRL || 0}</td><td>${r.caboDrop || 0}</td><td>${r.conectores || 0}</td><td>${r.fusoes || 0}</td><td>${r.nap || 0}</td><td>${r.dio || 0}</td><td>${r.cxSobrepor || 0}</td><td>${r.cxEmbutida || 0}</td><td>${r.cxFosc || 0}</td><td><b>${r.desfecho}</b></td><td>${det}</td></tr>`;
    });
    html += `</table>`;
    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `INDICADORES_GPD_PRODUCAO_${obterDataLocalISO()}.xls`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
};
window.exportarExcel = window.exportarPlanilhaDinamicaOficialExcel;

// ================= WHATSAPP E FINANCEIRO =================
copiarBoletimGestorWhatsApp = function() {
    const l = dadosFiltradosAtuais.filter(r => r && !normalizarChaveNome(r.equipe).includes('AAAAAATESTE') && r.projeto !== 'IMPREVISTO / ATRASO' && r.projeto !== PROJETO_SOLIC_COMBUSTIVEL && r.projeto !== PROJETO_SOLIC_MATERIAL);
    if (l.length === 0) return;
    const pStr = `${document.getElementById('gestor-filtro-data-inicio')?.value || 'Início'} a ${document.getElementById('gestor-filtro-data-fim')?.value || 'Hoje'}`;
    const and = l.filter(i => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(i.desfecho)).length;
    const fin = l.filter(i => !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(i.desfecho));
    const conc = fin.filter(i => i.desfecho === 'CONCLUIDA').length, mal = fin.filter(i => i.desfecho === 'MALOGRADA').length;
    const t = `📊 *BOLETIM GPD - MDU PROCISA RJ*\n📅 *Período:* ${pStr}\n──────────────────────\n🔵 *Ativas:* ${and}\n📈 *Finalizadas:* ${fin.length}\n🟢 *Concluídas:* ${conc}\n🔴 *Malogradas:* ${mal}`;
    navigator.clipboard.writeText(t).then(() => alert("✅ Boletim copiado!"));
};

function renderizarTabelaFinanceiro(totais) {
    const c = document.getElementById('tabela-financeiro-corpo'); if (!c) return;
    c.innerHTML = ""; let valG = 0;
    [{ ch: "VISTORIA", q: totais.vistorias }, { ch: "CABO RL", q: totais.caboRL }, { ch: "CONECTORES", q: totais.conectores }, { ch: "FUSÕES", q: totais.fusoes }, { ch: "CABO DROP", q: totais.caboDrop }, { ch: "NAP", q: totais.nap }, { ch: "DIO", q: totais.dio }, { ch: "CX SOBREPOR", q: totais.cxSobrepor }, { ch: "CX EMBUTIDA", q: totais.cxEmbutida }].forEach(i => {
        let cfg = TABELA_PRECOS[i.ch], t = i.q * cfg.valor; valG += t;
        c.innerHTML += `<tr class="border-b"><td class="p-3">${cfg.codigo}</td><td class="p-3">${cfg.desc}</td><td class="p-3">${cfg.unidade}</td><td class="p-3 text-center">${i.q}</td><td class="p-3 text-right">R$ ${cfg.valor.toFixed(2)}</td><td class="p-3 text-right font-bold text-emerald-700">R$ ${t.toFixed(2)}</td></tr>`;
    });
    const st = document.getElementById('fin-total-geral'); if (st) st.innerText = `R$ ${valG.toFixed(2)}`;
}

// ================= MODAIS DE EDICAO E TRANSFERENCIA =================
async function abrirModalEdicao(id) {
    if (!usuarioPodeEditarGestor()) return;
    let r = registrosSalvos.find(x => x.id === id); if (!r) return;
    document.getElementById('edit-reg-id').value = r.id; document.getElementById('edit-reg-imovel').value = r.imovel; document.getElementById('edit-reg-equipe').innerHTML = `<option value="${r.equipe}">${r.equipe}</option>`;
    document.getElementById('edit-reg-desfecho').value = r.desfecho; document.getElementById('edit-reg-cabo-rl').value = r.caboRL || 0;
    // Preenche as outras colunas...
    document.getElementById('modal-edicao').classList.remove('hidden');
}
function fecharModalEdicao() { document.getElementById('modal-edicao').classList.add('hidden'); }
async function salvarEdicaoRegistro() {
    let id = Number(document.getElementById('edit-reg-id').value);
    let rl = Number(document.getElementById('edit-reg-cabo-rl').value) || 0;
    const { error } = await supabaseClient.from('registros_producao').update({ cabo_rl: rl }).eq('id', id);
    if (!error) { let reg = registrosSalvos.find(r => r.id === id); if(reg) reg.caboRL = rl; fecharModalEdicao(); atualizarDashboardGestor(); }
}

// ================= FORECAST MDU =================
(function() {
    const LPU_PADRAO_FORECAST = {
        VISTORIA: { valor: 85.00 }, CABO_RL: { valor: 4.50 }, CABO_DROP: { valor: 3.20 },
        CONECTORES: { valor: 18.00 }, FUSOES: { valor: 22.00 }, NAP: { valor: 95.00 },
        DIO: { valor: 140.00 }, CX_SOBREPOR: { valor: 45.00 }, CX_EMBUTIDA: { valor: 38.00 }, CX_FOSC: { valor: 180.00 }
    };
    let parametrosEstimativaMdu = JSON.parse(localStorage.getItem('gpd_param_forecast_mdu') || 'null') || { metrosRlPorAndar: 4.5, metrosRlBasePorBloco: 25, hpsPorNap: 8, fusoesPorNap: 2, fusoesPorDio: 12, conectoresPorNap: 8, metrosDropPorAtivacao: 35 };
    let carteiraExtraSimulada = JSON.parse(localStorage.getItem('gpd_carteira_forecast_extra') || '[]');

    function obterPrecoUnitarioLpu(chaveInterna, chaveTabelaGlobal) {
        if (typeof TABELA_PRECOS !== 'undefined' && TABELA_PRECOS[chaveTabelaGlobal] && TABELA_PRECOS[chaveTabelaGlobal].valor > 0) return Number(TABELA_PRECOS[chaveTabelaGlobal].valor);
        return LPU_PADRAO_FORECAST[chaveInterna]?.valor || 0;
    }

    function calcularValorRealizadoRegistro(reg) {
        if (!reg) return { total: 0 };
        const qtdV = (reg.projeto.includes('VISTORIA') && reg.desfecho === 'CONCLUIDA') ? 1 : 0;
        const tot = (qtdV * obterPrecoUnitarioLpu('VISTORIA','VISTORIA')) + ((Number(reg.caboRL)||0) * obterPrecoUnitarioLpu('CABO_RL','CABO RL')) + ((Number(reg.fusoes)||0) * obterPrecoUnitarioLpu('FUSOES','FUSÕES')) + ((Number(reg.conectores)||0) * obterPrecoUnitarioLpu('CONECTORES','CONECTORES')) + ((Number(reg.nap)||0) * obterPrecoUnitarioLpu('NAP','NAP')) + ((Number(reg.dio)||0) * obterPrecoUnitarioLpu('DIO','DIO')) + ((Number(reg.caboDrop)||0) * obterPrecoUnitarioLpu('CABO_DROP','CABO DROP')) + ((Number(reg.cxSobrepor)||0) * obterPrecoUnitarioLpu('CX_SOBREPOR','CX SOBREPOR')) + ((Number(reg.cxEmbutida)||0) * obterPrecoUnitarioLpu('CX_EMBUTIDA','CX EMBUTIDA')) + ((Number(reg.cxFosc)||0) * obterPrecoUnitarioLpu('CX_FOSC','CX FOSC'));
        return { total: tot };
    }

    // CORREÇÃO: Força bloco = 1 se o nome do imóvel já conter " - BLOCO" (foi desmembrado)
    function calcularValorForecastEstrutural(item) {
        const proj = String(item.projeto || 'CONSTRUÇÃO ON GOING').toUpperCase();
        const andares = Math.max(0, Number(item.andares) || 0), hps = Math.max(0, Number(item.hps) || 0);

        let blocos = 1;
        if (String(item.imovel).toUpperCase().includes('- BLOCO')) {
            blocos = 1;
        } else {
            blocos = Math.max(1, Number(item.qtdBlocosProgramados) || Number(item.blocos) || 1);
        }

        if (proj.includes('VISTORIA')) return { total: blocos * obterPrecoUnitarioLpu('VISTORIA', 'VISTORIA'), resumo: `${blocos} Vistoria(s)` };
        const real = calcularValorRealizadoRegistro(item);
        const andaresRef = andares > 0 ? andares : (hps > 0 ? Math.max(1, Math.ceil(hps / 4)) : 5);
        const hpsRef = hps > 0 ? hps : (andaresRef * 4);
        let eRL=0, eDr=0, eNap=0, eDio=0, eFus=0, eCon=0, eCx=0;
        if (proj.includes('ATIVAÇÃO') || proj.includes('ATIVACAO')) { eDr = blocos * parametrosEstimativaMdu.metrosDropPorAtivacao; eCon = blocos * 4; eFus = blocos * 4; }
        else { eRL = (blocos * parametrosEstimativaMdu.metrosRlBasePorBloco) + (andaresRef * parametrosEstimativaMdu.metrosRlPorAndar); eNap = Math.max(blocos, Math.ceil(hpsRef / parametrosEstimativaMdu.hpsPorNap)); eDio = blocos; eFus = (eNap * parametrosEstimativaMdu.fusoesPorNap) + (eDio * parametrosEstimativaMdu.fusoesPorDio); eCon = eNap * parametrosEstimativaMdu.conectoresPorNap; eCx = Math.ceil(andaresRef / 2); }
        const tEst = (eRL * obterPrecoUnitarioLpu('CABO_RL','CABO RL')) + (eDr * obterPrecoUnitarioLpu('CABO_DROP','CABO DROP')) + (eCon * obterPrecoUnitarioLpu('CONECTORES','CONECTORES')) + (eFus * obterPrecoUnitarioLpu('FUSOES','FUSÕES')) + (eNap * obterPrecoUnitarioLpu('NAP','NAP')) + (eDio * obterPrecoUnitarioLpu('DIO','DIO')) + (eCx * obterPrecoUnitarioLpu('CX_SOBREPOR','CX SOBREPOR'));
        return { total: tEst > 0 ? tEst : real.total, resumo: `${blocos} Bl | ${andaresRef} And | ${hpsRef} HPs (Est: ${Math.round(eRL)}m RL)` };
    }

    function injetarPainelForecastNoFinanceiro() {
        const viewFin = document.getElementById('subview-financeiro');
        if (!viewFin || document.getElementById('painel-integrado-forecast-mdu')) return;
        const c = document.createElement('div'); c.id = 'painel-integrado-forecast-mdu'; c.className = 'space-y-4 pb-4 border-b-2 border-slate-200 mb-4';
        c.innerHTML = `<div class="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 rounded-2xl shadow-lg border-b-4 border-emerald-400 space-y-3"><div class="flex justify-between items-center"><div><h3 class="text-base font-black">📈 Forecast MDU — Previsão de Receita (Carteira) vs. Realizado</h3></div><button onclick="exportarRelatorioForecastExcel()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-2 rounded-xl">📥 Exportar Forecast (.XLS)</button></div><div class="grid grid-cols-4 gap-3 pt-1"><div class="bg-slate-800 p-3 rounded-xl"><span class="text-[10px] font-black text-cyan-300">1. Forecast Total</span><div class="text-xl font-black text-white mt-1" id="fc-card-valor-previsto">R$ 0,00</div></div><div class="bg-blue-950 p-3 rounded-xl"><span class="text-[10px] font-black text-blue-300">2. Em Execução</span><div class="text-xl font-black text-cyan-300 mt-1" id="fc-card-valor-andamento">R$ 0,00</div></div><div class="bg-emerald-950 p-3 rounded-xl"><span class="text-[10px] font-black text-emerald-300">3. Realizado Consolidado</span><div class="text-xl font-black text-emerald-400 mt-1" id="fc-card-valor-realizado">R$ 0,00</div></div><div class="bg-indigo-950 p-3 rounded-xl"><span class="text-[10px] font-black text-amber-300">4. GAP Faltante</span><div class="text-xl font-black text-amber-300 mt-1" id="fc-card-valor-gap">R$ 0,00</div></div></div></div><div class="bg-white rounded-xl border border-slate-200 shadow-sm"><div class="overflow-x-auto"><table class="w-full text-left border-collapse text-xs"><thead class="bg-slate-800 text-white text-[10px]"><tr><th class="p-2.5">Data</th><th class="p-2.5">Imóvel / Bloco</th><th class="p-2.5">Projeto</th><th class="p-2.5">Status</th><th class="p-2.5 text-right">Previsto (R$)</th><th class="p-2.5 text-right">Realizado (R$)</th></tr></thead><tbody id="tabela-forecast-mdu-corpo"></tbody></table></div></div>`;
        viewFin.insertBefore(c, viewFin.firstChild);
    }

    window.atualizarPainelForecastMdu = function() {
        injetarPainelForecastNoFinanceiro();
        const corpo = document.getElementById('tabela-forecast-mdu-corpo'); if (!corpo) return;
        const unificados = [...(dadosFiltradosAtuais || []).map(r => ({ ...r, _origem: 'SISTEMA' })), ...carteiraExtraSimulada.map(s => ({ ...s, _origem: 'PLANILHA' }))].filter(r => !normalizarChaveNome(r.equipe).includes('AAAAAATESTE') && r.equipe !== '__CONFIG_SISTEMA__');
        let sP=0, sA=0, sR=0, html='';
        unificados.forEach(item => {
            const desf = String(item.desfecho || 'PROGRAMADA').toUpperCase().trim();
            const calcPrev = calcularValorForecastEstrutural(item), calcReal = calcularValorRealizadoRegistro(item);
            const vPrev = calcPrev.total > 0 ? calcPrev.total : calcReal.total;
            const vReal = ['CONCLUIDA', 'CONCLUÍDA'].includes(desf) ? calcReal.total : 0;
            sP += vPrev; sR += vReal; if (['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(desf)) sA += (calcReal.total > 0 ? calcReal.total : vPrev);
            html += `<tr class="border-b hover:bg-slate-50"><td class="p-2.5 text-[9px]">${item.dataRegistro||'-'}</td><td class="p-2.5 font-bold">${item.imovel||'-'}</td><td class="p-2.5">${item.projeto}</td><td class="p-2.5">${desf}</td><td class="p-2.5 text-right font-bold text-slate-800">R$ ${vPrev.toFixed(2)}</td><td class="p-2.5 text-right font-bold text-emerald-700">R$ ${vReal.toFixed(2)}</td></tr>`;
        });
        document.getElementById('fc-card-valor-previsto').innerText = `R$ ${sP.toFixed(2)}`; document.getElementById('fc-card-valor-andamento').innerText = `R$ ${sA.toFixed(2)}`; document.getElementById('fc-card-valor-realizado').innerText = `R$ ${sR.toFixed(2)}`; document.getElementById('fc-card-valor-gap').innerText = `Faltam R$ ${Math.max(0, sP - sR).toFixed(2)}`;
        corpo.innerHTML = html || `<tr><td colspan="6" class="p-4 text-center">Nenhum dado de forecast.</td></tr>`;
    };

    window.exportarRelatorioForecastExcel = function() {
        const c = document.getElementById('tabela-forecast-mdu-corpo'); if (!c) return;
        const html = `<table border="1"><tr style="background:#0f172a;color:#fff;"><th colspan="6">RELATÓRIO FORECAST MDU - ${obterDataLocalISO()}</th></tr><tr style="background:#cbd5e1;"><th>DATA</th><th>IMÓVEL</th><th>PROJETO</th><th>STATUS</th><th>PREVISTO</th><th>REALIZADO</th></tr>${c.innerHTML}</table>`;
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' })); a.download = `FORECAST_${obterDataLocalISO()}.xls`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const _origRenderFin = window.renderizarTabelaFinanceiro;
    if (typeof _origRenderFin === 'function') {
        window.renderizarTabelaFinanceiro = function(totais) { const res = _origRenderFin.apply(this, arguments); try { window.atualizarPainelForecastMdu(); } catch (e) {} return res; };
    }
})();
