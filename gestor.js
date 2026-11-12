// ================= VARIÁVEIS GLOBAIS DO MODO GESTOR (UNIFICADO, PAGINADO E ESTÁVEL) =================
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

const TEMPO_MAXIMO_SINAL_ROTA_MINUTOS = 480; // Janela ampliada (8h) para não remover do mapa nem dar baixa indevida em rota

// ================= FECHO DOS MODAIS DE EXPANSÃO (TELA CHEIA) =================
function fecharModalGraficoExpandido() {
    const modal = document.getElementById('modal-expandir-grafico');
    if (modal) modal.classList.add('hidden');
    if (typeof estadoModalExpandidoAtual !== 'undefined') {
        estadoModalExpandidoAtual.ativo = false;
    }
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
    if (typeof estadoModalExpandidoAtual !== 'undefined') {
        estadoModalExpandidoAtual.ativo = false;
    }
}
window.fecharModalTabelaExpandida = fecharModalTabelaExpandida;

document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
        fecharModalGraficoExpandido();
        fecharModalTabelaExpandida();
    }
});

// ================= CATÁLOGO OFICIAL DOS 3 FISCAIS E CARTEIRA DE TÉCNICOS =================
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
    return String(str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
}

// ================= ETIQUETA DISCRETA COLORIDA DE CATEGORIA DO TÉCNICO =================
function obterCategoriaDiscretaTecnicoHtml(nomeEquipe, apenasTexto = false) {
    const eqObj = (typeof equipesSistema !== 'undefined' && Array.isArray(equipesSistema))
        ? equipesSistema.find(e => normalizarChaveNome(e.nome) === normalizarChaveNome(nomeEquipe))
        : null;
    const setores = typeof obterArraySetores === 'function'
        ? obterArraySetores(eqObj ? eqObj.setor : 'Instalador')
        : ['Instalador'];

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

// ================= NORMALIZAÇÃO DE PERMISSÕES =================
function garantirPermissaoOperadorEBaptista() {
    try {
        const emailAtual = String(usuarioLogado || "").toLowerCase().trim();

        if (Array.isArray(usuariosSistema)) {
            const uBaptista = usuariosSistema.find(u => String(u.email || "").toLowerCase().trim() === "e.baptista@procisa.com.br");
            if (uBaptista && uBaptista.nivel !== "Operador") {
                uBaptista.nivel = "Operador";
                uBaptista.status = "Ativo";
            }
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

function usuarioPodeEditarGestor() {
    const n = obterNivelNormalizadoGestor();
    return n === "master" || n === "operador";
}

function usuarioEhMasterGestor() {
    return obterNivelNormalizadoGestor() === "master";
}

// ================= FUNÇÕES DE CARTEIRA DE FISCAIS =================
function obterFiscalObjPorEmailOuNome(valor) {
    if (!valor) return null;
    const vNorm = normalizarChaveNome(valor);
    return CATALOGO_FISCAIS_MDU.find(f =>
        f.email.toLowerCase() === String(valor).toLowerCase().trim() ||
        normalizarChaveNome(f.nome) === vNorm
    ) || null;
}

function obterEmailFiscalDaEquipe(eqObjOuNome) {
    let eqObj = (typeof eqObjOuNome === 'object' && eqObjOuNome !== null)
        ? eqObjOuNome
        : (equipesSistema || []).find(e => normalizarChaveNome(e.nome) === normalizarChaveNome(eqObjOuNome));

    if (eqObj && eqObj.fiscalEmail) {
        return String(eqObj.fiscalEmail).toLowerCase().trim();
    }
    const nomeChave = normalizarChaveNome(eqObj ? eqObj.nome : eqObjOuNome);
    return MAPA_PADRAO_EQUIPE_FISCAL[nomeChave] || "";
}

function obterNomeFiscalDaEquipe(eqObjOuNome) {
    const email = obterEmailFiscalDaEquipe(eqObjOuNome);
    const fObj = obterFiscalObjPorEmailOuNome(email);
    return fObj ? fObj.nome : "SEM FISCAL DEFINIDO";
}

function obterFiscalLogadoRestrito() {
    const emailLogado = String(usuarioLogado || "").toLowerCase().trim();
    if (!emailLogado) return null;
    if (usuarioPodeEditarGestor()) return null;
    return CATALOGO_FISCAIS_MDU.find(f => f.email.toLowerCase() === emailLogado) || null;
}

function obterSetEquipesDoFiscalLogado() {
    const fiscalRestrito = obterFiscalLogadoRestrito();
    if (!fiscalRestrito) return null;

    const emailFiscal = fiscalRestrito.email.toLowerCase().trim();
    const permitidas = new Set();

    (equipesSistema || []).forEach(eq => {
        if (obterEmailFiscalDaEquipe(eq) === emailFiscal) {
            permitidas.add(normalizarChaveNome(eq.nome));
        }
    });

    Object.entries(MAPA_PADRAO_EQUIPE_FISCAL).forEach(([nomeTec, emailPadrao]) => {
        const eqCad = (equipesSistema || []).find(e => normalizarChaveNome(e.nome) === nomeTec);
        const emailAtual = (eqCad && eqCad.fiscalEmail) ? eqCad.fiscalEmail.toLowerCase().trim() : emailPadrao;
        if (emailAtual === emailFiscal) {
            permitidas.add(nomeTec);
        }
    });

    return permitidas;
}

function equipePertenceAoUsuarioLogado(nomeEquipe, setFiscal = undefined) {
    const setRef = setFiscal !== undefined ? setFiscal : obterSetEquipesDoFiscalLogado();
    if (!setRef) return true;
    return setRef.has(normalizarChaveNome(nomeEquipe));
}

function registroPertenceAoUsuarioLogado(reg, setFiscal = undefined) {
    const setRef = setFiscal !== undefined ? setFiscal : obterSetEquipesDoFiscalLogado();
    if (!setRef) return true;
    if (!reg) return false;
    if (setRef.has(normalizarChaveNome(reg.equipe))) return true;
    const apoios = extrairApoiosDoRegistro(reg);
    return apoios.some(ap => setRef.has(normalizarChaveNome(ap)));
}

function obterEquipesVisiveisUsuarioAtual(apenasAtivas = false) {
    const setFiscal = obterSetEquipesDoFiscalLogado();
    return (equipesSistema || []).filter(e => {
        if (!e || !e.nome) return false;
        if (normalizarChaveNome(e.nome).includes('AAAAAATESTE')) return false;
        if (apenasAtivas && e.status !== 'Ativo') return false;
        if (setFiscal && !setFiscal.has(normalizarChaveNome(e.nome))) return false;
        return true;
    });
}

// ================= FUNÇÕES DE APOIO CONJUNTO / ATUAÇÃO COMPARTILHADA =================
function extrairApoiosDoRegistro(reg) {
    if (!reg) return [];
    const titular = (reg.equipe || '').toUpperCase().trim();
    const validados = [];
    const mStr = (reg.membros || '').trim();
    if (mStr && mStr !== '__CONFIG_SISTEMA__' && mStr.toUpperCase() !== titular) {
        const partes = mStr.split('|').map(p => p.trim());
        partes.forEach(p => {
            if (p.toUpperCase().startsWith('APOIO_PENDENTE:')) return;
            const sub = p.replace(/^APOIO:/i, '').trim();
            sub.split(',').forEach(nome => {
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
        const partes = mStr.split('|').map(p => p.trim());
        partes.forEach(p => {
            if (p.toUpperCase().startsWith('APOIO_PENDENTE:')) {
                const sub = p.replace(/^APOIO_PENDENTE:/i, '').trim();
                sub.split(',').forEach(nome => {
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
    if (!usuarioPodeEditarGestor()) {
        alert("⚠️ Apenas usuários Master ou Operador podem gerenciar vínculos de apoio.");
        return;
    }
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

    const checksEquipesHtml = equipesDisponiveis.map(nome => `
        <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-purple-50 cursor-pointer border border-slate-100">
            <input type="checkbox" name="chk-apoio-gestor" value="${nome}" ${apoiosAtuais.includes(nome) ? 'checked' : ''} class="w-4 h-4 accent-purple-800 rounded">
            <span class="text-xs font-bold text-slate-800">🤝 ${nome}</span>
        </label>
    `).join('');

    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-purple-300 flex flex-col max-h-[90vh]">
            <div class="bg-purple-900 text-white p-4 flex justify-between items-center border-b-4 border-purple-400">
                <div>
                    <span class="bg-purple-300 text-purple-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Gestão de Atuação Conjunta</span>
                    <h3 class="font-bold text-sm mt-0.5">🤝 Direcionar / Vincular Equipe em Apoio</h3>
                </div>
                <button type="button" onclick="document.getElementById('modal-gerir-apoio-gestor').classList.add('hidden')" class="text-white font-bold text-lg">✕</button>
            </div>
            <div class="p-4 overflow-y-auto space-y-3 text-xs text-slate-700">
                <div class="bg-purple-50 p-3 rounded-xl border border-purple-200 space-y-1">
                    <div><strong>🏢 Imóvel:</strong> <span class="font-black text-purple-950">${reg.imovel}</span> (${reg.projeto})</div>
                    <div><strong>👷 Técnico Titular:</strong> <span class="font-black text-blue-900">${reg.equipe}</span></div>
                    <div><strong>🎯 Status:</strong> <span class="font-bold">${reg.desfecho}</span></div>
                </div>
                <div>
                    <label class="block font-black text-slate-800 uppercase text-[11px] mb-1.5">Marque o(s) Técnico(s) em Apoio Conjunto nesta Atividade:</label>
                    <div class="space-y-1 max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50">
                        ${checksEquipesHtml || '<span class="text-slate-400">Nenhuma outra equipe ativa cadastrada.</span>'}
                    </div>
                </div>
            </div>
            <div class="bg-slate-100 p-3 border-t flex justify-end gap-2">
                <button type="button" onclick="document.getElementById('modal-gerir-apoio-gestor').classList.add('hidden')" class="bg-slate-300 text-slate-800 text-xs px-3 py-2 rounded-xl font-bold">Cancelar</button>
                <button type="button" onclick="salvarVinculoApoioGestor(${reg.id})" class="bg-purple-800 hover:bg-purple-900 text-white text-xs px-4 py-2 rounded-xl font-black shadow-md">
                    💾 Salvar Equipe em Apoio
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

async function salvarVinculoApoioGestor(idReg) {
    const reg = (registrosSalvos || []).find(r => r.id === idReg);
    if (!reg) return;

    const selecionados = Array.from(document.querySelectorAll('input[name="chk-apoio-gestor"]:checked')).map(c => c.value);
    const novoMembros = formatarCampoMembrosComApoio(reg.equipe, selecionados);

    const codBase = obterCodigoBaseImovel(reg.imovel);
    const irmaos = (registrosSalvos || []).filter(r =>
        r.dataRegistro === reg.dataRegistro &&
        r.equipe === reg.equipe &&
        r.projeto === reg.projeto &&
        obterCodigoBaseImovel(r.imovel) === codBase
    );
    const idsAlvo = irmaos.length > 0 ? irmaos.map(i => i.id) : [reg.id];

    const { error } = await supabaseClient
        .from('registros_producao')
        .update({ membros: novoMembros })
        .in('id', idsAlvo);

    if (error) {
        alert("❌ Erro ao salvar vínculo de apoio: " + error.message);
        return;
    }

    irmaos.forEach(ir => { ir.membros = novoMembros; });
    reg.membros = novoMembros;

    document.getElementById('modal-gerir-apoio-gestor')?.classList.add('hidden');
    registrarLogAuditoria("VÍNCULO DE APOIO CONJUNTO", `Imóvel ${codBase} (Titular: ${reg.equipe}) atualizado com apoio de: ${selecionados.length > 0 ? selecionados.join(', ') : 'Nenhum (Individual)'}.`);
    atualizarDashboardGestor();
    alert(`✅ Vínculo de atuação conjunta atualizado com sucesso!`);
}

// ================= CLASSIFICADORES DOS 3 GRUPOS E SUBGRUPOS =================
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
    if (p.endsWith(' F') || p.includes('PROJETO F') || p === 'CONSTRUÇÃO F' || p === 'ATIVAÇÃO F' || macroCat.includes('PROJETO F')) {
        return 'F';
    }
    return 'ON GOING';
}

function extrairBairroDoEndereco(endereco) {
    if (!endereco || typeof endereco !== 'string') return 'NÃO INFORMADO';
    let limpo = endereco.toUpperCase().trim().replace(/\([^)]*\)/g, '').trim();
    if (limpo.includes(' - ')) {
        const partes = limpo.split(' - ').map(p => p.trim()).filter(Boolean);
        const candidato = partes[partes.length - 1];
        if (candidato && candidato.length >= 2 && !/^\d+$/.test(candidato) && !candidato.startsWith('BL ') && !candidato.startsWith('APT')) {
            return candidato;
        }
    }
    const bairrosRJ = [
        'COPACABANA', 'TIJUCA', 'RECREIO DOS BANDEIRANTES', 'RECREIO DO BANDEIRANTES', 'BOTAFOGO',
        'TAQUARA', 'FREGUESIA', 'PECHINCHA', 'CAMPO GRANDE', 'TODOS OS SANTOS', 'VARGEM GRANDE',
        'LEME', 'IPANEMA', 'LEBLON', 'FLAMENGO', 'LARANJEIRAS', 'CATETE', 'GLORIA', 'CENTRO',
        'BARRA DA TIJUCA', 'GRAJAU', 'VILA ISABEL', 'MARACANA', 'MEIER', 'ENGENHO NOVO',
        'LINS DE VASCONCELOS', 'CACHAMBI', 'DEL CASTILHO', 'INHAUMA', 'MADUREIRA', 'BANGU',
        'REALENGO', 'JACAREPAGUA', 'ANIL', 'CURICICA', 'TANQUE', 'PRACA SECA', 'VILA VALQUEIRE',
        'QUINTINO BOCAIUVA', 'SAMPAIO', 'PRACA DA BANDEIRA', 'SAO CRISTOVAO', 'HUMAITA', 'GAVEA',
        'JARDIM BOTANICO', 'URCA', 'SANTA TERESA', 'RIO COMPRIDO', 'ESTACIO', 'ROCHA', 'RIACHUELO'
    ];
    for (const b of bairrosRJ) {
        if (limpo.includes(b)) return b === 'RECREIO DO BANDEIRANTES' ? 'RECREIO DOS BANDEIRANTES' : b;
    }
    return 'OUTROS / VER ENDEREÇO';
}

function obterCodigoBaseImovel(imovelStr) {
    let cod = (imovelStr || '').toUpperCase().trim();
    const idx = cod.lastIndexOf(' - BLOCO');
    if (idx !== -1) cod = cod.substring(0, idx).trim();
    return cod;
}

function enriquecerStatusMacroEBairro(listaRegistros) {
    const mapaPrimeiraDataImovel = {};
    const ordenadosCronologico = [...(registrosSalvos || [])].filter(r =>
        r &&
        !normalizarChaveNome(r.equipe).includes('AAAAAATESTE') &&
        r.projeto !== 'IMPREVISTO / ATRASO' &&
        r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
        r.projeto !== PROJETO_SOLIC_MATERIAL &&
        r.equipe !== '__CONFIG_SISTEMA__'
    ).sort((a, b) => {
        if (a.dataRegistro !== b.dataRegistro) return (a.dataRegistro || '').localeCompare(b.dataRegistro || '');
        return (a.id || 0) - (b.id || 0);
    });

    ordenadosCronologico.forEach(r => {
        const codBase = obterCodigoBaseImovel(r.imovel);
        if (codBase && !mapaPrimeiraDataImovel[codBase]) {
            mapaPrimeiraDataImovel[codBase] = { data: r.dataRegistro, id: r.id };
        }
    });

    return (listaRegistros || [])
        .filter(r => r && !normalizarChaveNome(r.equipe).includes('AAAAAATESTE'))
        .map(r => {
            const codBase = obterCodigoBaseImovel(r.imovel);
            const obsSuperior = ((r.observacoes || '') + ' ' + (r.motivoDesfecho || '')).toUpperCase();
            let statusMacro = 'PROGRAMADO';
            if (obsSuperior.includes('RETORNO') || obsSuperior.includes('REINCID')) {
                statusMacro = 'RETORNO';
            } else if (codBase && mapaPrimeiraDataImovel[codBase] && r.dataRegistro > mapaPrimeiraDataImovel[codBase].data) {
                statusMacro = 'RETORNO';
            }
            const listaApoios = extrairApoiosDoRegistro(r);
            return {
                ...r,
                codigoImovelBase: codBase,
                apoiosConjunto: listaApoios,
                statusMacroPlanilha: statusMacro,
                bairroPlanilha: extrairBairroDoEndereco(r.endereco),
                semanaPlanilha: obterSemanaDoMes(r.dataRegistro),
                servicoPlanilha: obterMacroServicoPlanilha(r.projeto),
                subgrupoFOuOnGoing: obterSubgrupoFOuOnGoing(r.projeto),
                statusBinarioPlanilha: r.desfecho === 'CONCLUIDA' ? 'EXECUTADO' : 'N EXECUTADO'
            };
        });
}

// ================= SINCRONIZAÇÃO DE AUDITORIA NA NUVEM =================
async function sincronizarAuditoriaNaNuvem() {
    try {
        if (trilhaAuditoria.length > 250) trilhaAuditoria = trilhaAuditoria.slice(0, 250);
        localStorage.setItem('gpd_trilha_auditoria', JSON.stringify(trilhaAuditoria));
        const payloadAudit = {
            id: ID_NUVEM_AUDITORIA, data_registro: "2000-01-01", equipe: "__CONFIG_SISTEMA__",
            membros: "__CONFIG_SISTEMA__", projeto: "__CONFIG_AUDITORIA__", imovel: "__CONFIG_AUDITORIA__",
            h_entrada: "00:00", h_saida: "00:00", gps_entrada: "", gps_saida: "", desfecho: "CONFIG",
            motivo_desfecho: "", malogros: [], agendamento: null, observacoes: JSON.stringify(trilhaAuditoria)
        };
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
    trilhaAuditoria.unshift({
        id: Date.now() + Math.floor(Math.random() * 100),
        dataHora: new Date().toLocaleString('pt-BR'),
        usuario: usuarioLogado, acao, detalhes
    });
    setTimeout(() => { sincronizarAuditoriaNaNuvem(); }, 10);
};

function aplicarTooltipsExplicativosGlobais() {
    const mapaTooltips = {
        'btn-modo-campo': 'Alternar para a interface móvel de lançamento de atividades dos técnicos em campo',
        'btn-modo-gestor': 'Acessar o Painel Gerencial completo com indicadores, mapas e controle operacional',
        'btn-sair-gestor': 'Encerrar a sessão atual do gestor e bloquear o acesso administrativo',
        'btn-importar-planilha': 'Importar planilha CSV ou colar linhas do Excel para distribuir atividades programadas',
        'btn-boletim-whats-gestor': 'Copiar resumo executivo formatado com blocos e apoios organizados para colar no WhatsApp',
        'btn-baixar-excel-gestor': 'Baixar planilha Excel (.xls) oficial com materiais separados por bloco',
        'btn-atualizar-registros-gestor': 'Buscar imediatamente na nuvem todas as novas atividades, fotos e posições de GPS'
    };
    Object.entries(mapaTooltips).forEach(([id, texto]) => { const el = document.getElementById(id); if (el) el.title = texto; });
}

function inicializarMelhoriasVisuaisGestor() {
    garantirPermissaoOperadorEBaptista();
    aplicarTooltipsExplicativosGlobais();
    if (typeof otimizarCabecalhoAzulLinhaUnica === 'function') otimizarCabecalhoAzulLinhaUnica();

    const selDesf = document.getElementById('gestor-filtro-desfecho');
    if (selDesf && !document.getElementById('btn-abrir-filtro-multiplo')) {
        const btnMulti = document.createElement('button');
        btnMulti.type = 'button';
        btnMulti.id = 'btn-abrir-filtro-multiplo';
        btnMulti.onclick = abrirModalFiltroMultiplo;
        btnMulti.className = 'bg-amber-400 hover:bg-amber-300 text-blue-950 font-black text-[11px] px-2.5 py-1 rounded-lg shadow-sm transition whitespace-nowrap flex items-center gap-1 shrink-0';
        btnMulti.innerHTML = `☑️ Filtro Múltiplo <span id="badge-qtd-filtros-multi" class="bg-blue-950 text-cyan-300 px-1.5 py-0.2 rounded text-[9px] hidden">0</span>`;
        selDesf.parentNode.appendChild(btnMulti);
    }

    const selEqModalEdit = document.getElementById('edit-reg-equipe');
    if (selEqModalEdit && !document.getElementById('edit-reg-apoio-conjunto')) {
        const divPai = selEqModalEdit.parentNode;
        const divApoioEdit = document.createElement('div');
        divApoioEdit.className = 'mt-2 pt-2 border-t border-purple-200';
        divApoioEdit.innerHTML = `
            <label class="block font-black text-purple-900 text-[11px] mb-1">🤝 Técnico(s) em Apoio Conjunto (Separar por vírgula):</label>
            <input type="text" id="edit-reg-apoio-conjunto" placeholder="Ex: BRUNO SOARES DA SILVA" class="w-full border-2 border-purple-300 rounded-lg p-1.5 bg-purple-50/40 outline-none font-bold text-purple-950 uppercase">
        `;
        divPai.appendChild(divApoioEdit);
    }

    const selStatusEq = document.getElementById('sel-status-equipe');
    if (selStatusEq && !document.getElementById('sel-fiscal-equipe')) {
        const divFiscal = document.createElement('div');
        divFiscal.className = 'mt-3 pt-2 border-t border-slate-200';
        const opcoesFiscaisHtml = `<option value="">-- Sem Fiscal Específico (Visão Geral) --</option>` +
            CATALOGO_FISCAIS_MDU.map(f => `<option value="${f.email}">👮 ${f.nome} (${f.email})</option>`).join('');

        divFiscal.innerHTML = `
            <label class="block text-xs font-black text-blue-950 uppercase mb-1">👮 Fiscal Responsável pelo Técnico / Grupo</label>
            <select id="sel-fiscal-equipe" class="w-full text-xs border-2 border-blue-300 rounded-lg p-2.5 bg-blue-50/40 font-bold text-blue-950 outline-none">
                ${opcoesFiscaisHtml}
            </select>
            <p class="text-[10px] text-slate-500 mt-1">O fiscal selecionado visualizará este técnico no painel dele.</p>
        `;
        selStatusEq.parentNode.appendChild(divFiscal);
    }

    const viewEquipes = document.getElementById('subview-equipes');
    if (viewEquipes && !document.getElementById('painel-cobertura-ferias-fiscais')) {
        const divFerias = document.createElement('div');
        divFerias.id = 'painel-cobertura-ferias-fiscais';
        divFerias.className = 'bg-indigo-950 text-white p-4 rounded-2xl shadow-md mb-4 border-2 border-indigo-400/40 space-y-3';
        const opcoesFiscais = CATALOGO_FISCAIS_MDU.map(f => `<option value="${f.email}">${f.nome} (${f.email})</option>`).join('');

        divFerias.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-indigo-800 pb-2.5">
                <div>
                    <span class="bg-amber-400 text-indigo-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Gestão de Carteiras & Férias</span>
                    <h4 class="font-bold text-sm mt-0.5">👮 Controle de Grupos por Fiscal e Redirecionamento de Férias</h4>
                </div>
                <button type="button" onclick="restaurarCarteiraOriginalPadraoFiscais()" class="bg-indigo-800 hover:bg-indigo-700 border border-indigo-500 text-cyan-300 font-bold text-[11px] px-3 py-1.5 rounded-xl transition shadow-sm">
                    🔄 Restaurar Divisão Original da Planilha
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end text-xs">
                <div>
                    <label class="block text-[10px] font-bold text-indigo-200 uppercase mb-1">1. Fiscal que vai sair (Férias / Afastamento):</label>
                    <select id="sel-ferias-fiscal-origem" class="w-full bg-slate-900 border border-indigo-600 rounded-xl p-2 text-white font-bold text-xs">${opcoesFiscais}</select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-indigo-200 uppercase mb-1">2. Passar a visão do grupo para o Fiscal:</label>
                    <select id="sel-ferias-fiscal-destino" class="w-full bg-slate-900 border border-emerald-500 rounded-xl p-2 text-emerald-300 font-bold text-xs">${opcoesFiscais}</select>
                </div>
                <div>
                    <button type="button" onclick="transferirGrupoFiscalFeriasEmLote()" class="w-full bg-amber-400 hover:bg-amber-300 text-indigo-950 font-black py-2 px-4 rounded-xl text-xs transition shadow-md">
                        🔀 Virar Grupo p/ Fiscal Substituto
                    </button>
                </div>
            </div>
            <div id="resumo-contagem-carteiras-fiscais" class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]"></div>
        `;
        viewEquipes.insertBefore(divFerias, viewEquipes.firstChild);
        const selDest = document.getElementById('sel-ferias-fiscal-destino');
        if (selDest && CATALOGO_FISCAIS_MDU.length > 1) selDest.value = CATALOGO_FISCAIS_MDU[1].email;
    }

    const subBarra = document.getElementById('header-gestor-subbarra');
    if (subBarra) {
        const divBotoesExtras = subBarra.querySelector('.ml-auto');
        if (divBotoesExtras && !divBotoesExtras.id) {
            divBotoesExtras.id = 'botoes-atalho-exclusivos-disponibilidade';
            divBotoesExtras.classList.add('hidden');
        }
    }

    if (!document.getElementById('modal-filtro-multiplo')) {
        const modalMulti = document.createElement('div');
        modalMulti.id = 'modal-filtro-multiplo';
        modalMulti.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 hidden z-[78]';
        modalMulti.innerHTML = `
            <div class="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                <div class="bg-blue-900 text-white px-5 py-3.5 flex justify-between items-center border-b-4 border-amber-400">
                    <div>
                        <span class="bg-amber-400 text-blue-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Filtro Avançado Combinado</span>
                        <h3 class="font-bold text-sm sm:text-base mt-0.5">☑️ Seleção Múltipla de Equipes, Grupos, Projetos e Status</h3>
                    </div>
                    <button onclick="fecharModalFiltroMultiplo()" class="text-white font-bold text-lg hover:text-red-300">✕</button>
                </div>
                <div class="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                            <div class="font-black text-blue-950 uppercase text-[11px] border-b pb-1">1. Funções / Setores</div>
                            <div id="multi-lista-setores" class="space-y-1.5"></div>
                            <div class="font-black text-indigo-950 uppercase text-[11px] border-b pb-1 pt-2">2. Grupos de Projeto</div>
                            <div id="multi-lista-macrogrupos" class="space-y-1.5"></div>
                        </div>
                        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                            <div class="font-black text-blue-950 uppercase text-[11px] border-b pb-1">3. Tipos de Serviço / Projetos</div>
                            <div id="multi-lista-projetos" class="space-y-1.5 max-h-40 overflow-y-auto"></div>
                            <div class="font-black text-emerald-950 uppercase text-[11px] border-b pb-1 pt-2">4. Status / Desfechos</div>
                            <div id="multi-lista-desfechos" class="space-y-1.5"></div>
                        </div>
                        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col">
                            <div class="flex justify-between items-center border-b pb-1 mb-2">
                                <span class="font-black text-blue-950 uppercase text-[11px]">5. Equipes / Técnicos</span>
                                <div class="flex gap-1">
                                    <button type="button" onclick="marcarOuDesmarcarTodasEquipesMulti(true)" class="text-[9px] bg-blue-100 text-blue-900 font-bold px-1.5 py-0.5 rounded">Todos</button>
                                    <button type="button" onclick="marcarOuDesmarcarTodasEquipesMulti(false)" class="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">Limpar</button>
                                </div>
                            </div>
                            <div id="multi-lista-equipes" class="space-y-1 overflow-y-auto max-h-64 pr-1"></div>
                        </div>
                    </div>
                </div>
                <div class="bg-slate-100 px-5 py-3 border-t flex justify-between items-center">
                    <button type="button" onclick="limparFiltrosMultiplos()" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs px-4 py-2 rounded-xl font-bold">🗑️ Limpar Seleção Múltipla</button>
                    <div class="flex gap-2">
                        <button type="button" onclick="fecharModalFiltroMultiplo()" class="bg-slate-300 text-slate-800 text-xs px-4 py-2 rounded-xl font-bold">Cancelar</button>
                        <button type="button" onclick="aplicarFiltrosMultiplosDoModal()" class="bg-blue-900 hover:bg-blue-950 text-white text-xs px-5 py-2 rounded-xl font-black shadow-md">✅ Aplicar Filtros Selecionados</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalMulti);
    }

    const viewOpcoes = document.getElementById('subview-opcoes');
    if (viewOpcoes && !document.getElementById('central-master-backup-nuvem')) {
        const divBackup = document.createElement('div');
        divBackup.id = 'central-master-backup-nuvem';
        divBackup.className = 'mt-6 pt-5 border-t-2 border-slate-200 space-y-4';
        divBackup.innerHTML = `
            <div class="bg-slate-900 text-white p-4 rounded-2xl shadow-md space-y-3">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-700 pb-3">
                    <div>
                        <span class="bg-cyan-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Exclusivo Master • Proteção de Dados</span>
                        <h4 class="font-bold text-sm sm:text-base mt-1">💾 Central de Backup Integral (.JSON), Consulta Histórica e Alívio de Nuvem</h4>
                    </div>
                    <span id="badge-estimativa-peso-nuvem" class="bg-slate-800 border border-slate-600 text-cyan-300 font-mono text-xs px-3 py-1.5 rounded-xl whitespace-nowrap">Calculando uso...</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    <div class="bg-slate-800/90 border border-slate-700 p-3.5 rounded-xl space-y-2.5 flex flex-col justify-between">
                        <div>
                            <h5 class="font-black text-cyan-300 text-xs uppercase">1. Exportar Backup Completo (.JSON)</h5>
                            <div class="grid grid-cols-2 gap-1.5 mt-2">
                                <div><label class="text-[9px] text-slate-400 uppercase font-bold block">De:</label><input type="date" id="bkp-data-inicio" class="w-full text-[11px] bg-slate-900 border border-slate-600 rounded p-1 text-white"></div>
                                <div><label class="text-[9px] text-slate-400 uppercase font-bold block">Até:</label><input type="date" id="bkp-data-fim" class="w-full text-[11px] bg-slate-900 border border-slate-600 rounded p-1 text-white"></div>
                            </div>
                        </div>
                        <button type="button" onclick="baixarBackupIntegralJSON()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs transition shadow">📦 Baixar Backup Integral (.JSON)</button>
                    </div>
                    <div class="bg-slate-800/90 border border-slate-700 p-3.5 rounded-xl space-y-2.5 flex flex-col justify-between">
                        <div>
                            <h5 class="font-black text-amber-300 text-xs uppercase">2. Carregar / Restaurar Backup (.JSON)</h5>
                            <input type="file" id="inp-upload-backup-json" accept=".json" class="w-full text-[10px] bg-slate-900 border border-slate-600 rounded-lg p-1.5 text-slate-200 mt-2">
                        </div>
                        <div class="grid grid-cols-2 gap-1.5">
                            <button type="button" onclick="processarArquivoBackupJSON('consulta')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2 px-2 rounded-xl text-[11px] transition shadow">👁️ Modo Consulta</button>
                            <button type="button" onclick="processarArquivoBackupJSON('nuvem')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2 px-2 rounded-xl text-[11px] transition shadow">☁️ Subir p/ Nuvem</button>
                        </div>
                    </div>
                    <div class="bg-slate-800/90 border border-red-900/60 p-3.5 rounded-xl space-y-2.5 flex flex-col justify-between">
                        <div>
                            <h5 class="font-black text-red-400 text-xs uppercase">3. Limpeza Inteligente da Nuvem</h5>
                            <div class="mt-2"><label class="text-[9px] text-red-300 uppercase font-bold block">Limpar registos anteriores a:*</label><input type="date" id="expurgo-data-limite" class="w-full text-[11px] bg-slate-900 border border-red-700 rounded p-1 text-white"></div>
                        </div>
                        <div class="grid grid-cols-2 gap-1.5">
                            <button type="button" onclick="executarLimpezaInteligenteNuvem('apenas_fotos')" class="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-2 rounded-xl text-[10px] transition shadow">🧹 Limpar Só Fotos</button>
                            <button type="button" onclick="executarLimpezaInteligenteNuvem('registros_completos')" class="bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-2 rounded-xl text-[10px] transition shadow">🗑️ Excluir Antigos</button>
                        </div>
                    </div>
                </div>
            </div>`;
        viewOpcoes.appendChild(divBackup);
    }

    if (typeof atualizarResumoContagemCarteirasFiscais === 'function') atualizarResumoContagemCarteirasFiscais();
}

// ================= SOLICITAÇÕES DE COMBUSTÍVEL E MATERIAL (48H) =================
function calcularTempoRestante48h(timestampTratado) {
    if (!timestampTratado || isNaN(timestampTratado)) return "Exclusão em 48h";
    const restanteMs = Math.max(0, PRAZO_EXPURGO_48H_MS - (Date.now() - Number(timestampTratado)));
    const horas = Math.floor(restanteMs / (1000 * 60 * 60));
    const min = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60));
    return `Auto-exclusão em ${horas}h ${min}m`;
}

async function abrirFotosSolicitacaoCombustivelModal(idReg) {
    const reg = (registrosSalvos || []).find(r => r.id === idReg);
    if (reg) await abrirDetalhesAtividade(reg);
}

async function marcarSolicitacaoComoTratada(idReg) {
    if (!usuarioPodeEditarGestor()) { alert("⚠️ Permissão insuficiente."); return; }
    const reg = (registrosSalvos || []).find(r => r.id === idReg);
    if (!reg) return;

    const ehComb = reg.projeto === PROJETO_SOLIC_COMBUSTIVEL;
    const obsGestor = prompt(`✅ MARCAR SOLICITAÇÃO COMO TRATADA (${ehComb ? 'COMBUSTÍVEL' : 'MATERIAL'})\n\nTécnico: ${reg.equipe}\nDetalhe: ${reg.imovel}\n\nObservação da tratativa:`, "Atendido / Liberado pela gestão");
    if (obsGestor === null) return;

    const uObj = (usuariosSistema || []).find(u => u.email.toLowerCase() === (usuarioLogado || '').toLowerCase());
    const nomeTratador = uObj ? `${uObj.nome} (${usuarioLogado})` : (usuarioLogado || 'Gestor');
    const dataHoraAgora = new Date().toLocaleString('pt-BR');
    const tsAgora = Date.now();

    let fotosAtuais = Array.isArray(reg.fotos) ? reg.fotos : [];
    if (fotosAtuais.length === 0 && typeof obterFotosSobDemandaDoRegistro === 'function' && Number(reg.qtdFotos) > 0) {
        fotosAtuais = await obterFotosSobDemandaDoRegistro(reg.id);
    }

    const tagEnd = reg.endereco ? `[END: ${reg.endereco}] ` : '';
    const tagTratado = `[TRATADO_POR: ${nomeTratador}] [TRATADO_EM: ${dataHoraAgora}] [TRATADO_TS: ${tsAgora}] `;
    const sufixoFotos = (fotosAtuais && fotosAtuais.length > 0) ? ` [FOTOS:${JSON.stringify(fotosAtuais)}]` : '';
    const textoObsLimpo = obsGestor.trim() ? `${reg.observacoes ? reg.observacoes + ' | ' : ''}Tratativa: ${obsGestor.trim()}` : (reg.observacoes || '');
    const obsFinalBanco = `${tagEnd}${tagTratado}${textoObsLimpo}${sufixoFotos}`.trim();
    const horaCurta = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    const { error } = await supabaseClient.from('registros_producao').update({ desfecho: "TRATADA", h_saida: horaCurta, observacoes: obsFinalBanco }).eq('id', idReg);
    if (error) { alert("❌ Erro: " + error.message); return; }

    Object.assign(reg, { desfecho: "TRATADA", hSaida: horaCurta, tratadoPor: nomeTratador, tratadoDataHora: dataHoraAgora, tratadoTimestamp: tsAgora, observacoes: textoObsLimpo });
    registrarLogAuditoria(ehComb ? "COMBUSTÍVEL TRATADO" : "MATERIAL TRATADO", `Solicitação de ${reg.equipe} (${reg.imovel}) tratada por ${nomeTratador}.`);
    atualizarDashboardGestor();
    alert(`✅ Solicitação marcada como TRATADA por ${nomeTratador}!`);
}

function renderizarTabelasSolicitacoesGestor() {
    const corpoComb = document.getElementById('tabela-solic-combustivel-corpo');
    const corpoMat  = document.getElementById('tabela-solic-material-corpo');
    const pendComb = listaSolicitacoesCombustivelAtuais.filter(r => r.desfecho !== 'TRATADA').length;
    const pendMat  = listaSolicitacoesMaterialAtuais.filter(r => r.desfecho !== 'TRATADA').length;

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setTxt('badge-aba-combustivel', `${pendComb} pend.`);
    setTxt('badge-aba-solic-material', `${pendMat} pend.`);
    setTxt('contador-solic-combustivel', `${listaSolicitacoesCombustivelAtuais.length} solicitação(ões) (${pendComb} pendente(s))`);
    setTxt('contador-solic-material', `${listaSolicitacoesMaterialAtuais.length} solicitação(ões) (${pendMat} pendente(s))`);

    const podeTratar = usuarioPodeEditarGestor();

    if (corpoComb) {
        corpoComb.innerHTML = "";
        if (listaSolicitacoesCombustivelAtuais.length === 0) {
            corpoComb.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Nenhuma solicitação de recarga de combustível ativa no momento.</td></tr>`;
        } else {
            listaSolicitacoesCombustivelAtuais.forEach(item => {
                const tratada = item.desfecho === 'TRATADA';
                const qtdFotos = Number(item.qtdFotos) || (Array.isArray(item.fotos) ? item.fotos.length : 0);
                const labelsFotos = Array.isArray(item.malogros) && item.malogros.length > 0 ? item.malogros.join(' • ') : 'Painel + Mapa de Bordo';
                const statusHtml = tratada
                    ? `<div class="space-y-0.5"><span class="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-2 py-0.5 rounded text-[10px] inline-block">🟢 TRATADA</span><div class="text-[10px] text-slate-700 font-bold">👤 Por: ${item.tratadoPor || 'Gestor'}</div><div class="text-[10px] text-slate-500 font-mono">🕒 Em: ${item.tratadoDataHora || item.hSaida}</div><div class="text-[9px] text-orange-700 font-bold">⏳ ${calcularTempoRestante48h(item.tratadoTimestamp)}</div></div>`
                    : `<span class="bg-amber-100 text-amber-900 border border-amber-300 font-black px-2.5 py-1 rounded text-[10px] inline-block animate-pulse">🟡 AGUARDANDO TRATATIVA</span>`;
                let botoesHtml = podeTratar
                    ? `<div class="flex flex-wrap gap-1">${!tratada ? `<button onclick="marcarSolicitacaoComoTratada(${item.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow-sm">✅ Marcar Tratada</button>` : ''}<button onclick="abrirFotosSolicitacaoCombustivelModal(${item.id})" class="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-[10px] px-2 py-1 rounded">📷 Ver Fotos (${qtdFotos})</button><button onclick="excluirRegistro(${item.id}, '${item.imovel}')" class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[10px] px-2 py-1 rounded">🗑️</button></div>`
                    : `<span class="text-slate-400 text-[10px]">Leitura</span>`;
                const tr = document.createElement('tr');
                tr.className = tratada ? "bg-slate-50/70 border-b hover:bg-slate-100/70 transition cursor-pointer" : "bg-orange-50/30 border-b hover:bg-orange-50/70 transition cursor-pointer";
                tr.onclick = () => abrirDetalhesAtividade(item);
                tr.innerHTML = `<td class="p-3"><div class="font-bold text-slate-800">${item.dataRegistro}</div><div class="text-[10px] font-mono text-slate-500">Solicitado às ${item.hEntrada}</div></td><td class="p-3 font-bold text-blue-950">${item.equipe}</td><td class="p-3"><span class="bg-orange-100 text-orange-950 border border-orange-300 font-black px-2.5 py-1 rounded text-xs inline-block">${item.imovel}</span></td><td class="p-3 text-slate-700 font-medium">${item.motivoDesfecho || '-'}</td><td class="p-3"><span class="bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold px-2 py-0.5 rounded text-[10px] inline-block">📷 ${qtdFotos} foto(s)</span><div class="text-[9px] text-slate-500 mt-0.5">${labelsFotos}</div></td><td class="p-3">${statusHtml}</td><td class="p-3 whitespace-nowrap" onclick="event.stopPropagation()">${botoesHtml}</td>`;
                corpoComb.appendChild(tr);
            });
        }
    }

    if (corpoMat) {
        corpoMat.innerHTML = "";
        if (listaSolicitacoesMaterialAtuais.length === 0) {
            corpoMat.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Nenhuma solicitação de material ativa no momento.</td></tr>`;
        } else {
            listaSolicitacoesMaterialAtuais.forEach(item => {
                const tratada = item.desfecho === 'TRATADA';
                const tagsItens = Array.isArray(item.malogros) && item.malogros.length > 0
                    ? item.malogros.map(m => `<span class="bg-indigo-100 text-indigo-950 border border-indigo-300 font-black px-2 py-0.5 rounded text-[10px] inline-block">${m}</span>`).join(' ')
                    : `<span class="font-bold text-slate-700">${item.motivoDesfecho || '-'}</span>`;
                const statusHtml = tratada
                    ? `<div class="space-y-0.5"><span class="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-2 py-0.5 rounded text-[10px] inline-block">🟢 TRATADA</span><div class="text-[10px] text-slate-700 font-bold">👤 Por: ${item.tratadoPor || 'Gestor'}</div><div class="text-[10px] text-slate-500 font-mono">🕒 Em: ${item.tratadoDataHora || item.hSaida}</div><div class="text-[9px] text-indigo-700 font-bold">⏳ ${calcularTempoRestante48h(item.tratadoTimestamp)}</div></div>`
                    : `<span class="bg-amber-100 text-amber-900 border border-amber-300 font-black px-2.5 py-1 rounded text-[10px] inline-block animate-pulse">🟡 AGUARDANDO TRATATIVA</span>`;
                let botoesHtml = podeTratar
                    ? `<div class="flex flex-wrap gap-1">${!tratada ? `<button onclick="marcarSolicitacaoComoTratada(${item.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow-sm">✅ Marcar Tratada</button>` : ''}<button onclick="excluirRegistro(${item.id}, '${item.imovel}')" class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[10px] px-2 py-1 rounded">🗑️ Excluir</button></div>`
                    : `<span class="text-slate-400 text-[10px]">Leitura</span>`;
                const tr = document.createElement('tr');
                tr.className = tratada ? "bg-slate-50/70 border-b hover:bg-slate-100/70 transition cursor-pointer" : "bg-indigo-50/30 border-b hover:bg-indigo-50/70 transition cursor-pointer";
                tr.onclick = () => abrirDetalhesAtividade(item);
                tr.innerHTML = `<td class="p-3"><div class="font-bold text-slate-800">${item.dataRegistro}</div><div class="text-[10px] font-mono text-slate-500">Solicitado às ${item.hEntrada}</div></td><td class="p-3 font-bold text-blue-950">${item.equipe}</td><td class="p-3"><div class="flex flex-wrap gap-1">${tagsItens}</div></td><td class="p-3 text-slate-600">${item.observacoes || item.responsavel || '-'}</td><td class="p-3">${statusHtml}</td><td class="p-3 whitespace-nowrap" onclick="event.stopPropagation()">${botoesHtml}</td>`;
                corpoMat.appendChild(tr);
            });
        }
    }
}

// ================= FILTROS DE MARCAÇÃO MÚLTIPLA =================
function abrirModalFiltroMultiplo() {
    inicializarMelhoriasVisuaisGestor();
    const modal = document.getElementById('modal-filtro-multiplo');
    if (!modal) return;

    const desenharChecks = (idContainer, opcoes, arraySelecionados, nomeGrupo) => {
        const el = document.getElementById(idContainer);
        if (!el) return;
        el.innerHTML = opcoes.map(op => `<label class="flex items-center gap-2 font-semibold text-slate-700 hover:bg-blue-50 p-1 rounded cursor-pointer"><input type="checkbox" name="${nomeGrupo}" value="${op.valor}" ${arraySelecionados.includes(op.valor) ? 'checked' : ''} class="w-4 h-4 accent-blue-900 rounded"><span class="text-[11px]">${op.label}</span></label>`).join('');
    };

    const equipesVisiveis = obterEquipesVisiveisUsuarioAtual(false);

    desenharChecks('multi-lista-setores', [{ valor: 'Vistoriador', label: '🔍 Vistoriador' }, { valor: 'Instalador', label: '🛠️ Instalador' }, { valor: 'Ativador', label: '⚡ Ativador' }], filtrosMultiplosAtivos.setores, 'chk-multi-setor');
    desenharChecks('multi-lista-macrogrupos', GRUPOS_PROJETO_SISTEMA.map(grp => ({ valor: grp, label: `📂 Grupo ${grp}` })), filtrosMultiplosAtivos.macrogrupos, 'chk-multi-macro');
    desenharChecks('multi-lista-projetos', CATALOGO_PROJETOS_SISTEMA.map(p => ({ valor: p.nome, label: `${p.nome} (${p.grupo})` })), filtrosMultiplosAtivos.projetos, 'chk-multi-projeto');
    desenharChecks('multi-lista-desfechos', [{ valor: 'PROGRAMADA', label: '📋 Programadas' }, { valor: 'EM ANDAMENTO', label: '🔵 Em Andamento' }, { valor: 'PARALISADA', label: '⏸️ Paralisadas' }, { valor: 'REABERTA', label: '🔄 Reabertas' }, { valor: 'CONCLUIDA', label: '🟢 Concluídas' }, { valor: 'PENDENTE', label: '🟡 Pendentes' }, { valor: 'MALOGRADA', label: '🔴 Malogradas' }], filtrosMultiplosAtivos.desfechos, 'chk-multi-desfecho');
    desenharChecks('multi-lista-equipes', equipesVisiveis.map(e => ({ valor: e.nome, label: `${e.nome} (${formatarSetoresString(e.setor)})` })), filtrosMultiplosAtivos.equipes, 'chk-multi-equipe');
    modal.classList.remove('hidden');
}

function fecharModalFiltroMultiplo() { document.getElementById('modal-filtro-multiplo')?.classList.add('hidden'); }
function marcarOuDesmarcarTodasEquipesMulti(marcar) { document.querySelectorAll('input[name="chk-multi-equipe"]').forEach(c => c.checked = marcar); }

function atualizarBadgeFiltroMultiplo() {
    const total = filtrosMultiplosAtivos.equipes.length + filtrosMultiplosAtivos.setores.length + filtrosMultiplosAtivos.macrogrupos.length + filtrosMultiplosAtivos.projetos.length + filtrosMultiplosAtivos.desfechos.length;
    const badge = document.getElementById('badge-qtd-filtros-multi');
    if (!badge) return;
    if (total > 0) { badge.innerText = total; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }
}

function aplicarFiltrosMultiplosDoModal() {
    const lerGrupo = (nome) => Array.from(document.querySelectorAll(`input[name="${nome}"]:checked`)).map(c => c.value);
    filtrosMultiplosAtivos.setores = lerGrupo('chk-multi-setor');
    filtrosMultiplosAtivos.macrogrupos = lerGrupo('chk-multi-macro');
    filtrosMultiplosAtivos.projetos = lerGrupo('chk-multi-projeto');
    filtrosMultiplosAtivos.desfechos = lerGrupo('chk-multi-desfecho');
    filtrosMultiplosAtivos.equipes = lerGrupo('chk-multi-equipe');

    if (filtrosMultiplosAtivos.equipes.length > 0) document.getElementById('gestor-filtro-equipe').value = "";
    if (filtrosMultiplosAtivos.projetos.length > 0) document.getElementById('gestor-filtro-projeto').value = "";
    if (filtrosMultiplosAtivos.desfechos.length > 0) document.getElementById('gestor-filtro-desfecho').value = "";

    atualizarBadgeFiltroMultiplo();
    fecharModalFiltroMultiplo();
    atualizarDashboardGestor();
}

function limparFiltrosMultiplos() {
    filtrosMultiplosAtivos = { equipes: [], setores: [], macrogrupos: [], projetos: [], desfechos: [] };
    atualizarBadgeFiltroMultiplo();
    fecharModalFiltroMultiplo();
    atualizarDashboardGestor();
}

// ================= CENTRAL MASTER DE BACKUP (.JSON) =================
function atualizarEstimativaPesoNuvem() {
    if (typeof renderizarPainelCapacidadeNuvem === "function") renderizarPainelCapacidadeNuvem();
}

function baixarBackupIntegralJSON() {
    if (!usuarioEhMasterGestor()) { alert("⚠️ Apenas o perfil Master pode exportar o Backup Integral."); return; }
    const dIni = document.getElementById('bkp-data-inicio')?.value || "";
    const dFim = document.getElementById('bkp-data-fim')?.value || "";

    let listaExportar = (registrosSalvos || []).map(r => ({
        id: r.id, dataRegistro: r.dataRegistro, equipe: r.equipe, membros: r.membros, projeto: r.projeto,
        imovel: r.imovel, endereco: r.endereco, liberouAcesso: r.liberouAcesso, tempoPausadoMinutos: r.tempoPausadoMinutos,
        qtdBlocosProgramados: r.qtdBlocosProgramados, fotos: (typeof cacheFotosSobDemanda !== 'undefined' && cacheFotosSobDemanda.get(r.id)) || r.fotos || [],
        hEntrada: r.hEntrada, hSaida: r.hSaida, gpsEntrada: r.gpsEntrada, gpsSaida: r.gpsSaida, desfecho: r.desfecho,
        motivoDesfecho: r.motivoDesfecho, malogros: r.malogros, responsavel: r.responsavel, contato: r.contato,
        email: r.email, agendamento: r.agendamento, andares: r.andares, hps: r.hps, servicoObra: r.servicoObra,
        observacoes: r.observacoes, fusoes: r.fusoes, conectores: r.conectores, caboRL: r.caboRL, caboDrop: r.caboDrop,
        nap: r.nap, dio: r.dio, cxSobrepor: r.cxSobrepor, cxEmbutida: r.cxEmbutida, cxFosc: r.cxFosc
    })).filter(r => {
        if (dIni && r.dataRegistro < dIni) return false;
        if (dFim && r.dataRegistro > dFim) return false;
        return true;
    });

    if (listaExportar.length === 0) { alert("⚠️ Nenhum registo encontrado no período."); return; }
    const pacoteBackup = {
        sistema: "GPD MDU PROCISA RJ", versaoBackup: "8.2", dataExportacao: new Date().toISOString(), exportadoPor: usuarioLogado,
        configuracoes: {
            equipes: equipesSistema, usuarios: usuariosSistema, gruposProjeto: GRUPOS_PROJETO_SISTEMA,
            catalogoProjetos: CATALOGO_PROJETOS_SISTEMA, opcoesCombustivel: OPCOES_COMBUSTIVEL_PADRAO,
            opcoesMaterialSolicitacao: OPCOES_MATERIAL_SOLICITACAO, opcoesPendencia: OPCOES_PENDENCIA_PADRAO,
            opcoesMalogro: OPCOES_MALOGRO_PADRAO, opcoesImprevisto: OPCOES_IMPREVISTO_PADRAO, auditoria: trilhaAuditoria
        },
        registros: listaExportar
    };

    const blob = new Blob([JSON.stringify(pacoteBackup)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const sufixoData = (dIni || dFim) ? `${dIni || 'inicio'}_a_${dFim || 'hoje'}` : `completo_${obterDataLocalISO()}`;
    a.href = url; a.download = `BACKUP_GPD_PROCISA_${sufixoData}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    registrarLogAuditoria("BACKUP INTEGRAL (.JSON)", `Exportados ${listaExportar.length} registos.`);
}

async function processarArquivoBackupJSON(modo) {
    if (!usuarioEhMasterGestor()) { alert("⚠️ Apenas o perfil Master pode carregar backups."); return; }
    const inp = document.getElementById('inp-upload-backup-json');
    const file = inp?.files && inp.files[0];
    if (!file) { alert("⚠️ Selecione um ficheiro .JSON."); return; }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const pacote = JSON.parse(e.target.result);
            if (!pacote || !Array.isArray(pacote.registros)) { alert("❌ Ficheiro inválido!"); return; }
            if (modo === 'consulta') {
                if (!modoConsultaBackupAtivo) cacheRegistrosNuvemOriginal = [...registrosSalvos];
                modoConsultaBackupAtivo = true;
                if (typeof cacheFotosSobDemanda !== 'undefined') cacheFotosSobDemanda.clear();
                registrosSalvos = pacote.registros.map(r => {
                    if (typeof cacheFotosSobDemanda !== 'undefined' && Array.isArray(r.fotos)) cacheFotosSobDemanda.set(r.id, r.fotos);
                    return { ...r, qtdFotos: Array.isArray(r.fotos) ? r.fotos.length : 0 };
                });
                if (typeof reciclarContagemBytesFotos === 'function') reciclarContagemBytesFotos();
                exibirBannerModoConsultaBackup(file.name, registrosSalvos.length);
                atualizarDashboardGestor();
                mudarSubAbaGestor('atividades');
            } else if (modo === 'nuvem') {
                if (!confirm(`☁️ Restaurar ${pacote.registros.length} registos para o Supabase?`)) return;
                const linhasParaUpsert = pacote.registros.map(r => {
                    let tagEnd = r.endereco ? `[END: ${r.endereco}] ` : '';
                    let tagLiberou = r.liberouAcesso ? `[LIBEROU_ACESSO: ${r.liberouAcesso}] ` : '';
                    let tagPausa = r.tempoPausadoMinutos > 0 ? `[PAUSA_TOTAL: ${r.tempoPausadoMinutos}] ` : '';
                    let sufixoBlocos = r.qtdBlocosProgramados > 1 ? ` [BLOCOS: ${r.qtdBlocosProgramados}]` : '';
                    let fotosArr = (typeof cacheFotosSobDemanda !== 'undefined' && cacheFotosSobDemanda.get(r.id)) || r.fotos || [];
                    let sufixoFotos = (fotosArr && fotosArr.length > 0) ? ` [FOTOS:${JSON.stringify(fotosArr)}]` : '';
                    return {
                        id: r.id, data_registro: r.dataRegistro, equipe: r.equipe, membros: r.membros || r.equipe,
                        projeto: r.projeto, imovel: r.imovel, h_entrada: r.hEntrada, h_saida: r.hSaida,
                        gps_entrada: r.gpsEntrada, gps_saida: r.gpsSaida, desfecho: r.desfecho, motivo_desfecho: r.motivoDesfecho,
                        malogros: r.malogros || [], responsavel: r.responsavel || '', contato: r.contato || '', email: r.email || '',
                        agendamento: null, andares: Number(r.andares) || 0, hps: Number(r.hps) || 0, servico_obra: r.servicoObra || 'SIM',
                        observacoes: `${tagEnd}${tagLiberou}${tagPausa}${r.observacoes || ''}${sufixoBlocos}${sufixoFotos}`.trim(),
                        fusoes: Number(r.fusoes) || 0, conectores: Number(r.conectores) || 0, cabo_rl: Number(r.caboRL) || 0,
                        cabo_drop: Number(r.caboDrop) || 0, nap: Number(r.nap) || 0, dio: Number(r.dio) || 0,
                        cx_sobrepor: Number(r.cxSobrepor) || 0, cx_embutida: Number(r.cxEmbutida) || 0, cx_fosc: Number(r.cxFosc) || 0
                    };
                });
                for (let i = 0; i < linhasParaUpsert.length; i += 25) {
                    const { error } = await supabaseClient.from('registros_producao').upsert(linhasParaUpsert.slice(i, i + 25), { onConflict: 'id' });
                    if (error) throw error;
                }
                inp.value = "";
                await recarregarDadosGestor(true);
                alert(`✅ ${linhasParaUpsert.length} registos restaurados!`);
            }
        } catch (err) { alert("❌ Erro: " + err.message); }
    };
    reader.readAsText(file, 'UTF-8');
}

function exibirBannerModoConsultaBackup(nomeArquivo, qtd) {
    let banner = document.getElementById('banner-modo-consulta-backup');
    const mainGestor = document.getElementById('view-gestor');
    if (!mainGestor) return;
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'banner-modo-consulta-backup';
        banner.className = 'bg-indigo-950 text-white p-3.5 rounded-xl border-2 border-amber-400 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-lg';
        mainGestor.insertBefore(banner, mainGestor.firstChild);
    }
    banner.classList.remove('hidden');
    banner.innerHTML = `<div class="flex items-center gap-3"><span class="text-2xl">📂</span><div><h4 class="font-black text-amber-300 text-xs uppercase">Modo Consulta de Backup Ativo (${nomeArquivo})</h4><p class="text-xs text-indigo-100">Exibindo <b>${qtd} registos</b> carregados localmente.</p></div></div><button type="button" onclick="sairModoConsultaBackup()" class="bg-amber-400 hover:bg-amber-300 text-indigo-950 font-black text-xs px-4 py-2 rounded-xl shadow">🔙 Sair do Modo Consulta</button>`;
}

async function sairModoConsultaBackup() {
    modoConsultaBackupAtivo = false;
    if (cacheRegistrosNuvemOriginal) { registrosSalvos = [...cacheRegistrosNuvemOriginal]; cacheRegistrosNuvemOriginal = null; }
    else { await carregarRegistrosDaNuvem(true); }
    document.getElementById('banner-modo-consulta-backup')?.classList.add('hidden');
    atualizarDashboardGestor();
}

async function executarLimpezaInteligenteNuvem(tipoExpurgo) {
    if (!usuarioEhMasterGestor()) return;
    const dataLimite = document.getElementById('expurgo-data-limite')?.value;
    if (!dataLimite) { alert("⚠️ Selecione a data limite."); return; }
    const alvos = (registrosSalvos || []).filter(r => r.dataRegistro && r.dataRegistro < dataLimite);
    if (alvos.length === 0) { alert(`ℹ️ Nenhum registo anterior a ${dataLimite}.`); return; }

    if (tipoExpurgo === 'apenas_fotos') {
        const comFotos = alvos.filter(r => (Number(r.qtdFotos) || (Array.isArray(r.fotos) ? r.fotos.length : 0)) > 0);
        if (comFotos.length === 0 || !confirm(`🧹 Limpar fotos de ${comFotos.length} registos anteriores a ${dataLimite}?`)) return;
        for (const r of comFotos) {
            let obsSemFotos = `${r.endereco ? `[END: ${r.endereco}] ` : ''}${r.liberouAcesso ? `[LIBEROU_ACESSO: ${r.liberouAcesso}] ` : ''}${r.tempoPausadoMinutos > 0 ? `[PAUSA_TOTAL: ${r.tempoPausadoMinutos}] ` : ''}${r.observacoes || ''}`.trim();
            await supabaseClient.from('registros_producao').update({ observacoes: obsSemFotos }).eq('id', r.id);
            if (typeof cacheFotosSobDemanda !== 'undefined') cacheFotosSobDemanda.set(r.id, []);
            r.qtdFotos = 0;
        }
        if (typeof reciclarContagemBytesFotos === 'function') reciclarContagemBytesFotos();
        atualizarDashboardGestor();
        alert(`✅ Fotos removidas!`);
    } else if (tipoExpurgo === 'registros_completos') {
        if (!confirm(`🗑️ Excluir ${alvos.length} registos anteriores a ${dataLimite}?`)) return;
        const idsParaExcluir = alvos.map(r => r.id);
        const setExcluir = new Set(idsParaExcluir);
        for (let i = 0; i < idsParaExcluir.length; i += 100) {
            await supabaseClient.from('registros_producao').delete().in('id', idsParaExcluir.slice(i, i + 100));
        }
        registrosSalvos = registrosSalvos.filter(r => !setExcluir.has(r.id));
        atualizarDashboardGestor();
        alert(`✅ ${idsParaExcluir.length} registos excluídos!`);
    }
}

function gerarRelatorioVisualImpressaoPDF() {
    mudarSubAbaGestor('graficos');
    setTimeout(() => { window.print(); }, 300);
}

// ================= MAPA EM TEMPO REAL E BLINDAGEM CONTRA ROTA ENCERRADA INDEVIDAMENTE =================
function converterHorarioParaMinutos(strHora) {
    if (!strHora || typeof strHora !== 'string' || !strHora.includes(':')) return null;
    const partes = strHora.trim().split(':');
    const h = parseInt(partes[0], 10), m = parseInt(partes[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return (h * 60) + m;
}

function formatarMinutosParaHHMM(totalMinutos) {
    if (totalMinutos === null || isNaN(totalMinutos) || totalMinutos < 0) return "--:--";
    const h = Math.floor(totalMinutos / 60), m = Math.round(totalMinutos % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatarDuracaoTexto(totalMinutos) {
    if (totalMinutos === null || isNaN(totalMinutos) || totalMinutos <= 0) return "0 min";
    const h = Math.floor(totalMinutos / 60), m = Math.round(totalMinutos % 60);
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
}

function extrairCoordenadaMaisRecenteDoTecnicoHoje(nomeTec, regsHoje, obrasEmApoioHoje, tel) {
    let melhorCandidato = { lat: null, lng: null, hora: null, minDia: -1, ts: 0, origem: '' };

    const testarCandidato = (strCoord, strHora, timestampMs, origemLbl) => {
        if (!strCoord || typeof strCoord !== 'string' || !strCoord.includes(',')) return;
        const partes = strCoord.split(',').map(s => parseFloat(s.trim()));
        if (partes.length < 2 || isNaN(partes[0]) || isNaN(partes[1])) return;
        if (partes[0] === 0 && partes[1] === 0) return;

        const min = converterHorarioParaMinutos(strHora);
        const minValido = min !== null ? min : -1;
        const tsVal = Number(timestampMs) || 0;

        if (melhorCandidato.lat === null || minValido > melhorCandidato.minDia || (minValido === melhorCandidato.minDia && tsVal > melhorCandidato.ts)) {
            melhorCandidato = {
                lat: partes[0],
                lng: partes[1],
                hora: strHora && strHora.includes(':') ? strHora : '--:--',
                minDia: minValido,
                ts: tsVal,
                origem: origemLbl
            };
        }
    };

    if (tel && tel.lat !== null && tel.lng !== null && !isNaN(Number(tel.lat)) && !isNaN(Number(tel.lng))) {
        testarCandidato(`${tel.lat}, ${tel.lng}`, tel.horaUltimoSinal || tel.horaInicio, tel.timestampUltimoSinal, 'Rastreio GPS');
    }

    (regsHoje || []).forEach(r => {
        if (r.gpsEntrada && r.gpsEntrada.includes(',')) {
            testarCandidato(r.gpsEntrada, r.hEntrada, r.id, `Entrada (${r.imovel})`);
        }
        if (r.gpsSaida && r.gpsSaida.includes(',')) {
            const horaOut = (r.hSaida && r.hSaida.includes(':')) ? r.hSaida : r.hEntrada;
            testarCandidato(r.gpsSaida, horaOut, (Number(r.id) || 0) + 10, `Saída (${r.imovel})`);
        }
    });

    (obrasEmApoioHoje || []).forEach(r => {
        const obs = (r.observacoes || '');
        const regexGpsApoio = new RegExp(`\\[APOIO_CONJUNTO:\\s*${nomeTec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+entrou\\s+em\\s+apoio\\s+às\\s+(\\d{2}:\\d{2})\\s*\\(GPS:\\s*([-0-9.,\\s]+)\\)\\]`, 'i');
        const m = obs.match(regexGpsApoio);
        if (m && m[2] && m[2].includes(',')) {
            testarCandidato(m[2], m[1], (Number(r.id) || 0) + 20, `Apoio (${r.imovel})`);
        } else if (r.gpsEntrada && r.gpsEntrada.includes(',')) {
            testarCandidato(r.gpsEntrada, r.hEntrada, r.id, `Apoio c/ ${r.equipe}`);
        }
    });

    return melhorCandidato;
}

function calcularMinutosDesdeUltimoSinal(melhorSinal, tel) {
    const agora = new Date();
    const minAgora = (agora.getHours() * 60) + agora.getMinutes();

    if (melhorSinal && melhorSinal.minDia >= 0) {
        const diff = minAgora - melhorSinal.minDia;
        return diff >= 0 ? diff : 0;
    }

    const tsRef = Number(tel?.timestampUltimoSinal) || 0;
    if (tsRef > 1700000000000) {
        return Math.max(0, Math.round((Date.now() - tsRef) / 60000));
    }
    return 0;
}

async function encerrarTurnoTecnicoPeloGestor(nomeEq) {
    if (!usuarioPodeEditarGestor()) return;
    const hojeISO = obterDataLocalISO();
    const temAtiva = (registrosSalvos || []).some(r =>
        r.dataRegistro === hojeISO &&
        normalizarChaveNome(r.equipe) === normalizarChaveNome(nomeEq) &&
        ['EM ANDAMENTO', 'PARALISADA', 'REABERTA', 'IMPREVISTO'].includes(r.desfecho)
    );
    if (temAtiva) {
        alert(`🚫 BLOQUEADO: O técnico "${nomeEq}" possui atividade ou imprevisto aberto neste momento. Não é permitido encerrar a rota dele.`);
        return;
    }

    const confirmacaoDupla = prompt(`⚠️ ATENÇÃO: Esta ação encerrará a rota no celular do técnico "${nomeEq}".\n\nPara confirmar que o técnico realmente já encerrou o dia, digite FIM abaixo:`);
    if (!confirmacaoDupla || confirmacaoDupla.trim().toUpperCase() !== 'FIM') return;

    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const anterior = (telemetriaEquipes && telemetriaEquipes[nomeEq]) ? telemetriaEquipes[nomeEq] : {};

    const objEncerrado = {
        ...anterior,
        equipe: nomeEq,
        data: hojeISO,
        statusTurno: 'ENCERRADO',
        horaFim: horaAgora,
        timestampUltimoSinal: Date.now()
    };

    telemetriaEquipes[nomeEq] = objEncerrado;
    if (typeof sincronizarTelemetriaNaNuvem === 'function') {
        await sincronizarTelemetriaNaNuvem(nomeEq, objEncerrado);
    }
    registrarLogAuditoria("BAIXA MANUAL DE ROTA", `Gestor ${usuarioLogado} encerrou manualmente o expediente de ${nomeEq}.`);
    renderizarPainelDisponibilidade();
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

    const containerAtalhos = document.getElementById('lista-atalhos-tecnicos-mapa');
    if (containerAtalhos) containerAtalhos.innerHTML = "";

    listaPinos.forEach(p => {
        if (p.lat === null || p.lng === null || isNaN(p.lat) || isNaN(p.lng)) return;
        coordenadasPinosAtuais.push([p.lat, p.lng]);
        const primeiroNome = p.nome.split(' ')[0];
        const iconeHtml = L.divIcon({
            className: 'custom-pin-gpd',
            html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);"><div style="background:${p.corHex};color:#fff;font-weight:900;font-size:10px;padding:2px 7px;border-radius:8px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);white-space:nowrap;display:flex;align-items:center;gap:4px;"><span>${p.iconeEmoji}</span><span>${primeiroNome}</span></div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${p.corHex};margin-top:-1px;"></div></div>`,
            iconSize: [0, 0], iconAnchor: [0, 0]
        });

        const marker = L.marker([p.lat, p.lng], { icon: iconeHtml });
        marker.bindPopup(`<div style="font-family:sans-serif;font-size:11px;line-height:1.4;min-width:195px;"><div style="font-weight:900;color:#0f172a;font-size:12px;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-bottom:4px;">👷 ${p.nome}</div><div><b>Status:</b> <span style="color:${p.corHex};font-weight:800;">${p.statusTexto}</span></div><div><b>Expediente:</b> ${p.turnoTexto}</div><div><b>Ocupação:</b> ${p.ocupacaoLimpa}</div><div><b>Último Sinal:</b> ${p.sinalTexto}</div><div style="margin-top:5px;padding-top:4px;border-top:1px solid #f1f5f9;"><a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" style="color:#2563eb;font-weight:bold;text-decoration:underline;">🗺️ Abrir no Google Maps (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})</a></div></div>`);
        marker.addTo(camadaMarcadoresRastreio);

        if (containerAtalhos) {
            const btnAtalho = document.createElement('button');
            btnAtalho.type = "button";
            btnAtalho.className = "px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-sm transition hover:opacity-90 flex items-center gap-1";
            btnAtalho.style.backgroundColor = p.corHex;
            btnAtalho.innerHTML = `<span>${p.iconeEmoji}</span> <span>${p.nome} (${p.horaCurta || '--:--'})</span>`;
            btnAtalho.onclick = () => focarTecnicoNoMapa(p.lat, p.lng, p.nome);
            containerAtalhos.appendChild(btnAtalho);
        }
    });

    if (containerAtalhos && coordenadasPinosAtuais.length === 0) {
        containerAtalhos.innerHTML = `<span class="text-[11px] text-slate-400 italic">Nenhum técnico com turno ativo ou em atendimento no mapa neste momento.</span>`;
    }
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setTxt('lbl-contador-pinos-mapa', `${coordenadasPinosAtuais.length} técnico(s) no mapa`);
    setTxt('badge-aba-mapa', `${coordenadasPinosAtuais.length} no mapa`);
}

function centralizarMapaEquipes() {
    if (!mapaRastreioInstancia) return;
    mapaRastreioInstancia.invalidateSize();
    if (coordenadasPinosAtuais.length === 0) { mapaRastreioInstancia.setView([-22.9068, -43.1729], 11); return; }
    if (coordenadasPinosAtuais.length === 1) mapaRastreioInstancia.setView(coordenadasPinosAtuais[0], 16);
    else mapaRastreioInstancia.fitBounds(L.latLngBounds(coordenadasPinosAtuais), { padding: [45, 45], maxZoom: 16 });
}

function focarTecnicoNoMapa(lat, lng, nome) {
    if (isNaN(lat) || isNaN(lng)) return;
    const subMapa = document.getElementById('subview-mapa');
    if (subMapa && subMapa.classList.contains('hidden')) mudarSubAbaGestor('mapa');
    document.getElementById('mapa-rastreio-equipes')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
        if (!mapaRastreioInstancia) renderizarPainelDisponibilidade();
        if (mapaRastreioInstancia) { mapaRastreioInstancia.invalidateSize(); mapaRastreioInstancia.setView([lat, lng], 16); }
    }, 280);
}

function stringParaHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return hash;
}

function alternarVisualizacaoBlocosAgrupados(idElemento, btnEl) {
    const el = document.getElementById(idElemento);
    if (!el) return;
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        btnEl.innerText = "📂 Ocultar Blocos";
        btnEl.className = "mt-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 transition";
    } else {
        el.classList.add('hidden');
        const qtd = el.dataset.qtdBlocos || el.querySelectorAll('.card-bloco-interno').length;
        btnEl.innerText = `📂 Expandir Blocos (${qtd})`;
        btnEl.className = "mt-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 transition";
    }
}
// ================= TRANSFERÊNCIA, REABERTURA, IMPORTAÇÃO E PAINEL DE DISPONIBILIDADE =================
async function autorizarReaberturaCampo(id) {
    if (!usuarioPodeEditarGestor()) { alert("⚠️ Apenas Gestores podem autorizar a reabertura."); return; }
    const reg = registrosSalvos.find(r => r.id === id);
    if (!reg) return;
    const motivoReabertura = prompt(`🔓 AUTORIZAR REABERTURA PARA O TÉCNICO:\n\nImóvel: ${reg.imovel}\nTécnico: ${reg.equipe}\nStatus Atual: ${reg.desfecho}\n\nMotivo:`, "Correção de dados / inclusão de fotos");
    if (motivoReabertura === null) return;

    const { error } = await supabaseClient.from('registros_producao').update({ desfecho: "REABERTA" }).eq('id', id);
    if (error) { alert("❌ Erro: " + error.message); return; }

    reg.desfecho = "REABERTA";
    atualizarDashboardGestor();
    registrarLogAuditoria("REABERTURA AUTORIZADA", `Imóvel ${reg.imovel} reaberto para ${reg.equipe}.`);
    alert(`✅ Atividade do imóvel "${reg.imovel}" REABERTA!`);
}

function abrirModalTransferirAtividade(id) {
    if (!usuarioPodeEditarGestor()) return;
    const reg = registrosSalvos.find(r => r.id === id);
    if (!reg || ['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(reg.desfecho)) return;

    document.getElementById('transf-reg-id').value = reg.id;
    document.getElementById('transf-lbl-imovel').innerText = reg.imovel;
    document.getElementById('transf-lbl-projeto').innerText = reg.projeto;
    document.getElementById('transf-lbl-status').innerText = reg.desfecho;
    document.getElementById('transf-lbl-atual').innerText = reg.equipe;
    document.getElementById('inp-motivo-transf').value = "";

    const selDestino = document.getElementById('sel-tecnico-destino-transf');
    if (selDestino) {
        const equipesAtivas = equipesSistema.filter(e => e.status === 'Ativo' && e.nome !== reg.equipe);
        selDestino.innerHTML = `<option value="">Selecione o técnico de destino...</option>` + equipesAtivas.map(eq => `<option value="${eq.nome}">${eq.nome} (${formatarSetoresString(eq.setor)})</option>`).join('');
    }
    document.getElementById('modal-transferir-atividade').classList.remove('hidden');
}

function fecharModalTransferirAtividade() { document.getElementById('modal-transferir-atividade')?.classList.add('hidden'); }

async function confirmarTransferenciaAtividade() {
    if (!usuarioPodeEditarGestor()) return;
    const id = Number(document.getElementById('transf-reg-id').value);
    const novoTecnico = document.getElementById('sel-tecnico-destino-transf').value;
    const motivo = document.getElementById('inp-motivo-transf').value.trim();
    if (!novoTecnico) { alert("⚠️ Selecione o técnico de destino."); return; }

    const reg = registrosSalvos.find(r => r.id === id);
    if (!reg) return;
    const tecnicoAnterior = reg.equipe;
    const novoMotivoDesfecho = `${reg.motivoDesfecho ? reg.motivoDesfecho + ' | ' : ''}🔀 Transferida de ${tecnicoAnterior} para ${novoTecnico}${motivo ? ` (${motivo})` : ''}`;

    const { error } = await supabaseClient.from('registros_producao').update({ equipe: novoTecnico, membros: novoTecnico, motivo_desfecho: novoMotivoDesfecho }).eq('id', id);
    if (error) { alert("❌ Erro: " + error.message); return; }

    Object.assign(reg, { equipe: novoTecnico, membros: novoTecnico, motivoDesfecho: novoMotivoDesfecho });
    fecharModalTransferirAtividade();
    atualizarDashboardGestor();
    registrarLogAuditoria("TRANSFERÊNCIA DE ATIVIDADE", `Imóvel ${reg.imovel} transferido de '${tecnicoAnterior}' para '${novoTecnico}'.`);
}

function abrirModalImportarPlanilha() {
    if (!usuarioPodeEditarGestor()) return;
    document.getElementById('inp-arquivo-planilha').value = "";
    document.getElementById('txt-linhas-planilha').value = "";
    document.getElementById('modal-importar-planilha').classList.remove('hidden');
}

function fecharModalImportarPlanilha() { document.getElementById('modal-importar-planilha').classList.add('hidden'); }

function baixarModeloPlanilhaCSV() {
    const cabecalho = "IMOVEL;ENDERECO;PROJETO;TECNICO;QTD_BLOCOS;ANDARES;HPS;RESPONSAVEL;CONTATO;EMAIL;OBSERVACOES\n";
    const ex1 = "848465405;Rua Conde de Bonfim 450 - TIJUCA;VISTORIA;ANDREO FAGUNDES;2;10;40;Sr. Carlos;21 99888-7766;sindico@bonfim450.com.br;Condomínio com 2 blocos\n";
    const ex2 = "848473602;Av Nossa Senhora de Copacabana 800 - COPACABANA;CONSTRUÇÃO F;BRUNO SOARES DA SILVA;1;12;60;Dona Maria;21 98777-6655;portaria@copa800.com.br;Construção F\n";
    const blob = new Blob(['\ufeff' + cabecalho + ex1 + ex2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `planilha_carga_gpd_procisa_${obterDataLocalISO()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function lerArquivoPlanilhaUpload(inputEl) {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { document.getElementById('txt-linhas-planilha').value = e.target.result || ""; };
    reader.readAsText(file, 'UTF-8');
}

async function processarImportacaoPlanilha() {
    const textoBruto = document.getElementById('txt-linhas-planilha').value.trim();
    if (!textoBruto) return;
    const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const hojeISO = obterDataLocalISO();
    const novosRegistros = [];

    linhas.forEach((linha, idx) => {
        if (idx === 0 && (linha.toUpperCase().startsWith("IMOVEL") || linha.toUpperCase().startsWith("IMÓVEL"))) return;
        let delimitador = linha.includes('\t') ? '\t' : (!linha.includes(';') && linha.includes(',') ? ',' : ';');
        const partes = linha.split(delimitador).map(p => p.trim());
        if (partes.length < 4) return;
        const imovel = partes[0], endereco = partes[1] || "Endereço a confirmar";
        const projeto = normalizarNomeProjeto(partes[2] || "CONSTRUÇÃO ON GOING");
        const tecnico = (partes[3] || "").toUpperCase().trim();
        const qtdBlocos = Math.max(1, Math.min(20, Number(partes[4]) || 1));
        if (!imovel || !tecnico) return;

        novosRegistros.push({
            id: Date.now() + idx + Math.floor(Math.random() * 1000), data_registro: hojeISO, equipe: tecnico, membros: tecnico,
            projeto: TODOS_OS_PROJETOS.includes(projeto) ? projeto : "CONSTRUÇÃO ON GOING",
            imovel, h_entrada: "Programada", h_saida: "Aguardando", gps_entrada: "Carga Gestor", gps_saida: "-",
            desfecho: "PROGRAMADA", motivo_desfecho: `Carga Programada (${qtdBlocos} Bloco${qtdBlocos > 1 ? 's' : ''}) por ${usuarioLogado || 'Gestor'}`,
            malogros: [], responsavel: partes[7] || "", contato: partes[8] || "", email: partes[9] || "", agendamento: null,
            andares: Number(partes[5]) || 0, hps: Number(partes[6]) || 0, servico_obra: "SIM",
            observacoes: `[END: ${endereco}] [BLOCOS: ${qtdBlocos}] ${partes[10] || "Atividade programada pela gestão."}`.trim()
        });
    });

    if (novosRegistros.length === 0) return;
    const { error } = await supabaseClient.from('registros_producao').insert(novosRegistros);
    if (error) { alert("❌ Erro: " + error.message); return; }
    if (typeof converterLinhaBancoParaObjetoGpd === "function") {
        registrosSalvos = [...novosRegistros.map(converterLinhaBancoParaObjetoGpd), ...registrosSalvos];
    }
    fecharModalImportarPlanilha();
    atualizarDashboardGestor();
    alert(`✅ ${novosRegistros.length} atividade(s) enviadas!`);
}

function renderizarPainelDisponibilidade() {
    try {
        const tbody = document.getElementById('tabela-disponibilidade-corpo');
        if (!tbody) return;
        tbody.innerHTML = "";
        const hojeISO = obterDataLocalISO();
        const equipesAtivas = obterEquipesVisiveisUsuarioAtual(true);
        let countDisp = 0, countAtend = 0, countIndisp = 0, countOffline = 0;
        const listaPinosParaMapa = [];

        const todosRegsHoje = (registrosSalvos || []).filter(r =>
            r &&
            !normalizarChaveNome(r.equipe).includes('AAAAAATESTE') &&
            r.dataRegistro === hojeISO &&
            r.equipe !== '__CONFIG_SISTEMA__' &&
            r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
            r.projeto !== PROJETO_SOLIC_MATERIAL
        );

        equipesAtivas.forEach(eq => {
            const regsHoje = todosRegsHoje.filter(r => normalizarChaveNome(r.equipe) === normalizarChaveNome(eq.nome));
            const obrasEmApoioValidadoHoje = todosRegsHoje.filter(r => normalizarChaveNome(r.equipe) !== normalizarChaveNome(eq.nome) && extrairApoiosDoRegistro(r).some(ap => normalizarChaveNome(ap) === normalizarChaveNome(eq.nome)));
            const obrasEmApoioPendenteHoje = todosRegsHoje.filter(r => normalizarChaveNome(r.equipe) !== normalizarChaveNome(eq.nome) && extrairApoiosPendentesDoRegistro(r).some(ap => normalizarChaveNome(ap) === normalizarChaveNome(eq.nome)));

            const impAberto = regsHoje.find(r => r.desfecho === 'IMPREVISTO');
            const obraParalisada = regsHoje.find(r => r.desfecho === 'PARALISADA');
            const obraAndamento = regsHoje.find(r => r.desfecho === 'EM ANDAMENTO' || r.desfecho === 'REABERTA');
            const apoioValidadoAndamento = obrasEmApoioValidadoHoje.find(r => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(r.desfecho));
            const apoioPendenteAndamento = obrasEmApoioPendenteHoje.find(r => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(r.desfecho));

            const programadasHoje = (registrosSalvos || []).filter(r => r && normalizarChaveNome(r.equipe) === normalizarChaveNome(eq.nome) && r.desfecho === 'PROGRAMADA').length;
            const concluidasHoje = regsHoje.filter(r => r.desfecho === 'CONCLUIDA').length;
            const apoiosConcluidosHoje = obrasEmApoioValidadoHoje.filter(r => r.desfecho === 'CONCLUIDA').length;

            const tel = (telemetriaEquipes && telemetriaEquipes[eq.nome] && telemetriaEquipes[eq.nome].data === hojeISO) ? telemetriaEquipes[eq.nome] : null;
            const turnoIniciado = tel && tel.statusTurno === 'DISPONIVEL';
            const turnoEncerrado = tel && tel.statusTurno === 'ENCERRADO' && !obraAndamento && !obraParalisada && !impAberto;

            const melhorSinal = extrairCoordenadaMaisRecenteDoTecnicoHoje(eq.nome, regsHoje, [...obrasEmApoioValidadoHoje, ...obrasEmApoioPendenteHoje], tel);
            const latFinal = melhorSinal.lat;
            const lngFinal = melhorSinal.lng;
            const horaSinal = melhorSinal.hora;
            const minutosSemSinal = calcularMinutosDesdeUltimoSinal(melhorSinal, tel);
            const sinalRecenteValido = minutosSemSinal <= TEMPO_MAXIMO_SINAL_ROTA_MINUTOS;

            let turnoHtml = `<span class="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold">⚪ Não iniciado hoje</span>`;
            let turnoTextoPuro = "Não iniciado hoje";
            if (turnoIniciado) {
                turnoHtml = `<span class="bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">🟢 Em Rota desde ${tel.horaInicio || '--:--'}</span>`;
                turnoTextoPuro = `Ativo desde ${tel.horaInicio || '--:--'}`;
            } else if (turnoEncerrado) {
                turnoHtml = `<span class="bg-slate-200 text-slate-800 border border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">🔴 Encerrado (${tel.horaInicio || '--:--'} às ${tel.horaFim || '--:--'})</span>`;
                turnoTextoPuro = `Encerrado (${tel.horaInicio || '--:--'} às ${tel.horaFim || '--:--'})`;
            } else if (regsHoje.length > 0 || obrasEmApoioValidadoHoje.length > 0) {
                turnoHtml = `<span class="bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold">📍 Em campo hoje (Últ. sinal ${horaSinal || '--:--'})</span>`;
                turnoTextoPuro = `Em campo (Últ. sinal ${horaSinal || '--:--'})`;
            }

            let statusBadge = "", detalheTexto = "", ocupacaoLimpa = "", acaoHtml = "-";
            let corPinoHex = "#64748b", iconeEmojiPino = "⚪", statusTextoPuro = "OFFLINE";
            let deveAparecerNoMapa = false;

            if (impAberto) {
                countIndisp++; corPinoHex = "#dc2626"; iconeEmojiPino = "🔴"; statusTextoPuro = "INDISPONÍVEL (IMPREVISTO)";
                deveAparecerNoMapa = true;
                statusBadge = `<span class="bg-red-100 text-red-800 border border-red-300 font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🔴 INDISPONÍVEL</span>`;
                const mot = (impAberto.malogros && impAberto.malogros.length > 0) ? impAberto.malogros.join(' + ') : impAberto.motivoDesfecho;
                detalheTexto = `<span class="font-bold text-red-900">${mot}</span>`;
                ocupacaoLimpa = `Imprevisto: ${mot}`;
            } else if (obraParalisada) {
                countAtend++; corPinoHex = "#ea580c"; iconeEmojiPino = "⏸️"; statusTextoPuro = "ATIVIDADE PARALISADA";
                deveAparecerNoMapa = true;
                statusBadge = `<span class="bg-orange-500 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block">⏸️ PARALISADA</span>`;
                detalheTexto = `Imóvel: <b>${obraParalisada.imovel}</b> (${obraParalisada.projeto})`;
                ocupacaoLimpa = `Pausa no imóvel ${obraParalisada.imovel}`;
            } else if (obraAndamento) {
                countAtend++; corPinoHex = "#2563eb"; iconeEmojiPino = "🔵"; statusTextoPuro = "EM ATENDIMENTO";
                deveAparecerNoMapa = true;
                const apVal = extrairApoiosDoRegistro(obraAndamento);
                const apPend = extrairApoiosPendentesDoRegistro(obraAndamento);
                const txtAp = apVal.length > 0 ? ` • <span class="text-purple-800 font-black">🤝 Validado c/ ${apVal.join(', ')}</span>` : '';
                const txtPend = apPend.length > 0 ? ` • <span class="text-amber-800 font-black animate-pulse">⏳ Validar: ${apPend.join(', ')}</span>` : '';
                statusBadge = `<span class="bg-blue-600 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🔵 EM ATENDIMENTO</span>`;
                detalheTexto = `Imóvel: <b>${obraAndamento.imovel}</b> (${obraAndamento.projeto})${txtAp}${txtPend}`;
                ocupacaoLimpa = `Atendendo ${obraAndamento.imovel}${apVal.length > 0 ? ` (Conjunta c/ ${apVal.join(', ')})` : ''}`;
            } else if (apoioValidadoAndamento) {
                countAtend++; corPinoHex = "#7c3aed"; iconeEmojiPino = "🤝"; statusTextoPuro = "EM APOIO (VALIDADO)";
                deveAparecerNoMapa = true;
                statusBadge = `<span class="bg-purple-700 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🤝 EM APOIO (VALIDADO)</span>`;
                detalheTexto = `Apoiando <b>${apoioValidadoAndamento.equipe}</b> no Imóvel <b>${apoioValidadoAndamento.imovel}</b> (Presença Validada ✅)`;
                ocupacaoLimpa = `Em apoio validado a ${apoioValidadoAndamento.equipe} (Imóvel ${apoioValidadoAndamento.imovel})`;
            } else if (apoioPendenteAndamento) {
                countAtend++; corPinoHex = "#d97706"; iconeEmojiPino = "⏳"; statusTextoPuro = "APOIO AGUARDANDO VALIDAÇÃO";
                deveAparecerNoMapa = true;
                statusBadge = `<span class="bg-amber-500 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block animate-pulse">⏳ APOIO PENDENTE VALIDAÇÃO</span>`;
                detalheTexto = `Aguardando <b>${apoioPendenteAndamento.equipe}</b> validar presença no Imóvel <b>${apoioPendenteAndamento.imovel}</b>`;
                ocupacaoLimpa = `Aguardando ${apoioPendenteAndamento.equipe} validar apoio (${apoioPendenteAndamento.imovel})`;
            } else if (turnoEncerrado) {
                countOffline++; corPinoHex = "#475569"; iconeEmojiPino = "🏁"; statusTextoPuro = "EXPEDIENTE ENCERRADO";
                deveAparecerNoMapa = false;
                statusBadge = `<span class="bg-slate-200 text-slate-700 border border-slate-300 font-bold px-2.5 py-1 rounded-md text-[10px] inline-block">🏁 ENCERRADO</span>`;
                detalheTexto = `Turno finalizado (${concluidasHoje} concluída(s)${apoiosConcluidosHoje > 0 ? ` + ${apoiosConcluidosHoje} apoio(s)` : ''})`;
                ocupacaoLimpa = `Turno encerrado`;
            } else if (turnoIniciado || ((regsHoje.length > 0 || obrasEmApoioValidadoHoje.length > 0) && sinalRecenteValido)) {
                countDisp++; corPinoHex = "#059669"; iconeEmojiPino = "🟢"; statusTextoPuro = "EM ROTA / DISPONÍVEL";
                deveAparecerNoMapa = true;
                statusBadge = `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🟢 DISPONÍVEL</span>`;
                detalheTexto = `Em deslocamento / Livre (${concluidasHoje} concluída(s)${apoiosConcluidosHoje > 0 ? ` + <b>${apoiosConcluidosHoje} apoio(s)</b>` : ''} hoje)`;
                ocupacaoLimpa = `Disponível em rota`;
            } else {
                countOffline++; corPinoHex = "#94a3b8"; iconeEmojiPino = "⚪"; statusTextoPuro = "SEM SINAL RECENTE / FORA DO MAPA";
                deveAparecerNoMapa = false;
                statusBadge = `<span class="bg-slate-100 text-slate-500 border border-slate-200 font-bold px-2.5 py-1 rounded-md text-[10px] inline-block">⚪ FORA DO MAPA</span>`;
                detalheTexto = horaSinal
                    ? `<span class="text-amber-800 font-semibold">⏸️ Último sinal às ${horaSinal} (${concluidasHoje} concluída(s) hoje)</span>`
                    : `Sem check-in hoje (${programadasHoje} na fila)`;
                ocupacaoLimpa = "Sem sinal recente no mapa";
            }

            let gpsStr = `<span class="text-slate-400 text-[10px]">Sem sinal hoje</span>`;
            if (latFinal !== null && lngFinal !== null && !isNaN(latFinal) && !isNaN(lngFinal)) {
                const coordFormatada = `${latFinal.toFixed(5)}, ${lngFinal.toFixed(5)}`;
                gpsStr = `<div class="space-y-0.5"><div class="text-[9px] font-bold ${deveAparecerNoMapa ? 'text-emerald-800' : 'text-slate-500'}">🕒 Às ${horaSinal || '--:--'} • ${melhorSinal.origem}</div><a href="https://www.google.com/maps/search/?api=1&query=${latFinal},${lngFinal}" target="_blank" class="text-blue-600 underline font-mono text-[10px]">🗺️ ${coordFormatada}</a></div>`;

                if (deveAparecerNoMapa) {
                    const btnBaixar = usuarioPodeEditarGestor()
                        ? `<button type="button" onclick="encerrarTurnoTecnicoPeloGestor('${eq.nome}')" title="Encerrar turno deste técnico e removê-lo do mapa" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[10px] px-2 py-1 rounded">🔴 Baixar</button>`
                        : '';
                    acaoHtml = `<div class="flex items-center gap-1"><button type="button" onclick="focarTecnicoNoMapa(${latFinal}, ${lngFinal}, '${eq.nome}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[10px] px-2 py-1 rounded">🎯 Mapa</button>${btnBaixar}</div>`;
                    listaPinosParaMapa.push({
                        nome: eq.nome, lat: latFinal, lng: lngFinal, corHex: corPinoHex,
                        iconeEmoji: iconeEmojiPino, statusTexto: statusTextoPuro, turnoTexto: turnoTextoPuro,
                        ocupacaoLimpa, sinalTexto: `${horaSinal || '--:--'} (${melhorSinal.origem})`, horaCurta: horaSinal
                    });
                } else {
                    acaoHtml = `<button type="button" onclick="focarTecnicoNoMapa(${latFinal}, ${lngFinal}, '${eq.nome}')" class="text-[10px] text-slate-500 hover:text-blue-700 underline font-semibold">📍 Ver última pos. (${horaSinal || '--:--'})</button>`;
                }
            }

            tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3 font-bold text-slate-800">${eq.nome}<div class="text-[9px] text-indigo-700 font-semibold">👮 ${obterNomeFiscalDaEquipe(eq)}</div></td><td class="p-3">${obterBadgeSetorHtml(eq.setor)}</td><td class="p-3">${turnoHtml}</td><td class="p-3">${statusBadge}</td><td class="p-3">${detalheTexto}</td><td class="p-3">${gpsStr}</td><td class="p-3 whitespace-nowrap">${acaoHtml}</td></tr>`;
        });

        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        setTxt('disp-card-disponiveis', countDisp);
        setTxt('disp-card-atendimento', countAtend);
        setTxt('disp-card-indisponiveis', countIndisp);
        setTxt('disp-card-offline', countOffline);
        setTxt('badge-aba-indisp', `${countIndisp} indisp.`);
        inicializarOuAtualizarMapaRastreio(listaPinosParaMapa);
    } catch (e) { console.warn("Erro disponibilidade:", e); }
}

// ================= PAGINAÇÃO TOTAL DE REGISTROS DO SUPABASE (SEM DUPLO DOWNLOAD) =================
function converterLinhaLeveParaObjetoGpd(row) {
    if (typeof converterLinhaBancoParaObjetoGpd === "function") {
        const obj = converterLinhaBancoParaObjetoGpd({ ...row, observacoes: row.observacoes || "" });
        if (!obj.qtdBlocosProgramados) obj.qtdBlocosProgramados = 1;
        return obj;
    }
    return {
        id: row.id,
        dataRegistro: row.data_registro || "",
        equipe: (row.equipe || "").toUpperCase().trim(),
        membros: row.membros || row.equipe || "",
        projeto: normalizarNomeProjeto(row.projeto || "CONSTRUÇÃO ON GOING"),
        imovel: row.imovel || "",
        endereco: "",
        liberouAcesso: "",
        tempoPausadoMinutos: 0,
        qtdBlocosProgramados: 1,
        fotos: [],
        qtdFotos: 0,
        hEntrada: row.h_entrada || "",
        hSaida: row.h_saida || "",
        gpsEntrada: row.gps_entrada || "",
        gpsSaida: row.gps_saida || "",
        desfecho: (row.desfecho || "CONCLUIDA").toUpperCase().trim(),
        motivoDesfecho: row.motivo_desfecho || "",
        malogros: Array.isArray(row.malogros) ? row.malogros : [],
        responsavel: row.responsavel || "",
        contato: row.contato || "",
        email: row.email || "",
        agendamento: row.agendamento || null,
        andares: Number(row.andares) || 0,
        hps: Number(row.hps) || 0,
        servicoObra: row.servico_obra || "SIM",
        observacoes: "",
        fusoes: Number(row.fusoes) || 0,
        conectores: Number(row.conectores) || 0,
        caboRL: Number(row.cabo_rl) || 0,
        caboDrop: Number(row.cabo_drop) || 0,
        nap: Number(row.nap) || 0,
        dio: Number(row.dio) || 0,
        cxSobrepor: Number(row.cx_sobrepor) || 0,
        cxEmbutida: Number(row.cx_embutida) || 0,
        cxFosc: Number(row.cx_fosc) || 0
    };
}

async function baixarTodoHistoricoPaginadoSupabase() {
    if (typeof supabaseClient === "undefined") return [];

    const TAMANHO_PAGINA = 1000;
    let todasLinhas = [];
    let pagina = 0;
    let continuar = true;

    while (continuar && pagina < 50) {
        const inicio = pagina * TAMANHO_PAGINA;
        const fim = inicio + TAMANHO_PAGINA - 1;

        let { data, error } = await supabaseClient
            .from('registros_producao')
            .select('id, data_registro, equipe, membros, projeto, imovel, h_entrada, h_saida, gps_entrada, gps_saida, desfecho, motivo_desfecho, malogros, responsavel, contato, email, agendamento, andares, hps, servico_obra, fusoes, conectores, cabo_rl, cabo_drop, nap, dio, cx_sobrepor, cx_embutida, cx_fosc')
            .neq('equipe', '__CONFIG_SISTEMA__')
            .neq('projeto', '__CONFIG_AUDITORIA__')
            .order('data_registro', { ascending: false })
            .order('id', { ascending: false })
            .range(inicio, fim);

        if (error) {
            console.warn(`Aviso na página ${pagina} da busca paginada:`, error.message);
            break;
        }

        if (!data || data.length === 0) {
            continuar = false;
        } else {
            todasLinhas.push(...data);
            if (data.length < TAMANHO_PAGINA) {
                continuar = false;
            } else {
                pagina++;
            }
        }
    }

    return todasLinhas.map(converterLinhaLeveParaObjetoGpd);
}

async function garantirCargaNuvemGestor(forcarRecarga = false) {
    if (modoConsultaBackupAtivo) return;

    if (!forcarRecarga && typeof cargaInicialGestorConcluida !== 'undefined' && cargaInicialGestorConcluida && Array.isArray(registrosSalvos) && registrosSalvos.length > 0) {
        historicoCompletoGestorJaBaixado = true;
        return;
    }

    if ((forcarRecarga || !historicoCompletoGestorJaBaixado || !cargaInicialGestorConcluida) && !sincronizandoRegistrosMobileEmCurso) {
        sincronizandoRegistrosMobileEmCurso = true;
        try {
            const corpoAtivLoading = document.getElementById('tabela-gestor-corpo');
            if (corpoAtivLoading && (!registrosSalvos || registrosSalvos.length === 0)) {
                corpoAtivLoading.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-blue-900 font-bold animate-pulse">☁️ Sincronizando 100% dos registros e indicadores na nuvem...</td></tr>`;
            }

            if (typeof sincronizarDeltaRapidoGestor === "function") {
                try { await sincronizarDeltaRapidoGestor(); } catch (e) {}
            }

            const listaCompletaPaginada = await baixarTodoHistoricoPaginadoSupabase();

            if (Array.isArray(listaCompletaPaginada) && listaCompletaPaginada.length > 0) {
                const mapaExistentes = new Map();
                (registrosSalvos || []).forEach(r => {
                    if (r && r.id) mapaExistentes.set(r.id, r);
                });

                listaCompletaPaginada.forEach(itemPag => {
                    const existente = mapaExistentes.get(itemPag.id);
                    if (existente) {
                        itemPag.endereco = existente.endereco || itemPag.endereco || '';
                        itemPag.liberouAcesso = existente.liberouAcesso || itemPag.liberouAcesso || '';
                        itemPag.tempoPausadoMinutos = Math.max(Number(existente.tempoPausadoMinutos) || 0, Number(itemPag.tempoPausadoMinutos) || 0);
                        itemPag.observacoes = existente.observacoes || itemPag.observacoes || '';
                        itemPag.qtdFotos = existente.qtdFotos || 0;
                    }
                    mapaExistentes.set(itemPag.id, itemPag);
                });

                registrosSalvos = Array.from(mapaExistentes.values()).sort((a, b) => {
                    if (a.dataRegistro !== b.dataRegistro) return (b.dataRegistro || '').localeCompare(a.dataRegistro || '');
                    return (b.id || 0) - (a.id || 0);
                });
            }

            historicoCompletoGestorJaBaixado = true;
            cargaInicialGestorConcluida = true;
        } catch (errLoad) {
            console.warn("Aviso na leitura completa da nuvem:", errLoad);
        } finally {
            sincronizandoRegistrosMobileEmCurso = false;
        }
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
        selFiltroEq.innerHTML = `<option value="">${fiscalAtivo ? `👷 Meu Grupo (${listaEq.length} Técnicos)` : 'Todas as Equipes'}</option>` +
            listaEq.map(e => `<option value="${e.nome}">${e.nome}</option>`).join('');
        if (valorAtual && (!setPermitidas || setPermitidas.has(normalizarChaveNome(valorAtual)))) {
            selFiltroEq.value = valorAtual;
        } else {
            selFiltroEq.value = "";
        }
    }

    let banner = document.getElementById('banner-visao-fiscal-restrita');
    const viewGestor = document.getElementById('view-gestor');
    if (!viewGestor) return;

    if (!fiscalAtivo) {
        if (banner) banner.classList.add('hidden');
        return;
    }

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'banner-visao-fiscal-restrita';
        banner.className = 'bg-indigo-950 text-white px-4 py-2.5 rounded-xl border-2 border-cyan-400 flex flex-wrap justify-between items-center gap-2 shadow-md mb-3 text-xs';
        viewGestor.insertBefore(banner, viewGestor.firstChild);
    }

    const qtdMeusTecnicos = obterEquipesVisiveisUsuarioAtual(true).length;
    banner.classList.remove('hidden');
    banner.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="bg-cyan-400 text-slate-950 font-black px-2 py-0.5 rounded text-[10px] uppercase">Visão do Fiscal</span>
            <span>👮 Olá, <b>${fiscalAtivo.nome}</b>! Exibindo os <b>${qtdMeusTecnicos} técnicos</b> sob sua responsabilidade.</span>
        </div>
        <span class="text-[10px] text-cyan-300 font-mono">${fiscalAtivo.email}</span>
    `;
}

// ================= ATUALIZAÇÃO CENTRAL DO DASHBOARD (COM DOWNLOAD DE FOTOS EM LOTE E ISOLAMENTO DE TESTE) =================
async function atualizarDashboardGestor(forcarRecargaMobile = false) {
    inicializarMelhoriasVisuaisGestor();
    await garantirCargaNuvemGestor(forcarRecargaMobile);
    aplicarFiltroSelectEquipesEBannerFiscal();

    if (usuarioPodeEditarGestor()) {
        try { await verificarEExpurgarSolicitacoesVencidas48h(); } catch (e) {}
    }
    atualizarEstimativaPesoNuvem();

    const setFiscalRestrito = obterSetEquipesDoFiscalLogado();
    const dataInicio = document.getElementById('gestor-filtro-data-inicio')?.value || "";
    const dataFim = document.getElementById('gestor-filtro-data-fim')?.value || "";
    const fEquipe = document.getElementById('gestor-filtro-equipe')?.value || "";
    const fProjeto = document.getElementById('gestor-filtro-projeto')?.value || "";
    const fDesfecho = document.getElementById('gestor-filtro-desfecho')?.value || "";
    const termoBusca = document.getElementById('inp-busca-global')?.value.toLowerCase().trim() || "";

    const corpoAtiv = document.getElementById('tabela-gestor-corpo');
    const corpoMat = document.getElementById('tabela-materiais-corpo');
    const corpoImp = document.getElementById('tabela-imprevistos-corpo');
    if (corpoAtiv) corpoAtiv.innerHTML = "";
    if (corpoMat) corpoMat.innerHTML = "";
    if (corpoImp) corpoImp.innerHTML = "";

    let filtradosBase = (registrosSalvos || []).filter(item => {
        if (!item || item.equipe === "__CONFIG_SISTEMA__" || item.projeto === "__CONFIG_AUDITORIA__") return false;
        if (normalizarChaveNome(item.equipe).includes('AAAAAATESTE')) return false;

        if (setFiscalRestrito && !registroPertenceAoUsuarioLogado(item, setFiscalRestrito)) {
            return false;
        }

        let mData = true;
        if (dataInicio && dataFim) mData = item.dataRegistro >= dataInicio && item.dataRegistro <= dataFim;
        else if (dataInicio) mData = item.dataRegistro >= dataInicio;
        else if (dataFim) mData = item.dataRegistro <= dataFim;

        const apoiosItem = extrairApoiosDoRegistro(item);
        const eqNorm = normalizarChaveNome(item.equipe);
        let mEquipe = true;
        if (filtrosMultiplosAtivos.equipes.length > 0) {
            mEquipe = filtrosMultiplosAtivos.equipes.some(eq => normalizarChaveNome(eq) === eqNorm) ||
                      apoiosItem.some(ap => filtrosMultiplosAtivos.equipes.some(eq => normalizarChaveNome(eq) === normalizarChaveNome(ap)));
        } else if (fEquipe) {
            const fEqNorm = normalizarChaveNome(fEquipe);
            mEquipe = eqNorm === fEqNorm || apoiosItem.some(ap => normalizarChaveNome(ap) === fEqNorm);
        }

        let mSetor = true;
        if (filtrosMultiplosAtivos.setores.length > 0) {
            const eqObj = equipesSistema.find(e => normalizarChaveNome(e.nome) === eqNorm);
            const setoresTec = obterArraySetores(eqObj ? eqObj.setor : obterSetorDoProjeto(item.projeto));
            mSetor = filtrosMultiplosAtivos.setores.some(s => setoresTec.includes(s));
        }

        let mBusca = true;
        if (termoBusca) {
            mBusca = (item.imovel && item.imovel.toLowerCase().includes(termoBusca)) ||
                     (item.endereco && item.endereco.toLowerCase().includes(termoBusca)) ||
                     (item.liberouAcesso && item.liberouAcesso.toLowerCase().includes(termoBusca)) ||
                     (item.equipe && item.equipe.toLowerCase().includes(termoBusca)) ||
                     (apoiosItem.some(ap => ap.toLowerCase().includes(termoBusca))) ||
                     (item.projeto && item.projeto.toLowerCase().includes(termoBusca)) ||
                     (item.motivoDesfecho && item.motivoDesfecho.toLowerCase().includes(termoBusca)) ||
                     (item.desfecho && item.desfecho.toLowerCase().includes(termoBusca));
        }
        return mData && mEquipe && mSetor && mBusca;
    });

    listaSolicitacoesCombustivelAtuais = filtradosBase.filter(i => i.projeto === PROJETO_SOLIC_COMBUSTIVEL);
    listaSolicitacoesMaterialAtuais    = filtradosBase.filter(i => i.projeto === PROJETO_SOLIC_MATERIAL);
    renderizarTabelasSolicitacoesGestor();

    let listaImprevistos = filtradosBase.filter(i => i.projeto === 'IMPREVISTO / ATRASO' || i.desfecho === 'IMPREVISTO' || i.desfecho === 'IMPREVISTO RESOLVIDO');

    let filtrados = filtradosBase.filter(i => {
        if (i.projeto === 'IMPREVISTO / ATRASO' || i.projeto === PROJETO_SOLIC_COMBUSTIVEL || i.projeto === PROJETO_SOLIC_MATERIAL || i.desfecho === 'IMPREVISTO' || i.desfecho === 'IMPREVISTO RESOLVIDO') return false;
        const desfUpper = String(i.desfecho || '').toUpperCase().trim() === 'CONCLUÍDA' ? 'CONCLUIDA' : String(i.desfecho || '').toUpperCase().trim();
        let mMacro = filtrosMultiplosAtivos.macrogrupos.length > 0 ? filtrosMultiplosAtivos.macrogrupos.includes(obterMacroGrupoProjeto(i.projeto)) : true;
        let mProj = filtrosMultiplosAtivos.projetos.length > 0 ? filtrosMultiplosAtivos.projetos.includes(i.projeto) : (fProjeto ? i.projeto === fProjeto : true);
        let mDesf = filtrosMultiplosAtivos.desfechos.length > 0 ? filtrosMultiplosAtivos.desfechos.includes(desfUpper) : (fDesfecho ? desfUpper === fDesfecho : true);
        return mMacro && mProj && mDesf;
    });

    filtrados = enriquecerStatusMacroEBairro(filtrados);
    dadosFiltradosAtuais = filtrados;
    listaImprevistosAtuais = listaImprevistos;
    renderizarPainelDisponibilidade();

    const qtdEmAndamento = filtrados.filter(i => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(i.desfecho)).length;
    const qtdProgramadas = filtrados.filter(i => i.desfecho === 'PROGRAMADA').length;
    const imprevistosAbertos = listaImprevistos.filter(i => i.desfecho === 'IMPREVISTO').length;
    const podeEditar = usuarioPodeEditarGestor();

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setTxt('kpi-proj-andamento', qtdEmAndamento);
    setTxt('badge-aba-andamento', `${qtdEmAndamento} ativas`);
    setTxt('kpi-proj-imprevistos', listaImprevistos.length);
    setTxt('badge-aba-imprevistos', listaImprevistos.length);
    setTxt('contador-imprevistos', `${listaImprevistos.length} imprevisto(s) (${imprevistosAbertos} ativo(s))`);

    if (corpoImp) {
        if (listaImprevistos.length === 0) {
            corpoImp.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Nenhum imprevisto reportado no período.</td></tr>`;
        } else {
            listaImprevistos.forEach(imp => {
                const motivoPrincipal = (imp.malogros && imp.malogros.length > 0) ? imp.malogros.join(' + ') : "IMPREVISTO";
                const estaAberto = imp.desfecho === 'IMPREVISTO';
                const badgeSituacao = estaAberto ? `<span class="bg-red-100 text-red-800 border border-red-300 font-black px-2 py-0.5 rounded text-[10px]">🔴 EM ABERTO</span>` : `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">🟢 RESOLVIDO</span>`;
                let acoesImp = podeEditar
                    ? `${estaAberto ? `<button onclick="resolverImprevistoPorId(${imp.id}, true)" class="bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1 rounded mr-1">✅ Resolver</button>` : ''}<button onclick="abrirModalEdicao(${imp.id})" class="text-blue-600 font-bold text-[10px] bg-blue-50 border border-blue-200 px-2 py-1 rounded mr-1">✏️ Editar</button><button onclick="excluirRegistro(${imp.id}, 'IMPREVISTO')" class="text-red-500 font-bold text-[10px] bg-red-50 px-2 py-1 rounded">Excluir</button>`
                    : `<span class="text-slate-400 text-[10px]">Leitura</span>`;
                const linkGpsImp = (imp.gpsEntrada && imp.gpsEntrada.includes(','))
                    ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(imp.gpsEntrada)}" target="_blank" onclick="event.stopPropagation()" class="text-blue-600 underline font-bold">🗺️ ${imp.gpsEntrada}</a>`
                    : (imp.gpsEntrada || "-");
                const trImp = document.createElement('tr');
                trImp.className = "hover:bg-amber-50/50 border-b cursor-pointer";
                trImp.onclick = () => abrirDetalhesAtividade(imp);
                trImp.innerHTML = `<td class="p-3"><div class="font-bold text-slate-800">${imp.dataRegistro}</div><div class="text-[10px] font-mono text-slate-500">${imp.hEntrada} às ${imp.hSaida}</div></td><td class="p-3 font-bold text-blue-900">${imp.equipe}</td><td class="p-3"><span class="bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded text-[10px]">${motivoPrincipal}</span></td><td class="p-3">${badgeSituacao}</td><td class="p-3 text-slate-600">${imp.observacoes || imp.motivoDesfecho || "-"}</td><td class="p-3 font-mono text-[10px]">${linkGpsImp}</td><td class="p-3 whitespace-nowrap" onclick="event.stopPropagation()">${acoesImp}</td>`;
                corpoImp.appendChild(trImp);
            });
        }
    }

    const ehConcluida = (desf) => ['CONCLUIDA', 'CONCLUÍDA'].includes(String(desf || '').toUpperCase().trim());
    const finalizadas = filtrados.filter(i => !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(i.desfecho));

    setTxt('kpi-proj-vistoria', finalizadas.filter(i => i.servicoPlanilha === 'VISTORIA' && ehConcluida(i.desfecho)).length);
    setTxt('kpi-proj-const-f', finalizadas.filter(i => i.servicoPlanilha === 'CONSTRUÇÃO' && i.subgrupoFOuOnGoing === 'F' && ehConcluida(i.desfecho)).length);
    setTxt('kpi-proj-const-ongoing', finalizadas.filter(i => i.projeto === 'CONSTRUÇÃO ON GOING' && ehConcluida(i.desfecho)).length);
    setTxt('kpi-proj-const-nap', finalizadas.filter(i => i.projeto === 'CONSTRUÇÃO NAP LOTADA' && ehConcluida(i.desfecho)).length);
    setTxt('kpi-proj-ativ-f', finalizadas.filter(i => i.servicoPlanilha === 'ATIVAÇÃO' && i.subgrupoFOuOnGoing === 'F' && ehConcluida(i.desfecho)).length);
    setTxt('kpi-proj-ativ-ongoing', finalizadas.filter(i => i.projeto === 'ATIVAÇÃO ON GOING' && ehConcluida(i.desfecho)).length);
    setTxt('kpi-proj-ativ-nap', finalizadas.filter(i => i.projeto === 'ATIVAÇÃO NAP LOTADA' && ehConcluida(i.desfecho)).length);

    setTxt('contador-resultados', `${filtrados.length} registros (${qtdEmAndamento} ativas/pausa | ${qtdProgramadas} programadas)`);
    setTxt('contador-materiais', finalizadas.length + " registros finalizados");

    let concluidasCount = finalizadas.filter(i => ehConcluida(i.desfecho)).length;
    let malogradasCount = finalizadas.filter(i => i.desfecho === 'MALOGRADA').length;
    let pendentesCount = finalizadas.filter(i => i.desfecho === 'PENDENTE').length;

    setTxt('bonif-elegiveis', concluidasCount);
    setTxt('bonif-parciais', pendentesCount);
    setTxt('bonif-media-geral', finalizadas.length > 0 ? (concluidasCount / (new Set(finalizadas.map(i => i.dataRegistro)).size || 1)).toFixed(1) : "0.0");
    setTxt('bonif-malogros', malogradasCount);

    let sumCaboRL = 0, sumConectores = 0, sumCaboDrop = 0, sumNap = 0, sumDio = 0, sumFusoes = 0;
    let sumSobrepor = 0, sumEmbutida = 0, sumFosc = 0, sumVistorias = 0;

    finalizadas.forEach(i => {
        if (i.servicoPlanilha === 'VISTORIA' && ehConcluida(i.desfecho)) sumVistorias++;
        sumCaboRL += Number(i.caboRL) || 0;
        sumConectores += Number(i.conectores) || 0;
        sumCaboDrop += Number(i.caboDrop) || 0;
        sumNap += Number(i.nap) || 0;
        sumDio += Number(i.dio) || 0;
        sumFusoes += Number(i.fusoes) || 0;
        sumSobrepor += Number(i.cxSobrepor) || 0;
        sumEmbutida += Number(i.cxEmbutida) || 0;
        sumFosc += Number(i.cxFosc) || 0;
    });

    setTxt('total-cabo-rl', sumCaboRL + " m");
    setTxt('total-conectores', sumConectores);
    setTxt('total-cabo-drop', sumCaboDrop + " m");
    setTxt('total-nap', sumNap);
    setTxt('total-dio', sumDio);
    setTxt('total-fusoes', sumFusoes);
    setTxt('total-cx-sobrepor', sumSobrepor);
    setTxt('total-cx-embutida', sumEmbutida);
    setTxt('total-cx-fosc', sumFosc);

    totaisFinanceirosAtuais = { vistorias: sumVistorias, caboRL: sumCaboRL, conectores: sumConectores, fusoes: sumFusoes, caboDrop: sumCaboDrop, nap: sumNap, dio: sumDio, cxSobrepor: sumSobrepor, cxEmbutida: sumEmbutida, cxFosc: sumFosc };
    renderizarTabelaFinanceiro(totaisFinanceirosAtuais);

    if (filtrados.length === 0) {
        if (corpoAtiv) {
            const totalVisivel = (registrosSalvos || []).filter(r => r && !normalizarChaveNome(r.equipe).includes('AAAAAATESTE') && r.equipe !== "__CONFIG_SISTEMA__" && r.projeto !== "__CONFIG_AUDITORIA__" && registroPertenceAoUsuarioLogado(r, setFiscalRestrito)).length;
            const dicaFiltro = totalVisivel > 0
                ? `<div class="mt-2"><button type="button" onclick="aplicarAtalhoPeriodo('tudo')" class="bg-blue-900 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm">🔄 Mostrar Todos os ${totalVisivel} Registros do Histórico</button></div>`
                : '';
            corpoAtiv.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Nenhum registro encontrado para a data/filtro selecionado.${dicaFiltro}</td></tr>`;
        }
        if (corpoMat) corpoMat.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-slate-400">Nenhum material registrado no período.</td></tr>`;
    } else {
        const prioridadeStatus = { 'EM ANDAMENTO': 1, 'PARALISADA': 2, 'REABERTA': 3, 'PROGRAMADA': 4 };
        const filtradosOrdenados = [...filtrados].sort((a, b) => {
            const pA = prioridadeStatus[a.desfecho] || 5, pB = prioridadeStatus[b.desfecho] || 5;
            if (pA !== pB) return pA - pB;
            return b.id - a.id;
        });

        const mapaAgrupado = {};
        filtradosOrdenados.forEach(item => {
            let codigoBase = (item.imovel || "").trim();
            const idxTraco = codigoBase.toUpperCase().lastIndexOf(" - BLOCO");
            if (idxTraco !== -1) codigoBase = codigoBase.substring(0, idxTraco).trim();
            const ehAberta = ['EM ANDAMENTO', 'PARALISADA', 'REABERTA', 'PROGRAMADA'].includes(item.desfecho);
            const chaveAgrupamento = `${item.dataRegistro}_${item.equipe}_${codigoBase.toUpperCase()}_${item.projeto}_${ehAberta ? 'ABERTA' : 'FINALIZADA'}`;
            if (!mapaAgrupado[chaveAgrupamento]) {
                mapaAgrupado[chaveAgrupamento] = {
                    codigoBase, projeto: item.projeto, equipe: item.equipe, dataRegistro: item.dataRegistro,
                    endereco: item.endereco, liberouAcesso: item.liberouAcesso, hEntrada: item.hEntrada,
                    hSaida: item.hSaida, gpsEntrada: item.gpsEntrada, gpsSaida: item.gpsSaida, itens: []
                };
            }
            mapaAgrupado[chaveAgrupamento].itens.push(item);
        });

        Object.values(mapaAgrupado).forEach(grupo => {
            if (corpoAtiv) {
                const qtdBlocosNoGrupo = grupo.itens.length;
                const itemMaster = grupo.itens[0];
                const idGrupoUnico = `grupo_bloco_${Math.abs(stringParaHash(grupo.codigoBase + grupo.dataRegistro + grupo.equipe + grupo.projeto + itemMaster.id))}`;

                let desfechoExibicao = itemMaster.desfecho;
                if (qtdBlocosNoGrupo > 1) {
                    const desfechosUnicos = [...new Set(grupo.itens.map(i => i.desfecho))];
                    desfechoExibicao = desfechosUnicos.length === 1 ? desfechosUnicos[0] : "MÚLTIPLO";
                }

                const somaAndares = grupo.itens.reduce((acc, i) => acc + (Number(i.andares) || 0), 0);
                const somaHps = grupo.itens.reduce((acc, i) => acc + (Number(i.hps) || 0), 0);
                const somaTempoPausado = grupo.itens.reduce((acc, i) => acc + (Number(i.tempoPausadoMinutos) || 0), 0);
                const totalFotosGrupo = grupo.itens.reduce((acc, i) => acc + (Number(i.qtdFotos) || (Array.isArray(i.fotos) ? i.fotos.length : 0)), 0);
                const todasOpcoesGrupo = [...new Set(grupo.itens.flatMap(i => Array.isArray(i.malogros) ? i.malogros : []))];
                const todosApoiosGrupo = [...new Set(grupo.itens.flatMap(i => extrairApoiosDoRegistro(i)))];

                const badgeApoioHtml = todosApoiosGrupo.length > 0
                    ? `<div class="mt-1"><span class="bg-purple-100 text-purple-950 border border-purple-300 font-black px-2 py-0.5 rounded text-[9px] inline-block">🤝 CONJUNTA / APOIO: ${todosApoiosGrupo.join(', ')}</span></div>`
                    : '';

                const trPrincipal = document.createElement('tr');
                trPrincipal.className = (itemMaster.desfecho === 'EM ANDAMENTO' || itemMaster.desfecho === 'REABERTA')
                    ? "bg-blue-50/70 hover:bg-blue-100/60 border-b cursor-pointer transition"
                    : (itemMaster.desfecho === 'PARALISADA' ? "bg-orange-50/70 hover:bg-orange-100/60 border-b cursor-pointer transition" : (itemMaster.desfecho === 'PROGRAMADA' ? "bg-cyan-50/40 hover:bg-cyan-100/50 border-b cursor-pointer transition" : "hover:bg-blue-50/50 border-b cursor-pointer transition"));
                trPrincipal.onclick = () => abrirDetalhesAtividade(itemMaster);

                let botoesAcao = `<span class="text-slate-400 text-[10px] font-semibold">👁️ Visualização</span>`;
                if (podeEditar) {
                    const podeFinalizadasReabrir = ['CONCLUIDA', 'CONCLUÍDA', 'PENDENTE', 'MALOGRADA'].includes(itemMaster.desfecho);
                    const btnReabrir = podeFinalizadasReabrir ? `<button onclick="autorizarReaberturaCampo(${itemMaster.id})" class="text-purple-800 hover:bg-purple-200 font-bold text-[10px] bg-purple-100 border border-purple-300 px-2 py-1 rounded">🔓 Reabrir</button>` : '';
                    const btnMover = !podeFinalizadasReabrir ? `<button onclick="abrirModalTransferirAtividade(${itemMaster.id})" class="text-indigo-900 hover:bg-indigo-200 font-bold text-[10px] bg-indigo-100 border border-indigo-300 px-2 py-1 rounded">🔀 Mover</button>` : '';
                    const btnApoio = `<button onclick="abrirModalGerirApoioGestor(${itemMaster.id})" class="text-purple-950 hover:bg-purple-200 font-black text-[10px] bg-purple-100 border border-purple-300 px-2 py-1 rounded" title="Direcionar ou vincular técnico em apoio conjunto">🤝 Apoio</button>`;
                    botoesAcao = `<div class="flex flex-wrap gap-1">${btnApoio}${btnMover}${btnReabrir}<button onclick="abrirModalEdicao(${itemMaster.id})" class="text-blue-600 font-bold text-[10px] bg-blue-50 border border-blue-200 px-2 py-1 rounded">✏️ Editar</button><button onclick="excluirRegistro(${itemMaster.id}, '${itemMaster.imovel}')" class="text-red-500 font-bold text-[10px] bg-red-50 border border-red-200 px-2 py-1 rounded">Excluir</button></div>`;
                }

                const minIn = converterHorarioParaMinutos(grupo.hEntrada);
                const minOut = converterHorarioParaMinutos(grupo.hSaida);
                let duracaoStr = "-";
                if (minIn !== null && minOut !== null && minOut >= minIn) duracaoStr = formatarDuracaoTexto(Math.max(0, (minOut - minIn) - somaTempoPausado));
                else if (itemMaster.desfecho === 'EM ANDAMENTO') duracaoStr = '⏳ Em execução';
                else if (itemMaster.desfecho === 'PARALISADA') duracaoStr = '⏸️ Em pausa';
                else if (itemMaster.desfecho === 'REABERTA') duracaoStr = '🔄 Aguardando edição';
                else if (itemMaster.desfecho === 'PROGRAMADA') duracaoStr = `📋 Na fila (${itemMaster.qtdBlocosProgramados || 1} Bloco${(itemMaster.qtdBlocosProgramados || 1) > 1 ? 's' : ''})`;

                const badgePausaLinha = somaTempoPausado > 0 ? `<div class="text-[10px] text-orange-700 font-bold">⏸️ Pausa: ${somaTempoPausado} min</div>` : '';
                const infoLiberouLinha = grupo.liberouAcesso ? `<div class="text-[10px] text-amber-900 font-semibold truncate max-w-[200px]">🔑 Liberou: ${grupo.liberouAcesso}</div>` : '';
                const classeCorDesfecho = obterClasseCorDesfecho(desfechoExibicao);
                const eqObj = equipesSistema.find(e => normalizarChaveNome(e.nome) === normalizarChaveNome(grupo.equipe));
                const setorStr = eqObj ? eqObj.setor : "Instalador";
                const macroGrupo = obterMacroGrupoProjeto(grupo.projeto);
                const badgeGrupoCor = macroGrupo === 'PROJETO F' ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' : 'bg-cyan-50 text-cyan-900 border border-cyan-200';
                const tagsOpcoesHtml = todasOpcoesGrupo.length > 0 ? `<div class="mt-1 flex flex-wrap gap-1">${todasOpcoesGrupo.map(op => `<span class="text-[9px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">${op}</span>`).join('')}</div>` : '';

                // Badge de Fotos + Botão de Download em Lote direto na tabela
                const badgeFotosHtml = totalFotosGrupo > 0
                    ? `<span class="ml-1 bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold px-2 py-0.5 rounded-md text-[10px] inline-block">📷 ${totalFotosGrupo} foto(s)</span>
                       <button type="button" onclick="baixarTodasFotosPorIdAtividade(${itemMaster.id}, event, this)" title="Baixar todas as fotos desta atividade de uma só vez" class="ml-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-2 py-0.5 rounded-md text-[10px] inline-flex items-center gap-1 shadow-sm transition">⬇️ Baixar Todas</button>`
                    : '';

                const botaoExpandirBlocos = qtdBlocosNoGrupo > 1 ? `<button type="button" onclick="event.stopPropagation(); alternarVisualizacaoBlocosAgrupados('${idGrupoUnico}', this)" class="mt-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 transition">📂 Expandir Blocos (${qtdBlocosNoGrupo})</button>` : '';

                trPrincipal.innerHTML = `
                    <td class="p-3">
                        <div class="font-black text-slate-800">${qtdBlocosNoGrupo > 1 ? `${grupo.codigoBase} <span class="text-blue-700 font-bold text-[11px]">(${qtdBlocosNoGrupo} Blocos)</span>` : itemMaster.imovel}</div>
                        <div class="text-[10px] text-blue-900 font-medium truncate max-w-[200px]">📍 ${grupo.endereco || 'Endereço não informado'}</div>
                        ${infoLiberouLinha}
                        <div class="text-[10px] text-slate-400">${grupo.dataRegistro}</div>
                        ${botaoExpandirBlocos}
                    </td>
                    <td class="p-3"><div class="font-semibold text-slate-800 mb-0.5">${grupo.equipe}</div>${obterBadgeSetorHtml(setorStr)}${badgeApoioHtml}</td>
                    <td class="p-3"><div class="flex flex-wrap items-center gap-1"><span class="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[10px] inline-block">${grupo.projeto}</span><span class="font-bold px-1.5 py-0.5 rounded text-[9px] ${badgeGrupoCor}">${macroGrupo}</span></div><div class="text-[10px] text-slate-500 mt-1 font-semibold">🏢 Andares: <b>${somaAndares}</b> | HPs: <b>${somaHps}</b></div></td>
                    <td class="p-3"><div class="flex flex-wrap items-center gap-1"><span class="font-bold px-2.5 py-1 rounded-md text-[10px] inline-block ${classeCorDesfecho}">${desfechoExibicao}</span>${badgeFotosHtml}</div>${tagsOpcoesHtml}</td>
                    <td class="p-3"><div class="text-[11px]">🟢 Início: <b>${grupo.hEntrada}</b></div><div class="text-[11px]">🔴 Fim: <b>${grupo.hSaida}</b></div>${badgePausaLinha}<div class="text-[10px] text-emerald-700 font-bold mt-0.5">⏱️ ${duracaoStr}</div></td>
                    <td class="p-3 text-[10px] font-mono text-slate-600"><div>In: ${grupo.gpsEntrada}</div><div>Out: ${grupo.gpsSaida}</div></td>
                    <td class="p-3" onclick="event.stopPropagation()">${botoesAcao}</td>`;
                corpoAtiv.appendChild(trPrincipal);

                if (qtdBlocosNoGrupo > 1) {
                    const trDetalheBlocos = document.createElement('tr');
                    trDetalheBlocos.id = idGrupoUnico;
                    trDetalheBlocos.dataset.qtdBlocos = qtdBlocosNoGrupo;
                    trDetalheBlocos.className = "hidden bg-slate-100/90 border-b";

                    let cardsBlocosHtml = grupo.itens.map(blocoItem => {
                        const corDesfB = obterClasseCorDesfecho(blocoItem.desfecho);
                        const qtdFotosB = Number(blocoItem.qtdFotos) || (Array.isArray(blocoItem.fotos) ? blocoItem.fotos.length : 0);
                        const acoesIndividuais = podeEditar ? `<div class="flex flex-wrap gap-1 pt-2 border-t border-slate-200 mt-1.5" onclick="event.stopPropagation()"><button onclick="abrirModalGerirApoioGestor(${blocoItem.id})" class="bg-purple-100 text-purple-950 border border-purple-300 font-bold text-[9px] px-2 py-0.5 rounded">🤝 Apoio</button>${['CONCLUIDA', 'CONCLUÍDA', 'PENDENTE', 'MALOGRADA'].includes(blocoItem.desfecho) ? `<button onclick="autorizarReaberturaCampo(${blocoItem.id})" class="bg-purple-100 text-purple-900 border border-purple-300 font-bold text-[9px] px-2 py-0.5 rounded">🔓 Reabrir</button>` : `<button onclick="abrirModalTransferirAtividade(${blocoItem.id})" class="bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-[9px] px-2 py-0.5 rounded">🔀 Mover</button>`}<button onclick="abrirModalEdicao(${blocoItem.id})" class="bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[9px] px-2 py-0.5 rounded">✏️ Editar</button><button onclick="excluirRegistro(${blocoItem.id}, '${blocoItem.imovel}')" class="bg-red-50 text-red-600 border border-red-200 font-bold text-[9px] px-2 py-0.5 rounded">🗑️ Excluir</button></div>` : '';
                        return `<div class="card-bloco-interno bg-white p-3 rounded-xl border border-blue-200 shadow-sm space-y-1 cursor-pointer hover:border-blue-500 transition" onclick="abrirDetalhesAtividade(registrosSalvos.find(r => r.id === ${blocoItem.id}))"><div class="flex justify-between items-center gap-1"><span class="font-black text-blue-950 text-xs">🏢 ${blocoItem.imovel}</span><span class="px-2 py-0.5 rounded text-[9px] font-bold ${corDesfB}">${blocoItem.desfecho}</span></div><div class="text-[10px] text-slate-600 font-semibold">Andares: <b>${blocoItem.andares || 0}</b> | HPs: <b>${blocoItem.hps || 0}</b> ${qtdFotosB > 0 ? `| 📷 <b>${qtdFotosB} foto(s)</b>` : ''}</div><div class="text-[10px] text-slate-500">📦 RL: <b>${blocoItem.caboRL}m</b> | Drop: <b>${blocoItem.caboDrop}m</b> | Conect: <b>${blocoItem.conectores}</b> | Fusões: <b>${blocoItem.fusoes}</b> | NAP: <b>${blocoItem.nap}</b> | DIO: <b>${blocoItem.dio}</b></div>${blocoItem.motivoDesfecho ? `<div class="text-[10px] text-amber-900 bg-amber-50 px-2 py-1 rounded">💬 ${blocoItem.motivoDesfecho}</div>` : ''}${acoesIndividuais}</div>`;
                    }).join('');

                    trDetalheBlocos.innerHTML = `<td colspan="7" class="p-3 pl-6"><div class="bg-blue-50/60 p-3 rounded-xl border border-blue-200 space-y-2"><div class="flex justify-between items-center border-b border-blue-200 pb-1.5"><span class="font-black text-blue-950 text-xs uppercase">📂 Detalhamento Individual dos ${qtdBlocosNoGrupo} Blocos do Imóvel ${grupo.codigoBase}</span><span class="text-[10px] text-blue-800">Clique em qualquer bloco para abrir detalhes e fotos</span></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">${cardsBlocosHtml}</div></div></td>`;
                    corpoAtiv.appendChild(trDetalheBlocos);
                }
            }

            grupo.itens.forEach(item => {
                if (!['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(item.desfecho) && corpoMat) {
                    const apMat = extrairApoiosDoRegistro(item);
                    const trMat = document.createElement('tr');
                    trMat.className = "hover:bg-slate-50 border-b transition";
                    trMat.innerHTML = `<td class="p-2.5 font-bold text-slate-800">${item.imovel}<div class="text-[9px] text-slate-400 font-normal">${item.dataRegistro}</div></td><td class="p-2.5">${item.equipe}${apMat.length > 0 ? `<div class="text-[9px] font-bold text-purple-800">🤝 c/ ${apMat.join(', ')}</div>` : ''}<div class="text-[9px] text-blue-900">${item.projeto}</div></td><td class="p-2.5 font-semibold">${item.caboRL} m</td><td class="p-2.5 font-semibold">${item.conectores}</td><td class="p-2.5 font-semibold">${item.caboDrop} m</td><td class="p-2.5 font-bold text-blue-900">${item.nap}</td><td class="p-2.5 font-bold text-indigo-700">${item.dio}</td><td class="p-2.5 font-bold text-amber-700">${item.cxSobrepor}</td><td class="p-2.5 font-bold text-orange-700">${item.cxEmbutida}</td><td class="p-2.5 font-bold text-purple-700">${item.cxFosc}</td><td class="p-2.5 font-semibold">${item.fusoes}</td>`;
                    corpoMat.appendChild(trMat);
                }
            });
        });
    }

    try { renderizarAbaGraficosCompletaOficial(); } catch (e) { console.warn("Erro na aba gráficos:", e); }
    try { renderizarTabelaUsuariosPermissao(); } catch (e) {}
}

// ================= EDIÇÃO DE REGISTRO, DETALHES, FINANCEIRO, EQUIPES E NAVEGAÇÃO =================
function lerCheckboxesAtuaisModalEdicao() {
    const checks = document.querySelectorAll('input[name="chk-opcao-modal-edicao"]:checked');
    if (checks.length > 0) opcoesMarcadasEdicaoTemporarias = Array.from(checks).map(c => c.value);
}

function aoMudarDesfechoModalEdicao() {
    lerCheckboxesAtuaisModalEdicao();
    renderizarOpcoesCheckboxesModalEdicao(document.getElementById('edit-reg-desfecho')?.value || 'CONCLUIDA', opcoesMarcadasEdicaoTemporarias);
}

function renderizarOpcoesCheckboxesModalEdicao(desfechoAlvo, selecionadas = []) {
    const container = document.getElementById('container-checkboxes-edicao');
    if (!container) return;
    let opcoesBase = desfechoAlvo === 'PENDENTE' ? [...OPCOES_PENDENCIA_PADRAO] : (desfechoAlvo === 'MALOGRADA' ? [...OPCOES_MALOGRO_PADRAO] : ((desfechoAlvo === 'IMPREVISTO' || desfechoAlvo === 'IMPREVISTO RESOLVIDO') ? [...OPCOES_IMPREVISTO_PADRAO] : [...OPCOES_CONCLUIDA_PADRAO]));
    (selecionadas || []).forEach(op => { const limpo = String(op).trim().toUpperCase(); if (limpo && !opcoesBase.includes(limpo)) opcoesBase.push(limpo); });
    const setSelecionadas = new Set((selecionadas || []).map(s => String(s).trim().toUpperCase()));
    container.innerHTML = opcoesBase.map(op => `<label class="flex items-center gap-1.5 font-semibold text-slate-700 hover:bg-amber-50 p-1 rounded cursor-pointer"><input type="checkbox" name="chk-opcao-modal-edicao" value="${op}" ${setSelecionadas.has(op.toUpperCase()) ? 'checked' : ''} class="w-4 h-4 accent-blue-900 rounded"><span class="text-[11px]">${op}</span></label>`).join('');
}

async function incluirOpcaoCustomizadaNoModalEdicao() {
    const inp = document.getElementById('inp-nova-opcao-rapida-edicao');
    if (!inp || !inp.value.trim()) return;
    const novaOp = inp.value.trim().toUpperCase();
    const checksAtuais = document.querySelectorAll('input[name="chk-opcao-modal-edicao"]:checked');
    opcoesMarcadasEdicaoTemporarias = Array.from(checksAtuais).map(c => c.value);
    if (!opcoesMarcadasEdicaoTemporarias.includes(novaOp)) opcoesMarcadasEdicaoTemporarias.push(novaOp);
    inp.value = "";
    renderizarOpcoesCheckboxesModalEdicao(document.getElementById('edit-reg-desfecho')?.value || 'CONCLUIDA', opcoesMarcadasEdicaoTemporarias);
}

function renderizarFotosModalEdicao() {
    const container = document.getElementById('container-fotos-modal-edicao');
    const lblQtd = document.getElementById('lbl-qtd-fotos-edicao');
    if (!container) return;
    if (lblQtd) lblQtd.innerText = fotosEdicaoTemporarias.length;
    if (fotosEdicaoTemporarias.length === 0) { container.innerHTML = `<span class="text-[11px] text-slate-400 italic">Nenhuma foto anexada.</span>`; return; }
    container.innerHTML = fotosEdicaoTemporarias.map((fSrc, idx) => `<div class="relative border border-slate-300 rounded-lg overflow-hidden w-16 h-16 bg-white shadow-sm"><img src="${fSrc}" onclick="abrirZoomFoto('${fSrc}', 'Foto_${idx + 1}.jpg')" class="w-full h-full object-cover cursor-pointer"><button type="button" onclick="removerFotoModalEdicao(${idx})" class="absolute top-0.5 right-0.5 bg-red-600 text-white text-[9px] font-bold w-4 h-4 rounded-full">✕</button></div>`).join('');
}

async function adicionarFotosNoModalEdicao(inputEl) {
    const arquivos = Array.from(inputEl.files || []);
    if (fotosEdicaoTemporarias.length + arquivos.length > 10) { alert("⚠️ Máximo de 10 fotos."); return; }
    for (const arq of arquivos) { try { fotosEdicaoTemporarias.push(await comprimirImagemBase64(arq, 780, 0.60)); } catch (e) {} }
    inputEl.value = "";
    renderizarFotosModalEdicao();
}

function removerFotoModalEdicao(idx) { fotosEdicaoTemporarias.splice(idx, 1); renderizarFotosModalEdicao(); }

async function abrirModalEdicao(id) {
    if (!usuarioPodeEditarGestor()) return;
    let reg = registrosSalvos.find(r => r.id === id);
    if (!reg) return;
    popularSelectProjetosGlobal();
    inicializarMelhoriasVisuaisGestor();

    snapshotStatusEdicaoOriginal = { id: reg.id, desfecho: reg.desfecho, hSaida: reg.hSaida, equipe: reg.equipe };
    document.getElementById('edit-reg-id').value = reg.id;
    document.getElementById('edit-reg-data').value = reg.dataRegistro || obterDataLocalISO();

    const selEqEdit = document.getElementById('edit-reg-equipe');
    if (selEqEdit) {
        const nomesEquipes = equipesSistema.map(e => e.nome);
        if (reg.equipe && !nomesEquipes.includes(reg.equipe)) nomesEquipes.unshift(reg.equipe);
        selEqEdit.innerHTML = nomesEquipes.map(nome => `<option value="${nome}">${nome}</option>`).join('');
        selEqEdit.value = reg.equipe || "";
    }

    const inpApoioEdit = document.getElementById('edit-reg-apoio-conjunto');
    if (inpApoioEdit) {
        inpApoioEdit.value = extrairApoiosDoRegistro(reg).join(', ');
    }

    document.getElementById('edit-reg-imovel').value = reg.imovel || '';
    document.getElementById('edit-reg-endereco').value = reg.endereco || '';
    document.getElementById('edit-reg-liberou-acesso').value = reg.liberouAcesso || '';
    document.getElementById('edit-reg-responsavel').value = reg.responsavel || '';
    document.getElementById('edit-reg-contato').value = reg.contato || '';
    document.getElementById('edit-reg-email').value = reg.email || '';
    document.getElementById('edit-reg-projeto').value = reg.projeto || 'CONSTRUÇÃO ON GOING';
    document.getElementById('edit-reg-desfecho').value = reg.desfecho || 'CONCLUIDA';
    document.getElementById('edit-reg-h-entrada').value = reg.hEntrada || '';
    document.getElementById('edit-reg-h-saida').value = reg.hSaida || '';
    document.getElementById('edit-reg-pausa').value = Number(reg.tempoPausadoMinutos) || 0;
    document.getElementById('edit-reg-gps-entrada').value = reg.gpsEntrada || '';
    document.getElementById('edit-reg-gps-saida').value = reg.gpsSaida || '';
    document.getElementById('edit-reg-servico-obra').value = reg.servicoObra || 'SIM';
    document.getElementById('edit-reg-andares').value = reg.andares || 0;
    document.getElementById('edit-reg-hps').value = reg.hps || 0;
    document.getElementById('edit-reg-cabo-rl').value = reg.caboRL || 0;
    document.getElementById('edit-reg-conectores').value = reg.conectores || 0;
    document.getElementById('edit-reg-cabo-drop').value = reg.caboDrop || 0;
    document.getElementById('edit-reg-nap').value = reg.nap || 0;
    document.getElementById('edit-reg-dio').value = reg.dio || 0;
    document.getElementById('edit-reg-fusoes').value = reg.fusoes || 0;
    document.getElementById('edit-reg-cx-sobrepor').value = reg.cxSobrepor || 0;
    document.getElementById('edit-reg-cx-embutida').value = reg.cxEmbutida || 0;
    document.getElementById('edit-reg-cx-fosc').value = reg.cxFosc || 0;
    document.getElementById('edit-reg-motivo-desfecho').value = reg.motivoDesfecho || '';
    document.getElementById('edit-reg-observacoes').value = reg.observacoes || '';

    opcoesMarcadasEdicaoTemporarias = Array.isArray(reg.malogros) ? [...reg.malogros] : [];
    renderizarOpcoesCheckboxesModalEdicao(reg.desfecho, opcoesMarcadasEdicaoTemporarias);
    document.getElementById('modal-edicao').classList.remove('hidden');

    let fotosAtuais = Array.isArray(reg.fotos) ? [...reg.fotos] : [];
    if (fotosAtuais.length === 0 && typeof obterFotosSobDemandaDoRegistro === 'function') {
        fotosAtuais = await obterFotosSobDemandaDoRegistro(reg.id);
    }
    fotosEdicaoTemporarias = [...fotosAtuais];
    renderizarFotosModalEdicao();
}

function fecharModalEdicao() { document.getElementById('modal-edicao').classList.add('hidden'); }

async function salvarEdicaoRegistro() {
    let id = Number(document.getElementById('edit-reg-id').value);
    let regOriginal = registrosSalvos.find(r => r.id === id);

    const btnSalvar = document.getElementById('btn-salvar-modal-edicao');
    if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.innerText = "🛡️ Verificando conflitos e salvando..."; }

    try {
        const { data: versaoNuvem } = await supabaseClient.from('registros_producao').select('desfecho, h_saida, equipe').eq('id', id).maybeSingle();
        if (versaoNuvem && snapshotStatusEdicaoOriginal && snapshotStatusEdicaoOriginal.id === id && (versaoNuvem.desfecho !== snapshotStatusEdicaoOriginal.desfecho || versaoNuvem.h_saida !== snapshotStatusEdicaoOriginal.hSaida)) {
            if (!confirm(`🛡️ TRAVA ANTI-CONFLITO!\n\nEste registro foi atualizado na nuvem enquanto a janela estava aberta (${versaoNuvem.desfecho}). Deseja sobrescrever mesmo assim?`)) {
                if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.innerText = "💾 Salvar Todas as Alterações"; }
                fecharModalEdicao();
                await recarregarDadosGestor(false);
                return;
            }
        }
    } catch (e) {}

    let data_registro = document.getElementById('edit-reg-data').value || obterDataLocalISO();
    let equipe = document.getElementById('edit-reg-equipe').value || '';
    const strApoioDigitado = document.getElementById('edit-reg-apoio-conjunto')?.value || '';
    const arrApoios = strApoioDigitado.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const membrosFinal = formatarCampoMembrosComApoio(equipe, arrApoios);

    let imovel = document.getElementById('edit-reg-imovel').value.trim();
    let endereco = document.getElementById('edit-reg-endereco').value.trim();
    let liberouAcesso = document.getElementById('edit-reg-liberou-acesso').value.trim();
    let responsavel = document.getElementById('edit-reg-responsavel').value.trim();
    let contato = document.getElementById('edit-reg-contato').value.trim();
    let email = document.getElementById('edit-reg-email').value.trim();
    let projeto = document.getElementById('edit-reg-projeto').value;
    let desfecho = document.getElementById('edit-reg-desfecho').value;
    let h_entrada = document.getElementById('edit-reg-h-entrada').value.trim();
    let h_saida = document.getElementById('edit-reg-h-saida').value.trim();
    let pausaMin = Number(document.getElementById('edit-reg-pausa').value) || 0;
    let gps_entrada = document.getElementById('edit-reg-gps-entrada').value.trim();
    let gps_saida = document.getElementById('edit-reg-gps-saida').value.trim();
    let servico_obra = document.getElementById('edit-reg-servico-obra').value || 'SIM';
    let andares = Number(document.getElementById('edit-reg-andares').value) || 0;
    let hps = Number(document.getElementById('edit-reg-hps').value) || 0;
    let cabo_rl = Number(document.getElementById('edit-reg-cabo-rl').value) || 0;
    let conectores = Number(document.getElementById('edit-reg-conectores').value) || 0;
    let cabo_drop = Number(document.getElementById('edit-reg-cabo-drop').value) || 0;
    let nap = Number(document.getElementById('edit-reg-nap').value) || 0;
    let dio = Number(document.getElementById('edit-reg-dio').value) || 0;
    let fusoes = Number(document.getElementById('edit-reg-fusoes').value) || 0;
    let cx_sobrepor = Number(document.getElementById('edit-reg-cx-sobrepor').value) || 0;
    let cx_embutida = Number(document.getElementById('edit-reg-cx-embutida').value) || 0;
    let cx_fosc = Number(document.getElementById('edit-reg-cx-fosc').value) || 0;
    let motivo_desfecho = document.getElementById('edit-reg-motivo-desfecho').value.trim();
    let obsLimpa = document.getElementById('edit-reg-observacoes').value.trim();

    const listaMalogrosOpcoes = Array.from(document.querySelectorAll('input[name="chk-opcao-modal-edicao"]:checked')).map(c => c.value);
    let obsComTagsEFotos = `${endereco ? `[END: ${endereco}] ` : ''}${liberouAcesso ? `[LIBEROU_ACESSO: ${liberouAcesso}] ` : ''}${pausaMin > 0 ? `[PAUSA_TOTAL: ${pausaMin}] ` : ''}${obsLimpa}${(fotosEdicaoTemporarias && fotosEdicaoTemporarias.length > 0) ? ` [FOTOS:${JSON.stringify(fotosEdicaoTemporarias)}]` : ''}`.trim();

    const { error } = await supabaseClient.from('registros_producao').update({
        data_registro, equipe, membros: membrosFinal, imovel, projeto, desfecho, h_entrada, h_saida,
        gps_entrada, gps_saida, responsavel, contato, email, servico_obra, motivo_desfecho,
        malogros: listaMalogrosOpcoes, andares, hps, observacoes: obsComTagsEFotos,
        cabo_rl, conectores, cabo_drop, nap, dio, fusoes, cx_sobrepor, cx_embutida, cx_fosc
    }).eq('id', id);

    if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.innerText = "💾 Salvar Todas as Alterações"; }
    if (error) { alert("Erro: " + error.message); return; }
    if (regOriginal) {
        Object.assign(regOriginal, {
            dataRegistro: data_registro, equipe, membros: membrosFinal, imovel, endereco, liberouAcesso, responsavel,
            contato, email, projeto, desfecho, hEntrada: h_entrada, hSaida: h_saida, tempoPausadoMinutos: pausaMin,
            gpsEntrada: gps_entrada, gpsSaida: gps_saida, servicoObra: servico_obra, motivoDesfecho: motivo_desfecho,
            malogros: listaMalogrosOpcoes, andares, hps, observacoes: obsLimpa, fotos: [...fotosEdicaoTemporarias],
            qtdFotos: fotosEdicaoTemporarias.length, caboRL: cabo_rl, conectores, caboDrop: cabo_drop, nap, dio,
            fusoes, cxSobrepor: cx_sobrepor, cxEmbutida: cx_embutida, cxFosc: cx_fosc
        });
    }
    fecharModalEdicao();
    atualizarDashboardGestor();
    registrarLogAuditoria("EDIÇÃO DE REGISTRO", `Imóvel ${imovel} atualizado.`);
}

async function excluirRegistro(id, imovelCod) {
    if (!usuarioPodeEditarGestor()) return;
    if (confirm(`Deseja excluir o registro "${imovelCod}"?`)) {
        const { error } = await supabaseClient.from('registros_producao').delete().eq('id', id);
        if (!error) {
            if (typeof cacheFotosSobDemanda !== 'undefined') cacheFotosSobDemanda.delete(id);
            if (typeof reciclarContagemBytesFotos === 'function') reciclarContagemBytesFotos();
            registrosSalvos = registrosSalvos.filter(r => r.id !== id);
            atualizarDashboardGestor();
            registrarLogAuditoria("EXCLUSÃO DE REGISTRO", `Registro ${imovelCod} (ID: ${id}) excluído.`);
        }
    }
}

function renderizarTabelaFinanceiro(totais) {
    const corpo = document.getElementById('tabela-financeiro-corpo');
    const spanTotalGeral = document.getElementById('fin-total-geral');
    if (!corpo) return;
    corpo.innerHTML = "";
    let itensMedicao = [
        { chave: "VISTORIA", qtd: totais.vistorias }, { chave: "CABO RL", qtd: totais.caboRL },
        { chave: "CONECTORES", qtd: totais.conectores }, { chave: "FUSÕES", qtd: totais.fusoes },
        { chave: "CABO DROP", qtd: totais.caboDrop }, { chave: "NAP", qtd: totais.nap },
        { chave: "DIO", qtd: totais.dio }, { chave: "CX SOBREPOR", qtd: totais.cxSobrepor },
        { chave: "CX EMBUTIDA", qtd: totais.cxEmbutida }
    ];
    let valorGeralAcumulado = 0;
    itensMedicao.forEach(item => {
        let cfg = TABELA_PRECOS[item.chave];
        let totalItem = item.qtd * cfg.valor;
        valorGeralAcumulado += totalItem;
        corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3 font-mono font-bold text-slate-700">${cfg.codigo}</td><td class="p-3 font-semibold text-slate-800">${cfg.desc}</td><td class="p-3 text-slate-600">${cfg.unidade}</td><td class="p-3 text-center font-bold text-blue-900">${item.qtd.toLocaleString('pt-BR')}</td><td class="p-3 text-right text-slate-600">R$ ${cfg.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td><td class="p-3 text-right font-black text-emerald-700">R$ ${totalItem.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>`;
    });
    if (spanTotalGeral) spanTotalGeral.innerText = `R$ ${valorGeralAcumulado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}

function exportarExcelFinanceiro() {
    if (!totaisFinanceirosAtuais) return;
    let itensMedicao = [
        { chave: "VISTORIA", qtd: totaisFinanceirosAtuais.vistorias }, { chave: "CABO RL", qtd: totaisFinanceirosAtuais.caboRL },
        { chave: "CONECTORES", qtd: totaisFinanceirosAtuais.conectores }, { chave: "FUSÕES", qtd: totaisFinanceirosAtuais.fusoes },
        { chave: "CABO DROP", qtd: totaisFinanceirosAtuais.caboDrop }, { chave: "NAP", qtd: totaisFinanceirosAtuais.nap },
        { chave: "DIO", qtd: totaisFinanceirosAtuais.dio }, { chave: "CX SOBREPOR", qtd: totaisFinanceirosAtuais.cxSobrepor },
        { chave: "CX EMBUTIDA", qtd: totaisFinanceirosAtuais.cxEmbutida }
    ];
    let valorGeral = 0;
    let tabelaHTML = `<table border="1"><thead><tr><th>Código</th><th>Descrição do Item</th><th>Unidade</th><th>Qtd. Produzida</th><th>Valor Unitário (R$)</th><th>Total (R$)</th></tr></thead><tbody>`;
    itensMedicao.forEach(item => {
        let cfg = TABELA_PRECOS[item.chave];
        let totalItem = item.qtd * cfg.valor;
        valorGeral += totalItem;
        tabelaHTML += `<tr><td>${cfg.codigo}</td><td>${cfg.desc}</td><td>${cfg.unidade}</td><td>${item.qtd}</td><td>R$ ${cfg.valor.toFixed(2).replace('.', ',')}</td><td>R$ ${totalItem.toFixed(2).replace('.', ',')}</td></tr>`;
    });
    tabelaHTML += `<tr><td colspan="5"><b>VALOR TOTAL DA MEDIÇÃO</b></td><td><b>R$ ${valorGeral.toFixed(2).replace('.', ',')}</b></td></tr></tbody></table>`;

    let blob = new Blob(['\ufeff' + tabelaHTML], { type: 'application/vnd.ms-excel' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url; a.download = `medicao_financeira_mdu_${obterDataLocalISO()}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function renderizarTabelaUsuariosPermissao() {
    garantirPermissaoOperadorEBaptista();
    const corpo = document.getElementById('tabela-usuarios-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";
    const ehMaster = usuarioEhMasterGestor();
    let listaVisivel = !ehMaster
        ? (usuariosSistema || []).filter(u => String(u.email || '').toLowerCase() === String(usuarioLogado || '').toLowerCase())
        : (usuariosSistema || []);
    listaVisivel.forEach(u => {
        let acoesHtml = `<button onclick="abrirModalUsuario(${u.id})" class="bg-blue-50 text-blue-700 font-bold text-[10px] px-2.5 py-1 rounded">✏️ Editar / Senha</button>`;
        if (ehMaster) acoesHtml += ` <button onclick="excluirUsuario(${u.id}, '${u.email}')" class="bg-red-50 text-red-600 font-bold text-[10px] px-2.5 py-1 rounded">🗑️ Excluir</button>`;
        corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3"><div class="font-bold">${u.nome}</div><div class="text-[10px] text-slate-400">${u.email}</div></td><td class="p-3"><span class="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px]">${u.nivel}</span></td><td class="p-3"><span class="text-emerald-600 font-semibold">${u.status}</span></td><td class="p-3">${acoesHtml}</td></tr>`;
    });
}

async function abrirDetalhesAtividade(item) {
    if (!item) return;
    const modal = document.getElementById('modal-detalhes');
    const conteudo = document.getElementById('modal-detalhes-conteudo');

    const codBase = obterCodigoBaseImovel(item.imovel);
    const ehObraNormal = item.projeto !== 'IMPREVISTO / ATRASO' &&
                         item.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
                         item.projeto !== PROJETO_SOLIC_MATERIAL;

    let blocosIrmaos = [item];
    if (ehObraNormal && codBase) {
        const encontrados = (registrosSalvos || []).filter(r =>
            r.dataRegistro === item.dataRegistro &&
            r.equipe === item.equipe &&
            r.projeto === item.projeto &&
            obterCodigoBaseImovel(r.imovel) === codBase
        ).sort((a, b) => (a.imovel || '').localeCompare(b.imovel || ''));
        if (encontrados.length > 0) blocosIrmaos = encontrados;
    }

    // Busca sob demanda na nuvem as observações e fotos de todos os blocos irmãos
    if (typeof supabaseClient !== 'undefined') {
        try {
            const idsBuscar = blocosIrmaos.map(b => b.id);
            const { data: rowsCompleta } = await supabaseClient
                .from('registros_producao')
                .select('id, observacoes')
                .in('id', idsBuscar);

            if (Array.isArray(rowsCompleta)) {
                rowsCompleta.forEach(row => {
                    const alvo = blocosIrmaos.find(r => r.id === row.id);
                    if (alvo && row.observacoes) {
                        const obsBruta = row.observacoes;
                        const mEnd = obsBruta.match(/\[END:\s*([^\]]+)\]/i);
                        if (mEnd && mEnd[1]) alvo.endereco = mEnd[1].trim();
                        const mLib = obsBruta.match(/\[LIBEROU_ACESSO:\s*([^\]]+)\]/i);
                        if (mLib && mLib[1]) alvo.liberouAcesso = mLib[1].trim();
                        const mPausa = obsBruta.match(/\[PAUSA_TOTAL:\s*(\d+)\]/i);
                        if (mPausa && mPausa[1]) alvo.tempoPausadoMinutos = Number(mPausa[1]) || 0;
                        const mFotos = obsBruta.match(/\[FOTOS:(\[.*?\])\]/);
                        if (mFotos && mFotos[1]) {
                            try {
                                const arrF = JSON.parse(mFotos[1]);
                                if (Array.isArray(arrF)) {
                                    alvo.fotos = arrF;
                                    alvo.qtdFotos = arrF.length;
                                    if (typeof cacheFotosSobDemanda !== 'undefined') cacheFotosSobDemanda.set(alvo.id, arrF);
                                }
                            } catch (e) {}
                        }
                    }
                });
            }
        } catch (e) {}
    }

    const temMultiplosBlocos = blocosIrmaos.length > 1;
    document.getElementById('modal-detalhes-titulo').innerText = temMultiplosBlocos
        ? `Detalhes do Imóvel: ${codBase} (${blocosIrmaos.length} Blocos)`
        : `Detalhes do Registro: ${item.imovel}`;

    let todasFotosAcumuladas = [];
    const blocosDetalhadosParaWhats = [];

    for (let idx = 0; idx < blocosIrmaos.length; idx++) {
        const b = blocosIrmaos[idx];
        let fBloco = Array.isArray(b.fotos) ? [...b.fotos] : [];
        if (fBloco.length === 0 && typeof obterFotosSobDemandaDoRegistro === 'function') {
            fBloco = await obterFotosSobDemandaDoRegistro(b.id);
        }
        b._fotosCarregadas = fBloco;
        todasFotosAcumuladas.push(...fBloco);

        let identNome = b.imovel || `BLOCO ${idx + 1}`;
        const posTraco = identNome.toUpperCase().lastIndexOf(' - ');
        if (posTraco !== -1) identNome = identNome.substring(posTraco + 3).trim();

        blocosDetalhadosParaWhats.push({
            identificacao: identNome,
            andares: Number(b.andares) || 0,
            hps: Number(b.hps) || 0,
            desfecho: b.desfecho,
            fusoes: Number(b.fusoes) || 0,
            conectores: Number(b.conectores) || 0,
            caboRL: Number(b.caboRL) || 0,
            caboDrop: Number(b.caboDrop) || 0,
            nap: Number(b.nap) || 0,
            dio: Number(b.dio) || 0,
            cxSobrepor: Number(b.cxSobrepor) || 0,
            cxEmbutida: Number(b.cxEmbutida) || 0,
            cxFosc: Number(b.cxFosc) || 0,
            opcoesMarcadas: Array.isArray(b.malogros) ? b.malogros : [],
            motivoDesfecho: b.motivoDesfecho || '',
            observacoes: b.observacoes || '',
            fotos: fBloco
        });
    }

    const somaAndares = blocosIrmaos.reduce((acc, b) => acc + (Number(b.andares) || 0), 0);
    const somaHps = blocosIrmaos.reduce((acc, b) => acc + (Number(b.hps) || 0), 0);
    const somaRL = blocosIrmaos.reduce((acc, b) => acc + (Number(b.caboRL) || 0), 0);
    const somaDrop = blocosIrmaos.reduce((acc, b) => acc + (Number(b.caboDrop) || 0), 0);
    const somaConect = blocosIrmaos.reduce((acc, b) => acc + (Number(b.conectores) || 0), 0);
    const somaFusoes = blocosIrmaos.reduce((acc, b) => acc + (Number(b.fusoes) || 0), 0);
    const somaNap = blocosIrmaos.reduce((acc, b) => acc + (Number(b.nap) || 0), 0);
    const somaDio = blocosIrmaos.reduce((acc, b) => acc + (Number(b.dio) || 0), 0);
    const somaSobrepor = blocosIrmaos.reduce((acc, b) => acc + (Number(b.cxSobrepor) || 0), 0);
    const somaEmbutida = blocosIrmaos.reduce((acc, b) => acc + (Number(b.cxEmbutida) || 0), 0);
    const somaFosc = blocosIrmaos.reduce((acc, b) => acc + (Number(b.cxFosc) || 0), 0);
    const pausaMin = blocosIrmaos.reduce((acc, b) => acc + (Number(b.tempoPausadoMinutos) || 0), 0);
    const apoiosImovel = [...new Set(blocosIrmaos.flatMap(b => extrairApoiosDoRegistro(b)))];

    itemDetalheAtualModal = {
        ...item,
        imovel: temMultiplosBlocos ? `${codBase} (${blocosIrmaos.length} Blocos)` : item.imovel,
        equipe: apoiosImovel.length > 0 ? `${item.equipe} (🤝 Apoio: ${apoiosImovel.join(', ')})` : item.equipe,
        andares: somaAndares,
        hps: somaHps,
        tempoPausadoMinutos: pausaMin,
        caboRL: somaRL,
        caboDrop: somaDrop,
        conectores: somaConect,
        fusoes: somaFusoes,
        nap: somaNap,
        dio: somaDio,
        cxSobrepor: somaSobrepor,
        cxEmbutida: somaEmbutida,
        cxFosc: somaFosc,
        fotos: todasFotosAcumuladas,
        blocosDetalhados: temMultiplosBlocos ? blocosDetalhadosParaWhats : []
    };

    const linkGpsEntrada = (item.gpsEntrada && item.gpsEntrada.includes(','))
        ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.gpsEntrada)}" target="_blank" class="text-blue-600 underline font-bold hover:text-blue-800">🗺️ ${item.gpsEntrada} (Abrir no Maps)</a>`
        : (item.gpsEntrada || '-');

    const linkGpsSaida = (item.gpsSaida && item.gpsSaida.includes(','))
        ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.gpsSaida)}" target="_blank" class="text-blue-600 underline font-bold hover:text-blue-800">🗺️ ${item.gpsSaida} (Abrir no Maps)</a>`
        : (item.gpsSaida || '-');

    const minIn = converterHorarioParaMinutos(item.hEntrada);
    const minOut = converterHorarioParaMinutos(item.hSaida);
    const duracaoStr = (minIn !== null && minOut !== null && minOut >= minIn)
        ? formatarDuracaoTexto(Math.max(0, (minOut - minIn) - pausaMin))
        : "-";

    const classeCorDesfecho = obterClasseCorDesfecho(item.desfecho);

    let infoTratativaHtml = '';
    if (item.tratadoPor) {
        infoTratativaHtml = `
            <div class="bg-emerald-50 border border-emerald-300 p-3 rounded-lg text-xs text-emerald-950 space-y-1">
                <div><strong>✅ Tratado Por:</strong> ${item.tratadoPor}</div>
                <div><strong>🕒 Data/Hora da Tratativa:</strong> ${item.tratadoDataHora || item.hSaida}</div>
                <div class="text-[10px] text-orange-800 font-bold">⏳ ${calcularTempoRestante48h(item.tratadoTimestamp)}</div>
            </div>`;
    }

    let secaoMateriaisEBlocosHtml = '';
    if (ehObraNormal) {
        if (temMultiplosBlocos) {
            const cardsCadaBloco = blocosDetalhadosParaWhats.map(b => {
                const corB = obterClasseCorDesfecho(b.desfecho);
                const opcoesB = (b.opcoesMarcadas && b.opcoesMarcadas.length > 0) ? b.opcoesMarcadas.join(' + ') : 'Nenhuma';
                return `
                    <div class="bg-white p-3 rounded-xl border-2 border-blue-200 shadow-sm space-y-2">
                        <div class="flex justify-between items-center border-b border-slate-200 pb-1.5">
                            <span class="font-black text-blue-950 text-xs uppercase">🏢 ${b.identificacao}</span>
                            <span class="font-bold px-2 py-0.5 rounded text-[10px] ${corB}">${b.desfecho}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded border border-slate-200">
                            <div><strong>Andares:</strong> <b class="text-blue-900">${b.andares}</b></div>
                            <div><strong>HPs:</strong> <b class="text-blue-900">${b.hps}</b></div>
                        </div>
                        <div class="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200">
                            <div class="font-black text-emerald-950 text-[10px] uppercase mb-1.5">📦 Materiais e Caixas (${b.identificacao})</div>
                            <div class="grid grid-cols-3 gap-1.5 text-[11px]">
                                <div>Cabo RL: <b>${b.caboRL} m</b></div>
                                <div>Cabo Drop: <b>${b.caboDrop} m</b></div>
                                <div>Conectores: <b>${b.conectores}</b></div>
                                <div>Fusões: <b>${b.fusoes}</b></div>
                                <div>NAP: <b>${b.nap}</b></div>
                                <div>DIO: <b>${b.dio}</b></div>
                                <div>Cx. Sobrepor: <b>${b.cxSobrepor}</b></div>
                                <div>Cx. Embutida: <b>${b.cxEmbutida}</b></div>
                                <div>Cx. FOSC: <b>${b.cxFosc}</b></div>
                            </div>
                        </div>
                        ${b.opcoesMarcadas.length > 0 ? `<div class="text-[11px] bg-amber-50 p-2 rounded border border-amber-200"><strong>Opções Marcadas:</strong> <b class="text-amber-950">${opcoesB}</b></div>` : ''}
                        ${b.motivoDesfecho ? `<div class="text-[11px] bg-slate-50 p-2 rounded border"><strong>Detalhe/Motivo:</strong> ${b.motivoDesfecho}</div>` : ''}
                        ${b.observacoes ? `<div class="text-[11px] bg-slate-50 p-2 rounded border"><strong>Observações:</strong> ${b.observacoes}</div>` : ''}
                    </div>`;
            }).join('');

            secaoMateriaisEBlocosHtml = `
                <div class="bg-blue-50/50 p-3.5 rounded-xl border-2 border-blue-200 space-y-3">
                    <h4 class="font-black text-blue-950 text-xs uppercase">🏢 Detalhamento Separado por Bloco (${blocosIrmaos.length} Blocos)</h4>
                    <div class="grid grid-cols-1 gap-3">${cardsCadaBloco}</div>
                </div>`;
        } else {
            secaoMateriaisEBlocosHtml = `
                <div class="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                    <h4 class="font-black text-emerald-950 text-xs uppercase">📦 Materiais e Caixas Utilizados</h4>
                    <div class="grid grid-cols-3 gap-2 text-xs">
                        <div class="bg-white p-2 rounded border border-emerald-100"><strong>Cabo RL:</strong> <b class="text-blue-950">${somaRL} m</b></div>
                        <div class="bg-white p-2 rounded border border-emerald-100"><strong>Cabo Drop:</strong> <b class="text-blue-950">${somaDrop} m</b></div>
                        <div class="bg-white p-2 rounded border border-emerald-100"><strong>Conectores:</strong> <b class="text-blue-950">${somaConect}</b></div>
                        <div class="bg-white p-2 rounded border border-emerald-100"><strong>Fusões:</strong> <b class="text-blue-950">${somaFusoes}</b></div>
                        <div class="bg-white p-2 rounded border border-emerald-100"><strong>NAP:</strong> <b class="text-blue-950">${somaNap}</b></div>
                        <div class="bg-white p-2 rounded border border-emerald-100"><strong>DIO:</strong> <b class="text-blue-950">${somaDio}</b></div>
                        <div class="bg-white p-2 rounded border border-emerald-100"><strong>Cx. Sobrepor:</strong> <b class="text-blue-950">${somaSobrepor}</b></div>
                        <div class="bg-white p-2 rounded border border-emerald-100"><strong>Cx. Embutida:</strong> <b class="text-blue-950">${somaEmbutida}</b></div>
                        <div class="bg-white p-2 rounded border border-emerald-100"><strong>Cx. FOSC:</strong> <b class="text-blue-950">${somaFosc}</b></div>
                    </div>
                </div>`;
        }
    }

    const codigoLimpo = (codBase || 'imovel').replace(/[^a-zA-Z0-9_-]/g, '_');
    let galeriaFotosHtml = `<div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-400 text-[11px]">📷 Nenhuma foto anexada neste registro.</div>`;
    if (todasFotosAcumuladas.length > 0) {
        const cardsFotos = todasFotosAcumuladas.map((fSrc, idx) => {
            const nomeArq = `${codigoLimpo}_foto_${idx + 1}.jpg`;
            return `<div class="bg-white p-2 rounded-xl border border-indigo-200 shadow-sm flex flex-col items-center gap-1.5"><img src="${fSrc}" onclick="abrirZoomFoto('${fSrc}', '${nomeArq}')" class="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-90 transition border"><div class="flex gap-1 w-full"><button type="button" onclick="abrirZoomFoto('${fSrc}', '${nomeArq}')" class="flex-1 bg-indigo-50 text-indigo-900 font-bold text-[10px] py-1 rounded">🔍 Ampliar</button><button type="button" onclick="baixarFotoDireto('${fSrc}', '${nomeArq}')" class="flex-1 bg-emerald-600 text-white font-bold text-[10px] py-1 rounded">⬇️ Baixar</button></div></div>`;
        }).join('');
        galeriaFotosHtml = `
            <div class="bg-indigo-50/70 p-3 rounded-lg border border-indigo-200 space-y-2.5">
                <div class="flex flex-wrap justify-between items-center gap-2 pb-1.5 border-b border-indigo-200">
                    <h4 class="font-bold text-indigo-950 text-xs uppercase">📷 Fotos Anexadas (${todasFotosAcumuladas.length})</h4>
                    <button type="button" id="btn-baixar-todas-fotos-modal" onclick="baixarTodasFotosDoModalAtual(this)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] px-3 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                        ⬇️ Baixar Todas as Fotos (${todasFotosAcumuladas.length})
                    </button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">${cardsFotos}</div>
            </div>`;
    }

    const malogrosStr = (item.malogros && item.malogros.length > 0) ? item.malogros.join(' + ') : '';

    conteudo.innerHTML = `
        ${infoTratativaHtml}
        <div class="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div class="col-span-2"><strong>📍 Endereço do Atendimento:</strong> <span class="font-bold text-blue-950">${item.endereco || item.imovel || 'Não informado'}</span></div>
            ${apoiosImovel.length > 0 ? `<div class="col-span-2 bg-purple-100 p-2.5 rounded-lg border border-purple-300 text-purple-950"><strong>🤝 Atuação Conjunta / Apoio Operacional:</strong> <span class="font-black">${apoiosImovel.join(', ')}</span></div>` : ''}
            ${item.liberouAcesso ? `<div class="col-span-2 bg-amber-50 p-2 rounded border border-amber-200"><strong>🔑 Liberou o Acesso:</strong> <span class="font-black text-amber-950">${item.liberouAcesso}</span></div>` : ''}
            <div><strong>Data do Registro:</strong> ${item.dataRegistro}</div>
            <div><strong>Técnico Titular:</strong> <b class="text-blue-900">${item.equipe}</b></div>
            <div><strong>Projeto / Atividade:</strong> <b>${item.projeto}</b></div>
            <div><strong>Status / Desfecho:</strong> <span class="font-bold px-2 py-0.5 rounded text-[10px] ${classeCorDesfecho}">${item.desfecho}</span></div>
            <div><strong>Total de Andares:</strong> <b>${somaAndares}</b></div>
            <div><strong>Total de HPs:</strong> <b>${somaHps}</b></div>
            <div><strong>Responsável Local:</strong> ${item.responsavel || '-'}</div>
            <div><strong>Contato / Tel:</strong> ${item.contato || '-'}</div>
        </div>
        <div class="bg-blue-50 p-3.5 rounded-xl border border-blue-200 space-y-1.5">
            <h4 class="font-black text-blue-950 text-xs uppercase">🕒 Horários de Entrada / Saída e Links GPS</h4>
            <div><strong>🟢 Horário Entrada:</strong> <b>${item.hEntrada || '-'}</b></div>
            <div><strong>📍 GPS Entrada:</strong> ${linkGpsEntrada}</div>
            <div class="pt-1"><strong>🔴 Horário Saída:</strong> <b>${item.hSaida || '-'}</b></div>
            <div><strong>📍 GPS Saída:</strong> ${linkGpsSaida}</div>
            ${pausaMin > 0 ? `<div class="pt-1 text-orange-700 font-bold"><strong>⏸️ Tempo Paralisado:</strong> ${pausaMin} min</div>` : ''}
            <div class="pt-1 text-emerald-800 font-bold"><strong>⏱️ Duração Líquida:</strong> ${duracaoStr}</div>
        </div>
        ${secaoMateriaisEBlocosHtml}
        ${galeriaFotosHtml}
        ${(!temMultiplosBlocos && malogrosStr) ? `<div class="bg-amber-50 p-3 rounded-lg border border-amber-200"><strong>Opções Marcadas:</strong> <span class="font-bold text-amber-950">${malogrosStr}</span></div>` : ''}
        ${(!temMultiplosBlocos && item.motivoDesfecho) ? `<div class="bg-slate-50 p-3 rounded-lg border border-slate-200"><strong>Detalhamento / Motivo:</strong> ${item.motivoDesfecho}</div>` : ''}
        ${(!temMultiplosBlocos && item.observacoes) ? `<div class="bg-slate-50 p-3 rounded-lg border border-slate-200"><strong>Observações Gerais:</strong> ${item.observacoes}</div>` : ''}
    `;
    modal.classList.remove('hidden');
}

function fecharModalDetalhes() { document.getElementById('modal-detalhes')?.classList.add('hidden'); }
function fecharModalExplosao() { document.getElementById('modal-explosao')?.classList.add('hidden'); }
window.fecharModalDetalhes = fecharModalDetalhes;
window.fecharModalExplosao = fecharModalExplosao;

// ================= EQUIPES, CARTEIRAS DE FISCAIS, FÉRIAS E NAVEGAÇÃO =================
function atualizarResumoContagemCarteirasFiscais() {
    const container = document.getElementById('resumo-contagem-carteiras-fiscais');
    if (!container) return;

    container.innerHTML = CATALOGO_FISCAIS_MDU.map(f => {
        const qtd = (equipesSistema || []).filter(e => e.status === 'Ativo' && !normalizarChaveNome(e.nome).includes('AAAAAATESTE') && obterEmailFiscalDaEquipe(e) === f.email).length;
        return `
            <div class="bg-indigo-900/70 border border-indigo-700/80 px-3 py-2 rounded-xl flex justify-between items-center">
                <div>
                    <div class="font-black text-white text-[11px]">👮 ${f.nome}</div>
                    <div class="text-[10px] text-indigo-300 font-mono">${f.email}</div>
                </div>
                <span class="bg-cyan-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded-lg">${qtd} téc.</span>
            </div>
        `;
    }).join('');
}

async function alterarFiscalDiretoNaTabela(idEquipe, novoEmailFiscal) {
    if (!usuarioPodeEditarGestor()) return;
    const eq = (equipesSistema || []).find(e => e.id === idEquipe);
    if (!eq) return;

    const fObj = obterFiscalObjPorEmailOuNome(novoEmailFiscal);
    eq.fiscalEmail = fObj ? fObj.email : "";
    eq.fiscal = fObj ? fObj.nome : "";

    await sincronizarEquipesNaNuvem();
    renderizarTabelaEquipes();
    registrarLogAuditoria("ALTERAÇÃO DE FISCAL", `Técnico ${eq.nome} vinculado ao fiscal ${eq.fiscal || 'Sem Fiscal'}.`);
}

async function transferirGrupoFiscalFeriasEmLote() {
    if (!usuarioPodeEditarGestor()) {
        alert("⚠️ Apenas usuários Master ou Operador podem transferir carteiras de fiscais.");
        return;
    }

    const emailOrigem = document.getElementById('sel-ferias-fiscal-origem')?.value;
    const emailDestino = document.getElementById('sel-ferias-fiscal-destino')?.value;
    if (!emailOrigem || !emailDestino || emailOrigem === emailDestino) {
        alert("⚠️ Selecione um Fiscal de origem e um Fiscal substituto diferentes.");
        return;
    }

    const fOrig = obterFiscalObjPorEmailOuNome(emailOrigem);
    const fDest = obterFiscalObjPorEmailOuNome(emailDestino);
    const tecnicosAfetados = (equipesSistema || []).filter(e => obterEmailFiscalDaEquipe(e) === emailOrigem);

    if (tecnicosAfetados.length === 0) {
        alert(`ℹ️ Nenhum técnico está vinculado atualmente a ${fOrig ? fOrig.nome : emailOrigem}.`);
        return;
    }

    if (!confirm(`🏖️ COBERTURA DE FÉRIAS / TRANSFERÊNCIA DE GRUPO\n\nDeseja transferir os ${tecnicosAfetados.length} técnico(s) do grupo de:\n👉 ${fOrig.nome} (${emailOrigem})\n\nPara a visão do fiscal:\n👉 ${fDest.nome} (${emailDestino})?`)) {
        return;
    }

    tecnicosAfetados.forEach(eq => {
        eq.fiscalEmail = fDest.email;
        eq.fiscal = fDest.nome;
    });

    await sincronizarEquipesNaNuvem();
    renderizarTabelaEquipes();
    registrarLogAuditoria("TRANSFERÊNCIA DE GRUPO (FÉRIAS)", `${tecnicosAfetados.length} técnicos transferidos de ${fOrig.nome} para ${fDest.nome}.`);
    alert(`✅ Grupo transferido com sucesso!`);
}

async function restaurarCarteiraOriginalPadraoFiscais() {
    if (!usuarioPodeEditarGestor()) return;
    if (!confirm("🔄 RESTAURAR DIVISÃO ORIGINAL DE FISCAIS\n\nDeseja retornar todos os técnicos para a distribuição original da planilha (Francisco, Jefferson e Marcelo)?")) {
        return;
    }

    (equipesSistema || []).forEach(eq => {
        const chave = normalizarChaveNome(eq.nome);
        const emailPadrao = MAPA_PADRAO_EQUIPE_FISCAL[chave] || "";
        const fObj = obterFiscalObjPorEmailOuNome(emailPadrao);
        eq.fiscalEmail = fObj ? fObj.email : "";
        eq.fiscal = fObj ? fObj.nome : "";
    });

    await sincronizarEquipesNaNuvem();
    renderizarTabelaEquipes();
    alert("✅ Divisão original de fiscais restaurada com sucesso!");
}

function alternarChaveSetorEquipe(setorEscolhido) {
    let inputHidden = document.getElementById('inp-setor-equipe');
    let atuais = obterArraySetores(inputHidden.value);
    if (atuais.includes(setorEscolhido)) {
        if (atuais.length > 1) atuais = atuais.filter(s => s !== setorEscolhido);
        else return;
    } else atuais.push(setorEscolhido);
    inputHidden.value = formatarSetoresString(atuais);
    const aplicarEstilo = (btn, ativo, corBg) => {
        if (btn) btn.className = ativo ? `py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 ${corBg} text-white shadow-sm` : "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 text-slate-600 bg-slate-100";
    };
    aplicarEstilo(document.getElementById('btn-chave-vistoriador'), atuais.includes('Vistoriador'), 'bg-purple-800');
    aplicarEstilo(document.getElementById('btn-chave-instalador'), atuais.includes('Instalador'), 'bg-blue-900');
    aplicarEstilo(document.getElementById('btn-chave-ativador'), atuais.includes('Ativador'), 'bg-emerald-700');
}

function abrirModalEquipe(id = null) {
    inicializarMelhoriasVisuaisGestor();
    if (!usuarioPodeEditarGestor()) return;
    document.getElementById('modal-equipe').classList.remove('hidden');
    const selFiscal = document.getElementById('sel-fiscal-equipe');

    if (id) {
        let eq = equipesSistema.find(e => e.id === id);
        if (eq) {
            document.getElementById('edit-equipe-id').value = eq.id;
            document.getElementById('inp-nome-equipe').value = eq.nome;
            document.getElementById('sel-status-equipe').value = eq.status;
            document.getElementById('inp-setor-equipe').value = formatarSetoresString(eq.setor);
            if (selFiscal) selFiscal.value = obterEmailFiscalDaEquipe(eq);
        }
    } else {
        document.getElementById('edit-equipe-id').value = "";
        document.getElementById('inp-nome-equipe').value = "";
        document.getElementById('sel-status-equipe').value = "Ativo";
        document.getElementById('inp-setor-equipe').value = "Instalador";
        if (selFiscal) selFiscal.value = CATALOGO_FISCAIS_MDU[0].email;
    }
}

function fecharModalEquipe() { document.getElementById('modal-equipe').classList.add('hidden'); }

async function salvarOuAtualizarEquipe() {
    if (!usuarioPodeEditarGestor()) return;
    const editId = document.getElementById('edit-equipe-id').value;
    const nome = document.getElementById('inp-nome-equipe').value.trim().toUpperCase();
    const setor = formatarSetoresString(document.getElementById('inp-setor-equipe').value || "Instalador");
    const status = document.getElementById('sel-status-equipe').value;
    const emailFiscal = document.getElementById('sel-fiscal-equipe')?.value || "";
    const fObj = obterFiscalObjPorEmailOuNome(emailFiscal);
    if (!nome) return;

    if (editId) {
        let eq = equipesSistema.find(e => e.id == editId);
        if (eq) {
            eq.nome = nome; eq.setor = setor; eq.status = status;
            eq.fiscalEmail = fObj ? fObj.email : "";
            eq.fiscal = fObj ? fObj.nome : "";
            if (!eq.pin) eq.pin = "1234";
        }
    } else {
        equipesSistema.push({
            id: Date.now(), nome, setor, status, pin: "1234",
            fiscalEmail: fObj ? fObj.email : "",
            fiscal: fObj ? fObj.nome : ""
        });
    }
    await sincronizarEquipesNaNuvem();
    fecharModalEquipe();
    popularSelectEquipes();
    renderizarTabelaEquipes();
    renderizarPainelDisponibilidade();
}

async function alternarSetorDiretoNaTabela(idEquipe, setorAlvo) {
    if (!usuarioPodeEditarGestor()) return;
    const eq = equipesSistema.find(e => e.id === idEquipe);
    if (!eq) return;
    let setoresAtuais = obterArraySetores(eq.setor);
    if (setoresAtuais.includes(setorAlvo)) {
        if (setoresAtuais.length > 1) setoresAtuais = setoresAtuais.filter(s => s !== setorAlvo);
        else return;
    } else setoresAtuais.push(setorAlvo);
    eq.setor = formatarSetoresString(setoresAtuais);
    await sincronizarEquipesNaNuvem();
    popularSelectEquipes();
    renderizarTabelaEquipes();
}

function renderizarTabelaEquipes() {
    inicializarMelhoriasVisuaisGestor();
    const corpo = document.getElementById('tabela-equipes-corpo');
    if (!corpo) return;

    const trHead = corpo.closest('table')?.querySelector('thead tr');
    if (trHead && !trHead.dataset.colFiscalInjetada) {
        trHead.dataset.colFiscalInjetada = "true";
        trHead.innerHTML = `
            <th class="p-3">Técnico / Equipe</th>
            <th class="p-3">👮 Fiscal Responsável</th>
            <th class="p-3">Função / Setor (Chave)</th>
            <th class="p-3">Projetos Habilitados</th>
            <th class="p-3">Status</th>
            <th class="p-3">Ações</th>
        `;
    }

    corpo.innerHTML = "";
    const podeEditar = usuarioPodeEditarGestor();
    const ehMaster = usuarioEhMasterGestor();

    (equipesSistema || []).forEach(eq => {
        const setoresAtuais = obterArraySetores(eq.setor);
        const pinAtual = obterPinDaEquipe(eq);
        const emailFiscalAtual = obterEmailFiscalDaEquipe(eq);

        const selectFiscalLinhaHtml = podeEditar
            ? `<select onchange="alterarFiscalDiretoNaTabela(${eq.id}, this.value)" class="text-[11px] font-bold border border-indigo-300 rounded-lg px-2 py-1 bg-indigo-50/70 text-indigo-950 outline-none cursor-pointer">
                <option value="" ${!emailFiscalAtual ? 'selected' : ''}>Sem Fiscal Definido</option>
                ${CATALOGO_FISCAIS_MDU.map(f => `<option value="${f.email}" ${emailFiscalAtual === f.email ? 'selected' : ''}>👮 ${f.nome}</option>`).join('')}
               </select>`
            : `<span class="bg-indigo-100 text-indigo-950 font-bold px-2 py-1 rounded text-[10px]">👮 ${obterNomeFiscalDaEquipe(eq)}</span>`;

        const chaveSetorHtml = `<div class="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-300 gap-1"><button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Vistoriador')" class="px-2 py-1 rounded-md text-[10px] font-bold ${setoresAtuais.includes('Vistoriador') ? 'bg-purple-800 text-white' : 'text-slate-500 bg-white'}">🔍 Vistoriador</button><button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Instalador')" class="px-2 py-1 rounded-md text-[10px] font-bold ${setoresAtuais.includes('Instalador') ? 'bg-blue-900 text-white' : 'text-slate-500 bg-white'}">🛠️ Instalador</button><button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Ativador')" class="px-2 py-1 rounded-md text-[10px] font-bold ${setoresAtuais.includes('Ativador') ? 'bg-emerald-700 text-white' : 'text-slate-500 bg-white'}">⚡ Ativador</button></div>`;
        const projsHabilitados = obterProjetosPermitidosParaSetores(setoresAtuais).map(p => `<span class="bg-slate-100 border border-slate-300 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded">${p}</span>`).join(' ');
        const badgePin = podeEditar ? `<div class="mt-1"><span class="bg-amber-50 text-amber-900 border border-amber-300 font-mono font-bold text-[10px] px-2 py-0.5 rounded">🔑 PIN: ${pinAtual}</span></div>` : '';
        let acoesEq = podeEditar
            ? `<button onclick="resetarPinEquipeGestor(${eq.id})" class="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] px-2.5 py-1 rounded">🔄 Resetar PIN</button> <button onclick="abrirModalEquipe(${eq.id})" class="bg-blue-50 text-blue-700 font-bold text-[10px] px-2.5 py-1 rounded">✏️ Editar</button>`
            : `<span class="text-slate-400 text-[10px]">Leitura</span>`;
        if (ehMaster) acoesEq += ` <button onclick="excluirEquipe(${eq.id}, '${eq.nome}')" class="bg-red-50 text-red-600 font-bold text-[10px] px-2.5 py-1 rounded">🗑️ Excluir</button>`;

        corpo.innerHTML += `
            <tr class="hover:bg-slate-50 border-b">
                <td class="p-3"><div class="font-bold text-slate-800">${eq.nome}</div>${badgePin}</td>
                <td class="p-3">${selectFiscalLinhaHtml}</td>
                <td class="p-3">${chaveSetorHtml}</td>
                <td class="p-3"><div class="flex flex-wrap gap-1">${projsHabilitados}</div></td>
                <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${eq.status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">${eq.status}</span></td>
                <td class="p-3 space-x-1 whitespace-nowrap">${acoesEq}</td>
            </tr>
        `;
    });

    atualizarResumoContagemCarteirasFiscais();
}

async function excluirEquipe(id, nome) {
    if (!usuarioEhMasterGestor()) return;
    if (confirm(`Deseja excluir a equipe ${nome}?`)) {
        equipesSistema = equipesSistema.filter(e => e.id !== id);
        await sincronizarEquipesNaNuvem();
        popularSelectEquipes();
        renderizarTabelaEquipes();
    }
}

function abrirModalUsuario(id = null) {
    document.getElementById('modal-usuario').classList.remove('hidden');
    if (id) {
        let u = usuariosSistema.find(user => user.id === id);
        if (u) {
            document.getElementById('edit-user-id').value = u.id;
            document.getElementById('novo-user-nome').value = u.nome;
            document.getElementById('novo-user-email').value = u.email;
            document.getElementById('novo-user-senha').value = u.senha;
            document.getElementById('novo-user-nivel').value = u.email.toLowerCase() === 'e.baptista@procisa.com.br' ? 'Operador' : u.nivel;
        }
    } else {
        document.getElementById('edit-user-id').value = "";
        document.getElementById('novo-user-nome').value = "";
        document.getElementById('novo-user-email').value = "";
        document.getElementById('novo-user-senha').value = "";
        document.getElementById('novo-user-nivel').value = "Visualizador";
    }
}

function fecharModalUsuario() { document.getElementById('modal-usuario').classList.add('hidden'); }

async function salvarOuAtualizarUsuario() {
    const editId = document.getElementById('edit-user-id').value;
    const nome = document.getElementById('novo-user-nome').value.trim();
    const email = document.getElementById('novo-user-email').value.trim().toLowerCase();
    const senha = document.getElementById('novo-user-senha').value.trim();
    let nivel = document.getElementById('novo-user-nivel').value;
    if (!nome || !email || !senha) return;

    if (email === "e.baptista@procisa.com.br") nivel = "Operador";

    const ehMaster = usuarioEhMasterGestor();
    if (editId) {
        let u = usuariosSistema.find(user => user.id == editId);
        if (u) { if (ehMaster) { u.nome = nome; u.email = email; u.senha = senha; u.nivel = nivel; } else u.senha = senha; }
    } else {
        if (!ehMaster) return;
        usuariosSistema.push({ id: Date.now(), nome, email, senha, nivel, status: "Ativo" });
    }
    await sincronizarUsuariosNaNuvem();
    fecharModalUsuario();
    renderizarTabelaUsuariosPermissao();
}

async function excluirUsuario(id, email) {
    if (!usuarioEhMasterGestor() || email.toLowerCase() === "lsimoes@procisa.com.br") return;
    if (confirm(`Remover acesso de ${email}?`)) {
        usuariosSistema = usuariosSistema.filter(u => u.id !== id);
        await sincronizarUsuariosNaNuvem();
        renderizarTabelaUsuariosPermissao();
    }
}

async function renderizarTabelaAuditoria() {
    renderizarPainelCapacidadeNuvem();
    await carregarAuditoriaDaNuvem();
    const corpo = document.getElementById('tabela-auditoria-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";
    const emailsGestores = new Set((usuariosSistema || []).map(u => (u.email || '').toLowerCase()));
    const logsSomenteGestao = (trilhaAuditoria || []).filter(log => {
        const usr = (log.usuario || '').toLowerCase();
        return usr.includes('@') || emailsGestores.has(usr);
    });
    if (logsSomenteGestao.length === 0) {
        corpo.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">Nenhum registo de auditoria.</td></tr>`;
        return;
    }
    logsSomenteGestao.forEach(log => {
        corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b text-xs"><td class="p-3 font-mono text-slate-500">${log.dataHora}</td><td class="p-3 font-bold text-blue-900">${log.usuario}</td><td class="p-3"><span class="bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded text-[10px]">${log.acao}</span></td><td class="p-3 text-slate-600">${log.detalhes}</td></tr>`;
    });
}

async function limparLogsAuditoria() {
    if (!usuarioEhMasterGestor()) return;
    if (confirm("Limpar o histórico de auditoria?")) {
        trilhaAuditoria = [];
        localStorage.removeItem('gpd_trilha_auditoria');
        await sincronizarAuditoriaNaNuvem();
        renderizarTabelaAuditoria();
    }
}

recarregarDadosGestor = async function(silencioso = false) {
    try {
        if (!modoConsultaBackupAtivo) {
            historicoCompletoGestorJaBaixado = false;
            await garantirCargaNuvemGestor(true);
        }
        await atualizarDashboardGestor(false);
        const lblSync = document.getElementById('txt-hora-sync');
        if (lblSync) lblSync.innerText = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        console.warn("Erro ao recarregar dados gestor:", e);
    }
};

function mudarSubAbaGestor(aba) {
    inicializarMelhoriasVisuaisGestor();
    const nivelNorm = obterNivelNormalizadoGestor();
    const ehVisualizador = (nivelNorm === 'visualizador');
    const abasPermitidasVisualizador = ['atividades', 'disponibilidade', 'mapa', 'graficos', 'materiais'];

    if (ehVisualizador && !abasPermitidasVisualizador.includes(aba)) {
        aba = 'atividades';
    }

    document.getElementById('header-gestor-acoes')?.classList.remove('hidden');
    document.getElementById('header-gestor-subbarra')?.classList.remove('hidden');

    const btnImportar = document.getElementById('btn-importar-planilha');
    if (btnImportar) btnImportar.classList.toggle('hidden', ehVisualizador);

    const subs = ['atividades', 'disponibilidade', 'mapa', 'combustivel', 'solicitacao_material', 'graficos', 'imprevistos', 'materiais', 'financeiro', 'equipes', 'opcoes', 'usuarios', 'bonificacao', 'auditoria'];
    subs.forEach(s => {
        document.getElementById(`subview-${s}`)?.classList.add('hidden');
        const btn = document.getElementById(`subtab-btn-${s}`);
        if (btn) {
            const ocultoVisualizador = (ehVisualizador && !abasPermitidasVisualizador.includes(s));
            btn.className = `whitespace-nowrap shrink-0 snap-start px-2.5 py-1 text-[11px] font-bold rounded-lg transition bg-white text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 ${ocultoVisualizador ? 'hidden' : ''}`;
        }
    });

    document.getElementById(`subview-${aba}`)?.classList.remove('hidden');
    const targetBtn = document.getElementById(`subtab-btn-${aba}`);
    if (targetBtn) targetBtn.className = "whitespace-nowrap shrink-0 snap-start px-2.5 py-1 text-[11px] font-bold rounded-lg transition bg-blue-900 text-white shadow-sm flex items-center gap-1";

    const divBotoesDisp = document.getElementById('botoes-atalho-exclusivos-disponibilidade');
    if (divBotoesDisp) {
        if (aba === 'disponibilidade') divBotoesDisp.classList.remove('hidden');
        else divBotoesDisp.classList.add('hidden');
    }

    const boxBackupMaster = document.getElementById('central-master-backup-nuvem');
    if (boxBackupMaster) {
        if (nivelNorm === 'master') boxBackupMaster.classList.remove('hidden');
        else boxBackupMaster.classList.add('hidden');
    }

    if (aba === 'usuarios') renderizarTabelaUsuariosPermissao();
    if (aba === 'equipes') renderizarTabelaEquipes();
    if (aba === 'opcoes') { renderizarPainelOpcoesSistema(); atualizarEstimativaPesoNuvem(); }
    if (aba === 'auditoria') renderizarTabelaAuditoria();
    if (aba === 'disponibilidade') renderizarPainelDisponibilidade();
    if (['combustivel', 'solicitacao_material', 'graficos', 'bonificacao', 'financeiro', 'materiais', 'atividades', 'imprevistos'].includes(aba)) {
        atualizarDashboardGestor();
    }
    if (aba === 'mapa') {
        renderizarPainelDisponibilidade();
        setTimeout(() => {
            if (mapaRastreioInstancia) {
                mapaRastreioInstancia.invalidateSize();
                if (coordenadasPinosAtuais.length > 0) mapaRastreioInstancia.fitBounds(L.latLngBounds(coordenadasPinosAtuais), { padding: [45, 45], maxZoom: 16 });
            }
        }, 220);
    }
}

function aplicarAtalhoPeriodo(tipo) {
    const inpInicio = document.getElementById('gestor-filtro-data-inicio');
    const inpFim = document.getElementById('gestor-filtro-data-fim');
    const hoje = new Date();
    if (tipo === 'hoje') { const s = obterDataLocalISO(hoje); inpInicio.value = s; inpFim.value = s; }
    else if (tipo === 'ontem') { const o = new Date(hoje); o.setDate(hoje.getDate() - 1); const s = obterDataLocalISO(o); inpInicio.value = s; inpFim.value = s; }
    else if (tipo === '7dias') { const d = new Date(hoje); d.setDate(hoje.getDate() - 6); inpInicio.value = obterDataLocalISO(d); inpFim.value = obterDataLocalISO(hoje); }
    else if (tipo === 'mes') { const m = new Date(hoje.getFullYear(), hoje.getMonth(), 1); inpInicio.value = obterDataLocalISO(m); inpFim.value = obterDataLocalISO(hoje); }
    else if (tipo === 'tudo') { inpInicio.value = ''; inpFim.value = ''; }
    atualizarDashboardGestor();
}
// ================= ABA GRÁFICOS & INDICADORES + FOTOS EM LOTE, EXCEL COM MATERIAIS POR BLOCO E ISOLAMENTO DE TESTE (PARTE 3 FINAL) =================

var filtrosMultiGraficos = {
    segmentos: ['TODOS'],
    categorias: ['TODAS'],
    semanas: ['TODAS']
};

var modoSelecaoMultiplaSemCtrl = false;
var secoesInibidasGraficos = {
    consolidados: false,
    planilhaDinamica: false,
    geralTecnicos: false,
    evolucaoSegmentos: false,
    picosHorarios: false,
    planilhaHorarios: false,
    rankingOfensores: false,
    ofensoresSegmentos: false,
    controlePausas: false,
    impactoOperacional: false
};

var estadoModalExpandidoAtual = { ativo: false, tipo: null, idOrigem: null, titulo: '' };
var registroExplosaoCache = new Map();
var contadorChaveExplosao = 0;

var chartEvolucaoSegmentosInst = null;
var chartHorariosPicoNovoInst = null;
var chartOfensoresRankingInst = null;
var chartImpactoImprevistosInst = null;

var varreduraFotosEmCurso = false;
var limpezaDuplicadosEmAndamento = false;
var baixandoLoteFotos = false;
var idsFotosJaVerificadas = new Set();

function registrarListaParaExplosao(titulo, lista) {
    contadorChaveExplosao++;
    const chave = `exp_${contadorChaveExplosao}`;
    registroExplosaoCache.set(chave, { titulo, lista: Array.isArray(lista) ? lista : [] });
    return chave;
}

function dispararExplosaoPorChave(chave) {
    const pacote = registroExplosaoCache.get(chave);
    if (!pacote) return;
    abrirExplosaoPersonalizadaGraficos(pacote.titulo, pacote.lista);
}

// --- 1. DOWNLOAD DE FOTOS INDIVIDUAL E EM LOTE VIA BLOB BINÁRIO ---
window.baixarFotoDireto = function(srcBase64, nomeArquivo = "foto_gpd.jpg") {
    try {
        if (!srcBase64) {
            alert("⚠️ Imagem não disponível para transferência.");
            return;
        }
        if (srcBase64.startsWith('data:')) {
            const partes = srcBase64.split(',');
            const mimeMatch = partes[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const binStr = atob(partes[1]);
            const len = binStr.length;
            const arr = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                arr[i] = binStr.charCodeAt(i);
            }
            const blob = new Blob([arr], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = nomeArquivo;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
        } else {
            const a = document.createElement('a');
            a.href = srcBase64;
            a.download = nomeArquivo;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    } catch (err) {
        console.error("Erro ao transferir foto:", err);
        alert("⚠️ Erro ao transferir a foto diretamente.");
    }
};

const _origAbrirZoomGestorUnificado = window.abrirZoomFoto;
window.abrirZoomFoto = function(srcBase64, nomeArquivo = "foto_gpd.jpg") {
    if (typeof _origAbrirZoomGestorUnificado === 'function') {
        _origAbrirZoomGestorUnificado(srcBase64, nomeArquivo);
    }
    const btnDown = document.getElementById('btn-download-zoom-foto');
    if (btnDown) {
        btnDown.removeAttribute('href');
        btnDown.style.cursor = 'pointer';
        btnDown.onclick = function(e) {
            e.preventDefault();
            window.baixarFotoDireto(srcBase64, nomeArquivo);
        };
    }
};

window.baixarTodasFotosDoModalAtual = async function(btnEl) {
    if (baixandoLoteFotos) return;
    const item = typeof itemDetalheAtualModal !== 'undefined' ? itemDetalheAtualModal : null;
    const fotos = (item && Array.isArray(item.fotos)) ? item.fotos : [];

    if (fotos.length === 0) {
        alert("⚠️ Nenhuma foto encontrada neste registo para transferir.");
        return;
    }

    baixandoLoteFotos = true;
    const txtOriginal = btnEl ? btnEl.innerHTML : '';
    const codBase = typeof obterCodigoBaseImovel === 'function'
        ? obterCodigoBaseImovel(item.imovel)
        : String(item.imovel || 'imovel').split(' - BLOCO')[0].trim();
    const codigoLimpo = (codBase || 'imovel').replace(/[^a-zA-Z0-9_-]/g, '_');

    try {
        for (let i = 0; i < fotos.length; i++) {
            if (btnEl) {
                btnEl.disabled = true;
                btnEl.innerHTML = `⏳ Transferindo ${i + 1} de ${fotos.length}...`;
            }
            const nomeArq = `${codigoLimpo}_foto_${i + 1}.jpg`;
            window.baixarFotoDireto(fotos[i], nomeArq);
            await new Promise(r => setTimeout(r, 350));
        }
    } finally {
        baixandoLoteFotos = false;
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = `✅ ${fotos.length} foto(s) transferida(s)!`;
            setTimeout(() => { if (btnEl) btnEl.innerHTML = txtOriginal; }, 2500);
        }
    }
};

window.baixarTodasFotosPorIdAtividade = async function(idReg, event, btnEl) {
    if (event) event.stopPropagation();
    if (baixandoLoteFotos) return;

    const reg = (registrosSalvos || []).find(r => r && r.id === idReg);
    if (!reg) return;

    baixandoLoteFotos = true;
    const txtOrig = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = `⏳ Buscando...`;
    }

    try {
        const codBase = typeof obterCodigoBaseImovel === 'function'
            ? obterCodigoBaseImovel(reg.imovel)
            : String(reg.imovel || '').split(' - BLOCO')[0].trim();

        const ehObraNormal = reg.projeto !== 'IMPREVISTO / ATRASO' &&
                             reg.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
                             reg.projeto !== PROJETO_SOLIC_MATERIAL;

        let blocosIrmaos = [reg];
        if (ehObraNormal && codBase) {
            const encontrados = (registrosSalvos || []).filter(r =>
                r &&
                r.dataRegistro === reg.dataRegistro &&
                r.equipe === reg.equipe &&
                r.projeto === reg.projeto &&
                (typeof obterCodigoBaseImovel === 'function' ? obterCodigoBaseImovel(r.imovel) === codBase : String(r.imovel || '').startsWith(codBase))
            ).sort((a, b) => (a.imovel || '').localeCompare(b.imovel || ''));
            if (encontrados.length > 0) blocosIrmaos = encontrados;
        }

        if (typeof supabaseClient !== 'undefined') {
            const idsBuscar = blocosIrmaos.map(b => b.id);
            const { data: rows } = await supabaseClient
                .from('registros_producao')
                .select('id, observacoes')
                .in('id', idsBuscar);

            if (Array.isArray(rows)) {
                rows.forEach(row => {
                    const alvo = blocosIrmaos.find(b => b.id === row.id);
                    if (alvo && row.observacoes && row.observacoes.includes('[FOTOS:')) {
                        const mFotos = row.observacoes.match(/\[FOTOS:(\[.*?\])\]/);
                        if (mFotos && mFotos[1]) {
                            try {
                                const arrF = JSON.parse(mFotos[1]);
                                if (Array.isArray(arrF)) {
                                    alvo.fotos = arrF;
                                    alvo.qtdFotos = arrF.length;
                                    if (typeof cacheFotosSobDemanda !== 'undefined') cacheFotosSobDemanda.set(alvo.id, arrF);
                                }
                            } catch (e) {}
                        }
                    }
                });
            }
        }

        const todasFotos = [];
        for (const b of blocosIrmaos) {
            let f = Array.isArray(b.fotos) && b.fotos.length > 0 ? b.fotos : [];
            if (f.length === 0 && typeof obterFotosSobDemandaDoRegistro === 'function') {
                f = await obterFotosSobDemandaDoRegistro(b.id);
            }
            todasFotos.push(...f);
        }

        if (todasFotos.length === 0) {
            alert("⚠️ Nenhuma foto localizada na nuvem para este registo.");
            return;
        }

        const codigoLimpo = (codBase || 'imovel').replace(/[^a-zA-Z0-9_-]/g, '_');
        for (let i = 0; i < todasFotos.length; i++) {
            if (btnEl) btnEl.innerHTML = `⬇️ ${i + 1}/${todasFotos.length}...`;
            window.baixarFotoDireto(todasFotos[i], `${codigoLimpo}_foto_${i + 1}.jpg`);
            await new Promise(r => setTimeout(r, 350));
        }

        if (btnEl) {
            btnEl.innerHTML = `✅ Transferidas!`;
            setTimeout(() => { if (btnEl) btnEl.innerHTML = txtOrig; }, 2200);
        }
    } catch (err) {
        console.error("Erro ao transferir lote de fotos:", err);
        alert("⚠️ Erro ao transferir lote de fotos.");
        if (btnEl) btnEl.innerHTML = txtOrig;
    } finally {
        baixandoLoteFotos = false;
        if (btnEl) btnEl.disabled = false;
    }
};

// Varredor leve em segundo plano para sinalizar o badge "📷 X foto(s)", endereço e tempo de pausa na Aba Atividades
async function varrerEnderecosEFotosVisiveis() {
    if (varreduraFotosEmCurso || typeof supabaseClient === 'undefined') return;
    const fonte = (Array.isArray(dadosFiltradosAtuais) && dadosFiltradosAtuais.length > 0) ? dadosFiltradosAtuais : (registrosSalvos || []);
    const pendentes = fonte.filter(r => r && r.id && !idsFotosJaVerificadas.has(r.id)).slice(0, 40);
    if (pendentes.length === 0) return;

    varreduraFotosEmCurso = true;
    try {
        const ids = pendentes.map(r => r.id);
        ids.forEach(id => idsFotosJaVerificadas.add(id));

        const { data } = await supabaseClient
            .from('registros_producao')
            .select('id, observacoes')
            .in('id', ids);

        let houveMudanca = false;
        if (Array.isArray(data)) {
            data.forEach(row => {
                if (!row.observacoes) return;
                const reg = (registrosSalvos || []).find(r => r.id === row.id);
                if (!reg) return;

                const mEnd = row.observacoes.match(/\[END:\s*([^\]]+)\]/i);
                if (mEnd && mEnd[1] && !reg.endereco) {
                    reg.endereco = mEnd[1].trim();
                    houveMudanca = true;
                }
                const mLib = row.observacoes.match(/\[LIBEROU_ACESSO:\s*([^\]]+)\]/i);
                if (mLib && mLib[1] && !reg.liberouAcesso) {
                    reg.liberouAcesso = mLib[1].trim();
                }
                const mPausa = row.observacoes.match(/\[PAUSA_TOTAL:\s*(\d+)\]/i);
                if (mPausa && mPausa[1] && !reg.tempoPausadoMinutos) {
                    reg.tempoPausadoMinutos = Number(mPausa[1]) || 0;
                    houveMudanca = true;
                }
                if (row.observacoes.includes('[FOTOS:')) {
                    const qtdEst = (row.observacoes.match(/data:image\//g) || []).length;
                    if (qtdEst > 0 && reg.qtdFotos !== qtdEst) {
                        reg.qtdFotos = qtdEst;
                        houveMudanca = true;
                    }
                }
            });
        }

        const aindaFaltamNaTela = ((Array.isArray(dadosFiltradosAtuais) ? dadosFiltradosAtuais : [])).some(r => r && r.id && !idsFotosJaVerificadas.has(r.id));
        if (aindaFaltamNaTela) {
            varreduraFotosEmCurso = false;
            setTimeout(varrerEnderecosEFotosVisiveis, 300);
            return;
        }

        if (houveMudanca && typeof atualizarDashboardGestor === 'function') {
            await atualizarDashboardGestor(false);
        }
    } catch (e) {} finally {
        varreduraFotosEmCurso = false;
    }
}

// --- 2. CONTROLE DO MAPA EM TEMPO REAL E BOTÃO DE LIMPAR TRAVADOS ---
window.injetarBotaoLimparMapaFixo = function() {
    const podeEditar = typeof usuarioPodeEditarGestor === 'function' ? usuarioPodeEditarGestor() : false;
    const subMapa = document.getElementById('subview-mapa');

    if (subMapa && !document.getElementById('barra-topo-limpar-mapa-travados')) {
        const barra = document.createElement('div');
        barra.id = 'barra-topo-limpar-mapa-travados';
        barra.className = `bg-slate-900 text-white p-3 rounded-xl mb-3 flex flex-wrap justify-between items-center gap-2 shadow border-b-2 border-amber-400 ${!podeEditar ? 'hidden' : ''}`;
        barra.innerHTML = `
            <div class="text-xs">
                <span class="font-black text-amber-300 uppercase">🗺️ Controle de Sinais do Mapa em Tempo Real</span>
                <span class="block text-[10px] text-slate-300">Técnicos que já encerraram o expediente saem automaticamente do mapa. Se algum aparelho ficou travado, limpe abaixo:</span>
            </div>
            <div class="flex items-center gap-2">
                <button type="button" onclick="recarregarMapaETelemetriaAgora()" class="bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow transition">
                    🔄 Sincronizar Turnos
                </button>
                <button type="button" onclick="limparSinaisAntigosDoMapaGestor()" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-lg shadow transition">
                    🧹 Limpar Sinais Inativos / Travados
                </button>
            </div>
        `;
        subMapa.insertBefore(barra, subMapa.firstChild);
    } else if (document.getElementById('barra-topo-limpar-mapa-travados')) {
        document.getElementById('barra-topo-limpar-mapa-travados').classList.toggle('hidden', !podeEditar);
    }

    const lblCont = document.getElementById('lbl-contador-pinos-mapa');
    if (lblCont && lblCont.parentNode && !document.getElementById('btn-limpar-sinais-mapa')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btn-limpar-sinais-mapa';
        btn.onclick = window.limparSinaisAntigosDoMapaGestor;
        btn.className = `bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg shadow-sm transition ml-2 ${!podeEditar ? 'hidden' : ''}`;
        btn.innerHTML = '🧹 Limpar Sinais Travados';
        lblCont.parentNode.appendChild(btn);
    } else if (document.getElementById('btn-limpar-sinais-mapa')) {
        document.getElementById('btn-limpar-sinais-mapa').classList.toggle('hidden', !podeEditar);
    }
};

window.recarregarMapaETelemetriaAgora = async function() {
    if (typeof carregarTelemetriaDaNuvem === 'function') {
        await carregarTelemetriaDaNuvem();
    }
    if (typeof renderizarPainelDisponibilidade === 'function') {
        renderizarPainelDisponibilidade();
    }
};

window.limparSinaisAntigosDoMapaGestor = async function() {
    if (typeof usuarioPodeEditarGestor === 'function' && !usuarioPodeEditarGestor()) {
        alert("⚠️ Apenas gestores (Master ou Operador) podem limpar sinais do mapa.");
        return;
    }
    if (!confirm("🧹 LIMPAR TÉCNICOS TRAVADOS NO MAPA\n\nDeseja dar baixa no mapa em todos os técnicos que NÃO estão com atividade 'EM ANDAMENTO' neste momento?")) return;

    const hojeISO = obterDataLocalISO();
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (typeof carregarTelemetriaDaNuvem === 'function') {
        try { await carregarTelemetriaDaNuvem(); } catch (e) {}
    }

    const emAtendimentoAgora = new Set(
        (registrosSalvos || [])
            .filter(r => r && r.dataRegistro === hojeISO && ['EM ANDAMENTO', 'PARALISADA', 'REABERTA', 'IMPREVISTO'].includes(r.desfecho))
            .flatMap(r => [String(r.equipe || '').toUpperCase().trim(), ...(typeof extrairApoiosDoRegistro === 'function' ? extrairApoiosDoRegistro(r) : [])])
    );

    const todasEquipesNomes = new Set([
        ...Object.keys(telemetriaEquipes || {}),
        ...(equipesSistema || []).map(e => e.nome)
    ]);

    for (const nomeEq of todasEquipesNomes) {
        if (!nomeEq) continue;
        const ch = nomeEq.toUpperCase().trim();
        if (!emAtendimentoAgora.has(ch)) {
            const infoAnt = (telemetriaEquipes && telemetriaEquipes[nomeEq]) ? telemetriaEquipes[nomeEq] : {};
            const novoStatus = {
                ...infoAnt,
                equipe: nomeEq,
                data: hojeISO,
                statusTurno: 'ENCERRADO',
                horaInicio: infoAnt.horaInicio || '08:00',
                horaFim: horaAgora,
                horaUltimoSinal: horaAgora,
                timestampUltimoSinal: Date.now()
            };
            telemetriaEquipes[nomeEq] = novoStatus;
            if (typeof sincronizarTelemetriaNaNuvem === 'function') {
                await sincronizarTelemetriaNaNuvem(nomeEq, novoStatus);
            }
        }
    }

    if (typeof renderizarPainelDisponibilidade === 'function') {
        renderizarPainelDisponibilidade();
    }
    alert(`✅ Limpeza concluída! Permaneceram no mapa apenas os técnicos que estão em atendimento ativo agora.`);
};

if (typeof window.inicializarOuAtualizarMapaRastreio === 'function' && !window._hookFiltroMapaEncerradosV3) {
    window._hookFiltroMapaEncerradosV3 = true;
    const _origMapaV3 = window.inicializarOuAtualizarMapaRastreio;
    window.inicializarOuAtualizarMapaRastreio = function(listaPinos) {
        window.injetarBotaoLimparMapaFixo();
        const hojeISO = obterDataLocalISO();

        const pinosValidos = (listaPinos || []).filter(p => {
            if (normalizarChaveNome(p.nome).includes('AAAAAATESTE')) return false;
            const tel = (telemetriaEquipes && telemetriaEquipes[p.nome] && telemetriaEquipes[p.nome].data === hojeISO) ? telemetriaEquipes[p.nome] : null;
            const temObraAbertaAgora = (registrosSalvos || []).some(r =>
                r && r.dataRegistro === hojeISO &&
                ['EM ANDAMENTO', 'PARALISADA', 'REABERTA', 'IMPREVISTO'].includes(r.desfecho) &&
                (String(r.equipe || '').toUpperCase().trim() === String(p.nome || '').toUpperCase().trim() ||
                 (typeof extrairApoiosDoRegistro === 'function' && extrairApoiosDoRegistro(r).includes(String(p.nome || '').toUpperCase().trim())))
            );

            if (temObraAbertaAgora) return true;
            if (tel && tel.statusTurno === 'ENCERRADO') return false;
            if (!tel || tel.statusTurno !== 'DISPONIVEL') return false;
            return true;
        });

        return _origMapaV3.call(this, pinosValidos);
    };
}

// --- 3. TAXONOMIA E ESTRUTURA DA ABA GRÁFICOS ---
function classificarRegistroNovaTaxonomia(reg) {
    const p = String(reg?.projeto || '').toUpperCase().trim();
    const macroOrig = typeof obterMacroGrupoProjeto === 'function' ? String(obterMacroGrupoProjeto(p)).toUpperCase() : '';

    if (p === 'VISTORIA' || p.includes('VISTORIA')) {
        return { segmento: 'CONSTRUÇÃO MDU', categoria: 'VISTORIA', chaveCombinada: 'CONSTRUÇÃO MDU - VISTORIA' };
    }
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

function otimizarCabecalhoAzulLinhaUnica() {
    try {
        const badgeDuplicado = document.getElementById('badge-usuario-logado-compacto');
        if (badgeDuplicado) badgeDuplicado.remove();

        const viewGestor = document.getElementById('view-gestor');
        const gestorEstaVisivel = viewGestor && !viewGestor.classList.contains('hidden');
        const blocoAcoesGestor = document.getElementById('header-gestor-acoes');

        if (!gestorEstaVisivel) {
            if (blocoAcoesGestor) blocoAcoesGestor.classList.add('hidden');
            const spanExistente = document.getElementById('assinatura-dev-leonardo');
            if (spanExistente) spanExistente.classList.add('hidden');
            return;
        }

        const btnSair = document.getElementById('btn-sair-gestor') || document.querySelector('button[onclick*="sairModoGestor"], button[onclick*="bloquearGestor"]');
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

function alternarFiltroDinamicoComCtrl(grupo, valor, event) {
    const usouCtrl = (event && (event.ctrlKey || event.metaKey || event.shiftKey)) || modoSelecaoMultiplaSemCtrl;
    const valorPadraoTodos = grupo === 'segmentos' ? 'TODOS' : 'TODAS';
    let atual = filtrosMultiGraficos[grupo] || [valorPadraoTodos];

    if (valor === valorPadraoTodos) {
        filtrosMultiGraficos[grupo] = [valorPadraoTodos];
    } else if (!usouCtrl) {
        filtrosMultiGraficos[grupo] = [valor];
    } else {
        atual = atual.filter(v => v !== valorPadraoTodos);
        if (atual.includes(valor)) {
            atual = atual.filter(v => v !== valor);
            if (atual.length === 0) atual = [valorPadraoTodos];
        } else {
            atual.push(valor);
        }
        filtrosMultiGraficos[grupo] = atual;
    }

    const segs = filtrosMultiGraficos.segmentos;
    if (!segs.includes('TODOS') && !segs.includes('CONSTRUÇÃO MDU')) {
        filtrosMultiGraficos.categorias = filtrosMultiGraficos.categorias.filter(c => c !== 'VISTORIA');
        if (filtrosMultiGraficos.categorias.length === 0) filtrosMultiGraficos.categorias = ['TODAS'];
    }

    renderizarAbaGraficosCompletaOficial();
    atualizarConteudoModalExpandidoAoVivo();
}

function alternarModoMultiToque() {
    modoSelecaoMultiplaSemCtrl = !modoSelecaoMultiplaSemCtrl;
    renderizarAbaGraficosCompletaOficial();
    atualizarConteudoModalExpandidoAoVivo();
}

function registroPassaNosFiltrosGlobaisGraficos(reg) {
    const tax = reg._tax || classificarRegistroNovaTaxonomia(reg);
    const sem = reg._semana || obterNumeroSemanaFormatado(reg.dataRegistro);

    const segs = filtrosMultiGraficos.segmentos;
    const cats = filtrosMultiGraficos.categorias;
    const sems = filtrosMultiGraficos.semanas;

    const okSeg = segs.includes('TODOS') || segs.includes(tax.segmento);
    const okCat = cats.includes('TODAS') || cats.includes(tax.categoria);
    const okSem = sems.includes('TODAS') || sems.includes(sem);
    return okSeg && okCat && okSem;
}

function obterHtmlBarraSeletoresInterativos() {
    const segs = filtrosMultiGraficos.segmentos;
    const cats = filtrosMultiGraficos.categorias;
    const sems = filtrosMultiGraficos.semanas;

    const opcoesSeg = ['TODOS', 'CONSTRUÇÃO MDU', 'EXPANSÃO MDU', 'MAILING'];
    const mostrarVistoria = segs.includes('TODOS') || segs.includes('CONSTRUÇÃO MDU');
    const opcoesCat = mostrarVistoria
        ? ['TODAS', 'ATIVAÇÃO', 'CONSTRUÇÃO', 'VISTORIA']
        : ['TODAS', 'ATIVAÇÃO', 'CONSTRUÇÃO'];
    const opcoesSem = ['TODAS', 'Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];

    const btnsSeg = opcoesSeg.map(op => {
        const ativo = segs.includes(op);
        return `<button type="button" onclick="alternarFiltroDinamicoComCtrl('segmentos', '${op}', event)" class="px-2.5 py-1 rounded-lg font-black text-[10px] transition ${ativo ? 'bg-cyan-400 text-slate-950 shadow ring-2 ring-white/60' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}">${op}</button>`;
    }).join('');

    const btnsCat = opcoesCat.map(op => {
        const ativo = cats.includes(op);
        return `<button type="button" onclick="alternarFiltroDinamicoComCtrl('categorias', '${op}', event)" class="px-2.5 py-1 rounded-lg font-black text-[10px] transition ${ativo ? 'bg-amber-400 text-slate-950 shadow ring-2 ring-white/60' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}">${op}</button>`;
    }).join('');

    const btnsSem = opcoesSem.map(op => {
        const ativo = sems.includes(op);
        return `<button type="button" onclick="alternarFiltroDinamicoComCtrl('semanas', '${op}', event)" class="px-2.5 py-1 rounded-lg font-black text-[10px] transition ${ativo ? 'bg-emerald-400 text-slate-950 shadow ring-2 ring-white/60' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}">${op === 'TODAS' ? 'Todas' : op}</button>`;
    }).join('');

    return `
        <div class="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 space-y-2">
            <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-700 pb-1.5">
                <span class="text-[10px] font-bold text-slate-300">
                    💡 Segure <kbd class="bg-slate-700 px-1.5 py-0.5 rounded text-cyan-300 font-mono">CTRL</kbd> ao clicar para marcar múltiplos itens simultaneamente
                </span>
                <button type="button" onclick="alternarModoMultiToque()" class="px-2.5 py-0.5 rounded text-[10px] font-black transition ${modoSelecaoMultiplaSemCtrl ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-300 border border-slate-600'}">
                    ☑️ Modo Multi S/ Teclado: ${modoSelecaoMultiplaSemCtrl ? 'ATIVO' : 'OFF'}
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                <div class="bg-slate-800/90 p-2 rounded-lg border border-slate-700">
                    <span class="text-[9px] font-black text-cyan-300 uppercase block mb-1">1. Segmento (${segs.join(' + ')}):</span>
                    <div class="flex flex-wrap gap-1">${btnsSeg}</div>
                </div>
                <div class="bg-slate-800/90 p-2 rounded-lg border border-slate-700">
                    <span class="text-[9px] font-black text-amber-300 uppercase block mb-1">2. Categoria (${cats.join(' + ')}):</span>
                    <div class="flex flex-wrap gap-1">${btnsCat}</div>
                </div>
                <div class="bg-slate-800/90 p-2 rounded-lg border border-slate-700">
                    <span class="text-[9px] font-black text-emerald-300 uppercase block mb-1">3. Semana (${sems.join(' + ')}):</span>
                    <div class="flex flex-wrap gap-1">${btnsSem}</div>
                </div>
            </div>
        </div>
    `;
}

function alternarInibicaoSecaoGrafico(chaveSecao) {
    secoesInibidasGraficos[chaveSecao] = !secoesInibidasGraficos[chaveSecao];
    aplicarVisibilidadeSecoesInibidas();
}

function mostrarTodasSecoesGraficos() {
    Object.keys(secoesInibidasGraficos).forEach(k => secoesInibidasGraficos[k] = false);
    aplicarVisibilidadeSecoesInibidas();
}

function aplicarVisibilidadeSecoesInibidas() {
    const mapaNomes = {
        consolidados: '1. Consolidados Topo',
        planilhaDinamica: '2. Planilha Dinâmica',
        geralTecnicos: '3. Atendidas por Técnico',
        evolucaoSegmentos: '4. Gráfico Evolução',
        picosHorarios: '5. Gráfico Picos Horários',
        planilhaHorarios: '6. Planilha Horários',
        rankingOfensores: '7. Ranking Ofensores',
        ofensoresSegmentos: '8. Malogros Construção x Expansão',
        controlePausas: '9. Controle de Pausas',
        impactoOperacional: '10. Impacto Operacional'
    };

    Object.entries(secoesInibidasGraficos).forEach(([chave, oculto]) => {
        const elSecao = document.getElementById(`secao-bloco-${chave}`);
        if (elSecao) elSecao.classList.toggle('hidden', oculto);
    });

    const barraChips = document.getElementById('barra-chips-inibicao-secoes');
    if (barraChips) {
        barraChips.innerHTML = Object.entries(mapaNomes).map(([chave, label]) => {
            const oculto = secoesInibidasGraficos[chave];
            return `
                <button type="button" onclick="alternarInibicaoSecaoGrafico('${chave}')" class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border ${oculto ? 'bg-red-50 text-red-700 border-red-300 line-through opacity-75' : 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-sm'}">
                    <span>${oculto ? '🚫' : '👁️'}</span> <span>${label}</span>
                </button>
            `;
        }).join('');
    }
}

function construirLayoutExclusivoAbaGraficos() {
    otimizarCabecalhoAzulLinhaUnica();
    const containerGraficos = document.getElementById('subview-graficos');
    if (!containerGraficos || containerGraficos.dataset.layoutReconstruidoV21 === 'true') return;

    const btnGraficos = document.getElementById('subtab-btn-graficos');
    const deveFicarOculta = !btnGraficos || !btnGraficos.classList.contains('bg-blue-900');

    containerGraficos.dataset.layoutReconstruidoV21 = 'true';
    containerGraficos.className = `space-y-4 pb-10 ${deveFicarOculta ? 'hidden' : ''}`.trim();

    containerGraficos.innerHTML = `
        <!-- BARRA DE TOPO + EXPORTAÇÃO -->
        <div class="bg-slate-900 text-white p-3.5 rounded-2xl shadow-lg border-b-4 border-cyan-400 space-y-2.5">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <span class="bg-cyan-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Painel Analítico Interativo</span>
                    <h2 class="text-sm sm:text-base font-black tracking-tight mt-0.5">📊 Indicadores de Produtividade, Segmentos & Ofensores</h2>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" onclick="mostrarTodasSecoesGraficos()" class="bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-600 font-bold text-[11px] px-3 py-1.5 rounded-xl transition">
                        👁️ Mostrar Todos os Blocos
                    </button>
                    <button type="button" onclick="exportarPlanilhaDinamicaOficialExcel()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow flex items-center gap-1.5 transition">
                        📥 Baixar Planilha c/ Materiais (.XLS)
                    </button>
                    <button type="button" onclick="gerarRelatorioVisualImpressaoPDF()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow flex items-center gap-1.5 transition">
                        🖨️ Imprimir / Salvar PDF
                    </button>
                </div>
            </div>
            <div id="container-seletores-globais-topo"></div>
        </div>

        <!-- BARRA DE INIBIÇÃO DE BLOCOS -->
        <div class="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-2">
            <span class="text-[10px] font-black text-slate-700 uppercase">👁️ Exibição na Tela (Clique para Inibir / Mostrar):</span>
            <div id="barra-chips-inibicao-secoes" class="flex flex-wrap gap-1.5"></div>
        </div>

        <!-- 1. CONSOLIDADOS SUPERIORES -->
        <div id="secao-bloco-consolidados" class="space-y-1.5">
            <div class="flex justify-between items-center px-1">
                <span class="text-[11px] font-black text-slate-700 uppercase">📌 Consolidados por Segmento e Porcentagem das Categorias</span>
                <button type="button" onclick="alternarInibicaoSecaoGrafico('consolidados')" class="text-[10px] font-bold text-red-600 hover:underline">🚫 Inibir Bloco</button>
            </div>
            <div id="painel-consolidado-topo-segmentos" class="grid grid-cols-1 lg:grid-cols-3 gap-4"></div>
        </div>

        <!-- 2. PLANILHA DINÂMICA DE PRODUTIVIDADE -->
        <div id="secao-bloco-planilhaDinamica" class="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
            <div class="bg-slate-900 text-white p-3.5 flex flex-wrap justify-between items-center gap-2">
                <div>
                    <span class="bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Produtividade • Apenas Concluídas</span>
                    <h3 class="font-black text-sm sm:text-base mt-0.5">📋 Planilha Dinâmica de Executados, Dias Trabalhados, Produtividade e HPs</h3>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="expandirTabelaModal('tbody-planilha-dinamica-oficial', 'Planilha Dinâmica de Produtividade')" class="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-[11px] px-3 py-1.5 rounded-lg shadow">
                        🔍 Expandir p/ Reunião
                    </button>
                    <button type="button" onclick="alternarInibicaoSecaoGrafico('planilhaDinamica')" class="bg-red-900/80 hover:bg-red-800 text-red-100 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">
                        🚫 Inibir
                    </button>
                </div>
            </div>
            <div id="barra-porcentagem-categorias-din" class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs"></div>
            <div class="overflow-x-auto max-h-[520px]">
                <table class="w-full text-left border-collapse text-xs">
                    <thead class="bg-slate-800 text-white uppercase text-[10px] sticky top-0 z-10">
                        <tr>
                            <th class="p-3 text-center">#</th>
                            <th class="p-3">Técnico / Equipe</th>
                            <th class="p-3 text-center bg-emerald-900 text-emerald-100">Nº Atividades Executadas</th>
                            <th class="p-3 text-center">Dias Trabalhados</th>
                            <th class="p-3 text-center bg-blue-900 text-cyan-200 font-black">Produtividade (Exec / Dia)</th>
                            <th class="p-3 text-center bg-indigo-900 text-indigo-100">Quantidade de HP</th>
                            <th class="p-3 text-center bg-purple-900 text-purple-100 font-black">HP / DIA</th>
                            <th class="p-3 text-center bg-orange-900 text-orange-100">⏸️ Tempo Paralisado</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-planilha-dinamica-oficial" class="divide-y divide-slate-200"></tbody>
                </table>
            </div>
        </div>

        <!-- 3. PLANILHA GERAL DE ATIVIDADES ATENDIDAS POR TÉCNICO -->
        <div id="secao-bloco-geralTecnicos" class="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
            <div class="bg-blue-950 text-white p-3.5 flex flex-wrap justify-between items-center gap-2">
                <div>
                    <span class="bg-cyan-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Resultado Geral por Técnico</span>
                    <h3 class="font-black text-sm sm:text-base mt-0.5">👷 Quantidade de Atividades Atendidas (Concluídas, Malogros e Apoios)</h3>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="expandirTabelaModal('tbody-geral-atendidas-tecnico', 'Atividades Atendidas por Técnico')" class="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-[11px] px-3 py-1.5 rounded-lg shadow">
                        🔍 Expandir p/ Reunião
                    </button>
                    <button type="button" onclick="alternarInibicaoSecaoGrafico('geralTecnicos')" class="bg-red-900/80 hover:bg-red-800 text-red-100 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">
                        🚫 Inibir
                    </button>
                </div>
            </div>
            <div class="overflow-x-auto max-h-[500px]">
                <table class="w-full text-left border-collapse text-xs">
                    <thead class="bg-slate-800 text-white uppercase text-[10px] sticky top-0 z-10">
                        <tr>
                            <th class="p-2.5 text-center">#</th>
                            <th class="p-2.5">Técnico / Equipe</th>
                            <th class="p-2.5 text-center bg-blue-900/80">Construção MDU<br><span class="text-[9px] font-normal text-blue-200">(Ativ / Const / Vist)</span></th>
                            <th class="p-2.5 text-center bg-indigo-900/80">Expansão MDU<br><span class="text-[9px] font-normal text-indigo-200">(Ativ / Const)</span></th>
                            <th class="p-2.5 text-center bg-purple-900/80">Mailing<br><span class="text-[9px] font-normal text-purple-200">(Ativ / Const)</span></th>
                            <th class="p-2.5 text-center bg-emerald-800 text-white font-black">🟢 Concluídas</th>
                            <th class="p-2.5 text-center bg-red-800 text-white font-black">🔴 Malogros</th>
                            <th class="p-2.5 text-center bg-fuchsia-800 text-white font-black">🤝 Apoios</th>
                            <th class="p-2.5 text-center bg-slate-950 text-cyan-300 font-black">Total Atendidas</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-geral-atendidas-tecnico" class="divide-y divide-slate-200"></tbody>
                </table>
            </div>
        </div>

        <!-- 4. GRÁFICO DE EVOLUÇÃO DOS SEGMENTOS -->
        <div id="secao-bloco-evolucaoSegmentos" class="bg-white rounded-2xl shadow-md border border-slate-200 p-4 space-y-3">
            <div class="flex flex-wrap justify-between items-center gap-2 border-b pb-2.5">
                <div>
                    <span class="bg-emerald-100 text-emerald-900 font-black text-[9px] px-2 py-0.5 rounded uppercase">Evolução dos Segmentos</span>
                    <h3 class="font-black text-slate-800 text-sm sm:text-base mt-0.5">📈 Evolução das Atividades Executadas por Segmento</h3>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="expandirGraficoModal('canvasEvolucaoSegmentos', 'Evolução dos Segmentos')" class="bg-blue-900 hover:bg-blue-800 text-white text-[11px] font-black px-3 py-1.5 rounded-lg shadow">
                        🔍 Expandir p/ Reunião
                    </button>
                    <button type="button" onclick="alternarInibicaoSecaoGrafico('evolucaoSegmentos')" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">
                        🚫 Inibir
                    </button>
                </div>
            </div>
            <div class="h-72 w-full">
                <canvas id="canvasEvolucaoSegmentos"></canvas>
            </div>
        </div>

        <!-- 5 E 6. PICOS DE HORÁRIOS E PLANILHA DE FAIXAS HORÁRIAS -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div id="secao-bloco-picosHorarios" class="bg-white rounded-2xl shadow-md border border-slate-200 p-4 space-y-3 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center border-b pb-2">
                        <div>
                            <span class="bg-blue-100 text-blue-900 font-black text-[9px] px-2 py-0.5 rounded uppercase">Picos e Extremos</span>
                            <h3 class="font-black text-slate-800 text-sm mt-0.5">🕒 Gráfico de Picos de Horários</h3>
                        </div>
                        <div class="flex gap-1">
                            <button type="button" onclick="expandirGraficoModal('canvasHorariosPicoOficial', 'Gráfico de Picos de Horários')" class="bg-blue-900 text-white text-[10px] font-black px-2.5 py-1 rounded-lg">🔍 Expandir</button>
                            <button type="button" onclick="alternarInibicaoSecaoGrafico('picosHorarios')" class="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-1 rounded-lg">🚫 Inibir</button>
                        </div>
                    </div>
                    <div id="cards-extremos-horarios-tecnicos" class="grid grid-cols-1 sm:grid-cols-3 gap-2 my-3"></div>
                </div>
                <div class="h-64 w-full">
                    <canvas id="canvasHorariosPicoOficial"></canvas>
                </div>
            </div>

            <div id="secao-bloco-planilhaHorarios" class="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
                <div class="bg-slate-900 text-white p-3.5 flex justify-between items-center">
                    <div>
                        <span class="bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Volume Real por Faixa</span>
                        <h3 class="font-bold text-xs sm:text-sm mt-0.5">⏰ Horários com Mais Atividades Abertas e Fechadas</h3>
                    </div>
                    <div class="flex gap-1">
                        <button type="button" onclick="expandirTabelaModal('tbody-horarios-pico-planilha', 'Horários com Mais Atividades Abertas e Fechadas')" class="bg-cyan-400 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded">🔍 Expandir</button>
                        <button type="button" onclick="alternarInibicaoSecaoGrafico('planilhaHorarios')" class="bg-red-900 text-red-100 text-[10px] font-bold px-2 py-1 rounded">🚫 Inibir</button>
                    </div>
                </div>
                <div class="overflow-y-auto max-h-[360px]">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead class="bg-slate-800 text-white uppercase text-[10px] sticky top-0">
                            <tr>
                                <th class="p-2.5">Faixa de Horário</th>
                                <th class="p-2.5 text-center bg-blue-900">🟢 Qtd. Abertas (Check-in)</th>
                                <th class="p-2.5 text-center bg-emerald-900">🔴 Qtd. Fechadas (Check-out)</th>
                                <th class="p-2.5 text-center">Total Movimentações</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-horarios-pico-planilha" class="divide-y divide-slate-200"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 7 E 8. RANKING DE OFENSORES + CONSTRUÇÃO MDU x EXPANSÃO MDU -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div id="secao-bloco-rankingOfensores" class="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
                <div class="bg-red-950 text-white p-3.5 flex justify-between items-center">
                    <div>
                        <span class="bg-red-300 text-red-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Ranking Geral</span>
                        <h3 class="font-bold text-xs sm:text-sm mt-0.5">🚨 Maiores Ofensores de Malogros (Números Reais e %)</h3>
                    </div>
                    <div class="flex gap-1">
                        <button type="button" onclick="expandirGraficoModal('canvasOfensoresRanking', 'Gráfico Ranking de Ofensores')" class="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-1 rounded">📊 Gráfico</button>
                        <button type="button" onclick="expandirTabelaModal('tbody-ranking-ofensores-geral', 'Ranking de Ofensores de Malogros')" class="bg-cyan-400 text-slate-950 font-black text-[10px] px-2 py-1 rounded">🔍 Planilha</button>
                        <button type="button" onclick="alternarInibicaoSecaoGrafico('rankingOfensores')" class="bg-red-800 text-white text-[10px] font-bold px-2 py-1 rounded">🚫</button>
                    </div>
                </div>
                <div class="p-3 h-52 border-b">
                    <canvas id="canvasOfensoresRanking"></canvas>
                </div>
                <div class="overflow-y-auto max-h-[280px]">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead class="bg-slate-800 text-white uppercase text-[10px] sticky top-0">
                            <tr>
                                <th class="p-2.5 text-center">#</th>
                                <th class="p-2.5">Ofensor de Malogro</th>
                                <th class="p-2.5 text-center">Nº Ocorrências</th>
                                <th class="p-2.5 text-right">% sobre Malogros</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-ranking-ofensores-geral" class="divide-y divide-slate-200"></tbody>
                    </table>
                </div>
            </div>

            <div id="secao-bloco-ofensoresSegmentos" class="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
                <div class="bg-amber-950 text-white p-3.5 flex justify-between items-center">
                    <div>
                        <span class="bg-amber-300 text-amber-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Comparativo entre Segmentos</span>
                        <h3 class="font-bold text-xs sm:text-sm mt-0.5">📊 Volume e % de Malogros: CONSTRUÇÃO MDU x EXPANSÃO MDU</h3>
                    </div>
                    <div class="flex gap-1">
                        <button type="button" onclick="expandirTabelaModal('tbody-ofensores-segmentos-mdu', 'Ofensores: CONSTRUÇÃO MDU x EXPANSÃO MDU')" class="bg-cyan-400 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded">
                            🔍 Expandir
                        </button>
                        <button type="button" onclick="alternarInibicaoSecaoGrafico('ofensoresSegmentos')" class="bg-red-900 text-red-100 text-[10px] font-bold px-2 py-1 rounded">
                            🚫 Inibir
                        </button>
                    </div>
                </div>
                <div id="resumo-topo-ofensores-segmentos" class="grid grid-cols-2 gap-2 p-3 bg-amber-50/60 border-b border-amber-200 text-xs"></div>
                <div class="overflow-y-auto max-h-[420px]">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead class="bg-slate-800 text-white uppercase text-[10px] sticky top-0">
                            <tr>
                                <th class="p-2.5">Ofensor de Malogro</th>
                                <th class="p-2.5 text-center bg-blue-900">CONSTRUÇÃO MDU<br><span class="text-[9px] font-normal">(Qtd / %)</span></th>
                                <th class="p-2.5 text-center bg-indigo-900">EXPANSÃO MDU<br><span class="text-[9px] font-normal">(Qtd / %)</span></th>
                                <th class="p-2.5 text-center bg-slate-950 text-amber-300">Soma (Const + Exp)<br><span class="text-[9px] font-normal">(Qtd / %)</span></th>
                            </tr>
                        </thead>
                        <tbody id="tbody-ofensores-segmentos-mdu" class="divide-y divide-slate-200"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 9 E 10 (NO FIM DA ABA): CONTROLE DE PAUSAS & IMPACTO OPERACIONAL -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            <!-- CONTROLE DE PAUSAS -->
            <div id="secao-bloco-controlePausas" class="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
                <div class="bg-orange-950 text-white p-3.5 flex justify-between items-center">
                    <div>
                        <span class="bg-orange-300 text-orange-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">CONTROLE DE PAUSAS</span>
                        <h3 class="font-bold text-xs sm:text-sm mt-0.5">⏸️ Indicador de Ociosidade e Tempo de Paralisação por Técnico</h3>
                    </div>
                    <div class="flex gap-1">
                        <button type="button" onclick="expandirTabelaModal('tbody-ranking-ociosidade-pausas', 'Controle de Pausas e Ociosidade por Técnico')" class="bg-cyan-400 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded">
                            🔍 Expandir
                        </button>
                        <button type="button" onclick="alternarInibicaoSecaoGrafico('controlePausas')" class="bg-red-900 text-red-100 text-[10px] font-bold px-2 py-1 rounded">
                            🚫 Inibir
                        </button>
                    </div>
                </div>
                <div id="kpis-controle-pausas-topo" class="grid grid-cols-3 gap-2 p-3 bg-orange-50/60 border-b border-orange-200 text-xs"></div>
                <div class="overflow-y-auto max-h-[380px]">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead class="bg-slate-800 text-white uppercase text-[10px] sticky top-0">
                            <tr>
                                <th class="p-2.5 text-center">#</th>
                                <th class="p-2.5">Técnico / Equipe</th>
                                <th class="p-2.5 text-center">Ativ. c/ Pausa</th>
                                <th class="p-2.5 text-center bg-orange-900 text-orange-100 font-black">Tempo Total Paralisado</th>
                                <th class="p-2.5 text-center">Média / Pausa</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-ranking-ociosidade-pausas" class="divide-y divide-slate-200"></tbody>
                    </table>
                </div>
            </div>

            <!-- IMPACTO OPERACIONAL -->
            <div id="secao-bloco-impactoOperacional" class="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
                <div class="bg-slate-900 text-white p-3.5 flex justify-between items-center border-b-2 border-red-500">
                    <div>
                        <span class="bg-red-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">IMPACTO OPERACIONAL</span>
                        <h3 class="font-bold text-xs sm:text-sm mt-0.5">⚠️ Tempo Perdido em Imprevistos e Maiores Causas</h3>
                    </div>
                    <div class="flex gap-1">
                        <button type="button" onclick="expandirGraficoModal('canvasImpactoImprevistos', 'Impacto Operacional — Maiores Causas de Imprevistos')" class="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-1 rounded">📊 Gráfico</button>
                        <button type="button" onclick="expandirTabelaModal('tbody-impacto-imprevistos-causas', 'Impacto Operacional — Tempo em Imprevistos')" class="bg-cyan-400 text-slate-950 font-black text-[10px] px-2 py-1 rounded">🔍 Planilha</button>
                        <button type="button" onclick="alternarInibicaoSecaoGrafico('impactoOperacional')" class="bg-red-800 text-white text-[10px] font-bold px-2 py-1 rounded">🚫</button>
                    </div>
                </div>
                <div id="kpis-impacto-imprevistos-topo" class="grid grid-cols-3 gap-2 p-3 bg-red-50/50 border-b border-red-200 text-xs"></div>
                <div class="p-3 h-44 border-b">
                    <canvas id="canvasImpactoImprevistos"></canvas>
                </div>
                <div class="overflow-y-auto max-h-[240px]">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead class="bg-slate-800 text-white uppercase text-[10px] sticky top-0">
                            <tr>
                                <th class="p-2.5">Causa do Imprevisto</th>
                                <th class="p-2.5 text-center">Ocorrências</th>
                                <th class="p-2.5 text-center bg-red-900 text-white font-black">Tempo Perdido</th>
                                <th class="p-2.5 text-right">% do Tempo</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-impacto-imprevistos-causas" class="divide-y divide-slate-200"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    aplicarVisibilidadeSecoesInibidas();
}

function abrirExplosaoPersonalizadaGraficos(tituloExplosao, listaRegistrosSubset) {
    const modal = document.getElementById('modal-explosao');
    const corpo = document.getElementById('tabela-explosao-corpo');
    if (!modal || !corpo) return;

    modal.style.zIndex = "95";
    document.getElementById('modal-explosao-titulo').innerText = `💥 Explosão de Dados: ${tituloExplosao} (${listaRegistrosSubset.length} reg.)`;
    corpo.innerHTML = "";

    if (listaRegistrosSubset.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Nenhum registo encontrado para este recorte.</td></tr>`;
    } else {
        listaRegistrosSubset.forEach(item => {
            const tax = classificarRegistroNovaTaxonomia(item);
            const sem = obterNumeroSemanaFormatado(item.dataRegistro);
            const apoios = typeof extrairApoiosDoRegistro === 'function' ? extrairApoiosDoRegistro(item) : [];
            const badgeAp = apoios.length > 0 ? `<div class="text-[9px] font-black text-purple-800">🤝 Apoio: ${apoios.join(', ')}</div>` : '';
            const detalheInfo = (item.malogros && item.malogros.length > 0) ? item.malogros.join(' + ') : (item.motivoDesfecho || 'Concluído');

            corpo.innerHTML += `
                <tr class="hover:bg-blue-50/50 border-b text-xs cursor-pointer" onclick="fecharModalExplosao(); fecharModalGraficoExpandido(); fecharModalTabelaExpandida(); abrirDetalhesAtividade(registrosSalvos.find(r => r.id === ${item.id}))">
                    <td class="p-2.5 font-mono font-bold">${item.dataRegistro}<div class="text-[9px] text-indigo-700">${sem}</div></td>
                    <td class="p-2.5"><div class="font-bold text-slate-800">${item.imovel}</div><div class="text-[10px] text-slate-500">📍 ${item.endereco || '-'}</div></td>
                    <td class="p-2.5 font-semibold text-blue-900">${item.equipe} ${obterCategoriaDiscretaTecnicoHtml(item.equipe)}${badgeAp}</td>
                    <td class="p-2.5"><span class="bg-slate-800 text-cyan-300 font-black px-2 py-0.5 rounded text-[10px]">${tax.segmento}</span><div class="text-[10px] font-bold text-slate-600 mt-0.5">Categoria: ${tax.categoria}</div></td>
                    <td class="p-2.5"><span class="font-bold px-2 py-0.5 rounded text-[10px] ${obterClasseCorDesfecho(item.desfecho)}">${item.desfecho}</span><div class="text-[9px] mt-0.5">HPs: <b>${item.hps || 0}</b></div></td>
                    <td class="p-2.5 text-slate-600">${detalheInfo}</td>
                </tr>
            `;
        });
    }
    modal.classList.remove('hidden');
}

function limparBotoesFecharDuplicadosModal(modalEl, funcaoFechar) {
    if (!modalEl) return;
    modalEl.onclick = function(ev) {
        if (ev.target === modalEl) funcaoFechar();
    };
    const botoes = Array.from(modalEl.querySelectorAll('button'));
    let botaoTopoJaVisto = false;
    botoes.forEach(btn => {
        const txt = (btn.innerText || '').trim().toUpperCase();
        const attr = (btn.getAttribute('onclick') || '');
        const ehBotaoFechar = txt === '✕' || txt === 'X' || txt.includes('FECHAR') || attr.includes('fecharModal');
        if (ehBotaoFechar) {
            btn.type = 'button';
            btn.onclick = function(e) {
                e.stopPropagation();
                funcaoFechar();
            };
            const noCabecalho = btn.closest('.bg-slate-900, .bg-blue-900, .bg-indigo-950, .border-b');
            if (noCabecalho && (txt === '✕' || txt === 'X' || txt.includes('FECHAR'))) {
                if (botaoTopoJaVisto) btn.remove();
                else botaoTopoJaVisto = true;
            }
        }
    });
}

window.expandirTabelaModal = function(idTbodyOrigem, tituloJanela) {
    const modal = document.getElementById('modal-expandir-tabela');
    const titulo = document.getElementById('modal-tabela-expandida-titulo');
    const container = document.getElementById('container-tabela-expandida');
    const tbodyOrigem = document.getElementById(idTbodyOrigem);
    if (!modal || !container || !tbodyOrigem) return;

    estadoModalExpandidoAtual = { ativo: true, tipo: 'tabela', idOrigem: idTbodyOrigem, titulo: tituloJanela };
    if (titulo) titulo.innerText = `📊 Modo Apresentação: ${tituloJanela}`;

    let boxSeletoresModal = document.getElementById('seletores-reuniao-modal-tabela');
    if (!boxSeletoresModal) {
        boxSeletoresModal = document.createElement('div');
        boxSeletoresModal.id = 'seletores-reuniao-modal-tabela';
        boxSeletoresModal.className = 'px-4 pt-3 pb-1 bg-slate-100 border-b border-slate-300';
        container.parentNode.insertBefore(boxSeletoresModal, container);
    }
    boxSeletoresModal.innerHTML = obterHtmlBarraSeletoresInterativos();

    const tabelaOriginal = tbodyOrigem.closest('table');
    if (!tabelaOriginal) return;

    container.innerHTML = "";
    const infoTopo = document.getElementById('barra-porcentagem-categorias-din');
    if (idTbodyOrigem === 'tbody-planilha-dinamica-oficial' && infoTopo) {
        const cloneInfo = infoTopo.cloneNode(true);
        cloneInfo.removeAttribute('id');
        cloneInfo.className = 'bg-blue-50 px-4 py-2 border-b border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs mb-2 rounded-lg';
        container.appendChild(cloneInfo);
    }

    const tabelaClone = tabelaOriginal.cloneNode(true);
    tabelaClone.className = "w-full text-left border-collapse text-xs sm:text-sm";
    tabelaClone.querySelector('thead')?.classList.add('sticky', 'top-0', 'z-10', 'shadow-sm');
    const tbodyClone = tabelaClone.querySelector('tbody');
    if (tbodyClone) tbodyClone.removeAttribute('id');

    container.appendChild(tabelaClone);
    limparBotoesFecharDuplicadosModal(modal, window.fecharModalTabelaExpandida);
    modal.classList.remove('hidden');
};

window.expandirGraficoModal = function(idCanvasOrigem, tituloJanela) {
    const modal = document.getElementById('modal-expandir-grafico');
    const titulo = document.getElementById('modal-grafico-expandido-titulo');
    const canvasOrigem = document.getElementById(idCanvasOrigem);
    const canvasAlvo = document.getElementById('canvasGraficoExpandido');
    if (!modal || !canvasOrigem || !canvasAlvo) return;

    estadoModalExpandidoAtual = { ativo: true, tipo: 'grafico', idOrigem: idCanvasOrigem, titulo: tituloJanela };
    if (titulo) titulo.innerText = `📈 Modo Apresentação: ${tituloJanela}`;

    let boxSeletoresGraf = document.getElementById('seletores-reuniao-modal-grafico');
    if (!boxSeletoresGraf) {
        boxSeletoresGraf = document.createElement('div');
        boxSeletoresGraf.id = 'seletores-reuniao-modal-grafico';
        boxSeletoresGraf.className = 'px-4 pt-3 pb-1 bg-slate-100 border-b border-slate-300';
        const wrapperCanvas = canvasAlvo.parentElement;
        if (wrapperCanvas && wrapperCanvas.parentNode) {
            wrapperCanvas.parentNode.insertBefore(boxSeletoresGraf, wrapperCanvas);
        }
    }
    boxSeletoresGraf.innerHTML = obterHtmlBarraSeletoresInterativos();

    limparBotoesFecharDuplicadosModal(modal, window.fecharModalGraficoExpandido);
    modal.classList.remove('hidden');

    const chartOriginal = Chart.getChart(canvasOrigem);
    if (!chartOriginal) return;

    const instAnterior = Chart.getChart(canvasAlvo);
    if (instAnterior) { try { instAnterior.destroy(); } catch (e) {} }
    if (typeof graficoExpandidoInstancia !== 'undefined' && graficoExpandidoInstancia) {
        try { graficoExpandidoInstancia.destroy(); } catch (e) {}
        graficoExpandidoInstancia = null;
    }

    graficoExpandidoInstancia = new Chart(canvasAlvo, {
        type: chartOriginal.config.type,
        data: JSON.parse(JSON.stringify(chartOriginal.data)),
        options: {
            ...chartOriginal.config.options,
            responsive: true,
            maintainAspectRatio: false,
            plugins: { ...chartOriginal.config.options.plugins, legend: { display: true, position: 'top' } },
            onClick: (event, elements) => {
                if (elements.length > 0 && chartOriginal.config.options.onClick) {
                    chartOriginal.config.options.onClick(event, elements);
                }
            }
        }
    });
};

function atualizarConteudoModalExpandidoAoVivo() {
    if (!estadoModalExpandidoAtual.ativo) return;
    if (estadoModalExpandidoAtual.tipo === 'tabela') {
        window.expandirTabelaModal(estadoModalExpandidoAtual.idOrigem, estadoModalExpandidoAtual.titulo);
    } else if (estadoModalExpandidoAtual.tipo === 'grafico') {
        window.expandirGraficoModal(estadoModalExpandidoAtual.idOrigem, estadoModalExpandidoAtual.titulo);
    }
}

window.renderizarAbaGraficosCompletaOficial = function() {
    otimizarCabecalhoAzulLinhaUnica();
    construirLayoutExclusivoAbaGraficos();
    registroExplosaoCache.clear();
    contadorChaveExplosao = 0;

    const containerSeletoresTopo = document.getElementById('container-seletores-globais-topo');
    if (containerSeletoresTopo) {
        containerSeletoresTopo.innerHTML = obterHtmlBarraSeletoresInterativos();
    }

    const ehDesfechoConcluido = (d) => ['CONCLUIDA', 'CONCLUÍDA'].includes(String(d || '').toUpperCase().trim());

    const basePeriodoBruta = (dadosFiltradosAtuais || []).filter(r =>
        r &&
        !normalizarChaveNome(r.equipe).includes('AAAAAATESTE') &&
        r.equipe !== '__CONFIG_SISTEMA__' &&
        r.projeto !== '__CONFIG_AUDITORIA__' &&
        r.projeto !== 'IMPREVISTO / ATRASO' &&
        r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
        r.projeto !== PROJETO_SOLIC_MATERIAL &&
        !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(String(r.desfecho || '').toUpperCase().trim())
    ).map(r => ({
        ...r,
        desfecho: ehDesfechoConcluido(r.desfecho) ? 'CONCLUIDA' : String(r.desfecho || '').toUpperCase().trim(),
        _tax: classificarRegistroNovaTaxonomia(r),
        _semana: obterNumeroSemanaFormatado(r.dataRegistro)
    }));

    const baseFiltradaSelecao = basePeriodoBruta.filter(registroPassaNosFiltrosGlobaisGraficos);
    const concluidasFiltradasSelecao = baseFiltradaSelecao.filter(r => r.desfecho === 'CONCLUIDA');

    // 1. CONSOLIDADOS SUPERIORES
    const painelTopo = document.getElementById('painel-consolidado-topo-segmentos');
    if (painelTopo) {
        const cfgSegmentos = [
            { nome: 'CONSTRUÇÃO MDU', corHeader: 'bg-blue-900 text-white border-blue-400', corBg: 'bg-blue-50/50 border-blue-200', categorias: ['ATIVAÇÃO', 'CONSTRUÇÃO', 'VISTORIA'] },
            { nome: 'EXPANSÃO MDU', corHeader: 'bg-indigo-900 text-white border-indigo-400', corBg: 'bg-indigo-50/50 border-indigo-200', categorias: ['ATIVAÇÃO', 'CONSTRUÇÃO'] },
            { nome: 'MAILING', corHeader: 'bg-purple-900 text-white border-purple-400', corBg: 'bg-purple-50/50 border-purple-200', categorias: ['ATIVAÇÃO', 'CONSTRUÇÃO'] }
        ];

        const totalExecRecorte = concluidasFiltradasSelecao.length;

        painelTopo.innerHTML = cfgSegmentos.map(seg => {
            const concluidasSeg = concluidasFiltradasSelecao.filter(r => r._tax.segmento === seg.nome);
            const atendidasSeg = baseFiltradaSelecao.filter(r => r._tax.segmento === seg.nome);
            const totalSeg = concluidasSeg.length;
            const totalHpsSeg = concluidasSeg.reduce((acc, r) => acc + (Number(r.hps) || 0), 0);
            const percSobreGeral = totalExecRecorte > 0 ? ((totalSeg / totalExecRecorte) * 100).toFixed(1) : '0.0';
            const chaveExpSeg = registrarListaParaExplosao(`${seg.nome} (Atendidas no Filtro)`, atendidasSeg);

            const linhasCatHtml = seg.categorias.map(cat => {
                const listaCat = concluidasSeg.filter(r => r._tax.categoria === cat);
                const qtdCat = listaCat.length;
                const hpsCat = listaCat.reduce((acc, r) => acc + (Number(r.hps) || 0), 0);
                const percCat = totalSeg > 0 ? ((qtdCat / totalSeg) * 100).toFixed(1) : '0.0';
                const chaveExpCat = registrarListaParaExplosao(`${seg.nome} • ${cat} (Concluídas)`, listaCat);

                return `
                    <div onclick="dispararExplosaoPorChave('${chaveExpCat}')" class="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-blue-500 transition shadow-sm">
                        <div>
                            <span class="font-black text-slate-800 text-xs underline decoration-dotted">${cat}</span>
                            <div class="text-[10px] text-slate-500">HPs: <b>${hpsCat}</b></div>
                        </div>
                        <div class="text-right">
                            <span class="font-black text-emerald-700 text-sm">${qtdCat} exec.</span>
                            <span class="block text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">${percCat}% do segmento</span>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="rounded-2xl border-2 ${seg.corBg} shadow-sm overflow-hidden flex flex-col justify-between">
                    <div class="${seg.corHeader} p-3 border-b-2 flex justify-between items-center cursor-pointer" onclick="dispararExplosaoPorChave('${chaveExpSeg}')">
                        <div>
                            <span class="text-[9px] uppercase font-bold opacity-80 block">Segmento Oficial (Clique p/ Explosão)</span>
                            <h4 class="font-black text-sm sm:text-base underline decoration-dotted">${seg.nome}</h4>
                        </div>
                        <div class="text-right">
                            <span class="text-lg font-black text-cyan-300">${totalSeg} exec.</span>
                            <span class="block text-[10px] opacity-90">${percSobreGeral}% do recorte (${totalHpsSeg} HPs)</span>
                        </div>
                    </div>
                    <div class="p-3 space-y-2 flex-1 flex flex-col justify-center">
                        ${linhasCatHtml}
                    </div>
                    <div class="bg-slate-200/70 px-3.5 py-1.5 text-[10px] font-bold text-slate-700 flex justify-between">
                        <span>Total Atendido: ${atendidasSeg.length}</span>
                        <span>Malogros/Pend.: ${atendidasSeg.length - totalSeg}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 2. PLANILHA DINÂMICA DE PRODUTIVIDADE
    const barraPercCat = document.getElementById('barra-porcentagem-categorias-din');
    if (barraPercCat) {
        const totDin = concluidasFiltradasSelecao.length;
        const qtdAtiv = concluidasFiltradasSelecao.filter(r => r._tax.categoria === 'ATIVAÇÃO').length;
        const qtdConst = concluidasFiltradasSelecao.filter(r => r._tax.categoria === 'CONSTRUÇÃO').length;
        const qtdVist = concluidasFiltradasSelecao.filter(r => r._tax.categoria === 'VISTORIA').length;
        const pAtiv = totDin > 0 ? ((qtdAtiv / totDin) * 100).toFixed(1) : '0.0';
        const pConst = totDin > 0 ? ((qtdConst / totDin) * 100).toFixed(1) : '0.0';
        const pVist = totDin > 0 ? ((qtdVist / totDin) * 100).toFixed(1) : '0.0';

        barraPercCat.innerHTML = `
            <div class="font-black text-slate-700">
                🎯 Seleção Ativa: <span class="text-blue-900">${filtrosMultiGraficos.segmentos.join(' + ')}</span> • <span class="text-amber-800">${filtrosMultiGraficos.categorias.join(' + ')}</span> • <span class="text-emerald-800">${filtrosMultiGraficos.semanas.join(' + ')}</span> (${totDin} concluídas)
            </div>
            <div class="flex flex-wrap gap-2">
                <span class="bg-emerald-100 text-emerald-950 font-black px-2.5 py-1 rounded-lg border border-emerald-300">⚡ ATIVAÇÃO: ${qtdAtiv} (${pAtiv}%)</span>
                <span class="bg-blue-100 text-blue-950 font-black px-2.5 py-1 rounded-lg border border-blue-300">🛠️ CONSTRUÇÃO: ${qtdConst} (${pConst}%)</span>
                <span class="bg-purple-100 text-purple-950 font-black px-2.5 py-1 rounded-lg border border-purple-300">🔍 VISTORIA: ${qtdVist} (${pVist}%)</span>
            </div>
        `;
    }

    const equipesVisiveis = obterEquipesVisiveisUsuarioAtual(true);
    const mapaDin = {};
    equipesVisiveis.forEach(eq => {
        mapaDin[eq.nome] = { nome: eq.nome, executados: 0, hps: 0, minPausa: 0, diasSet: new Set(), registros: [] };
    });

    concluidasFiltradasSelecao.forEach(r => {
        const nome = r.equipe || 'NÃO IDENTIFICADO';
        if (normalizarChaveNome(nome).includes('AAAAAATESTE')) return;
        if (!mapaDin[nome]) mapaDin[nome] = { nome, executados: 0, hps: 0, minPausa: 0, diasSet: new Set(), registros: [] };
        mapaDin[nome].executados++;
        mapaDin[nome].hps += Number(r.hps) || 0;
        mapaDin[nome].minPausa += Number(r.tempoPausadoMinutos) || 0;
        if (r.dataRegistro) mapaDin[nome].diasSet.add(r.dataRegistro);
        mapaDin[nome].registros.push(r);
    });

    const listaDinamica = Object.values(mapaDin).map(item => {
        const dias = item.diasSet.size;
        return {
            ...item,
            dias,
            produtividade: dias > 0 ? (item.executados / dias) : 0,
            hpDia: dias > 0 ? (item.hps / dias) : 0
        };
    }).sort((a, b) => b.executados - a.executados || b.produtividade - a.produtividade || a.nome.localeCompare(b.nome));

    const tbodyDin = document.getElementById('tbody-planilha-dinamica-oficial');
    if (tbodyDin) {
        tbodyDin.innerHTML = "";
        let somaExec = 0, somaHps = 0, somaPausa = 0;
        const diasGlobaisSet = new Set();

        listaDinamica.forEach((t, idx) => {
            somaExec += t.executados;
            somaHps += t.hps;
            somaPausa += t.minPausa;
            t.diasSet.forEach(d => diasGlobaisSet.add(d));
            const chaveExp = registrarListaParaExplosao(`Executadas por ${t.nome}`, t.registros);

            const tr = document.createElement('tr');
            tr.className = "hover:bg-blue-50/60 cursor-pointer transition";
            tr.setAttribute('onclick', `dispararExplosaoPorChave('${chaveExp}')`);
            tr.innerHTML = `
                <td class="p-3 text-center font-bold text-slate-400">${idx + 1}º</td>
                <td class="p-3 font-black text-blue-950"><span class="underline decoration-dotted">${t.nome}</span>${obterCategoriaDiscretaTecnicoHtml(t.nome)}</td>
                <td class="p-3 text-center font-black text-emerald-700 bg-emerald-50/70 text-sm">${t.executados}</td>
                <td class="p-3 text-center font-mono font-bold text-slate-700">${t.dias}</td>
                <td class="p-3 text-center font-black text-blue-950 bg-blue-50/80 text-sm">${t.produtividade.toFixed(2)}</td>
                <td class="p-3 text-center font-black text-indigo-900 bg-indigo-50/60">${t.hps}</td>
                <td class="p-3 text-center font-black text-purple-900 bg-purple-50/60">${t.hpDia.toFixed(1)}</td>
                <td class="p-3 text-center font-bold text-orange-800 bg-orange-50/50">${t.minPausa > 0 ? `${t.minPausa} min` : '-'}</td>
            `;
            tbodyDin.appendChild(tr);
        });

        const diasGlobais = diasGlobaisSet.size;
        const prodGlobal = diasGlobais > 0 ? (somaExec / diasGlobais).toFixed(2) : "0.00";
        const hpDiaGlobal = diasGlobais > 0 ? (somaHps / diasGlobais).toFixed(1) : "0.0";
        const chaveExpTot = registrarListaParaExplosao(`Total Concluídas na Seleção`, concluidasFiltradasSelecao);

        tbodyDin.innerHTML += `
            <tr onclick="dispararExplosaoPorChave('${chaveExpTot}')" class="bg-slate-900 text-white font-black text-xs cursor-pointer hover:bg-slate-800">
                <td colspan="2" class="p-3 text-right uppercase underline decoration-dotted">Total Consolidado da Seleção:</td>
                <td class="p-3 text-center text-emerald-300 text-sm">${somaExec}</td>
                <td class="p-3 text-center font-mono">${diasGlobais} d</td>
                <td class="p-3 text-center text-cyan-300 text-sm">${prodGlobal}</td>
                <td class="p-3 text-center text-indigo-200">${somaHps}</td>
                <td class="p-3 text-center text-purple-200">${hpDiaGlobal}</td>
                <td class="p-3 text-center text-orange-300">${somaPausa} min</td>
            </tr>
        `;
    }

    // 3. PLANILHA GERAL DE ATIVIDADES ATENDIDAS POR TÉCNICO
    const mapaGeralTec = {};
    equipesVisiveis.forEach(eq => {
        mapaGeralTec[eq.nome] = {
            nome: eq.nome,
            cMduAtiv: 0, cMduConst: 0, cMduVist: 0,
            eMduAtiv: 0, eMduConst: 0,
            mailAtiv: 0, mailConst: 0,
            concluidas: 0, malogros: 0, apoios: 0, totalAtendidas: 0,
            registros: []
        };
    });

    const setApoiosUnicosGeral = new Set();

    baseFiltradaSelecao.forEach(r => {
        const nome = r.equipe || 'NÃO IDENTIFICADO';
        if (normalizarChaveNome(nome).includes('AAAAAATESTE')) return;
        if (!mapaGeralTec[nome]) {
            mapaGeralTec[nome] = {
                nome, cMduAtiv: 0, cMduConst: 0, cMduVist: 0, eMduAtiv: 0, eMduConst: 0, mailAtiv: 0, mailConst: 0,
                concluidas: 0, malogros: 0, apoios: 0, totalAtendidas: 0, registros: []
            };
        }
        const item = mapaGeralTec[nome];
        item.totalAtendidas++;
        item.registros.push(r);

        if (r.desfecho === 'CONCLUIDA') item.concluidas++;
        else item.malogros++;

        if (r._tax.segmento === 'CONSTRUÇÃO MDU') {
            if (r._tax.categoria === 'ATIVAÇÃO') item.cMduAtiv++;
            else if (r._tax.categoria === 'CONSTRUÇÃO') item.cMduConst++;
            else item.cMduVist++;
        } else if (r._tax.segmento === 'EXPANSÃO MDU') {
            if (r._tax.categoria === 'ATIVAÇÃO') item.eMduAtiv++;
            else item.eMduConst++;
        } else if (r._tax.segmento === 'MAILING') {
            if (r._tax.categoria === 'ATIVAÇÃO') item.mailAtiv++;
            else item.mailConst++;
        }

        if (typeof extrairApoiosDoRegistro === 'function') {
            extrairApoiosDoRegistro(r).forEach(apNome => {
                if (normalizarChaveNome(apNome).includes('AAAAAATESTE')) return;
                if (!mapaGeralTec[apNome]) {
                    mapaGeralTec[apNome] = {
                        nome: apNome, cMduAtiv: 0, cMduConst: 0, cMduVist: 0, eMduAtiv: 0, eMduConst: 0, mailAtiv: 0, mailConst: 0,
                        concluidas: 0, malogros: 0, apoios: 0, totalAtendidas: 0, registros: []
                    };
                }
                const codBase = typeof obterCodigoBaseImovel === 'function' ? obterCodigoBaseImovel(r.imovel) : r.imovel;
                const chAp = `${r.dataRegistro}_${codBase}_${apNome}`;
                if (!setApoiosUnicosGeral.has(chAp)) {
                    setApoiosUnicosGeral.add(chAp);
                    mapaGeralTec[apNome].apoios++;
                    mapaGeralTec[apNome].registros.push(r);
                }
            });
        }
    });

    const tbodyGeralAtend = document.getElementById('tbody-geral-atendidas-tecnico');
    if (tbodyGeralAtend) {
        tbodyGeralAtend.innerHTML = "";
        let totConc = 0, totMal = 0, totAp = 0, totAtend = 0;

        Object.values(mapaGeralTec)
            .sort((a, b) => b.concluidas - a.concluidas || b.totalAtendidas - a.totalAtendidas || b.apoios - a.apoios)
            .forEach((t, idx) => {
                totConc += t.concluidas;
                totMal += t.malogros;
                totAp += t.apoios;
                totAtend += t.totalAtendidas;
                const chaveExp = registrarListaParaExplosao(`Atendidas por ${t.nome}`, t.registros);

                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 cursor-pointer transition";
                tr.setAttribute('onclick', `dispararExplosaoPorChave('${chaveExp}')`);
                tr.innerHTML = `
                    <td class="p-2.5 text-center font-bold text-slate-400">${idx + 1}º</td>
                    <td class="p-2.5 font-black text-slate-800"><span class="underline decoration-dotted">${t.nome}</span>${obterCategoriaDiscretaTecnicoHtml(t.nome)}</td>
                    <td class="p-2.5 text-center font-semibold bg-blue-50/40"><span class="text-emerald-700 font-bold">${t.cMduAtiv}</span> / <span class="text-blue-800 font-bold">${t.cMduConst}</span> / <span class="text-purple-800 font-bold">${t.cMduVist}</span></td>
                    <td class="p-2.5 text-center font-semibold bg-indigo-50/40"><span class="text-emerald-700 font-bold">${t.eMduAtiv}</span> / <span class="text-indigo-800 font-bold">${t.eMduConst}</span></td>
                    <td class="p-2.5 text-center font-semibold bg-purple-50/40"><span class="text-emerald-700 font-bold">${t.mailAtiv}</span> / <span class="text-purple-800 font-bold">${t.mailConst}</span></td>
                    <td class="p-2.5 text-center font-black text-emerald-700 bg-emerald-50/80 text-sm">${t.concluidas}</td>
                    <td class="p-2.5 text-center font-black text-red-700 bg-red-50/80 text-sm">${t.malogros}</td>
                    <td class="p-2.5 text-center font-black text-fuchsia-800 bg-fuchsia-50/80">${t.apoios > 0 ? `🤝 ${t.apoios}` : '0'}</td>
                    <td class="p-2.5 text-center font-black text-slate-900 bg-slate-100 text-sm">${t.totalAtendidas}</td>
                `;
                tbodyGeralAtend.appendChild(tr);
            });

        const chaveExpGeral = registrarListaParaExplosao(`Todas Atividades Atendidas na Seleção`, baseFiltradaSelecao);
        tbodyGeralAtend.innerHTML += `
            <tr onclick="dispararExplosaoPorChave('${chaveExpGeral}')" class="bg-slate-900 text-white font-black text-xs cursor-pointer hover:bg-slate-800">
                <td colspan="5" class="p-2.5 text-right uppercase underline decoration-dotted">Total Geral na Seleção:</td>
                <td class="p-2.5 text-center text-emerald-300">${totConc}</td>
                <td class="p-2.5 text-center text-red-300">${totMal}</td>
                <td class="p-2.5 text-center text-fuchsia-300">🤝 ${totAp}</td>
                <td class="p-2.5 text-center text-cyan-300">${totAtend}</td>
            </tr>
        `;
    }

    // 4. GRÁFICO DE EVOLUÇÃO DOS SEGMENTOS
    const datasUnicas = [...new Set(baseFiltradaSelecao.map(r => r.dataRegistro).filter(Boolean))].sort();
    const ctxEvo = document.getElementById('canvasEvolucaoSegmentos')?.getContext('2d');
    if (ctxEvo) {
        if (chartEvolucaoSegmentosInst) chartEvolucaoSegmentosInst.destroy();
        chartEvolucaoSegmentosInst = new Chart(ctxEvo, {
            type: 'bar',
            data: {
                labels: datasUnicas.length > 0 ? datasUnicas.map(d => d.split('-').reverse().slice(0, 2).join('/')) : ['Sem dados'],
                datasets: [
                    {
                        label: '🏗️ CONSTRUÇÃO MDU (Exec.)',
                        data: datasUnicas.map(dt => concluidasFiltradasSelecao.filter(r => r.dataRegistro === dt && r._tax.segmento === 'CONSTRUÇÃO MDU').length),
                        backgroundColor: '#1d4ed8',
                        borderRadius: 4
                    },
                    {
                        label: '🚀 EXPANSÃO MDU (Exec.)',
                        data: datasUnicas.map(dt => concluidasFiltradasSelecao.filter(r => r.dataRegistro === dt && r._tax.segmento === 'EXPANSÃO MDU').length),
                        backgroundColor: '#059669',
                        borderRadius: 4
                    },
                    {
                        label: '📬 MAILING (Exec.)',
                        data: datasUnicas.map(dt => concluidasFiltradasSelecao.filter(r => r.dataRegistro === dt && r._tax.segmento === 'MAILING').length),
                        backgroundColor: '#7c3aed',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (e, el) => {
                    if (el.length > 0 && datasUnicas[el[0].index]) {
                        const dtAlvo = datasUnicas[el[0].index];
                        abrirExplosaoPersonalizadaGraficos(`Evolução em ${dtAlvo}`, baseFiltradaSelecao.filter(r => r.dataRegistro === dtAlvo));
                    }
                }
            }
        });
    }

    // 5 e 6. PICOS DE HORÁRIOS + PLANILHA DE FAIXAS HORÁRIAS
    const aberturasPorHora = new Array(24).fill(0);
    const fechamentosPorHora = new Array(24).fill(0);
    const registrosPorHora = Array.from({ length: 24 }, () => []);

    let tecMaisCedo = { nome: '-', hora: '--:--', min: 9999, imovel: '', reg: null };
    let tecMaisTarde = { nome: '-', hora: '--:--', min: -1, imovel: '', reg: null };
    let tecMaisTempo = { nome: '-', duracaoTxt: '--h --m', durMin: -1, imovel: '', reg: null };

    baseFiltradaSelecao.forEach(r => {
        const minIn = typeof converterHorarioParaMinutos === 'function' ? converterHorarioParaMinutos(r.hEntrada) : null;
        const minOut = typeof converterHorarioParaMinutos === 'function' ? converterHorarioParaMinutos(r.hSaida) : null;
        const pausa = Number(r.tempoPausadoMinutos) || 0;

        if (minIn !== null) {
            const hIn = Math.floor(minIn / 60);
            if (hIn >= 0 && hIn < 24) {
                aberturasPorHora[hIn]++;
                registrosPorHora[hIn].push(r);
            }
            if (minIn < tecMaisCedo.min) {
                tecMaisCedo = { nome: r.equipe, hora: r.hEntrada, min: minIn, imovel: r.imovel, reg: r };
            }
        }
        if (minOut !== null) {
            const hOut = Math.floor(minOut / 60);
            if (hOut >= 0 && hOut < 24) {
                fechamentosPorHora[hOut]++;
                if (!registrosPorHora[hOut].includes(r)) registrosPorHora[hOut].push(r);
            }
            if (minOut > tecMaisTarde.min) {
                tecMaisTarde = { nome: r.equipe, hora: r.hSaida, min: minOut, imovel: r.imovel, reg: r };
            }
        }
        if (minIn !== null && minOut !== null && minOut >= minIn) {
            const durLiq = Math.max(0, (minOut - minIn) - pausa);
            if (durLiq > 0 && durLiq <= 840 && durLiq > tecMaisTempo.durMin) {
                const txtDur = typeof formatarDuracaoTexto === 'function' ? formatarDuracaoTexto(durLiq) : `${durLiq}m`;
                tecMaisTempo = { nome: r.equipe, duracaoTxt: txtDur, durMin: durLiq, imovel: r.imovel, reg: r };
            }
        }
    });

    const boxExtremos = document.getElementById('cards-extremos-horarios-tecnicos');
    if (boxExtremos) {
        boxExtremos.innerHTML = `
            <div onclick="${tecMaisCedo.reg ? `abrirDetalhesAtividade(registrosSalvos.find(x => x.id === ${tecMaisCedo.reg.id}))` : ''}" class="bg-blue-50 border border-blue-200 p-2.5 rounded-xl cursor-pointer hover:border-blue-500 transition">
                <span class="text-[9px] font-black text-blue-800 uppercase block">🌅 Abriu Mais Cedo</span>
                <div class="font-black text-blue-950 text-xs truncate mt-0.5">${tecMaisCedo.nome}</div>
                <div class="text-[11px] font-mono font-bold text-emerald-700">Às ${tecMaisCedo.hora} ${tecMaisCedo.imovel ? `(${tecMaisCedo.imovel})` : ''}</div>
            </div>
            <div onclick="${tecMaisTarde.reg ? `abrirDetalhesAtividade(registrosSalvos.find(x => x.id === ${tecMaisTarde.reg.id}))` : ''}" class="bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl cursor-pointer hover:border-indigo-500 transition">
                <span class="text-[9px] font-black text-indigo-800 uppercase block">🌙 Fechou Mais Tarde</span>
                <div class="font-black text-indigo-950 text-xs truncate mt-0.5">${tecMaisTarde.nome}</div>
                <div class="text-[11px] font-mono font-bold text-indigo-700">Às ${tecMaisTarde.hora} ${tecMaisTarde.imovel ? `(${tecMaisTarde.imovel})` : ''}</div>
            </div>
            <div onclick="${tecMaisTempo.reg ? `abrirDetalhesAtividade(registrosSalvos.find(x => x.id === ${tecMaisTempo.reg.id}))` : ''}" class="bg-amber-50 border border-amber-200 p-2.5 rounded-xl cursor-pointer hover:border-amber-500 transition">
                <span class="text-[9px] font-black text-amber-900 uppercase block">⏱️ Maior Tempo na Atividade</span>
                <div class="font-black text-amber-950 text-xs truncate mt-0.5">${tecMaisTempo.nome}</div>
                <div class="text-[11px] font-mono font-bold text-amber-800">${tecMaisTempo.duracaoTxt} ${tecMaisTempo.imovel ? `(${tecMaisTempo.imovel})` : ''}</div>
            </div>
        `;
    }

    const ctxHorasNovo = document.getElementById('canvasHorariosPicoOficial')?.getContext('2d');
    if (ctxHorasNovo) {
        if (chartHorariosPicoNovoInst) chartHorariosPicoNovoInst.destroy();
        const labelsH = [], sliceIn = [], sliceOut = [];
        for (let h = 6; h <= 21; h++) {
            labelsH.push(`${String(h).padStart(2, '0')}h`);
            sliceIn.push(aberturasPorHora[h]);
            sliceOut.push(fechamentosPorHora[h]);
        }
        chartHorariosPicoNovoInst = new Chart(ctxHorasNovo, {
            type: 'line',
            data: {
                labels: labelsH,
                datasets: [
                    { label: '🟢 Atividades Abertas', data: sliceIn, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.15)', fill: true, tension: 0.35 },
                    { label: '🔴 Atividades Fechadas', data: sliceOut, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.15)', fill: true, tension: 0.35 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (e, el) => {
                    if (el.length > 0) {
                        const hClicada = el[0].index + 6;
                        abrirExplosaoPersonalizadaGraficos(`Faixa Horária ${String(hClicada).padStart(2, '0')}:00 às ${String(hClicada).padStart(2, '0')}:59`, registrosPorHora[hClicada]);
                    }
                }
            }
        });
    }

    const tbodyHorarios = document.getElementById('tbody-horarios-pico-planilha');
    if (tbodyHorarios) {
        tbodyHorarios.innerHTML = "";
        const faixasOrdenadas = [];
        for (let h = 6; h <= 21; h++) {
            const ab = aberturasPorHora[h];
            const fe = fechamentosPorHora[h];
            if (ab > 0 || fe > 0) {
                faixasOrdenadas.push({ hora: h, label: `${String(h).padStart(2, '0')}:00 às ${String(h).padStart(2, '0')}:59`, abertas: ab, fechadas: fe, total: ab + fe });
            }
        }
        faixasOrdenadas.sort((a, b) => b.total - a.total || b.abertas - a.abertas);

        if (faixasOrdenadas.length === 0) {
            tbodyHorarios.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Sem registos de horário na seleção atual.</td></tr>`;
        } else {
            faixasOrdenadas.forEach(f => {
                const chaveExpH = registrarListaParaExplosao(`Movimentações das ${f.label}`, registrosPorHora[f.hora]);
                const tr = document.createElement('tr');
                tr.className = "hover:bg-blue-50/50 cursor-pointer";
                tr.setAttribute('onclick', `dispararExplosaoPorChave('${chaveExpH}')`);
                tr.innerHTML = `
                    <td class="p-2.5 font-mono font-black text-slate-800 underline decoration-dotted">🕒 ${f.label}</td>
                    <td class="p-2.5 text-center font-black text-blue-800 bg-blue-50/60">${f.abertas}</td>
                    <td class="p-2.5 text-center font-black text-emerald-800 bg-emerald-50/60">${f.fechadas}</td>
                    <td class="p-2.5 text-center font-black text-slate-900 bg-slate-100">${f.total}</td>
                `;
                tbodyHorarios.appendChild(tr);
            });
        }
    }

    // 7 e 8. RANKING DE OFENSORES + COMPARATIVO CONSTRUÇÃO MDU x EXPANSÃO MDU
    const mapaOfensores = {};
    let totalOcorrenciasGeral = 0;
    let totalOcorrenciasConstMDU = 0;
    let totalOcorrenciasExpMDU = 0;
    const regsMalogroConstMDU = [];
    const regsMalogroExpMDU = [];

    baseFiltradaSelecao.forEach(r => {
        if (r.desfecho !== 'CONCLUIDA') {
            const listaMotivos = (Array.isArray(r.malogros) && r.malogros.length > 0)
                ? r.malogros
                : [r.motivoDesfecho || 'SEM OFENSOR ESPECIFICADO'];

            listaMotivos.forEach(m => {
                const ch = String(m || 'OUTROS').trim().toUpperCase();
                if (!mapaOfensores[ch]) {
                    mapaOfensores[ch] = { ofensor: ch, total: 0, constMdu: 0, expMdu: 0, registros: [] };
                }
                mapaOfensores[ch].total++;
                mapaOfensores[ch].registros.push(r);
                totalOcorrenciasGeral++;

                if (r._tax.segmento === 'CONSTRUÇÃO MDU') {
                    mapaOfensores[ch].constMdu++;
                    totalOcorrenciasConstMDU++;
                    regsMalogroConstMDU.push(r);
                } else if (r._tax.segmento === 'EXPANSÃO MDU') {
                    mapaOfensores[ch].expMdu++;
                    totalOcorrenciasExpMDU++;
                    regsMalogroExpMDU.push(r);
                }
            });
        }
    });

    const listaOfensoresOrd = Object.values(mapaOfensores).sort((a, b) => b.total - a.total);

    const ctxOf = document.getElementById('canvasOfensoresRanking')?.getContext('2d');
    if (ctxOf) {
        if (chartOfensoresRankingInst) chartOfensoresRankingInst.destroy();
        const topOf = listaOfensoresOrd.slice(0, 8);
        chartOfensoresRankingInst = new Chart(ctxOf, {
            type: 'bar',
            data: {
                labels: topOf.length > 0 ? topOf.map(o => o.ofensor) : ['Sem malogros'],
                datasets: [{
                    label: 'Nº de Ocorrências',
                    data: topOf.map(o => o.total),
                    backgroundColor: '#dc2626',
                    borderRadius: 5
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                onClick: (e, el) => {
                    if (el.length > 0 && topOf[el[0].index]) {
                        const alvo = topOf[el[0].index];
                        abrirExplosaoPersonalizadaGraficos(`Ofensor: ${alvo.ofensor}`, alvo.registros);
                    }
                }
            }
        });
    }

    const tbodyOfGeral = document.getElementById('tbody-ranking-ofensores-geral');
    if (tbodyOfGeral) {
        tbodyOfGeral.innerHTML = "";
        if (listaOfensoresOrd.length === 0) {
            tbodyOfGeral.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Nenhum malogro registado na seleção atual.</td></tr>`;
        } else {
            listaOfensoresOrd.forEach((o, idx) => {
                const perc = totalOcorrenciasGeral > 0 ? ((o.total / totalOcorrenciasGeral) * 100).toFixed(1) : '0.0';
                const chaveExpOf = registrarListaParaExplosao(`Ofensor: ${o.ofensor}`, o.registros);
                const tr = document.createElement('tr');
                tr.className = "hover:bg-red-50/60 cursor-pointer";
                tr.setAttribute('onclick', `dispararExplosaoPorChave('${chaveExpOf}')`);
                tr.innerHTML = `
                    <td class="p-2.5 text-center font-bold text-slate-400">${idx + 1}º</td>
                    <td class="p-2.5 font-black text-red-950 underline decoration-dotted">${o.ofensor}</td>
                    <td class="p-2.5 text-center font-black text-slate-900 bg-red-50/60">${o.total}</td>
                    <td class="p-2.5 text-right font-black text-red-700">${perc}%</td>
                `;
                tbodyOfGeral.appendChild(tr);
            });
        }
    }

    const boxResumoSegOf = document.getElementById('resumo-topo-ofensores-segmentos');
    const somaConstMaisExp = totalOcorrenciasConstMDU + totalOcorrenciasExpMDU;

    if (boxResumoSegOf) {
        const pConstMdu = somaConstMaisExp > 0 ? ((totalOcorrenciasConstMDU / somaConstMaisExp) * 100).toFixed(1) : '0.0';
        const pExpMdu = somaConstMaisExp > 0 ? ((totalOcorrenciasExpMDU / somaConstMaisExp) * 100).toFixed(1) : '0.0';
        const chConst = registrarListaParaExplosao(`Malogros CONSTRUÇÃO MDU`, regsMalogroConstMDU);
        const chExp = registrarListaParaExplosao(`Malogros EXPANSÃO MDU`, regsMalogroExpMDU);

        boxResumoSegOf.innerHTML = `
            <div onclick="dispararExplosaoPorChave('${chConst}')" class="bg-white p-2.5 rounded-xl border border-blue-200 flex justify-between items-center cursor-pointer hover:border-blue-500 transition">
                <div>
                    <span class="text-[10px] font-black text-blue-900 uppercase block underline decoration-dotted">🏗️ CONSTRUÇÃO MDU</span>
                    <span class="text-[10px] text-slate-500">Volume de Malogros</span>
                </div>
                <div class="text-right">
                    <span class="font-black text-blue-950 text-sm">${totalOcorrenciasConstMDU} ocorr.</span>
                    <span class="block text-[10px] font-bold text-blue-700">${pConstMdu}% (Const x Exp)</span>
                </div>
            </div>
            <div onclick="dispararExplosaoPorChave('${chExp}')" class="bg-white p-2.5 rounded-xl border border-indigo-200 flex justify-between items-center cursor-pointer hover:border-indigo-500 transition">
                <div>
                    <span class="text-[10px] font-black text-indigo-900 uppercase block underline decoration-dotted">🚀 EXPANSÃO MDU</span>
                    <span class="text-[10px] text-slate-500">Volume de Malogros</span>
                </div>
                <div class="text-right">
                    <span class="font-black text-indigo-950 text-sm">${totalOcorrenciasExpMDU} ocorr.</span>
                    <span class="block text-[10px] font-bold text-indigo-700">${pExpMdu}% (Const x Exp)</span>
                </div>
            </div>
        `;
    }

    const tbodyOfSeg = document.getElementById('tbody-ofensores-segmentos-mdu');
    if (tbodyOfSeg) {
        tbodyOfSeg.innerHTML = "";
        const ofensoresConstExp = listaOfensoresOrd.filter(o => (o.constMdu + o.expMdu) > 0);

        if (ofensoresConstExp.length === 0) {
            tbodyOfSeg.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Nenhum malogro registado em Construção MDU ou Expansão MDU na seleção.</td></tr>`;
        } else {
            ofensoresConstExp.forEach(o => {
                const somaLinha = o.constMdu + o.expMdu;
                const percConst = totalOcorrenciasConstMDU > 0 ? ((o.constMdu / totalOcorrenciasConstMDU) * 100).toFixed(1) : '0.0';
                const percExp = totalOcorrenciasExpMDU > 0 ? ((o.expMdu / totalOcorrenciasExpMDU) * 100).toFixed(1) : '0.0';
                const percSoma = somaConstMaisExp > 0 ? ((somaLinha / somaConstMaisExp) * 100).toFixed(1) : '0.0';
                const chaveExpLinha = registrarListaParaExplosao(`Ofensor (Const x Exp): ${o.ofensor}`, o.registros.filter(r => r._tax.segmento === 'CONSTRUÇÃO MDU' || r._tax.segmento === 'EXPANSÃO MDU'));

                const tr = document.createElement('tr');
                tr.className = "hover:bg-amber-50/60 cursor-pointer";
                tr.setAttribute('onclick', `dispararExplosaoPorChave('${chaveExpLinha}')`);
                tr.innerHTML = `
                    <td class="p-2.5 font-bold text-slate-800 underline decoration-dotted">${o.ofensor}</td>
                    <td class="p-2.5 text-center bg-blue-50/40"><b class="text-blue-950">${o.constMdu}</b> <span class="text-[10px] text-blue-700 font-semibold">(${percConst}%)</span></td>
                    <td class="p-2.5 text-center bg-indigo-50/40"><b class="text-indigo-950">${o.expMdu}</b> <span class="text-[10px] text-indigo-700 font-semibold">(${percExp}%)</span></td>
                    <td class="p-2.5 text-center bg-slate-100"><b class="text-slate-950">${somaLinha}</b> <span class="text-[10px] text-slate-600 font-bold">(${percSoma}%)</span></td>
                `;
                tbodyOfSeg.appendChild(tr);
            });
        }
    }

    // 9. CONTROLE DE PAUSAS (NO FIM DA ABA)
    const mapaPausasTec = {};
    let totalAtivPausadas = 0;
    let totalMinutosPausadosGlobal = 0;

    baseFiltradaSelecao.forEach(r => {
        const pMin = Number(r.tempoPausadoMinutos) || 0;
        if (pMin > 0) {
            const nome = r.equipe || 'NÃO IDENTIFICADO';
            if (normalizarChaveNome(nome).includes('AAAAAATESTE')) return;
            if (!mapaPausasTec[nome]) mapaPausasTec[nome] = { nome, qtdPausas: 0, minTotal: 0, registros: [] };
            mapaPausasTec[nome].qtdPausas++;
            mapaPausasTec[nome].minTotal += pMin;
            mapaPausasTec[nome].registros.push(r);
            totalAtivPausadas++;
            totalMinutosPausadosGlobal += pMin;
        }
    });

    const kpisPausas = document.getElementById('kpis-controle-pausas-topo');
    if (kpisPausas) {
        const mediaGlobalPausa = totalAtivPausadas > 0 ? Math.round(totalMinutosPausadosGlobal / totalAtivPausadas) : 0;
        const txtTotalPausa = typeof formatarDuracaoTexto === 'function' && totalMinutosPausadosGlobal > 0 ? formatarDuracaoTexto(totalMinutosPausadosGlobal) : `${totalMinutosPausadosGlobal} min`;
        kpisPausas.innerHTML = `
            <div class="bg-white p-2 rounded-xl border border-orange-200 text-center">
                <span class="text-[9px] font-bold text-slate-500 uppercase block">Atividades c/ Pausa</span>
                <span class="font-black text-orange-950 text-sm">${totalAtivPausadas}</span>
            </div>
            <div class="bg-white p-2 rounded-xl border border-orange-200 text-center">
                <span class="text-[9px] font-bold text-slate-500 uppercase block">Tempo Total Paralisado</span>
                <span class="font-black text-orange-700 text-sm">${txtTotalPausa}</span>
            </div>
            <div class="bg-white p-2 rounded-xl border border-orange-200 text-center">
                <span class="text-[9px] font-bold text-slate-500 uppercase block">Média por Paralisação</span>
                <span class="font-black text-slate-800 text-sm">${mediaGlobalPausa} min</span>
            </div>
        `;
    }

    const tbodyPausas = document.getElementById('tbody-ranking-ociosidade-pausas');
    if (tbodyPausas) {
        tbodyPausas.innerHTML = "";
        const listaPausas = Object.values(mapaPausasTec).sort((a, b) => b.minTotal - a.minTotal);
        if (listaPausas.length === 0) {
            tbodyPausas.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Nenhuma atividade teve tempo de paralisação registado no filtro atual.</td></tr>`;
        } else {
            listaPausas.forEach((p, idx) => {
                const mediaP = Math.round(p.minTotal / p.qtdPausas);
                const txtTot = typeof formatarDuracaoTexto === 'function' ? formatarDuracaoTexto(p.minTotal) : `${p.minTotal} min`;
                const chExpP = registrarListaParaExplosao(`Atividades Paralisadas: ${p.nome}`, p.registros);
                const tr = document.createElement('tr');
                tr.className = "hover:bg-orange-50/60 cursor-pointer";
                tr.setAttribute('onclick', `dispararExplosaoPorChave('${chExpP}')`);
                tr.innerHTML = `
                    <td class="p-2.5 text-center font-bold text-slate-400">${idx + 1}º</td>
                    <td class="p-2.5 font-black text-slate-800"><span class="underline decoration-dotted">${p.nome}</span>${obterCategoriaDiscretaTecnicoHtml(p.nome)}</td>
                    <td class="p-2.5 text-center font-bold text-slate-700">${p.qtdPausas}</td>
                    <td class="p-2.5 text-center font-black text-orange-800 bg-orange-50/70">${txtTot} (${p.minTotal}m)</td>
                    <td class="p-2.5 text-center font-mono font-bold text-slate-600">${mediaP} min</td>
                `;
                tbodyPausas.appendChild(tr);
            });
        }
    }

    // 10. IMPACTO OPERACIONAL (NO FIM DA ABA)
    const listaImprevistosRef = (Array.isArray(listaImprevistosAtuais) ? listaImprevistosAtuais : [])
        .filter(imp => imp && !normalizarChaveNome(imp.equipe).includes('AAAAAATESTE'));
    const mapaCausasImp = {};
    let totalMinutosImprevistos = 0;

    listaImprevistosRef.forEach(imp => {
        const minIn = typeof converterHorarioParaMinutos === 'function' ? converterHorarioParaMinutos(imp.hEntrada) : null;
        let minOut = typeof converterHorarioParaMinutos === 'function' ? converterHorarioParaMinutos(imp.hSaida) : null;
        if (minOut === null && imp.desfecho === 'IMPREVISTO') {
            const ag = new Date();
            minOut = (ag.getHours() * 60) + ag.getMinutes();
        }
        const dur = (minIn !== null && minOut !== null && minOut >= minIn) ? Math.max(1, minOut - minIn) : 30;
        totalMinutosImprevistos += dur;

        const causas = (Array.isArray(imp.malogros) && imp.malogros.length > 0) ? imp.malogros : [imp.motivoDesfecho || 'IMPREVISTO GERAL'];
        causas.forEach(c => {
            const ch = String(c || 'OUTROS').trim().toUpperCase();
            if (!mapaCausasImp[ch]) mapaCausasImp[ch] = { causa: ch, qtd: 0, minutos: 0, registros: [] };
            mapaCausasImp[ch].qtd++;
            mapaCausasImp[ch].minutos += dur;
            mapaCausasImp[ch].registros.push(imp);
        });
    });

    const listaCausasOrd = Object.values(mapaCausasImp).sort((a, b) => b.minutos - a.minutos || b.qtd - a.qtd);

    const kpisImp = document.getElementById('kpis-impacto-imprevistos-topo');
    if (kpisImp) {
        const mediaImp = listaImprevistosRef.length > 0 ? Math.round(totalMinutosImprevistos / listaImprevistosRef.length) : 0;
        const txtTotImp = typeof formatarDuracaoTexto === 'function' && totalMinutosImprevistos > 0 ? formatarDuracaoTexto(totalMinutosImprevistos) : `${totalMinutosImprevistos} min`;
        kpisImp.innerHTML = `
            <div class="bg-white p-2 rounded-xl border border-red-200 text-center">
                <span class="text-[9px] font-bold text-slate-500 uppercase block">Total de Imprevistos</span>
                <span class="font-black text-red-950 text-sm">${listaImprevistosRef.length}</span>
            </div>
            <div class="bg-white p-2 rounded-xl border border-red-200 text-center">
                <span class="text-[9px] font-bold text-slate-500 uppercase block">Tempo Perdido Total</span>
                <span class="font-black text-red-700 text-sm">${txtTotImp}</span>
            </div>
            <div class="bg-white p-2 rounded-xl border border-red-200 text-center">
                <span class="text-[9px] font-bold text-slate-500 uppercase block">Média / Imprevisto</span>
                <span class="font-black text-slate-800 text-sm">${mediaImp} min</span>
            </div>
        `;
    }

    const ctxImp = document.getElementById('canvasImpactoImprevistos')?.getContext('2d');
    if (ctxImp) {
        if (chartImpactoImprevistosInst) chartImpactoImprevistosInst.destroy();
        const topC = listaCausasOrd.slice(0, 6);
        chartImpactoImprevistosInst = new Chart(ctxImp, {
            type: 'bar',
            data: {
                labels: topC.length > 0 ? topC.map(c => c.causa) : ['Sem imprevistos'],
                datasets: [{
                    label: 'Minutos Perdidos',
                    data: topC.map(c => c.minutos),
                    backgroundColor: '#b91c1c',
                    borderRadius: 5
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                onClick: (e, el) => {
                    if (el.length > 0 && topC[el[0].index]) {
                        const alvo = topC[el[0].index];
                        abrirExplosaoPersonalizadaGraficos(`Imprevisto: ${alvo.causa}`, alvo.registros);
                    }
                }
            }
        });
    }

    const tbodyImpCausas = document.getElementById('tbody-impacto-imprevistos-causas');
    if (tbodyImpCausas) {
        tbodyImpCausas.innerHTML = "";
        if (listaCausasOrd.length === 0) {
            tbodyImpCausas.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Nenhum imprevisto registado no período.</td></tr>`;
        } else {
            listaCausasOrd.forEach(c => {
                const percT = totalMinutosImprevistos > 0 ? ((c.minutos / totalMinutosImprevistos) * 100).toFixed(1) : '0.0';
                const txtM = typeof formatarDuracaoTexto === 'function' ? formatarDuracaoTexto(c.minutos) : `${c.minutos}m`;
                const chExpC = registrarListaParaExplosao(`Imprevisto: ${c.causa}`, c.registros);
                const tr = document.createElement('tr');
                tr.className = "hover:bg-red-50/60 cursor-pointer";
                tr.setAttribute('onclick', `dispararExplosaoPorChave('${chExpC}')`);
                tr.innerHTML = `
                    <td class="p-2.5 font-bold text-slate-800 underline decoration-dotted">${c.causa}</td>
                    <td class="p-2.5 text-center font-bold text-slate-700">${c.qtd}</td>
                    <td class="p-2.5 text-center font-black text-red-800 bg-red-50/70">${txtM} (${c.minutos}m)</td>
                    <td class="p-2.5 text-right font-black text-red-700">${percT}%</td>
                `;
                tbodyImpCausas.appendChild(tr);
            });
        }
    }
};

// --- 4. EXPORTAÇÃO EXCEL OFICIAL (COM TODOS OS MATERIAIS SEPARADOS POR BLOCO E ISOLAMENTO DO USUÁRIO TESTE) ---
window.exportarPlanilhaDinamicaOficialExcel = async function() {
    const baseBruta = (dadosFiltradosAtuais && dadosFiltradosAtuais.length > 0 ? dadosFiltradosAtuais : registrosSalvos).filter(r =>
        r &&
        !normalizarChaveNome(r.equipe).includes('AAAAAATESTE') &&
        r.equipe !== '__CONFIG_SISTEMA__' &&
        r.projeto !== '__CONFIG_AUDITORIA__' &&
        r.projeto !== 'IMPREVISTO / ATRASO' &&
        r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
        r.projeto !== PROJETO_SOLIC_MATERIAL &&
        !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(r.desfecho) &&
        (typeof registroPertenceAoUsuarioLogado === 'function' ? registroPertenceAoUsuarioLogado(r) : true)
    ).map(r => ({
        ...r,
        _tax: classificarRegistroNovaTaxonomia(r),
        _semana: obterNumeroSemanaFormatado(r.dataRegistro)
    })).filter(registroPassaNosFiltrosGlobaisGraficos);

    if (baseBruta.length === 0) {
        alert("⚠️ Nenhum registo finalizado na seleção atual para exportar.");
        return;
    }

    // Como registrosSalvos já contém 100% dos blocos paginados (cada bloco foi gravado em linha individual no banco),
    // garantimos a ordenação cronológica e por bloco sem duplicar chamadas pesadas à nuvem
    const chavesUnicas = new Set();
    const registrosExpandidosExcel = [];

    baseBruta.forEach(reg => {
        const ch = `${reg.id}_${reg.imovel}`;
        if (!chavesUnicas.has(ch)) {
            chavesUnicas.add(ch);
            registrosExpandidosExcel.push(reg);
        }
    });

    registrosExpandidosExcel.sort((a, b) => {
        if (a.dataRegistro !== b.dataRegistro) return (b.dataRegistro || '').localeCompare(a.dataRegistro || '');
        const codA = obterCodigoBaseImovel(a.imovel);
        const codB = obterCodigoBaseImovel(b.imovel);
        if (codA !== codB) return codA.localeCompare(codB);
        return (a.imovel || '').localeCompare(b.imovel || '');
    });

    let html = `<table border="1">
        <tr style="background-color:#0f172a;color:#ffffff;font-weight:bold;font-size:13px;">
            <th colspan="23">RELATÓRIO OFICIAL DE INDICADORES GPD — PRODUÇÃO E MATERIAIS SEPARADOS POR BLOCO (${obterDataLocalISO()})</th>
        </tr>
        <tr style="background-color:#cbd5e1;font-weight:bold;">
            <th>SEMANA</th>
            <th>DATA</th>
            <th>TÉCNICO / EQUIPE</th>
            <th>CATEGORIA TÉCNICO</th>
            <th>APOIO CONJUNTO</th>
            <th>SEGMENTO</th>
            <th>CATEGORIA</th>
            <th>IMÓVEL / BLOCO DETALHADO</th>
            <th>ENDEREÇO</th>
            <th>ANDARES</th>
            <th>HPs</th>
            <th>PARALISAÇÃO (MIN)</th>
            <th>CABO RL (m)</th>
            <th>CABO DROP (m)</th>
            <th>CONECTORES</th>
            <th>FUSÕES</th>
            <th>NAP</th>
            <th>DIO</th>
            <th>CX SOBREPOR</th>
            <th>CX EMBUTIDA</th>
            <th>CX FOSC</th>
            <th>RESULTADO (STATUS)</th>
            <th>DETALHES / OFENSORES</th>
        </tr>`;

    registrosExpandidosExcel.forEach(r => {
        const ap = extrairApoiosDoRegistro(r).join(', ') || '-';
        const catTec = obterCategoriaDiscretaTecnicoHtml(r.equipe, true);
        const detalhesStr = (Array.isArray(r.malogros) && r.malogros.length > 0)
            ? r.malogros.join(' + ')
            : (r.motivoDesfecho || r.observacoes || '-');

        const pausaExibir = Number(r.tempoPausadoMinutos) || 0;

        html += `<tr>
            <td>${r._semana}</td>
            <td>${r.dataRegistro}</td>
            <td><b>${r.equipe}</b></td>
            <td>${catTec}</td>
            <td>${ap}</td>
            <td><b>${r._tax.segmento}</b></td>
            <td><b>${r._tax.categoria}</b></td>
            <td><b>${r.imovel}</b></td>
            <td>${r.endereco || '-'}</td>
            <td>${r.andares || 0}</td>
            <td>${r.hps || 0}</td>
            <td>${pausaExibir}</td>
            <td>${r.caboRL || 0}</td>
            <td>${r.caboDrop || 0}</td>
            <td>${r.conectores || 0}</td>
            <td>${r.fusoes || 0}</td>
            <td>${r.nap || 0}</td>
            <td>${r.dio || 0}</td>
            <td>${r.cxSobrepor || 0}</td>
            <td>${r.cxEmbutida || 0}</td>
            <td>${r.cxFosc || 0}</td>
            <td><b>${r.desfecho}</b></td>
            <td>${detalhesStr}</td>
        </tr>`;
    });

    html += `</table>`;
    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `INDICADORES_GPD_PRODUCAO_E_MATERIAIS_${obterDataLocalISO()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

window.exportarExcel = window.exportarPlanilhaDinamicaOficialExcel;

copiarBoletimGestorWhatsApp = function() {
    const lista = (dadosFiltradosAtuais && dadosFiltradosAtuais.length > 0 ? dadosFiltradosAtuais : registrosSalvos).filter(r =>
        r &&
        !normalizarChaveNome(r.equipe).includes('AAAAAATESTE') &&
        r.projeto !== 'IMPREVISTO / ATRASO' &&
        r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
        r.projeto !== PROJETO_SOLIC_MATERIAL &&
        r.equipe !== "__CONFIG_SISTEMA__" &&
        r.projeto !== "__CONFIG_AUDITORIA__" &&
        registroPertenceAoUsuarioLogado(r)
    );

    if (lista.length === 0) {
        alert("⚠️ Nenhum registo encontrado no filtro atual para gerar o Boletim.");
        return;
    }

    const dIni = document.getElementById('gestor-filtro-data-inicio')?.value;
    const dFim = document.getElementById('gestor-filtro-data-fim')?.value;
    const periodoStr = (dIni || dFim) ? `${dIni || 'Início'} a ${dFim || 'Hoje'}` : 'Todo o Histórico';

    const andamento = lista.filter(i => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(i.desfecho)).length;
    const finalizadas = lista.filter(i => !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(i.desfecho));
    const concluidas = finalizadas.filter(i => ['CONCLUIDA', 'CONCLUÍDA'].includes(i.desfecho)).length;
    const pendentes = finalizadas.filter(i => i.desfecho === 'PENDENTE').length;
    const malogradas = finalizadas.filter(i => i.desfecho === 'MALOGRADA').length;

    const texto = [
        `📊 *BOLETIM GPD - MDU PROCISA RJ*`,
        `📅 *Período:* ${periodoStr}`,
        `──────────────────────`,
        `🔵 *Ativas / Em Execução Agora:* ${andamento}`,
        `📈 *Total Finalizadas:* ${finalizadas.length}`,
        `🟢 *Concluídas:* ${concluidas}`,
        `🟡 *Pendentes:* ${pendentes}`,
        `🔴 *Malogradas:* ${malogradas}`
    ].join('\n');

    copiarTextoAreaTransferencia(texto, "✅ Boletim Executivo copiado para o WhatsApp!");
};

// Limpa rascunhos "EM ANDAMENTO" fantasmas quando a mesma atividade já consta finalizada no dia
async function removerApenasAberturasFantasmas() {
    if (limpezaDuplicadosEmAndamento || (typeof modoConsultaBackupAtivo !== 'undefined' && modoConsultaBackupAtivo)) return;
    if (!Array.isArray(registrosSalvos) || registrosSalvos.length === 0) return;

    limpezaDuplicadosEmAndamento = true;
    try {
        const chavesFinalizadasHoje = new Set();
        const idsFantasmasParaApagar = new Set();

        const obterBaseCod = (str) => {
            let c = String(str || '').toUpperCase().trim();
            const i = c.lastIndexOf(' - BLOCO');
            return i !== -1 ? c.substring(0, i).trim() : c;
        };

        registrosSalvos.forEach(r => {
            if (!r || r.equipe === '__CONFIG_SISTEMA__' || r.projeto === '__CONFIG_AUDITORIA__') return;
            if (['CONCLUIDA', 'CONCLUÍDA', 'PENDENTE', 'MALOGRADA'].includes(String(r.desfecho || '').toUpperCase().trim())) {
                const dt = String(r.dataRegistro || '').trim();
                const eq = String(r.equipe || '').toUpperCase().trim();
                const codBase = obterBaseCod(r.imovel);
                const hIn = String(r.hEntrada || '').trim();
                chavesFinalizadasHoje.add(`${dt}|${eq}|${codBase}|${hIn}`);
            }
        });

        registrosSalvos.forEach(r => {
            if (!r) return;
            if (['EM ANDAMENTO', 'PARALISADA'].includes(r.desfecho)) {
                const dt = String(r.dataRegistro || '').trim();
                const eq = String(r.equipe || '').toUpperCase().trim();
                const codBase = obterBaseCod(r.imovel);
                const hIn = String(r.hEntrada || '').trim();

                if (chavesFinalizadasHoje.has(`${dt}|${eq}|${codBase}|${hIn}`)) {
                    idsFantasmasParaApagar.add(r.id);
                }
            }
        });

        if (idsFantasmasParaApagar.size > 0) {
            registrosSalvos = registrosSalvos.filter(r => !idsFantasmasParaApagar.has(r.id));
            if (typeof supabaseClient !== 'undefined') {
                await supabaseClient.from('registros_producao').delete().in('id', Array.from(idsFantasmasParaApagar));
            }
        }
    } catch (e) {} finally {
        limpezaDuplicadosEmAndamento = false;
    }
}

if (typeof window.atualizarDashboardGestor === 'function' && !window._hookDashUnificadoV3) {
    window._hookDashUnificadoV3 = true;
    const _origAtuDashV3 = window.atualizarDashboardGestor;
    window.atualizarDashboardGestor = async function(...args) {
        await removerApenasAberturasFantasmas();
        const res = await _origAtuDashV3.apply(this, args);
        try {
            window.injetarBotaoLimparMapaFixo();
            setTimeout(() => {
                if (typeof varrerEnderecosEFotosVisiveis === 'function') varrerEnderecosEFotosVisiveis();
            }, 250);
        } catch (e) {}
        return res;
    };
}

setTimeout(() => {
    otimizarCabecalhoAzulLinhaUnica();
    inicializarMelhoriasVisuaisGestor();
    construirLayoutExclusivoAbaGraficos();
    window.injetarBotaoLimparMapaFixo();
    window.renderizarAbaGraficosCompletaOficial();
}, 400);

// Vigilância contínua de isolamento entre Modo Campo, Modo Gestor e Perfil Visualizador (Cliente)
setInterval(() => {
    const viewGestor = document.getElementById('view-gestor');
    const gestorVisivel = viewGestor && !viewGestor.classList.contains('hidden');
    const blocoAcoesGestor = document.getElementById('header-gestor-acoes');
    const subBarraGestor = document.getElementById('header-gestor-subbarra');

    if (!gestorVisivel) {
        if (blocoAcoesGestor) blocoAcoesGestor.classList.add('hidden');
        if (subBarraGestor) subBarraGestor.classList.add('hidden');
    } else {
        otimizarCabecalhoAzulLinhaUnica();
        window.injetarBotaoLimparMapaFixo();

        const ehVis = (typeof obterNivelNormalizadoGestor === 'function' && obterNivelNormalizadoGestor() === 'visualizador');
        if (ehVis) {
            document.getElementById('btn-importar-planilha')?.classList.add('hidden');
            document.getElementById('btn-boletim-whats-gestor')?.classList.add('hidden');
            document.getElementById('btn-limpar-sinais-mapa')?.classList.add('hidden');
            document.getElementById('barra-topo-limpar-mapa-travados')?.classList.add('hidden');
        }

        const subGraficos = document.getElementById('subview-graficos');
        const btnGraficos = document.getElementById('subtab-btn-graficos');
        if (subGraficos && btnGraficos) {
            if (!btnGraficos.classList.contains('bg-blue-900')) {
                subGraficos.classList.add('hidden');
                subGraficos.style.setProperty('display', 'none', 'important');
            } else {
                subGraficos.classList.remove('hidden');
                subGraficos.style.removeProperty('display');
            }
        }
    }
}, 450);
