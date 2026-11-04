// ================= VARIÁVEIS GLOBAIS DO MAPA, GRÁFICOS POR GRUPO, APOIO CONJUNTO, EDIÇÃO E BACKUP =================
let mapaRastreioInstancia = null;
let camadaMarcadoresRastreio = null;
let coordenadasPinosAtuais = [];
let fotosEdicaoTemporarias = [];
let opcoesMarcadasEdicaoTemporarias = [];
let snapshotStatusEdicaoOriginal = null;
let modoConsultaBackupAtivo = false;
let cacheRegistrosNuvemOriginal = null;
let sincronizandoRegistrosMobileEmCurso = false;

let graficoExecutoresVistoriaInstancia = null;
let graficoExecutoresConstrucaoInstancia = null;
let graficoExecutoresAtivacaoInstancia = null;
let graficoProgramadoRetornoBairroInstancia = null;
let grupoAtivoAbaGraficos = 'TODOS';

let filtrosMultiplosAtivos = { equipes: [], setores: [], macrogrupos: [], projetos: [], desfechos: [] };

// ================= FUNÇÕES DE APOIO CONJUNTO / ATUAÇÃO COMPARTILHADA =================
function extrairApoiosDoRegistro(reg) {
    if (!reg) return [];
    const titular = (reg.equipe || '').toUpperCase().trim();
    const lista = [];
    const mStr = (reg.membros || '').trim();
    if (mStr && mStr !== '__CONFIG_SISTEMA__' && mStr.toUpperCase() !== titular) {
        const limpo = mStr.replace(/^APOIO:/i, '').trim();
        limpo.split(',').forEach(nome => {
            const n = nome.trim().toUpperCase();
            if (n && n !== titular && !lista.includes(n)) lista.push(n);
        });
    }
    const obs = (reg.observacoes || '') + ' ' + (reg.motivoDesfecho || '');
    const regex = /\[APOIO_CONJUNTO:\s*([^\]\s]+(?:\s+[^\]\s]+)*?)\s+entrou/gi;
    let match;
    while ((match = regex.exec(obs)) !== null) {
        const n = match[1].trim().toUpperCase();
        if (n && n !== titular && !lista.includes(n)) lista.push(n);
    }
    return lista;
}

function formatarCampoMembrosComApoio(nomeTitular, listaApoios) {
    const limpos = [...new Set((listaApoios || []).map(a => String(a || '').trim().toUpperCase()).filter(a => a && a !== (nomeTitular || '').toUpperCase().trim()))];
    return limpos.length > 0 ? `APOIO:${limpos.join(', ')}` : (nomeTitular || '');
}

async function abrirModalGerirApoioGestor(idReg) {
    const nivelNorm = String(nivelUsuarioLogado || '').trim().toLowerCase();
    if (nivelNorm !== 'master' && nivelNorm !== 'operador') {
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
                    <label class="block font-black text-slate-800 uppercase text-[11px] mb-1.5">Marque o(s) Técnico(s) em Apoio Conjunto neste Imóvel:</label>
                    <div class="space-y-1 max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50">
                        ${checksEquipesHtml || '<span class="text-slate-400">Nenhuma outra equipe ativa cadastrada.</span>'}
                    </div>
                </div>
                <p class="text-[10px] text-slate-500">
                    💡 <b>Regra Opção A:</b> O imóvel conta 1 execução para o titular e o(s) técnico(s) em apoio recebem automaticamente o <b>Dia Trabalhado</b> e a contabilização na coluna <b>🤝 Apoios</b> nos gráficos e planilhas!
                </p>
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

    // Aplica a todos os blocos irmãos do mesmo imóvel/data/equipe
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

// ================= CLASSIFICADORES DOS 3 GRUPOS E SUBGRUPOS (EXCLUSIVOS PARA ABA GRÁFICOS E PLANILHAS) =================
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

    return listaRegistros.map(r => {
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

function selecionarGrupoAbaGraficos(grupo) {
    grupoAtivoAbaGraficos = grupo;
    const botoes = [
        { id: 'TODOS', corAtiva: 'bg-cyan-400 text-slate-950 shadow-sm font-black', corInativa: 'bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold' },
        { id: 'VISTORIA', corAtiva: 'bg-purple-500 text-white shadow-sm font-black', corInativa: 'bg-slate-800 text-purple-200 hover:bg-purple-900 border border-purple-500/40 font-bold' },
        { id: 'CONSTRUCAO', corAtiva: 'bg-blue-500 text-white shadow-sm font-black', corInativa: 'bg-slate-800 text-blue-200 hover:bg-blue-900 border border-blue-500/40 font-bold' },
        { id: 'ATIVACAO', corAtiva: 'bg-emerald-500 text-white shadow-sm font-black', corInativa: 'bg-slate-800 text-emerald-200 hover:bg-emerald-900 border border-emerald-500/40 font-bold' }
    ];
    botoes.forEach(b => {
        const el = document.getElementById(`btn-grupo-graf-${b.id}`);
        if (el) el.className = `py-2 px-3 rounded-lg text-xs transition ${grupo === b.id ? b.corAtiva : b.corInativa}`;
    });

    const secVist = document.getElementById('secao-grupo-vistoria');
    const secConst = document.getElementById('secao-grupo-construcao');
    const secAtiv = document.getElementById('secao-grupo-ativacao');
    if (secVist) secVist.classList.toggle('hidden', grupo !== 'TODOS' && grupo !== 'VISTORIA');
    if (secConst) secConst.classList.toggle('hidden', grupo !== 'TODOS' && grupo !== 'CONSTRUCAO');
    if (secAtiv) secAtiv.classList.toggle('hidden', grupo !== 'TODOS' && grupo !== 'ATIVACAO');

    atualizarDashboardGestor();
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
        'btn-baixar-excel-gestor': 'Baixar planilha Excel (.xls) separada nos 3 Grupos com coluna de Apoio Conjunto',
        'btn-atualizar-registros-gestor': 'Buscar imediatamente na nuvem todas as novas atividades, fotos e posições de GPS'
    };
    Object.entries(mapaTooltips).forEach(([id, texto]) => { const el = document.getElementById(id); if (el) el.title = texto; });
}

function inicializarMelhoriasVisuaisGestor() {
    aplicarTooltipsExplicativosGlobais();

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

    // Injeta seletor de Técnico em Apoio também dentro do Super Modal de Edição
    const selEqModalEdit = document.getElementById('edit-reg-equipe');
    if (selEqModalEdit && !document.getElementById('edit-reg-apoio-conjunto')) {
        const divPai = selEqModalEdit.parentNode;
        const divApoioEdit = document.createElement('div');
        divApoioEdit.className = 'mt-2 pt-2 border-t border-purple-200';
        divApoioEdit.innerHTML = `
            <label class="block font-black text-purple-900 text-[11px] mb-1">🤝 Técnico(s) em Apoio Conjunto (Separar por vírgula ou selecionar ao lado):</label>
            <input type="text" id="edit-reg-apoio-conjunto" placeholder="Ex: BRUNO SOARES DA SILVA" class="w-full border-2 border-purple-300 rounded-lg p-1.5 bg-purple-50/40 outline-none font-bold text-purple-950 uppercase">
        `;
        divPai.appendChild(divApoioEdit);
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
}

setTimeout(inicializarMelhoriasVisuaisGestor, 350);

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
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') { alert("⚠️ Permissão insuficiente."); return; }
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

    const podeTratar = (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador');

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

    desenharChecks('multi-lista-setores', [{ valor: 'Vistoriador', label: '🔍 Vistoriador' }, { valor: 'Instalador', label: '🛠️ Instalador' }, { valor: 'Ativador', label: '⚡ Ativador' }], filtrosMultiplosAtivos.setores, 'chk-multi-setor');
    desenharChecks('multi-lista-macrogrupos', GRUPOS_PROJETO_SISTEMA.map(grp => ({ valor: grp, label: `📂 Grupo ${grp}` })), filtrosMultiplosAtivos.macrogrupos, 'chk-multi-macro');
    desenharChecks('multi-lista-projetos', CATALOGO_PROJETOS_SISTEMA.map(p => ({ valor: p.nome, label: `${p.nome} (${p.grupo})` })), filtrosMultiplosAtivos.projetos, 'chk-multi-projeto');
    desenharChecks('multi-lista-desfechos', [{ valor: 'PROGRAMADA', label: '📋 Programadas' }, { valor: 'EM ANDAMENTO', label: '🔵 Em Andamento' }, { valor: 'PARALISADA', label: '⏸️ Paralisadas' }, { valor: 'REABERTA', label: '🔄 Reabertas' }, { valor: 'CONCLUIDA', label: '🟢 Concluídas' }, { valor: 'PENDENTE', label: '🟡 Pendentes' }, { valor: 'MALOGRADA', label: '🔴 Malogradas' }], filtrosMultiplosAtivos.desfechos, 'chk-multi-desfecho');
    desenharChecks('multi-lista-equipes', equipesSistema.map(e => ({ valor: e.nome, label: `${e.nome} (${formatarSetoresString(e.setor)})` })), filtrosMultiplosAtivos.equipes, 'chk-multi-equipe');
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
    if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas o perfil Master pode exportar o Backup Integral."); return; }
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
        sistema: "GPD MDU PROCISA RJ", versaoBackup: "7.0", dataExportacao: new Date().toISOString(), exportadoPor: usuarioLogado,
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
    if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas o perfil Master pode carregar backups."); return; }
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
    if (nivelUsuarioLogado !== 'Master') return;
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

// ================= MAPA DE RASTREAMENTO EM TEMPO REAL (LEAFLET) E VARREDURA DO SINAL MAIS RECENTE =================
function extrairCoordenadaMaisRecenteDoTecnicoHoje(nomeTec, regsHoje, obrasEmApoioHoje, tel) {
    let melhorCandidato = { lat: null, lng: null, hora: null, minDia: -1, ts: 0, origem: '' };

    const testarCandidato = (strCoord, strHora, timestampMs, origemLbl) => {
        if (!strCoord || typeof strCoord !== 'string' || !strCoord.includes(',')) return;
        const partes = strCoord.split(',').map(s => parseFloat(s.trim()));
        if (partes.length < 2 || isNaN(partes[0]) || isNaN(partes[1])) return;
        const min = converterHorarioParaMinutos(strHora) ?? -1;
        const tsVal = Number(timestampMs) || 0;

        if ((tsVal > 0 && tsVal > melhorCandidato.ts && min >= melhorCandidato.minDia) || (min > melhorCandidato.minDia) || (melhorCandidato.lat === null)) {
            melhorCandidato = { lat: partes[0], lng: partes[1], hora: strHora || '--:--', minDia: Math.max(min, melhorCandidato.minDia), ts: Math.max(tsVal, melhorCandidato.ts), origem: origemLbl };
        }
    };

    // 1. Testa a telemetria direta do técnico
    if (tel && tel.lat && tel.lng && !isNaN(Number(tel.lat)) && !isNaN(Number(tel.lng))) {
        testarCandidato(`${tel.lat}, ${tel.lng}`, tel.horaUltimoSinal, tel.timestampUltimoSinal, 'Sinal Rastreio');
    }

    // 2. Varre TODOS os registros de hoje onde o técnico é titular (testando TANTO gpsEntrada QUANTO gpsSaida!)
    (regsHoje || []).forEach(r => {
        if (r.gpsEntrada && r.gpsEntrada.includes(',')) testarCandidato(r.gpsEntrada, r.hEntrada, r.id, `Check-in (${r.imovel})`);
        if (r.gpsSaida && r.gpsSaida.includes(',')) testarCandidato(r.gpsSaida, r.hSaida, r.id + 1, `Check-out (${r.imovel})`);
    });

    // 3. Varre registros onde o técnico entrou como APOIO CONJUNTO hoje
    (obrasEmApoioHoje || []).forEach(r => {
        const obs = (r.observacoes || '');
        const regexGpsApoio = new RegExp(`\\[APOIO_CONJUNTO:\\s*${nomeTec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+entrou\\s+em\\s+apoio\\s+às\\s+(\\d{2}:\\d{2})\\s*\\(GPS:\\s*([-0-9.,\\s]+)\\)\\]`, 'i');
        const m = obs.match(regexGpsApoio);
        if (m && m[2] && m[2].includes(',')) {
            testarCandidato(m[2], m[1], r.id + 2, `Apoio Conjunto (${r.imovel})`);
        } else {
            if (r.gpsSaida && r.gpsSaida.includes(',')) testarCandidato(r.gpsSaida, r.hSaida, r.id, `Apoio c/ ${r.equipe}`);
            else if (r.gpsEntrada && r.gpsEntrada.includes(',')) testarCandidato(r.gpsEntrada, r.hEntrada, r.id, `Apoio c/ ${r.equipe}`);
        }
    });

    return melhorCandidato;
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
        containerAtalhos.innerHTML = `<span class="text-[11px] text-slate-400 italic">Nenhum técnico transmitiu coordenada GPS hoje até o momento.</span>`;
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
    if (totalMinutos === null || isNaN(totalMinutos) || totalMinutos <= 0) return "--h --m";
    const h = Math.floor(totalMinutos / 60), m = Math.round(totalMinutos % 60);
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
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

function expandirGraficoModal(idCanvasOrigem, tituloJanela) {
    const modal = document.getElementById('modal-expandir-grafico');
    const titulo = document.getElementById('modal-grafico-expandido-titulo');
    const canvasOrigem = document.getElementById(idCanvasOrigem);
    const canvasAlvo = document.getElementById('canvasGraficoExpandido');
    if (!modal || !canvasOrigem || !canvasAlvo) return;
    if (titulo) titulo.innerText = tituloJanela;
    modal.classList.remove('hidden');

    const chartOriginal = Chart.getChart(canvasOrigem);
    if (!chartOriginal) return;
    if (graficoExpandidoInstancia) graficoExpandidoInstancia.destroy();

    graficoExpandidoInstancia = new Chart(canvasAlvo, {
        type: chartOriginal.config.type,
        data: JSON.parse(JSON.stringify(chartOriginal.data)),
        options: {
            ...chartOriginal.config.options, responsive: true, maintainAspectRatio: false,
            plugins: { ...chartOriginal.config.options.plugins, legend: { display: true, position: 'top' } },
            onClick: (event, elements) => { if (elements.length > 0 && chartOriginal.config.options.onClick) chartOriginal.config.options.onClick(event, elements); }
        }
    });
}

function fecharModalGraficoExpandido() {
    document.getElementById('modal-expandir-grafico')?.classList.add('hidden');
    if (graficoExpandidoInstancia) { graficoExpandidoInstancia.destroy(); graficoExpandidoInstancia = null; }
}

function expandirTabelaModal(idTbodyOrigem, tituloJanela) {
    const modal = document.getElementById('modal-expandir-tabela');
    const titulo = document.getElementById('modal-tabela-expandida-titulo');
    const container = document.getElementById('container-tabela-expandida');
    const tbodyOrigem = document.getElementById(idTbodyOrigem);
    if (!modal || !container || !tbodyOrigem) return;
    const tabelaOriginal = tbodyOrigem.closest('table');
    if (!tabelaOriginal) return;

    if (titulo) titulo.innerText = tituloJanela;
    container.innerHTML = "";
    const tabelaClone = tabelaOriginal.cloneNode(true);
    tabelaClone.className = "w-full text-left border-collapse text-xs sm:text-sm";
    tabelaClone.querySelector('thead')?.classList.add('sticky', 'top-0', 'z-10', 'shadow-sm');

    const linhasOriginais = tbodyOrigem.querySelectorAll('tr');
    const tbodyClone = tabelaClone.querySelector('tbody');
    if (tbodyClone) {
        tbodyClone.removeAttribute('id');
        tbodyClone.querySelectorAll('tr').forEach((trClone, idx) => {
            const trOrig = linhasOriginais[idx];
            if (trOrig && typeof trOrig.onclick === 'function') {
                trClone.onclick = (ev) => { fecharModalTabelaExpandida(); trOrig.onclick(ev); };
            }
        });
    }
    container.appendChild(tabelaClone);
    modal.classList.remove('hidden');
}

function fecharModalTabelaExpandida() { document.getElementById('modal-expandir-tabela')?.classList.add('hidden'); }

async function autorizarReaberturaCampo(id) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') { alert("⚠️ Apenas Gestores podem autorizar a reabertura."); return; }
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
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') return;
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
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') return;
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
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') return;
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

// ================= PAINEL DE DISPONIBILIDADE + MAPA (COM APOIO CONJUNTO E SINAL MAIS RECENTE) =================
function renderizarPainelDisponibilidade() {
    try {
        const tbody = document.getElementById('tabela-disponibilidade-corpo');
        if (!tbody) return;
        tbody.innerHTML = "";
        const hojeISO = obterDataLocalISO();
        const equipesAtivas = equipesSistema.filter(e => e.status === 'Ativo');
        let countDisp = 0, countAtend = 0, countIndisp = 0, countOffline = 0;
        const listaPinosParaMapa = [];

        const todosRegsHoje = (registrosSalvos || []).filter(r =>
            r.dataRegistro === hojeISO &&
            r.equipe !== '__CONFIG_SISTEMA__' &&
            r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
            r.projeto !== PROJETO_SOLIC_MATERIAL
        );

        equipesAtivas.forEach(eq => {
            const regsHoje = todosRegsHoje.filter(r => r.equipe === eq.nome);
            const obrasEmApoioHoje = todosRegsHoje.filter(r => r.equipe !== eq.nome && extrairApoiosDoRegistro(r).includes(eq.nome));

            const impAberto = regsHoje.find(r => r.desfecho === 'IMPREVISTO');
            const obraParalisada = regsHoje.find(r => r.desfecho === 'PARALISADA');
            const obraAndamento = regsHoje.find(r => r.desfecho === 'EM ANDAMENTO' || r.desfecho === 'REABERTA');
            const apoioAndamento = obrasEmApoioHoje.find(r => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(r.desfecho));

            const programadasHoje = (registrosSalvos || []).filter(r => r.equipe === eq.nome && r.desfecho === 'PROGRAMADA').length;
            const concluidasHoje = regsHoje.filter(r => r.desfecho === 'CONCLUIDA').length;
            const apoiosConcluidosHoje = obrasEmApoioHoje.filter(r => r.desfecho === 'CONCLUIDA').length;

            const tel = (telemetriaEquipes && telemetriaEquipes[eq.nome] && telemetriaEquipes[eq.nome].data === hojeISO) ? telemetriaEquipes[eq.nome] : null;
            const turnoIniciado = tel && tel.statusTurno === 'DISPONIVEL';
            const turnoEncerrado = tel && tel.statusTurno === 'ENCERRADO';

            let turnoHtml = `<span class="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold">⚪ Não iniciado hoje</span>`;
            let turnoTextoPuro = "Não iniciado hoje";
            if (turnoIniciado) {
                turnoHtml = `<span class="bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">🟢 Ativo desde ${tel.horaInicio || '--:--'}</span>`;
                turnoTextoPuro = `Ativo desde ${tel.horaInicio || '--:--'}`;
            } else if (turnoEncerrado) {
                turnoHtml = `<span class="bg-slate-200 text-slate-800 border border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">🔴 Encerrado (${tel.horaInicio || '--:--'} às ${tel.horaFim || '--:--'})</span>`;
                turnoTextoPuro = `Encerrado (${tel.horaInicio || '--:--'} às ${tel.horaFim || '--:--'})`;
            }

            // CORREÇÃO DO MAPA TRAVADO: Busca a coordenada mais recente entre Telemetria, Check-ins, Check-outs e Apoios de hoje!
            const melhorSinal = extrairCoordenadaMaisRecenteDoTecnicoHoje(eq.nome, regsHoje, obrasEmApoioHoje, tel);
            const latFinal = melhorSinal.lat;
            const lngFinal = melhorSinal.lng;
            const horaSinal = melhorSinal.hora;

            let statusBadge = "", detalheTexto = "", ocupacaoLimpa = "", acaoHtml = "-";
            let corPinoHex = "#64748b", iconeEmojiPino = "⚪", statusTextoPuro = "OFFLINE";

            if (impAberto) {
                countIndisp++; corPinoHex = "#dc2626"; iconeEmojiPino = "🔴"; statusTextoPuro = "INDISPONÍVEL (IMPREVISTO)";
                statusBadge = `<span class="bg-red-100 text-red-800 border border-red-300 font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🔴 INDISPONÍVEL</span>`;
                const mot = (impAberto.malogros && impAberto.malogros.length > 0) ? impAberto.malogros.join(' + ') : impAberto.motivoDesfecho;
                detalheTexto = `<span class="font-bold text-red-900">${mot}</span>`;
                ocupacaoLimpa = `Imprevisto: ${mot}`;
            } else if (obraParalisada) {
                countAtend++; corPinoHex = "#ea580c"; iconeEmojiPino = "⏸️"; statusTextoPuro = "ATIVIDADE PARALISADA";
                statusBadge = `<span class="bg-orange-500 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block">⏸️ PARALISADA</span>`;
                detalheTexto = `Imóvel: <b>${obraParalisada.imovel}</b> (${obraParalisada.projeto})`;
                ocupacaoLimpa = `Pausa no imóvel ${obraParalisada.imovel}`;
            } else if (obraAndamento) {
                countAtend++; corPinoHex = "#2563eb"; iconeEmojiPino = "🔵"; statusTextoPuro = "EM ATENDIMENTO";
                const apList = extrairApoiosDoRegistro(obraAndamento);
                const txtAp = apList.length > 0 ? ` • <span class="text-purple-800 font-black">🤝 c/ ${apList.join(', ')}</span>` : '';
                statusBadge = `<span class="bg-blue-600 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🔵 EM ATENDIMENTO</span>`;
                detalheTexto = `Imóvel: <b>${obraAndamento.imovel}</b> (${obraAndamento.projeto})${txtAp}`;
                ocupacaoLimpa = `Atendendo ${obraAndamento.imovel}${apList.length > 0 ? ` (Conjunta c/ ${apList.join(', ')})` : ''}`;
            } else if (apoioAndamento) {
                countAtend++; corPinoHex = "#7c3aed"; iconeEmojiPino = "🤝"; statusTextoPuro = "EM APOIO CONJUNTO";
                statusBadge = `<span class="bg-purple-700 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block animate-pulse">🤝 EM APOIO CONJUNTO</span>`;
                detalheTexto = `Apoiando <b>${apoioAndamento.equipe}</b> no Imóvel <b>${apoioAndamento.imovel}</b> (${apoioAndamento.projeto})`;
                ocupacaoLimpa = `Em apoio a ${apoioAndamento.equipe} (Imóvel ${apoioAndamento.imovel})`;
            } else if (turnoEncerrado) {
                countOffline++; corPinoHex = "#475569"; iconeEmojiPino = "🏁"; statusTextoPuro = "EXPEDIENTE ENCERRADO";
                statusBadge = `<span class="bg-slate-200 text-slate-700 border border-slate-300 font-bold px-2.5 py-1 rounded-md text-[10px] inline-block">🏁 ENCERRADO</span>`;
                detalheTexto = `Turno finalizado (${concluidasHoje} concluída(s)${apoiosConcluidosHoje > 0 ? ` + ${apoiosConcluidosHoje} apoio(s)` : ''})`;
                ocupacaoLimpa = `Turno encerrado`;
            } else if (turnoIniciado || regsHoje.length > 0 || obrasEmApoioHoje.length > 0) {
                countDisp++; corPinoHex = "#059669"; iconeEmojiPino = "🟢"; statusTextoPuro = "EM ROTA / DISPONÍVEL";
                statusBadge = `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🟢 DISPONÍVEL</span>`;
                detalheTexto = `Em deslocamento / Livre (${concluidasHoje} concluída(s)${apoiosConcluidosHoje > 0 ? ` + <b>${apoiosConcluidosHoje} apoio(s)</b>` : ''} hoje)`;
                ocupacaoLimpa = `Disponível em rota`;
            } else {
                countOffline++; corPinoHex = "#94a3b8"; iconeEmojiPino = "⚪"; statusTextoPuro = "AGUARDANDO INÍCIO";
                statusBadge = `<span class="bg-slate-100 text-slate-500 border border-slate-200 font-bold px-2.5 py-1 rounded-md text-[10px] inline-block">⚪ AGUARDANDO</span>`;
                detalheTexto = `Sem check-in hoje (${programadasHoje} na fila)`;
                ocupacaoLimpa = "Aguardando início";
            }

            let gpsStr = `<span class="text-slate-400 text-[10px]">Sem sinal hoje</span>`;
            let sinalTextoPuro = "Sem sinal hoje";
            if (latFinal !== null && lngFinal !== null && !isNaN(latFinal) && !isNaN(lngFinal)) {
                const coordFormatada = `${latFinal.toFixed(5)}, ${lngFinal.toFixed(5)}`;
                sinalTextoPuro = `${horaSinal || '--:--'} (${melhorSinal.origem || 'GPS'})`;
                gpsStr = `<div class="space-y-0.5"><div class="text-[9px] font-bold text-emerald-800">🕒 Às ${horaSinal || '--:--'} • ${melhorSinal.origem}</div><a href="https://www.google.com/maps/search/?api=1&query=${latFinal},${lngFinal}" target="_blank" class="text-blue-600 underline font-mono text-[10px]">🗺️ ${coordFormatada}</a></div>`;
                acaoHtml = `<button type="button" onclick="focarTecnicoNoMapa(${latFinal}, ${lngFinal}, '${eq.nome}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[10px] px-2 py-1 rounded">🎯 Ver no Mapa</button>`;
                listaPinosParaMapa.push({
                    nome: eq.nome, lat: latFinal, lng: lngFinal, corHex: corPinoHex,
                    iconeEmoji: iconeEmojiPino, statusTexto: statusTextoPuro, turnoTexto: turnoTextoPuro,
                    ocupacaoLimpa, sinalTexto: sinalTextoPuro, horaCurta: horaSinal
                });
            }

            tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3 font-bold text-slate-800">${eq.nome}</td><td class="p-3">${obterBadgeSetorHtml(eq.setor)}</td><td class="p-3">${turnoHtml}</td><td class="p-3">${statusBadge}</td><td class="p-3">${detalheTexto}</td><td class="p-3">${gpsStr}</td><td class="p-3 whitespace-nowrap">${acaoHtml}</td></tr>`;
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

// ================= ATUALIZAÇÃO CENTRAL DO DASHBOARD =================
async function atualizarDashboardGestor(forcarRecargaMobile = false) {
    inicializarMelhoriasVisuaisGestor();

    const registrosReaisNaMemoria = (registrosSalvos || []).filter(r =>
        r.equipe !== "__CONFIG_SISTEMA__" &&
        r.projeto !== "__CONFIG_AUDITORIA__"
    );

    if ((forcarRecargaMobile || !cargaInicialGestorConcluida || registrosReaisNaMemoria.length === 0) && !modoConsultaBackupAtivo && !sincronizandoRegistrosMobileEmCurso) {
        sincronizandoRegistrosMobileEmCurso = true;
        try {
            const corpoAtivLoading = document.getElementById('tabela-gestor-corpo');
            if (corpoAtivLoading && registrosReaisNaMemoria.length === 0) {
                corpoAtivLoading.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-blue-900 font-bold animate-pulse">☁️ Carregando atividades da nuvem...</td></tr>`;
            }
            if (typeof carregarRegistrosDaNuvem === "function") {
                await carregarRegistrosDaNuvem(true);
            }
            cargaInicialGestorConcluida = true;
        } catch (errLoad) {
            console.warn("Aviso ao sincronizar registros:", errLoad);
        } finally {
            sincronizandoRegistrosMobileEmCurso = false;
        }
    }

    const nivelNorm = String(nivelUsuarioLogado || '').trim().toLowerCase();
    if (nivelNorm === 'master' || nivelNorm === 'operador') {
        try { await verificarEExpurgarSolicitacoesVencidas48h(); } catch (e) {}
    }
    atualizarEstimativaPesoNuvem();

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
        let mData = true;
        if (dataInicio && dataFim) mData = item.dataRegistro >= dataInicio && item.dataRegistro <= dataFim;
        else if (dataInicio) mData = item.dataRegistro >= dataInicio;
        else if (dataFim) mData = item.dataRegistro <= dataFim;

        const apoiosItem = extrairApoiosDoRegistro(item);
        let mEquipe = true;
        if (filtrosMultiplosAtivos.equipes.length > 0) {
            mEquipe = filtrosMultiplosAtivos.equipes.includes(item.equipe) || apoiosItem.some(ap => filtrosMultiplosAtivos.equipes.includes(ap));
        } else if (fEquipe) {
            mEquipe = item.equipe === fEquipe || apoiosItem.includes(fEquipe);
        }

        let mSetor = true;
        if (filtrosMultiplosAtivos.setores.length > 0) {
            const eqObj = equipesSistema.find(e => e.nome === item.equipe);
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
        let mMacro = filtrosMultiplosAtivos.macrogrupos.length > 0 ? filtrosMultiplosAtivos.macrogrupos.includes(obterMacroGrupoProjeto(i.projeto)) : true;
        let mProj = filtrosMultiplosAtivos.projetos.length > 0 ? filtrosMultiplosAtivos.projetos.includes(i.projeto) : (fProjeto ? i.projeto === fProjeto : true);
        let mDesf = filtrosMultiplosAtivos.desfechos.length > 0 ? filtrosMultiplosAtivos.desfechos.includes(i.desfecho) : (fDesfecho ? i.desfecho === fDesfecho : true);
        return mMacro && mProj && mDesf;
    });

    filtrados = enriquecerStatusMacroEBairro(filtrados);
    dadosFiltradosAtuais = filtrados;
    listaImprevistosAtuais = listaImprevistos;
    renderizarPainelDisponibilidade();

    const qtdEmAndamento = filtrados.filter(i => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(i.desfecho)).length;
    const qtdProgramadas = filtrados.filter(i => i.desfecho === 'PROGRAMADA').length;
    const imprevistosAbertos = listaImprevistos.filter(i => i.desfecho === 'IMPREVISTO').length;

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
                let acoesImp = (nivelNorm === 'master' || nivelNorm === 'operador')
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

    const finalizadas = filtrados.filter(i => !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(i.desfecho));
    setTxt('kpi-proj-vistoria', finalizadas.filter(i => i.servicoPlanilha === 'VISTORIA' && i.desfecho === 'CONCLUIDA').length);
    setTxt('kpi-proj-const-f', finalizadas.filter(i => i.servicoPlanilha === 'CONSTRUÇÃO' && i.subgrupoFOuOnGoing === 'F' && i.desfecho === 'CONCLUIDA').length);
    setTxt('kpi-proj-const-ongoing', finalizadas.filter(i => i.projeto === 'CONSTRUÇÃO ON GOING' && i.desfecho === 'CONCLUIDA').length);
    setTxt('kpi-proj-const-nap', finalizadas.filter(i => i.projeto === 'CONSTRUÇÃO NAP LOTADA' && i.desfecho === 'CONCLUIDA').length);
    setTxt('kpi-proj-ativ-f', finalizadas.filter(i => i.servicoPlanilha === 'ATIVAÇÃO' && i.subgrupoFOuOnGoing === 'F' && i.desfecho === 'CONCLUIDA').length);
    setTxt('kpi-proj-ativ-ongoing', finalizadas.filter(i => i.projeto === 'ATIVAÇÃO ON GOING' && i.desfecho === 'CONCLUIDA').length);
    setTxt('kpi-proj-ativ-nap', finalizadas.filter(i => i.projeto === 'ATIVAÇÃO NAP LOTADA' && i.desfecho === 'CONCLUIDA').length);

    setTxt('contador-resultados', `${filtrados.length} registros (${qtdEmAndamento} ativas/pausa | ${qtdProgramadas} programadas)`);
    setTxt('contador-materiais', finalizadas.length + " registros finalizados");

    let concluidasCount = finalizadas.filter(i => i.desfecho === 'CONCLUIDA').length;
    let malogradasCount = finalizadas.filter(i => i.desfecho === 'MALOGRADA').length;
    let pendentesCount = finalizadas.filter(i => i.desfecho === 'PENDENTE').length;

    setTxt('bonif-elegiveis', concluidasCount);
    setTxt('bonif-parciais', pendentesCount);
    setTxt('bonif-media-geral', finalizadas.length > 0 ? (concluidasCount / (new Set(finalizadas.map(i => i.dataRegistro)).size || 1)).toFixed(1) : "0.0");
    setTxt('bonif-malogros', malogradasCount);

    let sumCaboRL = 0, sumConectores = 0, sumCaboDrop = 0, sumNap = 0, sumDio = 0, sumFusoes = 0;
    let sumSobrepor = 0, sumEmbutida = 0, sumFosc = 0, sumVistorias = 0;

    finalizadas.forEach(i => {
        if (i.servicoPlanilha === 'VISTORIA' && i.desfecho === 'CONCLUIDA') sumVistorias++;
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

    // Renderiza a aba Atividades e Materiais (Com selo e botão de Apoio Conjunto)
    if (filtrados.length === 0) {
        if (corpoAtiv) {
            const totalGeralNoBanco = (registrosSalvos || []).filter(r => r.equipe !== "__CONFIG_SISTEMA__" && r.projeto !== "__CONFIG_AUDITORIA__").length;
            const dicaFiltro = totalGeralNoBanco > 0
                ? `<div class="mt-2"><button type="button" onclick="aplicarAtalhoPeriodo('tudo')" class="bg-blue-900 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm">🔄 Mostrar Todos os ${totalGeralNoBanco} Registros do Histórico</button></div>`
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
            const chaveAgrupamento = `${item.dataRegistro}_${item.equipe}_${codigoBase.toUpperCase()}_${item.projeto}`;
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
                const idGrupoUnico = `grupo_bloco_${Math.abs(stringParaHash(grupo.codigoBase + grupo.dataRegistro + grupo.equipe + grupo.projeto))}`;

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
                if (nivelNorm === 'master' || nivelNorm === 'operador') {
                    const podeFinalizadasReabrir = ['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(itemMaster.desfecho);
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
                const eqObj = equipesSistema.find(e => e.nome === grupo.equipe);
                const setorStr = eqObj ? eqObj.setor : "Instalador";
                const macroGrupo = obterMacroGrupoProjeto(grupo.projeto);
                const badgeGrupoCor = macroGrupo === 'PROJETO F' ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' : 'bg-cyan-50 text-cyan-900 border border-cyan-200';
                const tagsOpcoesHtml = todasOpcoesGrupo.length > 0 ? `<div class="mt-1 flex flex-wrap gap-1">${todasOpcoesGrupo.map(op => `<span class="text-[9px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">${op}</span>`).join('')}</div>` : '';
                const badgeFotosHtml = totalFotosGrupo > 0 ? `<span class="ml-1 bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold px-2 py-0.5 rounded-md text-[10px] inline-block">📷 ${totalFotosGrupo} foto(s)</span>` : '';
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
                        const acoesIndividuais = (nivelNorm === 'master' || nivelNorm === 'operador') ? `<div class="flex flex-wrap gap-1 pt-2 border-t border-slate-200 mt-1.5" onclick="event.stopPropagation()"><button onclick="abrirModalGerirApoioGestor(${blocoItem.id})" class="bg-purple-100 text-purple-950 border border-purple-300 font-bold text-[9px] px-2 py-0.5 rounded">🤝 Apoio</button>${['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(blocoItem.desfecho) ? `<button onclick="autorizarReaberturaCampo(${blocoItem.id})" class="bg-purple-100 text-purple-900 border border-purple-300 font-bold text-[9px] px-2 py-0.5 rounded">🔓 Reabrir</button>` : `<button onclick="abrirModalTransferirAtividade(${blocoItem.id})" class="bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-[9px] px-2 py-0.5 rounded">🔀 Mover</button>`}<button onclick="abrirModalEdicao(${blocoItem.id})" class="bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[9px] px-2 py-0.5 rounded">✏️ Editar</button><button onclick="excluirRegistro(${blocoItem.id}, '${blocoItem.imovel}')" class="bg-red-50 text-red-600 border border-red-200 font-bold text-[9px] px-2 py-0.5 rounded">🗑️ Excluir</button></div>` : '';
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

    const finalizadasParaGraficosGerais = grupoAtivoAbaGraficos === 'TODOS'
        ? finalizadas
        : finalizadas.filter(d => {
            if (grupoAtivoAbaGraficos === 'VISTORIA') return d.servicoPlanilha === 'VISTORIA';
            if (grupoAtivoAbaGraficos === 'CONSTRUCAO') return d.servicoPlanilha === 'CONSTRUÇÃO';
            if (grupoAtivoAbaGraficos === 'ATIVACAO') return d.servicoPlanilha === 'ATIVAÇÃO';
            return true;
        });

    const filtradosParaGraficosGerais = grupoAtivoAbaGraficos === 'TODOS'
        ? filtrados
        : filtrados.filter(d => {
            if (grupoAtivoAbaGraficos === 'VISTORIA') return d.servicoPlanilha === 'VISTORIA';
            if (grupoAtivoAbaGraficos === 'CONSTRUCAO') return d.servicoPlanilha === 'CONSTRUÇÃO';
            if (grupoAtivoAbaGraficos === 'ATIVACAO') return d.servicoPlanilha === 'ATIVAÇÃO';
            return true;
        });

    try { renderizarTresBlocosDeGruposNaAbaGraficos(finalizadas); } catch (e) { console.warn("Erro 3 grupos:", e); }
    try { renderizarPainelMallingEProjetoF(finalizadasParaGraficosGerais); } catch (e) { console.warn("Erro visões planilha:", e); }
    try { renderizarPainelProgramadoRetornoEBairro(filtradosParaGraficosGerais); } catch (e) { console.warn("Erro Programado/Retorno:", e); }
    try { renderizarGraficos(finalizadasParaGraficosGerais, filtradosParaGraficosGerais); } catch (e) { console.warn("Erro graficos:", e); }
    try { renderizarOfensoresMalogro(finalizadasParaGraficosGerais); } catch (e) { console.warn("Erro ofensores:", e); }
    try { renderizarTabelaConsolidada(finalizadasParaGraficosGerais); } catch (e) { console.warn("Erro consolidada:", e); }
    try { renderizarTabelaUsuariosPermissao(); } catch (e) {}
}
// ================= OS 3 BLOCOS INDEPENDENTES NA ABA GRÁFICOS (COM APOIO CONJUNTO - OPÇÃO A) =================
function renderizarTresBlocosDeGruposNaAbaGraficos(dadosFinalizados) {
    const hojeISO = obterDataLocalISO();
    const datasPresentes = [...new Set(dadosFinalizados.map(d => d.dataRegistro).filter(Boolean))].sort();
    const dataRefDiaria = datasPresentes.includes(hojeISO) ? hojeISO : (datasPresentes.length > 0 ? datasPresentes[datasPresentes.length - 1] : hojeISO);
    const lblDataRef = document.getElementById('lbl-data-ref-diaria');
    if (lblDataRef) lblDataRef.innerText = dataRefDiaria === hojeISO ? `Hoje (${hojeISO})` : dataRefDiaria;

    // --- 1. BLOCO GRUPO VISTORIA (Vistoriadores + Contabilização de Apoios Opção A) ---
    const dadosVistoria = dadosFinalizados.filter(d => d.servicoPlanilha === 'VISTORIA');
    const mapaVist = {};
    equipesSistema.filter(e => e.status === 'Ativo' && tecnicoPertenceAoSetor(e.setor, 'Vistoriador')).forEach(eq => {
        mapaVist[eq.nome] = { nome: eq.nome, prodDiaria: 0, exec: 0, apoios: 0, nExec: 0, total: 0, hps: 0, duracoes: [], diasSet: new Set() };
    });

    dadosVistoria.forEach(d => {
        const nome = d.equipe || 'NÃO IDENTIFICADO';
        if (!mapaVist[nome]) mapaVist[nome] = { nome, prodDiaria: 0, exec: 0, apoios: 0, nExec: 0, total: 0, hps: 0, duracoes: [], diasSet: new Set() };
        const item = mapaVist[nome];
        item.total++;
        if (d.dataRegistro) item.diasSet.add(d.dataRegistro);
        if (d.desfecho === 'CONCLUIDA') {
            item.exec++;
            item.hps += Number(d.hps) || 0;
            if (d.dataRegistro === dataRefDiaria) item.prodDiaria++;
        } else item.nExec++;
        const minIn = converterHorarioParaMinutos(d.hEntrada), minOut = converterHorarioParaMinutos(d.hSaida);
        if (minIn !== null && minOut !== null && minOut >= minIn) {
            const dur = Math.max(0, (minOut - minIn) - (Number(d.tempoPausadoMinutos) || 0));
            if (dur > 0 && dur <= 840) item.duracoes.push(dur);
        }

        // OPÇÃO A: Regista o apoio e garante o Dia Trabalhado sem duplicar o total de imóveis executados
        const apoiosReg = extrairApoiosDoRegistro(d);
        apoiosReg.forEach(nomeAp => {
            if (!mapaVist[nomeAp]) mapaVist[nomeAp] = { nome: nomeAp, prodDiaria: 0, exec: 0, apoios: 0, nExec: 0, total: 0, hps: 0, duracoes: [], diasSet: new Set() };
            if (d.dataRegistro) mapaVist[nomeAp].diasSet.add(d.dataRegistro);
            if (d.desfecho === 'CONCLUIDA') mapaVist[nomeAp].apoios++;
        });
    });

    const listaVist = Object.values(mapaVist).map(v => {
        const dias = v.diasSet.size;
        return {
            ...v, dias,
            produtividade: dias > 0 ? (v.exec / dias) : 0,
            hpDia: dias > 0 ? (v.hps / dias) : 0,
            conversao: v.total > 0 ? ((v.exec / v.total) * 100) : 0,
            tma: v.duracoes.length > 0 ? formatarDuracaoTexto(v.duracoes.reduce((a, b) => a + b, 0) / v.duracoes.length) : '--h --m'
        };
    }).sort((a, b) => b.exec - a.exec || b.apoios - a.apoios || b.total - a.total);

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    const vistComProd = listaVist.filter(x => x.total > 0 || x.apoios > 0);
    setEl('card-vist-qtd-tec', `${listaVist.length} vist. (${vistComProd.length} c/ prod.)`);
    setEl('card-vist-diaria', listaVist.reduce((a, b) => a + b.prodDiaria, 0));
    setEl('card-vist-consolidado', listaVist.reduce((a, b) => a + b.exec, 0));
    setEl('card-vist-media', (vistComProd.length > 0 ? vistComProd.reduce((a, b) => a + b.produtividade, 0) / vistComProd.length : 0).toFixed(2));

    const tbodyVist = document.getElementById('tabela-executores-vistoria-corpo');
    if (tbodyVist) {
        const trHeadVist = tbodyVist.closest('table')?.querySelector('thead tr');
        if (trHeadVist && !trHeadVist.dataset.apoioInjetado) {
            trHeadVist.dataset.apoioInjetado = "true";
            trHeadVist.innerHTML = `
                <th class="p-2.5 text-center">#</th>
                <th class="p-2.5">Vistoriador / Equipe</th>
                <th class="p-2.5 text-center bg-emerald-800">Executados</th>
                <th class="p-2.5 text-center bg-purple-700 text-purple-100" title="Atuações em Apoio Conjunto (Opção A)">🤝 Apoios</th>
                <th class="p-2.5 text-center bg-amber-800">N Executado</th>
                <th class="p-2.5 text-center">Total Geral</th>
                <th class="p-2.5 text-center">Dias Trab</th>
                <th class="p-2.5 text-center bg-purple-800 text-purple-200 font-black">Produtividade</th>
                <th class="p-2.5 text-center bg-cyan-900 text-cyan-200">QNT. HP</th>
                <th class="p-2.5 text-center">HP / DIA</th>
                <th class="p-2.5 text-center">TMA Líquido</th>
                <th class="p-2.5 text-right">% Conversão</th>
            `;
        }
        tbodyVist.innerHTML = "";
        let sExec = 0, sAp = 0, sNExec = 0, sTot = 0, sHp = 0;
        listaVist.forEach((v, idx) => {
            sExec += v.exec; sAp += v.apoios; sNExec += v.nExec; sTot += v.total; sHp += v.hps;
            const tr = document.createElement('tr');
            tr.className = "hover:bg-purple-50/60 border-b cursor-pointer";
            tr.onclick = () => dispararExplosaoGrafico('equipe_servico', `${v.nome}|VISTORIA`);
            tr.innerHTML = `<td class="p-2.5 text-center font-bold text-slate-400">${idx + 1}º</td><td class="p-2.5 font-bold text-purple-950 underline decoration-dotted">${v.nome}</td><td class="p-2.5 text-center font-black text-emerald-700 bg-emerald-50/60 text-sm">${v.exec}</td><td class="p-2.5 text-center font-black text-purple-800 bg-purple-100/60">${v.apoios > 0 ? `🤝 ${v.apoios}` : '0'}</td><td class="p-2.5 text-center font-bold text-amber-800 bg-amber-50/40">${v.nExec}</td><td class="p-2.5 text-center font-black text-slate-800">${v.total}</td><td class="p-2.5 text-center font-mono">${v.dias}</td><td class="p-2.5 text-center font-black text-purple-900 bg-purple-50/80 text-sm">${v.produtividade.toFixed(2)}</td><td class="p-2.5 text-center font-black text-cyan-900 bg-cyan-50/50">${v.hps}</td><td class="p-2.5 text-center font-semibold">${v.hpDia.toFixed(1)}</td><td class="p-2.5 text-center font-bold text-emerald-800">${v.tma}</td><td class="p-2.5 text-right font-bold">${v.conversao.toFixed(1)}%</td>`;
            tbodyVist.appendChild(tr);
        });
        const convGeralVist = sTot > 0 ? ((sExec / sTot) * 100).toFixed(1) : "0.0";
        tbodyVist.innerHTML += `<tr class="bg-purple-950 text-white font-black text-xs"><td colspan="2" class="p-2.5 text-right uppercase">Total Grupo Vistoria:</td><td class="p-2.5 text-center text-emerald-300">${sExec}</td><td class="p-2.5 text-center text-purple-200">🤝 ${sAp}</td><td class="p-2.5 text-center text-amber-300">${sNExec}</td><td class="p-2.5 text-center">${sTot}</td><td class="p-2.5 text-center">-</td><td class="p-2.5 text-center text-purple-200">-</td><td class="p-2.5 text-center text-cyan-300">${sHp}</td><td class="p-2.5 text-center">-</td><td class="p-2.5 text-center">-</td><td class="p-2.5 text-right">${convGeralVist}%</td></tr>`;
    }

    const ctxVist = document.getElementById('graficoExecutoresVistoria')?.getContext('2d');
    if (ctxVist) {
        if (graficoExecutoresVistoriaInstancia) graficoExecutoresVistoriaInstancia.destroy();
        const grafVist = vistComProd.length > 0 ? vistComProd : listaVist.slice(0, 10);
        graficoExecutoresVistoriaInstancia = new Chart(ctxVist, {
            type: 'bar',
            data: {
                labels: grafVist.map(v => `${v.nome.split(' ')[0]} ${v.nome.split(' ')[1] ? v.nome.split(' ')[1].charAt(0) + '.' : ''}`),
                datasets: [
                    { label: '🟢 Vistorias Executadas (Titular)', data: grafVist.map(v => v.exec), backgroundColor: '#7c3aed', borderRadius: 5 },
                    { label: '🤝 Apoios em Conjunto', data: grafVist.map(v => v.apoios), backgroundColor: '#ec4899', borderRadius: 5 },
                    { label: '🟠 Não Executadas', data: grafVist.map(v => v.nExec), backgroundColor: '#f59e0b', borderRadius: 5 },
                    { label: '⚡ Produtividade/Dia', data: grafVist.map(v => Number(v.produtividade.toFixed(2))), backgroundColor: '#059669', borderRadius: 5 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                onClick: (e, el) => { if (el.length > 0) dispararExplosaoGrafico('equipe_servico', `${grafVist[el[0].index].nome}|VISTORIA`); }
            }
        });
    }

    // --- 2 e 3. CONSTRUÇÃO E ATIVAÇÃO (SEPARANDO F vs ON GOING + COLUNA E BARRA DE APOIOS OPÇÃO A) ---
    const processarGrupoComSubdivisaoFOuOnGoing = (macroServico, setorPadrao, idTbody, idCanvas, prefixoCard, corBarraF, corBarraOG) => {
        const dadosGrupo = dadosFinalizados.filter(d => d.servicoPlanilha === macroServico);
        const mapa = {};
        equipesSistema.filter(e => e.status === 'Ativo' && tecnicoPertenceAoSetor(e.setor, setorPadrao)).forEach(eq => {
            mapa[eq.nome] = {
                nome: eq.nome, prodDiaria: 0,
                execF: 0, execOG: 0, execTotal: 0, apoios: 0,
                nExecF: 0, nExecOG: 0, nExecTotal: 0,
                totalGeral: 0, hpF: 0, hpOG: 0, hpTotal: 0, diasSet: new Set()
            };
        });

        // Evita contar 2 vezes o mesmo imóvel multi-bloco como 2 apoios no mesmo dia para o mesmo técnico
        const setApoiosUnicosImovel = new Set();

        dadosGrupo.forEach(d => {
            const nome = d.equipe || 'NÃO IDENTIFICADO';
            if (!mapa[nome]) {
                mapa[nome] = {
                    nome, prodDiaria: 0,
                    execF: 0, execOG: 0, execTotal: 0, apoios: 0,
                    nExecF: 0, nExecOG: 0, nExecTotal: 0,
                    totalGeral: 0, hpF: 0, hpOG: 0, hpTotal: 0, diasSet: new Set()
                };
            }
            const item = mapa[nome];
            item.totalGeral++;
            if (d.dataRegistro) item.diasSet.add(d.dataRegistro);
            const ehF = d.subgrupoFOuOnGoing === 'F';
            const hpsVal = Number(d.hps) || 0;

            if (d.desfecho === 'CONCLUIDA') {
                item.execTotal++;
                item.hpTotal += hpsVal;
                if (ehF) { item.execF++; item.hpF += hpsVal; }
                else { item.execOG++; item.hpOG += hpsVal; }
                if (d.dataRegistro === dataRefDiaria) item.prodDiaria++;
            } else {
                item.nExecTotal++;
                if (ehF) item.nExecF++;
                else item.nExecOG++;
            }

            // OPÇÃO A: Computa os Apoios realizados sem inflar o Total Executado da operação
            const apoiosReg = extrairApoiosDoRegistro(d);
            apoiosReg.forEach(nomeAp => {
                if (!mapa[nomeAp]) {
                    mapa[nomeAp] = {
                        nome: nomeAp, prodDiaria: 0,
                        execF: 0, execOG: 0, execTotal: 0, apoios: 0,
                        nExecF: 0, nExecOG: 0, nExecTotal: 0,
                        totalGeral: 0, hpF: 0, hpOG: 0, hpTotal: 0, diasSet: new Set()
                    };
                }
                if (d.dataRegistro) mapa[nomeAp].diasSet.add(d.dataRegistro);
                const chaveAp = `${d.dataRegistro}_${obterCodigoBaseImovel(d.imovel)}_${nomeAp}`;
                if (!setApoiosUnicosImovel.has(chaveAp)) {
                    setApoiosUnicosImovel.add(chaveAp);
                    mapa[nomeAp].apoios++;
                }
            });
        });

        const lista = Object.values(mapa).map(x => {
            const dias = x.diasSet.size;
            return {
                ...x, dias,
                produtividade: dias > 0 ? (x.execTotal / dias) : 0,
                hpDia: dias > 0 ? (x.hpTotal / dias) : 0,
                conversao: x.totalGeral > 0 ? ((x.execTotal / x.totalGeral) * 100) : 0
            };
        }).sort((a, b) => b.execTotal - a.execTotal || b.apoios - a.apoios || b.totalGeral - a.totalGeral);

        const comProd = lista.filter(x => x.totalGeral > 0 || x.apoios > 0);
        const totExecF = lista.reduce((a, b) => a + b.execF, 0);
        const totExecOG = lista.reduce((a, b) => a + b.execOG, 0);
        const totExecGeral = lista.reduce((a, b) => a + b.execTotal, 0);

        setEl(`card-${prefixoCard}-qtd-tec`, `${lista.length} eq. (${comProd.length} c/ prod.)`);
        setEl(`card-${prefixoCard}-exec-f`, totExecF);
        setEl(`card-${prefixoCard}-exec-ongoing`, totExecOG);
        setEl(`card-${prefixoCard}-consolidado`, totExecGeral);
        setEl(`card-${prefixoCard}-diaria`, lista.reduce((a, b) => a + b.prodDiaria, 0));
        setEl(`card-${prefixoCard}-media`, (comProd.length > 0 ? comProd.reduce((a, b) => a + b.produtividade, 0) / comProd.length : 0).toFixed(2));

        const tbody = document.getElementById(idTbody);
        if (tbody) {
            const trHead = tbody.closest('table')?.querySelector('thead tr');
            if (trHead && !trHead.dataset.apoioInjetado) {
                trHead.dataset.apoioInjetado = "true";
                trHead.innerHTML = `
                    <th class="p-2.5 text-center">#</th>
                    <th class="p-2.5">Equipe / Técnico</th>
                    <th class="p-2.5 text-center bg-indigo-800 text-indigo-100">Exec. F</th>
                    <th class="p-2.5 text-center bg-cyan-800 text-cyan-100">Exec. ON GOING</th>
                    <th class="p-2.5 text-center bg-emerald-800 text-white font-black">Total Exec.</th>
                    <th class="p-2.5 text-center bg-purple-800 text-purple-100" title="Atuações em Apoio Conjunto (Opção A)">🤝 Apoios</th>
                    <th class="p-2.5 text-center bg-amber-800/80">N Exec. F</th>
                    <th class="p-2.5 text-center bg-amber-700/80">N Exec. ON GOING</th>
                    <th class="p-2.5 text-center bg-amber-900 text-amber-200">Total N Exec.</th>
                    <th class="p-2.5 text-center">Total Geral</th>
                    <th class="p-2.5 text-center">Dias Trab</th>
                    <th class="p-2.5 text-center bg-blue-800 text-cyan-300 font-black">Produtividade</th>
                    <th class="p-2.5 text-center bg-cyan-950 text-cyan-200">HP (F / ON GOING / Total)</th>
                    <th class="p-2.5 text-center">HP / DIA</th>
                    <th class="p-2.5 text-right">% Conv.</th>
                `;
            }

            tbody.innerHTML = "";
            let sEF = 0, sEOG = 0, sET = 0, sAp = 0, sNF = 0, sNOG = 0, sNT = 0, sTG = 0, sHF = 0, sHOG = 0, sHT = 0;
            lista.forEach((x, idx) => {
                sEF += x.execF; sEOG += x.execOG; sET += x.execTotal; sAp += x.apoios;
                sNF += x.nExecF; sNOG += x.nExecOG; sNT += x.nExecTotal;
                sTG += x.totalGeral; sHF += x.hpF; sHOG += x.hpOG; sHT += x.hpTotal;

                const tr = document.createElement('tr');
                tr.className = "hover:bg-blue-50/60 border-b cursor-pointer";
                tr.onclick = () => dispararExplosaoGrafico('equipe_servico', `${x.nome}|${macroServico}`);
                tr.innerHTML = `
                    <td class="p-2.5 text-center font-bold text-slate-400">${idx + 1}º</td>
                    <td class="p-2.5 font-bold text-blue-950 underline decoration-dotted">${x.nome}</td>
                    <td class="p-2.5 text-center font-black text-indigo-800 bg-indigo-50/70">${x.execF}</td>
                    <td class="p-2.5 text-center font-black text-cyan-800 bg-cyan-50/70">${x.execOG}</td>
                    <td class="p-2.5 text-center font-black text-emerald-800 bg-emerald-100/70 text-sm">${x.execTotal}</td>
                    <td class="p-2.5 text-center font-black text-purple-800 bg-purple-100/70">${x.apoios > 0 ? `🤝 ${x.apoios}` : '0'}</td>
                    <td class="p-2.5 text-center text-amber-800 bg-amber-50/40">${x.nExecF}</td>
                    <td class="p-2.5 text-center text-amber-800 bg-amber-50/40">${x.nExecOG}</td>
                    <td class="p-2.5 text-center font-bold text-amber-900 bg-amber-100/50">${x.nExecTotal}</td>
                    <td class="p-2.5 text-center font-black text-slate-800">${x.totalGeral}</td>
                    <td class="p-2.5 text-center font-mono">${x.dias}</td>
                    <td class="p-2.5 text-center font-black text-blue-950 bg-blue-50/80 text-sm">${x.produtividade.toFixed(2)}</td>
                    <td class="p-2.5 text-center font-semibold text-xs bg-slate-50"><span class="text-indigo-700 font-bold">${x.hpF}</span> / <span class="text-cyan-800 font-bold">${x.hpOG}</span> / <b class="text-slate-900">${x.hpTotal}</b></td>
                    <td class="p-2.5 text-center font-semibold">${x.hpDia.toFixed(1)}</td>
                    <td class="p-2.5 text-right font-bold">${x.conversao.toFixed(1)}%</td>`;
                tbody.appendChild(tr);
            });
            const convG = sTG > 0 ? ((sET / sTG) * 100).toFixed(1) : "0.0";
            tbody.innerHTML += `<tr class="bg-slate-900 text-white font-black text-xs"><td colspan="2" class="p-2.5 text-right uppercase">Total Grupo ${macroServico}:</td><td class="p-2.5 text-center text-indigo-300">${sEF}</td><td class="p-2.5 text-center text-cyan-300">${sEOG}</td><td class="p-2.5 text-center text-emerald-300">${sET}</td><td class="p-2.5 text-center text-purple-300">🤝 ${sAp}</td><td class="p-2.5 text-center text-amber-200">${sNF}</td><td class="p-2.5 text-center text-amber-200">${sNOG}</td><td class="p-2.5 text-center text-amber-300">${sNT}</td><td class="p-2.5 text-center">${sTG}</td><td class="p-2.5 text-center">-</td><td class="p-2.5 text-center">-</td><td class="p-2.5 text-center text-cyan-200">${sHF} / ${sHOG} / ${sHT}</td><td class="p-2.5 text-center">-</td><td class="p-2.5 text-right">${convG}%</td></tr>`;
        }

        const ctx = document.getElementById(idCanvas)?.getContext('2d');
        if (ctx) {
            const grafLista = comProd.length > 0 ? comProd : lista.slice(0, 12);
            const novaInst = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: grafLista.map(x => `${x.nome.split(' ')[0]} ${x.nome.split(' ')[1] ? x.nome.split(' ')[1].charAt(0) + '.' : ''}`),
                    datasets: [
                        { label: `🟣 Executado PROJETO F`, data: grafLista.map(x => x.execF), backgroundColor: corBarraF, borderRadius: 4 },
                        { label: `🔵 Executado ON GOING`, data: grafLista.map(x => x.execOG), backgroundColor: corBarraOG, borderRadius: 4 },
                        { label: `🤝 Apoios em Conjunto`, data: grafLista.map(x => x.apoios), backgroundColor: '#ec4899', borderRadius: 4 },
                        { label: `🟠 Não Executado (F + ON GOING)`, data: grafLista.map(x => x.nExecTotal), backgroundColor: '#f59e0b', borderRadius: 4 },
                        { label: `⚡ Produtividade/Dia`, data: grafLista.map(x => Number(x.produtividade.toFixed(2))), backgroundColor: '#10b981', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    onClick: (e, el) => { if (el.length > 0) dispararExplosaoGrafico('equipe_servico', `${grafLista[el[0].index].nome}|${macroServico}`); }
                }
            });
            if (macroServico === 'CONSTRUÇÃO') {
                if (graficoExecutoresConstrucaoInstancia) graficoExecutoresConstrucaoInstancia.destroy();
                graficoExecutoresConstrucaoInstancia = novaInst;
            } else {
                if (graficoExecutoresAtivacaoInstancia) graficoExecutoresAtivacaoInstancia.destroy();
                graficoExecutoresAtivacaoInstancia = novaInst;
            }
        }
    };

    processarGrupoComSubdivisaoFOuOnGoing('CONSTRUÇÃO', 'Instalador', 'tabela-executores-construcao-corpo', 'graficoExecutoresConstrucao', 'inst', '#4f46e5', '#0284c7');
    processarGrupoComSubdivisaoFOuOnGoing('ATIVAÇÃO', 'Ativador', 'tabela-executores-ativacao-corpo', 'graficoExecutoresAtivacao', 'ativ', '#6366f1', '#0d9488');
}

// ================= GRÁFICOS DINÂMICOS E MATRIZES SEPARADAS POR GRUPO NA ABA GRÁFICOS =================
function renderizarPainelMallingEProjetoF(dados) {
    const categorias5 = [
        { label: '🔍 VISTORIA', filtro: d => d.servicoPlanilha === 'VISTORIA', chaveExp: 'VISTORIA|TODOS' },
        { label: '🛠️ CONSTRUÇÃO F', filtro: d => d.servicoPlanilha === 'CONSTRUÇÃO' && d.subgrupoFOuOnGoing === 'F', chaveExp: 'CONSTRUÇÃO|F' },
        { label: '🛠️ CONST. ON GOING', filtro: d => d.servicoPlanilha === 'CONSTRUÇÃO' && d.subgrupoFOuOnGoing === 'ON GOING', chaveExp: 'CONSTRUÇÃO|ON GOING' },
        { label: '⚡ ATIVAÇÃO F', filtro: d => d.servicoPlanilha === 'ATIVAÇÃO' && d.subgrupoFOuOnGoing === 'F', chaveExp: 'ATIVAÇÃO|F' },
        { label: '⚡ ATIV. ON GOING', filtro: d => d.servicoPlanilha === 'ATIVAÇÃO' && d.subgrupoFOuOnGoing === 'ON GOING', chaveExp: 'ATIVAÇÃO|ON GOING' }
    ];

    const badgeTotalServ = document.getElementById('badge-total-malling');
    if (badgeTotalServ) badgeTotalServ.innerText = `${dados.length} acionamentos`;

    const ctxServ = document.getElementById('graficoGrupoMalling')?.getContext('2d');
    if (ctxServ) {
        if (graficoGrupoMallingInstancia) graficoGrupoMallingInstancia.destroy();
        graficoGrupoMallingInstancia = new Chart(ctxServ, {
            type: 'bar',
            data: {
                labels: categorias5.map(c => c.label),
                datasets: [
                    { label: '🟢 EXECUTADO', data: categorias5.map(c => dados.filter(d => c.filtro(d) && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#059669', borderRadius: 5 },
                    { label: '🤝 Com Apoio Conjunto', data: categorias5.map(c => dados.filter(d => c.filtro(d) && extrairApoiosDoRegistro(d).length > 0).length), backgroundColor: '#9333ea', borderRadius: 5 },
                    { label: '🟠 N EXECUTADO', data: categorias5.map(c => dados.filter(d => c.filtro(d) && d.desfecho !== 'CONCLUIDA').length), backgroundColor: '#f59e0b', borderRadius: 5 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                onClick: (e, el) => { if (el.length > 0) dispararExplosaoGrafico('grupo_subgrupo', categorias5[el[0].index].chaveExp); }
            }
        });
    }

    const semanas = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5'];
    const badgeSem = document.getElementById('badge-total-projetof');
    if (badgeSem) badgeSem.innerText = `${dados.filter(d => d.desfecho === 'CONCLUIDA').length} executados`;

    const ctxSem = document.getElementById('graficoGrupoProjetoF')?.getContext('2d');
    if (ctxSem) {
        if (graficoGrupoProjetoFInstancia) graficoGrupoProjetoFInstancia.destroy();
        graficoGrupoProjetoFInstancia = new Chart(ctxSem, {
            type: 'bar',
            data: {
                labels: semanas,
                datasets: [
                    { label: '🔍 Vistoria (Exec.)', data: semanas.map(s => dados.filter(d => obterSemanaDoMes(d.dataRegistro) === s && d.servicoPlanilha === 'VISTORIA' && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#7c3aed', borderRadius: 4 },
                    { label: '🛠️ Construção F (Exec.)', data: semanas.map(s => dados.filter(d => obterSemanaDoMes(d.dataRegistro) === s && d.servicoPlanilha === 'CONSTRUÇÃO' && d.subgrupoFOuOnGoing === 'F' && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#4f46e5', borderRadius: 4 },
                    { label: '🛠️ Construção ON GOING (Exec.)', data: semanas.map(s => dados.filter(d => obterSemanaDoMes(d.dataRegistro) === s && d.servicoPlanilha === 'CONSTRUÇÃO' && d.subgrupoFOuOnGoing === 'ON GOING' && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#0284c7', borderRadius: 4 },
                    { label: '⚡ Ativação F + ON GOING (Exec.)', data: semanas.map(s => dados.filter(d => obterSemanaDoMes(d.dataRegistro) === s && d.servicoPlanilha === 'ATIVAÇÃO' && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#059669', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                onClick: (e, el) => { if (el.length > 0) dispararExplosaoGrafico('semana', semanas[el[0].index]); }
            }
        });
    }

    const datasOrdenadas = [...new Set(dados.map(d => d.dataRegistro).filter(Boolean))].sort();
    const ctxDiario = document.getElementById('graficoEvolucaoGrupos')?.getContext('2d');
    if (ctxDiario) {
        if (graficoEvolucaoGruposInstancia) graficoEvolucaoGruposInstancia.destroy();
        graficoEvolucaoGruposInstancia = new Chart(ctxDiario, {
            type: 'bar',
            data: {
                labels: datasOrdenadas.length > 0 ? datasOrdenadas.map(dt => dt.split('-').reverse().slice(0, 2).join('/')) : ['Sem datas'],
                datasets: [
                    { label: '🔍 Vistoria (Exec.)', data: datasOrdenadas.map(dt => dados.filter(d => d.dataRegistro === dt && d.servicoPlanilha === 'VISTORIA' && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#7c3aed', borderRadius: 4 },
                    { label: '🛠️ Construção (F + ON GOING Exec.)', data: datasOrdenadas.map(dt => dados.filter(d => d.dataRegistro === dt && d.servicoPlanilha === 'CONSTRUÇÃO' && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#2563eb', borderRadius: 4 },
                    { label: '⚡ Ativação (F + ON GOING Exec.)', data: datasOrdenadas.map(dt => dados.filter(d => d.dataRegistro === dt && d.servicoPlanilha === 'ATIVAÇÃO' && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#059669', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } },
                onClick: (e, el) => { if (el.length > 0 && datasOrdenadas[el[0].index]) dispararExplosaoGrafico('data', datasOrdenadas[el[0].index]); }
            }
        });
    }

    renderizarMatrizDiariaPlanilha(dados, datasOrdenadas);

    const theadCruz = document.getElementById('thead-cruzamento-executores');
    const tbodyCruz = document.getElementById('tabela-cruzamento-executores-corpo');
    if (!tbodyCruz) return;
    tbodyCruz.innerHTML = "";

    if (theadCruz) {
        theadCruz.innerHTML = `
            <tr class="bg-slate-800 text-white uppercase font-bold text-[9px] border-b">
                <th class="p-2.5">Executor / Técnico</th>
                <th class="p-2.5">Grupo Principal</th>
                <th class="p-2 text-center bg-purple-900">Vistoria (Exec / N Exec)</th>
                <th class="p-2 text-center bg-indigo-900">Construção F (Exec / N Exec)</th>
                <th class="p-2 text-center bg-blue-900">Const. ON GOING (Exec / N Exec)</th>
                <th class="p-2 text-center bg-emerald-900">Ativação F (Exec / N Exec)</th>
                <th class="p-2 text-center bg-teal-900">Ativ. ON GOING (Exec / N Exec)</th>
                <th class="p-2 text-center bg-purple-800 text-purple-100">🤝 Apoios</th>
                <th class="p-2.5 text-center bg-slate-950 text-cyan-300 font-black">Total Executado</th>
                <th class="p-2.5 text-center bg-slate-900">Total Geral</th>
            </tr>`;
    }

    const gruposMacro = [
        { chave: 'VISTORIA', titulo: '🔍 GRUPO VISTORIA (Vistoriadores)', cor: 'bg-purple-100 text-purple-950' },
        { chave: 'CONSTRUÇÃO', titulo: '🛠️ GRUPO CONSTRUÇÃO (Instaladores — F & ON GOING)', cor: 'bg-blue-100 text-blue-950' },
        { chave: 'ATIVAÇÃO', titulo: '⚡ GRUPO ATIVAÇÃO (Ativadores — F & ON GOING)', cor: 'bg-emerald-100 text-emerald-950' }
    ];

    gruposMacro.forEach(grp => {
        const dadosDoGrp = dados.filter(d => d.servicoPlanilha === grp.chave);
        if (dadosDoGrp.length === 0) return;

        tbodyCruz.innerHTML += `<tr class="${grp.cor} font-black text-xs"><td colspan="10" class="p-2 uppercase">${grp.titulo}</td></tr>`;
        const mapaTec = {};
        dadosDoGrp.forEach(d => {
            const n = d.equipe || 'NÃO IDENTIFICADO';
            if (!mapaTec[n]) mapaTec[n] = { nome: n, vE: 0, vN: 0, cfE: 0, cfN: 0, cogE: 0, cogN: 0, afE: 0, afN: 0, aogE: 0, aogN: 0, ap: 0, totE: 0, totG: 0 };
            const t = mapaTec[n];
            t.totG++;
            const ok = d.desfecho === 'CONCLUIDA';
            if (ok) t.totE++;
            if (d.servicoPlanilha === 'VISTORIA') { if (ok) t.vE++; else t.vN++; }
            else if (d.servicoPlanilha === 'CONSTRUÇÃO') {
                if (d.subgrupoFOuOnGoing === 'F') { if (ok) t.cfE++; else t.cfN++; }
                else { if (ok) t.cogE++; else t.cogN++; }
            } else {
                if (d.subgrupoFOuOnGoing === 'F') { if (ok) t.afE++; else t.afN++; }
                else { if (ok) t.aogE++; else t.aogN++; }
            }

            extrairApoiosDoRegistro(d).forEach(apNome => {
                if (!mapaTec[apNome]) mapaTec[apNome] = { nome: apNome, vE: 0, vN: 0, cfE: 0, cfN: 0, cogE: 0, cogN: 0, afE: 0, afN: 0, aogE: 0, aogN: 0, ap: 0, totE: 0, totG: 0 };
                mapaTec[apNome].ap++;
            });
        });

        Object.values(mapaTec).sort((a, b) => b.totE - a.totE || b.ap - a.ap).forEach(t => {
            const cel = (e, n) => e === 0 && n === 0 ? `<span class="text-slate-300">-</span>` : `<b class="text-emerald-700">${e}</b> <span class="text-slate-400">/</span> <span class="text-amber-700">${n}</span>`;
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 border-b cursor-pointer";
            tr.onclick = () => dispararExplosaoGrafico('equipe_servico', `${t.nome}|${grp.chave}`);
            tr.innerHTML = `<td class="p-2.5 font-bold text-slate-800">${t.nome}</td><td class="p-2.5 font-bold text-[10px]">${grp.chave}</td><td class="p-2 text-center">${cel(t.vE, t.vN)}</td><td class="p-2 text-center">${cel(t.cfE, t.cfN)}</td><td class="p-2 text-center">${cel(t.cogE, t.cogN)}</td><td class="p-2 text-center">${cel(t.afE, t.afN)}</td><td class="p-2 text-center">${cel(t.aogE, t.aogN)}</td><td class="p-2 text-center font-black text-purple-800 bg-purple-50/60">${t.ap > 0 ? `🤝 ${t.ap}` : '-'}</td><td class="p-2.5 text-center font-black bg-emerald-50 text-emerald-900">${t.totE}</td><td class="p-2.5 text-center font-bold bg-slate-50">${t.totG}</td>`;
            tbodyCruz.appendChild(tr);
        });
    });
}

function renderizarMatrizDiariaPlanilha(dados, datasOrdenadas) {
    const thead = document.getElementById('thead-matriz-diaria-equipes');
    const tbody = document.getElementById('tabela-matriz-diaria-equipes-corpo');
    if (!thead || !tbody) return;
    tbody.innerHTML = "";
    const datasExibir = datasOrdenadas.length > 0 ? datasOrdenadas : [obterDataLocalISO()];

    let htmlHead = `<tr class="bg-slate-900 text-white uppercase font-bold text-[9px] tracking-wider"><th class="p-2.5 text-center bg-emerald-900 text-cyan-300">Exec. Total</th><th class="p-2.5 text-center bg-purple-900 text-purple-200">🤝 Apoios</th><th class="p-2.5 text-center bg-indigo-950 text-indigo-200">F / ON GOING</th><th class="p-2.5">Equipe / Técnico</th>`;
    datasExibir.forEach(dt => { htmlHead += `<th class="p-2 text-center font-mono">${dt.split('-').reverse().slice(0, 2).join('/')}</th>`; });
    htmlHead += `</tr>`;
    thead.innerHTML = htmlHead;

    const gruposDiario = [
        { chave: 'VISTORIA', titulo: '🔍 GRUPO VISTORIA (Vistoriadores)', cor: 'bg-purple-900 text-white' },
        { chave: 'CONSTRUÇÃO', titulo: '🛠️ GRUPO CONSTRUÇÃO — Instaladores (F & ON GOING)', cor: 'bg-blue-900 text-white' },
        { chave: 'ATIVAÇÃO', titulo: '⚡ GRUPO ATIVAÇÃO — Ativadores (F & ON GOING)', cor: 'bg-emerald-900 text-white' }
    ];

    gruposDiario.forEach(grp => {
        const dadosGrp = dados.filter(d => d.servicoPlanilha === grp.chave);
        if (dadosGrp.length === 0) return;

        tbody.innerHTML += `<tr class="${grp.cor} font-black text-xs"><td colspan="${datasExibir.length + 4}" class="p-2 uppercase">${grp.titulo}</td></tr>`;

        const mapaDiario = {};
        dadosGrp.forEach(d => {
            const eq = d.equipe || "NÃO IDENTIFICADO";
            if (!mapaDiario[eq]) mapaDiario[eq] = { nome: eq, totalExec: 0, totalAp: 0, execF: 0, execOG: 0, porData: {}, apPorData: {} };
            if (d.desfecho === 'CONCLUIDA') {
                mapaDiario[eq].totalExec++;
                if (d.subgrupoFOuOnGoing === 'F') mapaDiario[eq].execF++;
                else mapaDiario[eq].execOG++;
                mapaDiario[eq].porData[d.dataRegistro] = (mapaDiario[eq].porData[d.dataRegistro] || 0) + 1;
            }
            extrairApoiosDoRegistro(d).forEach(apNome => {
                if (!mapaDiario[apNome]) mapaDiario[apNome] = { nome: apNome, totalExec: 0, totalAp: 0, execF: 0, execOG: 0, porData: {}, apPorData: {} };
                mapaDiario[apNome].totalAp++;
                mapaDiario[apNome].apPorData[d.dataRegistro] = (mapaDiario[apNome].apPorData[d.dataRegistro] || 0) + 1;
            });
        });

        const somaDiaGrupo = {};
        datasExibir.forEach(dt => somaDiaGrupo[dt] = 0);
        let somaTotGrupo = 0, somaApGrupo = 0, somaFGrupo = 0, somaOGGrupo = 0;

        Object.values(mapaDiario).sort((a, b) => b.totalExec - a.totalExec || b.totalAp - a.totalAp).forEach(item => {
            somaTotGrupo += item.totalExec; somaApGrupo += item.totalAp; somaFGrupo += item.execF; somaOGGrupo += item.execOG;
            let colsDias = "";
            datasExibir.forEach(dt => {
                const v = item.porData[dt] || 0;
                const apDia = item.apPorData[dt] || 0;
                somaDiaGrupo[dt] += v;
                let txtCel = v > 0 ? `${v}` : (apDia > 0 ? '' : '-');
                if (apDia > 0) txtCel += `${v > 0 ? ' ' : ''}<span class="text-[9px] text-purple-700 font-bold">(+${apDia}🤝)</span>`;
                colsDias += `<td class="p-2 text-center ${v > 0 ? 'font-black text-emerald-800 bg-emerald-50/60' : (apDia > 0 ? 'bg-purple-50/50' : 'text-slate-300')}">${txtCel}</td>`;
            });
            const subF_OG = grp.chave === 'VISTORIA' ? '-' : `${item.execF} F / ${item.execOG} OG`;
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 border-b cursor-pointer";
            tr.onclick = () => dispararExplosaoGrafico('equipe_servico', `${item.nome}|${grp.chave}`);
            tr.innerHTML = `<td class="p-2 text-center font-black bg-emerald-50 text-emerald-950">${item.totalExec}</td><td class="p-2 text-center font-black bg-purple-50 text-purple-900">${item.totalAp > 0 ? `🤝 ${item.totalAp}` : '-'}</td><td class="p-2 text-center text-[10px] font-bold text-indigo-900 bg-indigo-50/40 whitespace-nowrap">${subF_OG}</td><td class="p-2 font-bold text-slate-800 whitespace-nowrap">${item.nome}</td>${colsDias}`;
            tbody.appendChild(tr);
        });

        let colsSub = "";
        datasExibir.forEach(dt => { colsSub += `<td class="p-2 text-center font-black">${somaDiaGrupo[dt]}</td>`; });
        tbody.innerHTML += `<tr class="bg-slate-200 text-slate-900 font-black text-[11px] border-b-2 border-slate-400"><td class="p-2 text-center">${somaTotGrupo}</td><td class="p-2 text-center text-purple-900">🤝 ${somaApGrupo}</td><td class="p-2 text-center text-[10px]">${grp.chave === 'VISTORIA' ? '-' : `${somaFGrupo} F / ${somaOGGrupo} OG`}</td><td class="p-2 uppercase">Subtotal ${grp.chave}</td>${colsSub}</tr>`;
    });
}

// ================= SEÇÃO E PLANILHA SEPARADA POR GRUPOS: PROGRAMADO vs. RETORNO & BAIRRO =================
function renderizarPainelProgramadoRetornoEBairro(dadosEnriquecidos) {
    const tbody = document.getElementById('tabela-programado-retorno-bairro-corpo');
    if (!tbody) return;
    tbody.innerHTML = "";

    const baseValida = dadosEnriquecidos.filter(d => !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(d.desfecho));
    const totalValidos = baseValida.length;
    const qtdProg = baseValida.filter(d => d.statusMacroPlanilha === 'PROGRAMADO').length;
    const qtdRet  = baseValida.filter(d => d.statusMacroPlanilha === 'RETORNO').length;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setEl('kpi-macro-programado', qtdProg);
    setEl('kpi-macro-programado-perc', totalValidos > 0 ? `${((qtdProg / totalValidos) * 100).toFixed(1)}% do total` : '0% do total');
    setEl('kpi-macro-retorno', qtdRet);
    setEl('kpi-macro-retorno-perc', totalValidos > 0 ? `${((qtdRet / totalValidos) * 100).toFixed(1)}% do total` : '0% do total');

    const mapaBairrosGlobal = {};
    baseValida.forEach(d => {
        const b = d.bairroPlanilha || 'OUTROS / VER ENDEREÇO';
        if (!mapaBairrosGlobal[b]) mapaBairrosGlobal[b] = { bairro: b, programado: 0, retorno: 0, executado: 0, total: 0 };
        mapaBairrosGlobal[b].total++;
        if (d.statusMacroPlanilha === 'RETORNO') mapaBairrosGlobal[b].retorno++;
        else mapaBairrosGlobal[b].programado++;
        if (d.desfecho === 'CONCLUIDA') mapaBairrosGlobal[b].executado++;
    });

    const listaBairrosGlobal = Object.values(mapaBairrosGlobal).sort((a, b) => b.total - a.total);
    setEl('kpi-macro-qtd-bairros', listaBairrosGlobal.length);
    if (listaBairrosGlobal.length > 0) {
        setEl('kpi-macro-top-bairro', listaBairrosGlobal[0].bairro);
        setEl('kpi-macro-top-bairro-qtd', `${listaBairrosGlobal[0].total} acionamentos (${listaBairrosGlobal[0].executado} exec.)`);
    } else {
        setEl('kpi-macro-top-bairro', '-');
        setEl('kpi-macro-top-bairro-qtd', '0 acionamentos');
    }

    const gruposBairro = [
        { chave: 'VISTORIA', titulo: '🔍 GRUPO VISTORIA — Por Bairro', cor: 'bg-purple-900 text-white' },
        { chave: 'CONSTRUÇÃO', titulo: '🛠️ GRUPO CONSTRUÇÃO (F vs. ON GOING) — Por Bairro', cor: 'bg-blue-900 text-white' },
        { chave: 'ATIVAÇÃO', titulo: '⚡ GRUPO ATIVAÇÃO (F vs. ON GOING) — Por Bairro', cor: 'bg-emerald-900 text-white' }
    ];

    if (baseValida.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Nenhum registro finalizado no período.</td></tr>`;
    } else {
        gruposBairro.forEach(grp => {
            const itensGrp = baseValida.filter(d => d.servicoPlanilha === grp.chave);
            if (itensGrp.length === 0) return;

            tbody.innerHTML += `<tr class="${grp.cor} font-black text-[11px]"><td colspan="7" class="p-2 uppercase">${grp.titulo} (${itensGrp.length} reg.)</td></tr>`;
            const mapaB = {};
            itensGrp.forEach(d => {
                const b = d.bairroPlanilha || 'OUTROS / VER ENDEREÇO';
                if (!mapaB[b]) mapaB[b] = { bairro: b, prog: 0, ret: 0, exec: 0, execF: 0, execOG: 0, nExec: 0, total: 0, hps: 0 };
                mapaB[b].total++;
                if (d.statusMacroPlanilha === 'RETORNO') mapaB[b].ret++;
                else mapaB[b].prog++;
                if (d.desfecho === 'CONCLUIDA') {
                    mapaB[b].exec++;
                    mapaB[b].hps += Number(d.hps) || 0;
                    if (d.subgrupoFOuOnGoing === 'F') mapaB[b].execF++;
                    else mapaB[b].execOG++;
                } else mapaB[b].nExec++;
            });

            Object.values(mapaB).sort((a, b) => b.total - a.total).forEach(item => {
                const detExec = grp.chave === 'VISTORIA' ? `${item.exec}` : `${item.exec} <span class="text-[9px] text-slate-500">(${item.execF}F / ${item.execOG}OG)</span>`;
                const tr = document.createElement('tr');
                tr.className = "hover:bg-amber-50/50 border-b cursor-pointer";
                tr.onclick = () => dispararExplosaoGrafico('bairro', item.bairro);
                tr.innerHTML = `<td class="p-2 font-bold text-slate-800">${item.bairro}</td><td class="p-2 text-center font-bold text-blue-800 bg-blue-50/40">${item.prog}</td><td class="p-2 text-center font-bold text-amber-800 bg-amber-50/40">${item.ret}</td><td class="p-2 text-center font-black text-emerald-700 bg-emerald-50/40">${detExec}</td><td class="p-2 text-center text-slate-500">${item.nExec}</td><td class="p-2 text-center font-black">${item.total}</td><td class="p-2 text-right font-bold text-indigo-900">${item.hps}</td>`;
                tbody.appendChild(tr);
            });
        });
    }

    const topBairrosGraf = listaBairrosGlobal.slice(0, 12);
    const ctxBairro = document.getElementById('graficoProgramadoRetornoBairro')?.getContext('2d');
    if (ctxBairro) {
        if (graficoProgramadoRetornoBairroInstancia) graficoProgramadoRetornoBairroInstancia.destroy();
        graficoProgramadoRetornoBairroInstancia = new Chart(ctxBairro, {
            type: 'bar',
            data: {
                labels: topBairrosGraf.length > 0 ? topBairrosGraf.map(b => b.bairro) : ['Sem dados'],
                datasets: [
                    { label: '📋 PROGRAMADO (1ª Visita)', data: topBairrosGraf.map(b => b.programado), backgroundColor: '#2563eb', borderRadius: 4 },
                    { label: '🔄 RETORNO (Reincidência)', data: topBairrosGraf.map(b => b.retorno), backgroundColor: '#d97706', borderRadius: 4 },
                    { label: '🟢 EXECUTADO', data: topBairrosGraf.map(b => b.executado), backgroundColor: '#059669', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                onClick: (e, el) => { if (el.length > 0 && topBairrosGraf[el[0].index]) dispararExplosaoGrafico('bairro', topBairrosGraf[el[0].index].bairro); }
            }
        });
    }
}

function exportarPlanilhaProgramadoRetornoBairro() {
    const base = enriquecerStatusMacroEBairro(dadosFiltradosAtuais.length > 0 ? dadosFiltradosAtuais : registrosSalvos).filter(r =>
        r.projeto !== 'IMPREVISTO / ATRASO' &&
        r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
        r.projeto !== PROJETO_SOLIC_MATERIAL &&
        r.equipe !== '__CONFIG_SISTEMA__'
    );

    if (base.length === 0) { alert("⚠️ Nenhum registro encontrado no período."); return; }

    let html = `<table border="1">`;
    const gruposExport = [
        { chave: 'VISTORIA', titulo: 'GRUPO 1: VISTORIA (RESULTADOS DOS VISTORIADORES)', cor: '#581c87' },
        { chave: 'CONSTRUÇÃO', titulo: 'GRUPO 2: CONSTRUÇÃO — INSTALADORES (SEPARANDO PROJETO F E ON GOING)', cor: '#1e3a8a' },
        { chave: 'ATIVAÇÃO', titulo: 'GRUPO 3: ATIVAÇÃO — ATIVADORES (SEPARANDO PROJETO F E ON GOING)', cor: '#064e3b' }
    ];

    gruposExport.forEach(grp => {
        const regsGrp = base.filter(r => r.servicoPlanilha === grp.chave);
        html += `
            <tr style="background-color:${grp.cor};color:#ffffff;font-weight:bold;font-size:13px;">
                <th colspan="16">${grp.titulo} — TOTAL: ${regsGrp.length} REGISTROS</th>
            </tr>
            <tr style="background-color:#e2e8f0;font-weight:bold;">
                <th>BAIRRO</th><th>GRUPO</th><th>PROGRAMADO (1ª VISITA)</th><th>RETORNO</th><th>EXECUTADO PROJETO F</th><th>EXECUTADO ON GOING</th><th>TOTAL EXECUTADO</th><th>OBRAS EM CONJUNTO (APOIO)</th><th>N EXECUTADO</th><th>TOTAL ACIONADO</th><th colspan="6">SOMA DE HPs</th>
            </tr>`;

        const mapaB = {};
        regsGrp.forEach(d => {
            const b = d.bairroPlanilha || 'OUTROS';
            if (!mapaB[b]) mapaB[b] = { bairro: b, prog: 0, ret: 0, execF: 0, execOG: 0, execTot: 0, comApoio: 0, nExec: 0, total: 0, hps: 0 };
            mapaB[b].total++;
            if (d.statusMacroPlanilha === 'RETORNO') mapaB[b].ret++; else mapaB[b].prog++;
            if (extrairApoiosDoRegistro(d).length > 0) mapaB[b].comApoio++;
            if (d.desfecho === 'CONCLUIDA') {
                mapaB[b].execTot++;
                mapaB[b].hps += Number(d.hps) || 0;
                if (d.subgrupoFOuOnGoing === 'F') mapaB[b].execF++; else mapaB[b].execOG++;
            } else mapaB[b].nExec++;
        });

        Object.values(mapaB).sort((a, b) => b.total - a.total).forEach(b => {
            html += `<tr><td><b>${b.bairro}</b></td><td>${grp.chave}</td><td>${b.prog}</td><td>${b.ret}</td><td>${b.execF}</td><td>${b.execOG}</td><td><b>${b.execTot}</b></td><td><b>${b.comApoio}</b></td><td>${b.nExec}</td><td><b>${b.total}</b></td><td colspan="6">${b.hps}</td></tr>`;
        });

        html += `
            <tr style="background-color:#dbeafe;font-weight:bold;">
                <th>SEMANA</th><th>MÊS</th><th>ANO</th><th>DATA</th><th>TÉCNICO TITULAR</th><th>TÉCNICO(S) EM APOIO / CONJUNTA</th><th>COD. IMOVEL</th><th>BAIRRO</th><th>GRUPO</th><th>SUBGRUPO (F / ON GOING)</th><th>PROJETO</th><th>ENDEREÇO</th><th>HP</th><th>STATUS MACRO</th><th>STATUS1 (DETALHE/OFENSOR)</th><th>STATUS</th>
            </tr>`;

        regsGrp.forEach(r => {
            const dt = r.dataRegistro || '';
            const status1 = (Array.isArray(r.malogros) && r.malogros.length > 0) ? r.malogros.join(' + ') : (r.motivoDesfecho || r.desfecho);
            const apoiosStr = extrairApoiosDoRegistro(r).join(', ');
            html += `<tr>
                <td>${r.semanaPlanilha}</td><td>${parseInt(dt.substring(5, 7) || '1', 10)}</td><td>${dt.substring(0, 4) || '2026'}</td>
                <td>${dt}</td><td><b>${r.equipe}</b></td><td><b>${apoiosStr || '-'}</b></td><td>${r.imovel}</td><td><b>${r.bairroPlanilha}</b></td>
                <td><b>${r.servicoPlanilha}</b></td><td><b>${r.subgrupoFOuOnGoing}</b></td><td>${r.projeto}</td>
                <td>${r.endereco || ''}</td><td>${r.hps || 0}</td><td><b>${r.statusMacroPlanilha}</b></td>
                <td>${status1}</td><td><b>${r.statusBinarioPlanilha}</b></td>
            </tr>`;
        });
        html += `<tr><td colspan="16"></td></tr>`;
    });

    html += `</table>`;
    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `PLANILHA_GRUPOS_PROGRAMADO_RETORNO_BAIRRO_${obterDataLocalISO()}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    registrarLogAuditoria("EXPORTAÇÃO PROGRAMADO/RETORNO POR GRUPOS", `Exportados ${base.length} registros divididos por Vistoria, Construção e Ativação.`);
}

function montarTabelaHtmlGrupoParaExcel(tituloBloco, corFundoHex, listaRegistros) {
    let html = `
        <tr style="background-color:${corFundoHex};color:#ffffff;font-weight:bold;font-size:13px;">
            <th colspan="23">${tituloBloco} (${listaRegistros.length} REGISTROS)</th>
        </tr>
        <tr style="background-color:#f1f5f9;font-weight:bold;">
            <th>SEMANA</th><th>DATA</th><th>TÉCNICO TITULAR</th><th>TÉCNICO(S) EM APOIO / CONJUNTA</th><th>GRUPO</th><th>SUBGRUPO (F / ON GOING)</th><th>PROJETO</th><th>IMÓVEL / BLOCO</th><th>BAIRRO</th><th>ENDEREÇO</th><th>STATUS MACRO</th><th>STATUS PLANILHA</th><th>DESFECHO</th><th>STATUS1 / OFENSORES</th><th>H. ENTRADA</th><th>H. SAÍDA</th><th>ANDARES</th><th>HPs</th><th>CABO RL (m)</th><th>CABO DROP (m)</th><th>CONECTORES</th><th>FUSÕES</th><th>NAP / DIO</th>
        </tr>`;

    listaRegistros.forEach(r => {
        const status1 = (Array.isArray(r.malogros) && r.malogros.length > 0) ? r.malogros.join(' + ') : (r.motivoDesfecho || '');
        const apoiosStr = extrairApoiosDoRegistro(r).join(', ');
        html += `<tr>
            <td>${r.semanaPlanilha}</td><td>${r.dataRegistro}</td><td><b>${r.equipe}</b></td><td><b>${apoiosStr || '-'}</b></td>
            <td><b>${r.servicoPlanilha}</b></td><td><b>${r.subgrupoFOuOnGoing}</b></td><td>${r.projeto}</td>
            <td>${r.imovel}</td><td>${r.bairroPlanilha}</td><td>${r.endereco || ''}</td>
            <td><b>${r.statusMacroPlanilha}</b></td><td><b>${r.statusBinarioPlanilha}</b></td><td>${r.desfecho}</td>
            <td>${status1}</td><td>${r.hEntrada}</td><td>${r.hSaida}</td><td>${r.andares || 0}</td><td><b>${r.hps || 0}</b></td>
            <td>${r.caboRL || 0}</td><td>${r.caboDrop || 0}</td><td>${r.conectores || 0}</td><td>${r.fusoes || 0}</td><td>NAP:${r.nap || 0} / DIO:${r.dio || 0}</td>
        </tr>`;
    });
    html += `<tr><td colspan="23"></td></tr>`;
    return html;
}

function exportarExcelGrupoEspecifico(grupoAlvo) {
    const todos = enriquecerStatusMacroEBairro(dadosFiltradosAtuais.length > 0 ? dadosFiltradosAtuais : registrosSalvos).filter(r =>
        r.projeto !== 'IMPREVISTO / ATRASO' && r.projeto !== PROJETO_SOLIC_COMBUSTIVEL && r.projeto !== PROJETO_SOLIC_MATERIAL && r.equipe !== '__CONFIG_SISTEMA__'
    );

    let html = `<table border="1">`;
    if (grupoAlvo === 'VISTORIA') {
        const vist = todos.filter(r => r.servicoPlanilha === 'VISTORIA');
        html += montarTabelaHtmlGrupoParaExcel('🔍 GRUPO VISTORIA — RESULTADOS DOS VISTORIADORES', '#581c87', vist);
    } else if (grupoAlvo === 'CONSTRUCAO') {
        const constF = todos.filter(r => r.servicoPlanilha === 'CONSTRUÇÃO' && r.subgrupoFOuOnGoing === 'F');
        const constOG = todos.filter(r => r.servicoPlanilha === 'CONSTRUÇÃO' && r.subgrupoFOuOnGoing === 'ON GOING');
        html += montarTabelaHtmlGrupoParaExcel('🛠️ GRUPO CONSTRUÇÃO — SUBGRUPO PROJETO F (INSTALADORES)', '#312e81', constF);
        html += montarTabelaHtmlGrupoParaExcel('🛠️ GRUPO CONSTRUÇÃO — SUBGRUPO ON GOING (INSTALADORES)', '#0c4a6e', constOG);
    } else if (grupoAlvo === 'ATIVACAO') {
        const ativF = todos.filter(r => r.servicoPlanilha === 'ATIVAÇÃO' && r.subgrupoFOuOnGoing === 'F');
        const ativOG = todos.filter(r => r.servicoPlanilha === 'ATIVAÇÃO' && r.subgrupoFOuOnGoing === 'ON GOING');
        html += montarTabelaHtmlGrupoParaExcel('⚡ GRUPO ATIVAÇÃO — SUBGRUPO PROJETO F (ATIVADORES)', '#312e81', ativF);
        html += montarTabelaHtmlGrupoParaExcel('⚡ GRUPO ATIVAÇÃO — SUBGRUPO ON GOING (ATIVADORES)', '#064e3b', ativOG);
    }
    html += `</table>`;

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `PLANILHA_GRUPO_${grupoAlvo}_${obterDataLocalISO()}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function exportarExcel() {
    const todos = enriquecerStatusMacroEBairro(dadosFiltradosAtuais.length > 0 ? dadosFiltradosAtuais : registrosSalvos).filter(r =>
        r.projeto !== 'IMPREVISTO / ATRASO' && r.projeto !== PROJETO_SOLIC_COMBUSTIVEL && r.projeto !== PROJETO_SOLIC_MATERIAL && r.equipe !== '__CONFIG_SISTEMA__'
    );
    if (todos.length === 0) { alert("Nenhum registro para exportar no filtro atual."); return; }

    const vist = todos.filter(r => r.servicoPlanilha === 'VISTORIA');
    const constF = todos.filter(r => r.servicoPlanilha === 'CONSTRUÇÃO' && r.subgrupoFOuOnGoing === 'F');
    const constOG = todos.filter(r => r.servicoPlanilha === 'CONSTRUÇÃO' && r.subgrupoFOuOnGoing === 'ON GOING');
    const ativF = todos.filter(r => r.servicoPlanilha === 'ATIVAÇÃO' && r.subgrupoFOuOnGoing === 'F');
    const ativOG = todos.filter(r => r.servicoPlanilha === 'ATIVAÇÃO' && r.subgrupoFOuOnGoing === 'ON GOING');

    let html = `<table border="1">`;
    html += montarTabelaHtmlGrupoParaExcel('1. GRUPO VISTORIA — RESULTADOS DOS VISTORIADORES', '#581c87', vist);
    html += montarTabelaHtmlGrupoParaExcel('2A. GRUPO CONSTRUÇÃO — SUBGRUPO PROJETO F (INSTALADORES)', '#312e81', constF);
    html += montarTabelaHtmlGrupoParaExcel('2B. GRUPO CONSTRUÇÃO — SUBGRUPO ON GOING (INSTALADORES)', '#1e3a8a', constOG);
    html += montarTabelaHtmlGrupoParaExcel('3A. GRUPO ATIVAÇÃO — SUBGRUPO PROJETO F (ATIVADORES)', '#065f46', ativF);
    html += montarTabelaHtmlGrupoParaExcel('3B. GRUPO ATIVAÇÃO — SUBGRUPO ON GOING (ATIVADORES)', '#0f766e', ativOG);
    html += `</table>`;

    let blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url; a.download = `RELATORIO_POR_GRUPOS_GPD_PROCISA_${obterDataLocalISO()}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    registrarLogAuditoria("EXPORTAÇÃO DE RELATÓRIO POR GRUPOS", `Baixado relatório Excel separado por grupos e apoios.`);
}

function renderizarOfensoresMalogro(dados) {
    const tbody = document.getElementById('tabela-ofensores-malogro-corpo');
    const badgeTotal = document.getElementById('badge-total-ocorrencias-malogro');
    if (!tbody) return;
    tbody.innerHTML = "";

    const contagemOfensores = {};
    OPCOES_MALOGRO_PADRAO.forEach(o => contagemOfensores[o] = { total: 0, vist: 0, const: 0, ativ: 0 });
    let totalOcorrenciasMalogro = 0;

    dados.forEach(d => {
        if ((d.desfecho === 'MALOGRADA' || d.desfecho === 'PENDENTE') && Array.isArray(d.malogros)) {
            d.malogros.forEach(m => {
                const chave = m.trim().toUpperCase();
                if (!contagemOfensores[chave]) contagemOfensores[chave] = { total: 0, vist: 0, const: 0, ativ: 0 };
                contagemOfensores[chave].total++;
                if (d.servicoPlanilha === 'VISTORIA') contagemOfensores[chave].vist++;
                else if (d.servicoPlanilha === 'CONSTRUÇÃO') contagemOfensores[chave].const++;
                else contagemOfensores[chave].ativ++;
                totalOcorrenciasMalogro++;
            });
        }
    });

    if (badgeTotal) badgeTotal.innerText = `${totalOcorrenciasMalogro} ocorrência(s)`;
    const ordenados = Object.entries(contagemOfensores).sort((a, b) => b[1].total - a[1].total);

    ordenados.forEach(([ofensor, obj], idx) => {
        const perc = totalOcorrenciasMalogro > 0 ? ((obj.total / totalOcorrenciasMalogro) * 100).toFixed(1) : "0.0";
        const tr = document.createElement('tr');
        tr.className = "hover:bg-red-50/60 border-b cursor-pointer transition";
        tr.onclick = () => dispararExplosaoGrafico('ofensor', ofensor);
        tr.innerHTML = `<td class="py-2 font-bold text-slate-400">${idx + 1}º</td><td class="py-2 font-bold text-red-900 underline decoration-dotted">${ofensor}</td><td class="py-2 text-center text-[10px] font-semibold"><span class="text-purple-800">${obj.vist}V</span> / <span class="text-blue-800">${obj.const}C</span> / <span class="text-emerald-800">${obj.ativ}A</span></td><td class="py-2 text-center font-black text-slate-800">${obj.total}</td><td class="py-2 text-right font-bold text-slate-600">${perc}%</td>`;
        tbody.appendChild(tr);
    });

    const ctxOfensores = document.getElementById('graficoOfensoresMalogro')?.getContext('2d');
    if (ctxOfensores) {
        if (graficoOfensoresMalogroInstancia) graficoOfensoresMalogroInstancia.destroy();
        const labelsOfensores = ordenados.map(item => item[0]);
        graficoOfensoresMalogroInstancia = new Chart(ctxOfensores, {
            type: 'bar',
            data: { labels: labelsOfensores, datasets: [{ label: 'Ocorrências de Não Execução', data: ordenados.map(item => item[1].total), backgroundColor: '#dc2626', borderRadius: 6 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }, onClick: (event, elements) => { if (elements.length > 0) dispararExplosaoGrafico('ofensor', labelsOfensores[elements[0].index]); } }
        });
    }
}

function renderizarTabelaConsolidada(dados) {
    const corpo = document.getElementById('tabela-consolidada-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";
    if (dados.length === 0) {
        corpo.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Nenhum dado consolidado no período.</td></tr>`;
        return;
    }

    const grupos = [
        { chave: 'VISTORIA', titulo: '🔍 GRUPO 1: VISTORIA (Vistoriadores)', cor: 'bg-purple-900 text-white' },
        { chave: 'CONSTRUÇÃO', titulo: '🛠️ GRUPO 2: CONSTRUÇÃO — Instaladores (F & ON GOING)', cor: 'bg-blue-900 text-white' },
        { chave: 'ATIVAÇÃO', titulo: '⚡ GRUPO 3: ATIVAÇÃO — Ativadores (F & ON GOING)', cor: 'bg-emerald-900 text-white' }
    ];

    grupos.forEach(g => {
        const dGrp = dados.filter(d => d.servicoPlanilha === g.chave);
        if (dGrp.length === 0) return;

        corpo.innerHTML += `<tr class="${g.cor} font-black text-xs"><td colspan="4" class="p-2.5 uppercase">${g.titulo} (Total: ${dGrp.length})</td></tr>`;
        const cats = {};
        dGrp.forEach(d => {
            const st = d.desfecho === 'CONCLUIDA' ? '🟢 EXECUTADO (Concluída)' : `🟠 N EXECUTADO (${d.desfecho})`;
            const chave = g.chave === 'VISTORIA' ? `VISTORIA — ${st}` : `[Subgrupo ${d.subgrupoFOuOnGoing}] ${d.projeto} — ${st}`;
            if (!cats[chave]) cats[chave] = { qtd: 0, hps: 0 };
            cats[chave].qtd++;
            cats[chave].hps += Number(d.hps) || 0;
        });

        Object.entries(cats).forEach(([cat, info]) => {
            const perc = ((info.qtd / dGrp.length) * 100).toFixed(1);
            corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3 font-semibold text-slate-800">${cat}</td><td class="p-3 text-center font-bold text-blue-900">${info.qtd}</td><td class="p-3 text-center font-bold text-indigo-800">${info.hps}</td><td class="p-3 text-center font-bold text-slate-600">${perc}%</td></tr>`;
        });
    });
}

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
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') return;
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
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') return;
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

function renderizarTabelaUsuariosPermissao() {
    const corpo = document.getElementById('tabela-usuarios-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";
    const nivelNorm = String(nivelUsuarioLogado || '').trim().toLowerCase();
    let listaVisivel = (nivelNorm === 'visualizador' || nivelNorm === 'operador')
        ? usuariosSistema.filter(u => u.email.toLowerCase() === (usuarioLogado || '').toLowerCase())
        : usuariosSistema;
    listaVisivel.forEach(u => {
        let acoesHtml = `<button onclick="abrirModalUsuario(${u.id})" class="bg-blue-50 text-blue-700 font-bold text-[10px] px-2.5 py-1 rounded">✏️ Alterar Senha</button>`;
        if (nivelNorm === 'master') acoesHtml += ` <button onclick="excluirUsuario(${u.id}, '${u.email}')" class="bg-red-50 text-red-600 font-bold text-[10px] px-2.5 py-1 rounded">🗑️ Excluir</button>`;
        corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3"><div class="font-bold">${u.nome}</div><div class="text-[10px] text-slate-400">${u.email}</div></td><td class="p-3"><span class="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px]">${u.nivel}</span></td><td class="p-3"><span class="text-emerald-600 font-semibold">${u.status}</span></td><td class="p-3">${acoesHtml}</td></tr>`;
    });
}

// ================= MODAL DE DETALHES COMPLETO (MATERIAIS POR BLOCO, LINKS GPS MAPS, APOIO CONJUNTO E WHATSAPP) =================
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

    const temMultiplosBlocos = blocosIrmaos.length > 1;
    document.getElementById('modal-detalhes-titulo').innerText = temMultiplosBlocos
        ? `Detalhes do Imóvel: ${codBase} (${blocosIrmaos.length} Blocos)`
        : `Detalhes do Registro: ${item.imovel}`;

    let todasFotosAcumuladas = [];
    const blocosDetalhadosParaWhats = [];

    for (let idx = 0; idx < blocosIrmaos.length; idx++) {
        const b = blocosIrmaos[idx];
        let fBloco = Array.isArray(b.fotos) ? [...b.fotos] : [];
        if (fBloco.length === 0 && typeof obterFotosSobDemandaDoRegistro === 'function' && Number(b.qtdFotos) > 0) {
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
                    <div class="bg-slate-900 text-white p-3 rounded-xl space-y-1.5">
                        <div class="font-black text-cyan-300 text-[11px] uppercase border-b border-slate-700 pb-1">📊 Soma Total Consolidada dos ${blocosIrmaos.length} Blocos</div>
                        <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 text-[11px] pt-1">
                            <div>Andares: <b>${somaAndares}</b></div>
                            <div>HPs: <b>${somaHps}</b></div>
                            <div>Cabo RL: <b>${somaRL} m</b></div>
                            <div>Cabo Drop: <b>${somaDrop} m</b></div>
                            <div>Conectores: <b>${somaConect}</b></div>
                            <div>Fusões: <b>${somaFusoes}</b></div>
                            <div>NAP: <b>${somaNap}</b></div>
                            <div>DIO: <b>${somaDio}</b></div>
                            <div>Sobrepor: <b>${somaSobrepor}</b></div>
                            <div>Embutida: <b>${somaEmbutida}</b></div>
                            <div>Cx. FOSC: <b>${somaFosc}</b></div>
                        </div>
                    </div>
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
            const legendaSlot = (item.projeto === PROJETO_SOLIC_COMBUSTIVEL && Array.isArray(item.malogros) && item.malogros[idx])
                ? `<div class="text-[9px] font-black text-orange-900 uppercase">${item.malogros[idx]}</div>`
                : '';
            return `<div class="bg-white p-2 rounded-xl border border-indigo-200 shadow-sm flex flex-col items-center gap-1.5">${legendaSlot}<img src="${fSrc}" onclick="abrirZoomFoto('${fSrc}', '${nomeArq}')" class="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-90 transition border"><div class="flex gap-1 w-full"><button type="button" onclick="abrirZoomFoto('${fSrc}', '${nomeArq}')" class="flex-1 bg-indigo-50 text-indigo-900 font-bold text-[10px] py-1 rounded">🔍 Ampliar</button><button type="button" onclick="baixarFotoDireto('${fSrc}', '${nomeArq}')" class="flex-1 bg-emerald-600 text-white font-bold text-[10px] py-1 rounded">⬇️ Baixar</button></div></div>`;
        }).join('');
        galeriaFotosHtml = `<div class="bg-indigo-50/70 p-3 rounded-lg border border-indigo-200 space-y-2"><h4 class="font-bold text-indigo-950 text-xs uppercase">📷 Fotos Anexadas (${todasFotosAcumuladas.length})</h4><div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">${cardsFotos}</div></div>`;
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
            ${item.email ? `<div class="col-span-2"><strong>E-mail:</strong> ${item.email}</div>` : ''}
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

function fecharModalDetalhes() { document.getElementById('modal-detalhes').classList.add('hidden'); }

// Boletim Executivo WhatsApp com agrupamento de blocos e evidência de Atuação Conjunta
copiarBoletimGestorWhatsApp = function() {
    const lista = dadosFiltradosAtuais.length > 0
        ? dadosFiltradosAtuais
        : registrosSalvos.filter(r => r.projeto !== 'IMPREVISTO / ATRASO' && r.projeto !== PROJETO_SOLIC_COMBUSTIVEL && r.projeto !== PROJETO_SOLIC_MATERIAL && r.equipe !== "__CONFIG_SISTEMA__" && r.projeto !== "__CONFIG_AUDITORIA__");

    if (lista.length === 0 && listaImprevistosAtuais.length === 0) {
        alert("⚠️ Nenhum registro encontrado no filtro atual para gerar o Boletim.");
        return;
    }

    const dIni = document.getElementById('gestor-filtro-data-inicio')?.value;
    const dFim = document.getElementById('gestor-filtro-data-fim')?.value;
    const periodoStr = (dIni || dFim) ? `${dIni || 'Início'} a ${dFim || 'Hoje'}` : 'Todo o Histórico';

    const andamento = lista.filter(i => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(i.desfecho)).length;
    const finalizadas = lista.filter(i => !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(i.desfecho));
    const concluidas = finalizadas.filter(i => i.desfecho === 'CONCLUIDA').length;
    const pendentes = finalizadas.filter(i => i.desfecho === 'PENDENTE').length;
    const malogradas = finalizadas.filter(i => i.desfecho === 'MALOGRADA').length;
    const totalObrasConjuntas = lista.filter(i => extrairApoiosDoRegistro(i).length > 0).length;

    let sumRL = 0, sumDrop = 0, sumConect = 0, sumNap = 0, sumDio = 0, sumFusoes = 0, sumSobre = 0, sumEmb = 0, sumFosc = 0;
    finalizadas.forEach(i => {
        sumRL += Number(i.caboRL) || 0;
        sumDrop += Number(i.caboDrop) || 0;
        sumConect += Number(i.conectores) || 0;
        sumNap += Number(i.nap) || 0;
        sumDio += Number(i.dio) || 0;
        sumFusoes += Number(i.fusoes) || 0;
        sumSobre += Number(i.cxSobrepor) || 0;
        sumEmb += Number(i.cxEmbutida) || 0;
        sumFosc += Number(i.cxFosc) || 0;
    });

    const gruposImoveis = {};
    finalizadas.slice(0, 40).forEach(r => {
        const codBase = obterCodigoBaseImovel(r.imovel);
        const chave = `${r.dataRegistro}_${r.equipe}_${codBase}_${r.projeto}`;
        if (!gruposImoveis[chave]) {
            gruposImoveis[chave] = { codBase, equipe: r.equipe, projeto: r.projeto, endereco: r.endereco, liberouAcesso: r.liberouAcesso, blocos: [] };
        }
        gruposImoveis[chave].blocos.push(r);
    });

    const linhasImoveisFormatadas = Object.values(gruposImoveis).slice(0, 15).map(g => {
        const apoiosGrp = [...new Set(g.blocos.flatMap(b => extrairApoiosDoRegistro(b)))];
        const txtApoio = apoiosGrp.length > 0 ? ` *(🤝 Conjunta c/ ${apoiosGrp.join(', ')})*` : '';
        if (g.blocos.length === 1) {
            const u = g.blocos[0];
            return `• *${u.imovel}* (${u.projeto}) - ${u.equipe}${txtApoio}: *${u.desfecho}* | Andares: ${u.andares || 0} | HPs: ${u.hps || 0}${u.endereco ? `\n  📍 End: ${u.endereco}` : ''}${u.liberouAcesso ? ` | 🔑 Liberou: ${u.liberouAcesso}` : ''}`;
        } else {
            const subBlocos = g.blocos.map(b => {
                let nomeB = b.imovel || 'Bloco';
                const idx = nomeB.toUpperCase().lastIndexOf(' - ');
                if (idx !== -1) nomeB = nomeB.substring(idx + 3).trim();
                return `   ↳ *${nomeB}*: *${b.desfecho}* (And: ${b.andares || 0} | HPs: ${b.hps || 0} | RL: ${b.caboRL || 0}m | Drop: ${b.caboDrop || 0}m | Conect: ${b.conectores || 0} | Fus: ${b.fusoes || 0} | NAP: ${b.nap || 0} | DIO: ${b.dio || 0})`;
            }).join('\n');
            return `• *${g.codBase} (${g.blocos.length} Blocos)* (${g.projeto}) - ${g.equipe}${txtApoio}${g.endereco ? `\n  📍 End: ${g.endereco}` : ''}${g.liberouAcesso ? ` | 🔑 Liberou: ${g.liberouAcesso}` : ''}\n${subBlocos}`;
        }
    }).join('\n');

    const texto = [
        `📊 *BOLETIM GPD - CONSTRUÇÃO MDU PROCISA RJ*`,
        `📅 *Período:* ${periodoStr}`,
        `──────────────────────`,
        `🔵 *Ativas / Em Execução Agora:* ${andamento}`,
        `📈 *Total Finalizadas:* ${finalizadas.length}`,
        `🟢 *Concluídas:* ${concluidas}`,
        `🤝 *Atuações em Conjunto (Apoio):* ${totalObrasConjuntas}`,
        `🟡 *Pendentes:* ${pendentes}`,
        `🔴 *Malogradas:* ${malogradas}`,
        `⚠️ *Imprevistos Reportados:* ${listaImprevistosAtuais.length}`,
        `──────────────────────`,
        `📦 *CONSUMO DE MATERIAIS & CAIXAS:*`,
        `• Cabo RL: *${sumRL} m* | Cabo Drop: *${sumDrop} m*`,
        `• Conectores: *${sumConect}* | Fusões: *${sumFusoes}*`,
        `• NAP: *${sumNap}* | DIO: *${sumDio}*`,
        `• Cx Sobrepor: *${sumSobre}* | Cx Embutida: *${sumEmb}* | Cx FOSC: *${sumFosc}*`,
        `──────────────────────`,
        `🏢 *ÚLTIMAS ATIVIDADES:*`,
        linhasImoveisFormatadas || 'Nenhuma atividade finalizada no filtro.'
    ].join('\n');

    copiarParaAreaTransferencia(texto, "✅ Boletim Executivo (com blocos e apoios conjuntos) copiado para o WhatsApp!");
};

function dispararExplosaoGrafico(filtroTipo, filtroValor) {
    const modal = document.getElementById('modal-explosao');
    const corpo = document.getElementById('tabela-explosao-corpo');
    document.getElementById('modal-explosao-titulo').innerText = `Modo Explosão Executivo: ${filtroTipo.toUpperCase()} -> ${filtroValor}`;
    corpo.innerHTML = "";

    let subset = dadosFiltradosAtuais.filter(item => {
        const apoios = extrairApoiosDoRegistro(item);
        if (filtroTipo === 'projeto') return item.projeto === filtroValor;
        if (filtroTipo === 'macro_servico') return item.servicoPlanilha === filtroValor;
        if (filtroTipo === 'equipe_servico') {
            const [eq, serv] = filtroValor.split('|');
            return (item.equipe === eq || apoios.includes(eq)) && item.servicoPlanilha === serv;
        }
        if (filtroTipo === 'grupo_subgrupo') {
            const [serv, sub] = filtroValor.split('|');
            return item.servicoPlanilha === serv && (sub === 'TODOS' || item.subgrupoFOuOnGoing === sub);
        }
        if (filtroTipo === 'semana') return item.semanaPlanilha === filtroValor;
        if (filtroTipo === 'data') return item.dataRegistro === filtroValor;
        if (filtroTipo === 'bairro') return item.bairroPlanilha === filtroValor;
        if (filtroTipo === 'desfecho') return item.desfecho === filtroValor;
        if (filtroTipo === 'equipe') return item.equipe === filtroValor || apoios.includes(filtroValor);
        if (filtroTipo === 'ofensor') return (item.desfecho === 'MALOGRADA' || item.desfecho === 'PENDENTE') && Array.isArray(item.malogros) && item.malogros.map(m => m.trim().toUpperCase()).includes(filtroValor.toUpperCase());
        return false;
    });

    if (subset.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Nenhum registro encontrado.</td></tr>`;
    } else {
        subset.forEach(item => {
            let detalheInfo = item.malogros && item.malogros.length > 0 ? `STATUS1: ${item.malogros.join(' + ')}` : (item.motivoDesfecho || 'Concluído');
            const apoios = extrairApoiosDoRegistro(item);
            const badgeAp = apoios.length > 0 ? `<div class="text-[9px] font-black text-purple-800">🤝 Apoio: ${apoios.join(', ')}</div>` : '';
            corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b text-xs cursor-pointer" onclick="fecharModalExplosao(); fecharModalGraficoExpandido(); fecharModalTabelaExpandida(); abrirDetalhesAtividade(registrosSalvos.find(r => r.id === ${item.id}))"><td class="p-2.5 font-mono font-bold">${item.dataRegistro}<div class="text-[9px] text-indigo-700">${item.semanaPlanilha}</div></td><td class="p-2.5"><div class="font-bold text-slate-800">${item.imovel}</div><div class="text-[10px] text-slate-500">📍 ${item.endereco || '-'} (<b>${item.bairroPlanilha}</b>)</div></td><td class="p-2.5 font-semibold text-blue-900">${item.equipe}${badgeAp}</td><td class="p-2.5"><b>${item.servicoPlanilha} (${item.subgrupoFOuOnGoing})</b><div class="text-[9px] text-slate-500">${item.projeto} • ${item.statusMacroPlanilha}</div></td><td class="p-2.5"><span class="font-bold px-2 py-0.5 rounded text-[10px] ${obterClasseCorDesfecho(item.desfecho)}">${item.desfecho}</span><div class="text-[9px] mt-0.5">HPs: <b>${item.hps || 0}</b></div></td><td class="p-2.5 text-slate-500">${detalheInfo}</td></tr>`;
        });
    }
    modal.classList.remove('hidden');
}

function fecharModalExplosao() { document.getElementById('modal-explosao').classList.add('hidden'); }

function renderizarGraficos(dados, todosFiltrados = []) {
    let projetosCount = {};
    TODOS_OS_PROJETOS.forEach(p => projetosCount[p] = 0);
    let desfechosCount = { 'CONCLUIDA': 0, 'PENDENTE': 0, 'MALOGRADA': 0 };
    let totalMinutosPausaPeriodo = 0, qtdAtividadesComPausa = 0;

    const basePausas = (Array.isArray(todosFiltrados) && todosFiltrados.length > 0) ? todosFiltrados : dados;
    basePausas.forEach(item => {
        const pMin = Number(item.tempoPausadoMinutos) || 0;
        if (pMin > 0 || item.desfecho === 'PARALISADA') { totalMinutosPausaPeriodo += pMin; qtdAtividadesComPausa++; }
    });

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setEl('ind-tempo-paralisado', totalMinutosPausaPeriodo > 0 ? formatarDuracaoTexto(totalMinutosPausaPeriodo) : "0 min");
    setEl('ind-detalhe-paralisado', `${qtdAtividadesComPausa} atividade(s) com pausa`);

    let listaMinutosEntrada = [], listaMinutosSaida = [], listaDuracoes = [];
    let aberturasPorHora = new Array(24).fill(0), fechamentosPorHora = new Array(24).fill(0);
    let duracaoPorProjeto = {};
    TODOS_OS_PROJETOS.forEach(k => duracaoPorProjeto[k] = []);

    dados.forEach(d => {
        projetosCount[d.projeto] = (projetosCount[d.projeto] || 0) + 1;
        if (desfechosCount[d.desfecho] !== undefined) desfechosCount[d.desfecho]++;

        const minIn = converterHorarioParaMinutos(d.hEntrada), minOut = converterHorarioParaMinutos(d.hSaida);
        const pausaItem = Number(d.tempoPausadoMinutos) || 0;
        if (minIn !== null) { listaMinutosEntrada.push(minIn); const hIn = Math.floor(minIn / 60); if (hIn >= 0 && hIn < 24) aberturasPorHora[hIn]++; }
        if (minOut !== null) { listaMinutosSaida.push(minOut); const hOut = Math.floor(minOut / 60); if (hOut >= 0 && hOut < 24) fechamentosPorHora[hOut]++; }
        if (minIn !== null && minOut !== null && minOut >= minIn) {
            const durLiquida = Math.max(0, (minOut - minIn) - pausaItem);
            if (durLiquida > 0 && durLiquida <= 840) {
                listaDuracoes.push(durLiquida);
                if (!duracaoPorProjeto[d.projeto]) duracaoPorProjeto[d.projeto] = [];
                duracaoPorProjeto[d.projeto].push(durLiquida);
            }
        }
    });

    setEl('ind-media-abertura', listaMinutosEntrada.length > 0 ? formatarMinutosParaHHMM(listaMinutosEntrada.reduce((a, b) => a + b, 0) / listaMinutosEntrada.length) : "--:--");
    setEl('ind-media-fechamento', listaMinutosSaida.length > 0 ? formatarMinutosParaHHMM(listaMinutosSaida.reduce((a, b) => a + b, 0) / listaMinutosSaida.length) : "--:--");
    setEl('ind-tempo-medio', listaDuracoes.length > 0 ? formatarDuracaoTexto(listaDuracoes.reduce((a, b) => a + b, 0) / listaDuracoes.length) : "--h --m");

    let maxAtivHora = 0, horaPico = null;
    for (let h = 0; h < 24; h++) { if (aberturasPorHora[h] > maxAtivHora) { maxAtivHora = aberturasPorHora[h]; horaPico = h; } }
    setEl('ind-horario-pico', (horaPico !== null && maxAtivHora > 0) ? `${String(horaPico).padStart(2, '0')}h às ${String(horaPico + 1).padStart(2, '0')}h` : "--:--");
    setEl('ind-detalhe-pico', (horaPico !== null && maxAtivHora > 0) ? `${maxAtivHora} atividade(s) na faixa` : "Sem picos");

    const ctxProj = document.getElementById('graficoProjetos')?.getContext('2d');
    if (ctxProj) {
        if (graficoProjetosInstancia) graficoProjetosInstancia.destroy();
        const labelsP = Object.keys(projetosCount);
        graficoProjetosInstancia = new Chart(ctxProj, {
            type: 'bar',
            data: {
                labels: labelsP,
                datasets: [
                    { label: '🟢 Executado', data: labelsP.map(p => dados.filter(d => d.projeto === p && d.desfecho === 'CONCLUIDA').length), backgroundColor: '#059669', borderRadius: 5 },
                    { label: '🟠 Não Executado', data: labelsP.map(p => dados.filter(d => d.projeto === p && d.desfecho !== 'CONCLUIDA').length), backgroundColor: '#f59e0b', borderRadius: 5 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, onClick: (e, el) => { if (el.length > 0) dispararExplosaoGrafico('projeto', labelsP[el[0].index]); } }
        });
    }

    const ctxDesf = document.getElementById('graficoDesfechos')?.getContext('2d');
    if (ctxDesf) {
        if (graficoDesfechosInstancia) graficoDesfechosInstancia.destroy();
        graficoDesfechosInstancia = new Chart(ctxDesf, {
            type: 'doughnut',
            data: {
                labels: ['EXECUTADO (Concluída)', 'N EXECUTADO (Pendente)', 'N EXECUTADO (Malograda)'],
                datasets: [{ data: [desfechosCount['CONCLUIDA'], desfechosCount['PENDENTE'], desfechosCount['MALOGRADA']], backgroundColor: ['#059669', '#d97706', '#dc2626'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, onClick: (e, el) => { if (el.length > 0) dispararExplosaoGrafico('desfecho', ['CONCLUIDA', 'PENDENTE', 'MALOGRADA'][el[0].index]); } }
        });
    }

    // GRÁFICO DE HORÁRIOS DE PICO (MANTIDO 100% INALTERADO)
    const ctxHoras = document.getElementById('graficoHorasPico')?.getContext('2d');
    if (ctxHoras) {
        if (graficoHorasPicoInstancia) graficoHorasPicoInstancia.destroy();
        const labelsHoras = [], dadosAberturaSlice = [], dadosFechamentoSlice = [];
        for (let h = 6; h <= 20; h++) {
            labelsHoras.push(`${String(h).padStart(2, '0')}h`);
            dadosAberturaSlice.push(aberturasPorHora[h]);
            dadosFechamentoSlice.push(fechamentosPorHora[h]);
        }
        graficoHorasPicoInstancia = new Chart(ctxHoras, {
            type: 'line',
            data: {
                labels: labelsHoras,
                datasets: [
                    { label: '🟢 Aberturas (Check-in)', data: dadosAberturaSlice, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.15)', fill: true, tension: 0.35 },
                    { label: '🔴 Fechamentos (Check-out)', data: dadosFechamentoSlice, borderColor: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.12)', fill: true, tension: 0.35 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }

    const ctxTempoProj = document.getElementById('graficoTempoProjeto')?.getContext('2d');
    if (ctxTempoProj) {
        if (graficoTempoProjetoInstancia) graficoTempoProjetoInstancia.destroy();
        const labelsProj = Object.keys(projetosCount);
        const mediasMinutosProj = labelsProj.map(proj => {
            const arr = duracaoPorProjeto[proj] || [];
            return arr.length === 0 ? 0 : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
        });
        graficoTempoProjetoInstancia = new Chart(ctxTempoProj, {
            type: 'bar',
            data: { labels: labelsProj, datasets: [{ label: 'Tempo Médio Líquido (Minutos)', data: mediasMinutosProj, backgroundColor: '#0d9488', borderRadius: 6 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
        });
    }
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

// ================= EQUIPES, USUÁRIOS, AUDITORIA E NAVEGAÇÃO =================
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
    if (String(nivelUsuarioLogado || '').trim().toLowerCase() === 'visualizador') return;
    document.getElementById('modal-equipe').classList.remove('hidden');
    if (id) {
        let eq = equipesSistema.find(e => e.id === id);
        if (eq) {
            document.getElementById('edit-equipe-id').value = eq.id;
            document.getElementById('inp-nome-equipe').value = eq.nome;
            document.getElementById('sel-status-equipe').value = eq.status;
            document.getElementById('inp-setor-equipe').value = formatarSetoresString(eq.setor);
        }
    } else {
        document.getElementById('edit-equipe-id').value = "";
        document.getElementById('inp-nome-equipe').value = "";
        document.getElementById('sel-status-equipe').value = "Ativo";
        document.getElementById('inp-setor-equipe').value = "Instalador";
    }
}

function fecharModalEquipe() { document.getElementById('modal-equipe').classList.add('hidden'); }

async function salvarOuAtualizarEquipe() {
    if (String(nivelUsuarioLogado || '').trim().toLowerCase() === 'visualizador') return;
    const editId = document.getElementById('edit-equipe-id').value;
    const nome = document.getElementById('inp-nome-equipe').value.trim().toUpperCase();
    const setor = formatarSetoresString(document.getElementById('inp-setor-equipe').value || "Instalador");
    const status = document.getElementById('sel-status-equipe').value;
    if (!nome) return;

    if (editId) {
        let eq = equipesSistema.find(e => e.id == editId);
        if (eq) { eq.nome = nome; eq.setor = setor; eq.status = status; if (!eq.pin) eq.pin = "1234"; }
    } else {
        equipesSistema.push({ id: Date.now(), nome, setor, status, pin: "1234" });
    }
    await sincronizarEquipesNaNuvem();
    fecharModalEquipe();
    popularSelectEquipes();
    renderizarTabelaEquipes();
    renderizarPainelDisponibilidade();
}

async function alternarSetorDiretoNaTabela(idEquipe, setorAlvo) {
    if (String(nivelUsuarioLogado || '').trim().toLowerCase() === 'visualizador') return;
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
    const corpo = document.getElementById('tabela-equipes-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";
    const nivelNorm = String(nivelUsuarioLogado || '').trim().toLowerCase();
    equipesSistema.forEach(eq => {
        const setoresAtuais = obterArraySetores(eq.setor);
        const pinAtual = obterPinDaEquipe(eq);
        const chaveSetorHtml = `<div class="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-300 gap-1"><button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Vistoriador')" class="px-2 py-1 rounded-md text-[10px] font-bold ${setoresAtuais.includes('Vistoriador') ? 'bg-purple-800 text-white' : 'text-slate-500 bg-white'}">🔍 Vistoriador</button><button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Instalador')" class="px-2 py-1 rounded-md text-[10px] font-bold ${setoresAtuais.includes('Instalador') ? 'bg-blue-900 text-white' : 'text-slate-500 bg-white'}">🛠️ Instalador</button><button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Ativador')" class="px-2 py-1 rounded-md text-[10px] font-bold ${setoresAtuais.includes('Ativador') ? 'bg-emerald-700 text-white' : 'text-slate-500 bg-white'}">⚡ Ativador</button></div>`;
        const projsHabilitados = obterProjetosPermitidosParaSetores(setoresAtuais).map(p => `<span class="bg-slate-100 border border-slate-300 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded">${p}</span>`).join(' ');
        const badgePin = (nivelNorm === 'master' || nivelNorm === 'operador') ? `<div class="mt-1"><span class="bg-amber-50 text-amber-900 border border-amber-300 font-mono font-bold text-[10px] px-2 py-0.5 rounded">🔑 PIN: ${pinAtual}</span></div>` : '';
        let acoesEq = (nivelNorm === 'master' || nivelNorm === 'operador')
            ? `<button onclick="resetarPinEquipeGestor(${eq.id})" class="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] px-2.5 py-1 rounded">🔄 Resetar PIN</button> <button onclick="abrirModalEquipe(${eq.id})" class="bg-blue-50 text-blue-700 font-bold text-[10px] px-2.5 py-1 rounded">✏️ Editar</button>`
            : `<span class="text-slate-400 text-[10px]">Leitura</span>`;
        if (nivelNorm === 'master') acoesEq += ` <button onclick="excluirEquipe(${eq.id}, '${eq.nome}')" class="bg-red-50 text-red-600 font-bold text-[10px] px-2.5 py-1 rounded">🗑️ Excluir</button>`;
        corpo.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3"><div class="font-bold text-slate-800">${eq.nome}</div>${badgePin}</td><td class="p-3">${chaveSetorHtml}</td><td class="p-3"><div class="flex flex-wrap gap-1">${projsHabilitados}</div></td><td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${eq.status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">${eq.status}</span></td><td class="p-3 space-x-1 whitespace-nowrap">${acoesEq}</td></tr>`;
    });
}

async function excluirEquipe(id, nome) {
    if (String(nivelUsuarioLogado || '').trim().toLowerCase() !== 'master') return;
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
            document.getElementById('novo-user-nivel').value = u.nivel;
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
    const nivel = document.getElementById('novo-user-nivel').value;
    if (!nome || !email || !senha) return;

    const nivelNorm = String(nivelUsuarioLogado || '').trim().toLowerCase();
    if (editId) {
        let u = usuariosSistema.find(user => user.id == editId);
        if (u) { if (nivelNorm === 'master') { u.nome = nome; u.email = email; u.senha = senha; u.nivel = nivel; } else u.senha = senha; }
    } else {
        if (nivelNorm !== 'master') return;
        usuariosSistema.push({ id: Date.now(), nome, email, senha, nivel, status: "Ativo" });
    }
    await sincronizarUsuariosNaNuvem();
    fecharModalUsuario();
    renderizarTabelaUsuariosPermissao();
}

async function excluirUsuario(id, email) {
    if (String(nivelUsuarioLogado || '').trim().toLowerCase() !== 'master' || email.toLowerCase() === "lsimoes@procisa.com.br") return;
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
    if (String(nivelUsuarioLogado || '').trim().toLowerCase() !== 'master') return;
    if (confirm("Limpar o histórico de auditoria?")) {
        trilhaAuditoria = [];
        localStorage.removeItem('gpd_trilha_auditoria');
        await sincronizarAuditoriaNaNuvem();
        renderizarTabelaAuditoria();
    }
}

// Sobrescreve recarregarDadosGestor para atualizar também a Telemetria do Mapa e funcionar em Smartphone
recarregarDadosGestor = async function(silencioso = false) {
    try {
        if (!modoConsultaBackupAtivo) {
            if (typeof carregarTelemetriaDaNuvem === "function") await carregarTelemetriaDaNuvem();
            if (typeof carregarRegistrosDaNuvem === "function") {
                await carregarRegistrosDaNuvem(true);
                cargaInicialGestorConcluida = true;
            }
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

    const nivelNorm = String(nivelUsuarioLogado || '').trim().toLowerCase();
    const ehVisualizador = (nivelNorm === 'visualizador');

    if (ehVisualizador && !['atividades', 'graficos', 'materiais'].includes(aba)) {
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
            const ocultoVisualizador = (ehVisualizador && !['atividades', 'graficos', 'materiais'].includes(s));
            btn.className = `px-2.5 py-1 text-[11px] font-bold rounded-lg transition bg-white text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 ${ocultoVisualizador ? 'hidden' : ''}`;
        }
    });

    document.getElementById(`subview-${aba}`)?.classList.remove('hidden');
    const targetBtn = document.getElementById(`subtab-btn-${aba}`);
    if (targetBtn) targetBtn.className = "px-2.5 py-1 text-[11px] font-bold rounded-lg transition bg-blue-900 text-white shadow-sm flex items-center gap-1";

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
// ================= COMPLEMENTO DEFINITIVO: VALIDAÇÃO DE APOIO + AUTO-EXPIRAÇÃO E LIMPEZA DE TÉCNICOS TRAVADOS NO MAPA =================

const TEMPO_MAXIMO_SINAL_MAPA_MINUTOS = 45; // Remove do mapa quem está sem transmitir GPS há mais de 45 min

// Extrai apenas os apoios VALIDADOS pelo titular ou pela gestão
extrairApoiosDoRegistro = function(reg) {
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
                if (n && n !== titular && !validados.includes(n)) validados.push(n);
            });
        });
    }
    return validados;
};

// Extrai solicitações de apoio que ainda aguardam validação do técnico titular
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
                    if (n && n !== titular && !pendentes.includes(n)) pendentes.push(n);
                });
            }
        });
    }
    return pendentes;
}

// Calcula quantos minutos se passaram desde o último horário (HH:MM) ou timestamp do técnico hoje
function calcularMinutosInatividadeSinalHoje(melhorSinal, tel) {
    const agora = new Date();
    const minAgora = (agora.getHours() * 60) + agora.getMinutes();

    let minDiffPorHora = null;
    if (melhorSinal && melhorSinal.minDia !== undefined && melhorSinal.minDia >= 0) {
        minDiffPorHora = minAgora - melhorSinal.minDia;
        if (minDiffPorHora < 0) minDiffPorHora = 0;
    }

    let minDiffPorTs = null;
    const tsRef = Number(tel?.timestampUltimoSinal) || 0;
    if (tsRef > 1700000000000) {
        minDiffPorTs = Math.max(0, Math.round((Date.now() - tsRef) / 60000));
    }

    if (minDiffPorHora !== null && minDiffPorTs !== null) {
        return Math.min(minDiffPorHora, minDiffPorTs);
    }
    if (minDiffPorHora !== null) return minDiffPorHora;
    if (minDiffPorTs !== null) return minDiffPorTs;
    return 999;
}

// Permite ao Gestor encerrar manualmente o turno de um técnico que esqueceu o expediente aberto
async function encerrarTurnoTecnicoPeloGestor(nomeEq) {
    const nivelNorm = String(nivelUsuarioLogado || '').trim().toLowerCase();
    if (nivelNorm !== 'master' && nivelNorm !== 'operador') {
        alert("⚠️ Apenas usuários Master ou Operador podem encerrar turnos.");
        return;
    }
    if (!confirm(`🔴 ENCERRAR TURNO NO MAPA\n\nDeseja encerrar o expediente ativo de "${nomeEq}" para removê-lo do mapa em tempo real?`)) return;

    const hojeISO = obterDataLocalISO();
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
    renderizarPainelDisponibilidade();
}

// Limpa de uma só vez do Mapa todos os técnicos com sinal travado/antigo ou sem atividade aberta
async function limparSinaisAntigosDoMapaGestor() {
    const nivelNorm = String(nivelUsuarioLogado || '').trim().toLowerCase();
    if (nivelNorm !== 'master' && nivelNorm !== 'operador') {
        alert("⚠️ Apenas usuários Master ou Operador podem resetar sinais do mapa.");
        return;
    }

    if (!confirm(`🧹 LIMPAR SINAIS TRAVADOS DO MAPA\n\nDeseja encerrar os turnos antigos/inativos na nuvem e manter no mapa apenas quem está em atendimento ativo agora?`)) return;

    const hojeISO = obterDataLocalISO();
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const emAtendimentoAgora = new Set(
        (registrosSalvos || [])
            .filter(r => r.dataRegistro === hojeISO && ['EM ANDAMENTO', 'PARALISADA', 'REABERTA', 'IMPREVISTO'].includes(r.desfecho))
            .flatMap(r => [r.equipe, ...extrairApoiosDoRegistro(r)])
    );

    let qtdLimpos = 0;
    for (const nomeEq of Object.keys(telemetriaEquipes || {})) {
        if (!emAtendimentoAgora.has(nomeEq) && telemetriaEquipes[nomeEq]?.statusTurno === 'DISPONIVEL') {
            telemetriaEquipes[nomeEq].statusTurno = 'ENCERRADO';
            telemetriaEquipes[nomeEq].horaFim = horaAgora;
            qtdLimpos++;
            if (typeof sincronizarTelemetriaNaNuvem === 'function') {
                await sincronizarTelemetriaNaNuvem(nomeEq, telemetriaEquipes[nomeEq]);
            }
        }
    }

    renderizarPainelDisponibilidade();
    alert(`✅ Mapa atualizado! ${qtdLimpos} turno(s) travado(s)/inativo(s) foram encerrados na nuvem.`);
}

// Injeta o botão de "Limpar Sinais Travados" no topo da aba Mapa
function injetarBotaoLimparMapa() {
    const lblCont = document.getElementById('lbl-contador-pinos-mapa');
    if (lblCont && lblCont.parentNode && !document.getElementById('btn-limpar-sinais-mapa')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btn-limpar-sinais-mapa';
        btn.onclick = limparSinaisAntigosDoMapaGestor;
        btn.className = 'bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition';
        btn.innerHTML = '🧹 Limpar Sinais Travados';
        lblCont.parentNode.appendChild(btn);
    }
}

renderizarPainelDisponibilidade = function() {
    try {
        injetarBotaoLimparMapa();
        const tbody = document.getElementById('tabela-disponibilidade-corpo');
        if (!tbody) return;
        tbody.innerHTML = "";
        const hojeISO = obterDataLocalISO();
        const equipesAtivas = equipesSistema.filter(e => e.status === 'Ativo');
        let countDisp = 0, countAtend = 0, countIndisp = 0, countOffline = 0;
        const listaPinosParaMapa = [];

        const todosRegsHoje = (registrosSalvos || []).filter(r =>
            r.dataRegistro === hojeISO &&
            r.equipe !== '__CONFIG_SISTEMA__' &&
            r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
            r.projeto !== PROJETO_SOLIC_MATERIAL
        );

        equipesAtivas.forEach(eq => {
            const regsHoje = todosRegsHoje.filter(r => r.equipe === eq.nome);
            const obrasEmApoioValidadoHoje = todosRegsHoje.filter(r => r.equipe !== eq.nome && extrairApoiosDoRegistro(r).includes(eq.nome));
            const obrasEmApoioPendenteHoje = todosRegsHoje.filter(r => r.equipe !== eq.nome && extrairApoiosPendentesDoRegistro(r).includes(eq.nome));

            const impAberto = regsHoje.find(r => r.desfecho === 'IMPREVISTO');
            const obraParalisada = regsHoje.find(r => r.desfecho === 'PARALISADA');
            const obraAndamento = regsHoje.find(r => r.desfecho === 'EM ANDAMENTO' || r.desfecho === 'REABERTA');
            const apoioValidadoAndamento = obrasEmApoioValidadoHoje.find(r => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(r.desfecho));
            const apoioPendenteAndamento = obrasEmApoioPendenteHoje.find(r => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA'].includes(r.desfecho));

            const programadasHoje = (registrosSalvos || []).filter(r => r.equipe === eq.nome && r.desfecho === 'PROGRAMADA').length;
            const concluidasHoje = regsHoje.filter(r => r.desfecho === 'CONCLUIDA').length;
            const apoiosConcluidosHoje = obrasEmApoioValidadoHoje.filter(r => r.desfecho === 'CONCLUIDA').length;

            const tel = (telemetriaEquipes && telemetriaEquipes[eq.nome] && telemetriaEquipes[eq.nome].data === hojeISO) ? telemetriaEquipes[eq.nome] : null;
            const turnoIniciado = tel && tel.statusTurno === 'DISPONIVEL';
            const turnoEncerrado = tel && tel.statusTurno === 'ENCERRADO';

            const melhorSinal = extrairCoordenadaMaisRecenteDoTecnicoHoje(eq.nome, regsHoje, [...obrasEmApoioValidadoHoje, ...obrasEmApoioPendenteHoje], tel);
            const latFinal = melhorSinal.lat;
            const lngFinal = melhorSinal.lng;
            const horaSinal = melhorSinal.hora;
            const minutosSemSinal = calcularMinutosInatividadeSinalHoje(melhorSinal, tel);

            // Se o técnico iniciou o turno cedo, não tem obra aberta e o sinal de GPS travou há mais de 45 min, considera SINAL EXPIRADO!
            const sinalTravadoExpirado = minutosSemSinal > TEMPO_MAXIMO_SINAL_MAPA_MINUTOS;

            let turnoHtml = `<span class="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold">⚪ Não iniciado hoje</span>`;
            let turnoTextoPuro = "Não iniciado hoje";
            if (turnoIniciado && !sinalTravadoExpirado) {
                turnoHtml = `<span class="bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">🟢 Ativo desde ${tel.horaInicio || '--:--'}</span>`;
                turnoTextoPuro = `Ativo desde ${tel.horaInicio || '--:--'}`;
            } else if (turnoIniciado && sinalTravadoExpirado) {
                turnoHtml = `<span class="bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">⏸️ Sem sinal há ${minutosSemSinal} min (Início: ${tel.horaInicio || '--:--'})</span>`;
                turnoTextoPuro = `Sinal inativo há ${minutosSemSinal} min`;
            } else if (turnoEncerrado) {
                turnoHtml = `<span class="bg-slate-200 text-slate-800 border border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">🔴 Encerrado (${tel.horaInicio || '--:--'} às ${tel.horaFim || '--:--'})</span>`;
                turnoTextoPuro = `Encerrado (${tel.horaInicio || '--:--'} às ${tel.horaFim || '--:--'})`;
            }

            let statusBadge = "", detalheTexto = "", ocupacaoLimpa = "", acaoHtml = "-";
            let corPinoHex = "#64748b", iconeEmojiPino = "⚪", statusTextoPuro = "OFFLINE";
            let deveAparecerNoMapa = false;

            if (impAberto) {
                countIndisp++; corPinoHex = "#dc2626"; iconeEmojiPino = "🔴"; statusTextoPuro = "INDISPONÍVEL (IMPREVISTO)";
                deveAparecerNoMapa = !sinalTravadoExpirado;
                statusBadge = `<span class="bg-red-100 text-red-800 border border-red-300 font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🔴 INDISPONÍVEL</span>`;
                const mot = (impAberto.malogros && impAberto.malogros.length > 0) ? impAberto.malogros.join(' + ') : impAberto.motivoDesfecho;
                detalheTexto = `<span class="font-bold text-red-900">${mot}</span>`;
                ocupacaoLimpa = `Imprevisto: ${mot}`;
            } else if (obraParalisada) {
                countAtend++; corPinoHex = "#ea580c"; iconeEmojiPino = "⏸️"; statusTextoPuro = "ATIVIDADE PARALISADA";
                deveAparecerNoMapa = !sinalTravadoExpirado;
                statusBadge = `<span class="bg-orange-500 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block">⏸️ PARALISADA</span>`;
                detalheTexto = `Imóvel: <b>${obraParalisada.imovel}</b> (${obraParalisada.projeto})`;
                ocupacaoLimpa = `Pausa no imóvel ${obraParalisada.imovel}`;
            } else if (obraAndamento) {
                countAtend++; corPinoHex = "#2563eb"; iconeEmojiPino = "🔵"; statusTextoPuro = "EM ATENDIMENTO";
                // Se a atividade foi iniciada hoje e está dentro da janela ativa (ou teve sinal recente), mostra no mapa
                deveAparecerNoMapa = (minutosSemSinal <= 120);
                const apVal = extrairApoiosDoRegistro(obraAndamento);
                const apPend = extrairApoiosPendentesDoRegistro(obraAndamento);
                const txtAp = apVal.length > 0 ? ` • <span class="text-purple-800 font-black">🤝 Validado c/ ${apVal.join(', ')}</span>` : '';
                const txtPend = apPend.length > 0 ? ` • <span class="text-amber-800 font-black animate-pulse">⏳ Validar: ${apPend.join(', ')}</span>` : '';
                statusBadge = `<span class="bg-blue-600 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🔵 EM ATENDIMENTO</span>`;
                detalheTexto = `Imóvel: <b>${obraAndamento.imovel}</b> (${obraAndamento.projeto})${txtAp}${txtPend}`;
                ocupacaoLimpa = `Atendendo ${obraAndamento.imovel}${apVal.length > 0 ? ` (Conjunta c/ ${apVal.join(', ')})` : ''}`;
            } else if (apoioValidadoAndamento) {
                countAtend++; corPinoHex = "#7c3aed"; iconeEmojiPino = "🤝"; statusTextoPuro = "EM APOIO (VALIDADO)";
                deveAparecerNoMapa = (minutosSemSinal <= 120);
                statusBadge = `<span class="bg-purple-700 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🤝 EM APOIO (VALIDADO)</span>`;
                detalheTexto = `Apoiando <b>${apoioValidadoAndamento.equipe}</b> no Imóvel <b>${apoioValidadoAndamento.imovel}</b> (Presença Validada ✅)`;
                ocupacaoLimpa = `Em apoio validado a ${apoioValidadoAndamento.equipe} (Imóvel ${apoioValidadoAndamento.imovel})`;
            } else if (apoioPendenteAndamento) {
                countAtend++; corPinoHex = "#d97706"; iconeEmojiPino = "⏳"; statusTextoPuro = "APOIO AGUARDANDO VALIDAÇÃO";
                deveAparecerNoMapa = (minutosSemSinal <= 120);
                statusBadge = `<span class="bg-amber-500 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block animate-pulse">⏳ APOIO PENDENTE VALIDAÇÃO</span>`;
                detalheTexto = `Aguardando <b>${apoioPendenteAndamento.equipe}</b> validar presença no Imóvel <b>${apoioPendenteAndamento.imovel}</b>`;
                ocupacaoLimpa = `Aguardando ${apoioPendenteAndamento.equipe} validar apoio (${apoioPendenteAndamento.imovel})`;
            } else if (turnoEncerrado) {
                countOffline++; corPinoHex = "#475569"; iconeEmojiPino = "🏁"; statusTextoPuro = "EXPEDIENTE ENCERRADO";
                deveAparecerNoMapa = false;
                statusBadge = `<span class="bg-slate-200 text-slate-700 border border-slate-300 font-bold px-2.5 py-1 rounded-md text-[10px] inline-block">🏁 ENCERRADO</span>`;
                detalheTexto = `Turno finalizado (${concluidasHoje} concluída(s)${apoiosConcluidosHoje > 0 ? ` + ${apoiosConcluidosHoje} apoio(s)` : ''})`;
                ocupacaoLimpa = `Turno encerrado`;
            } else if (turnoIniciado && !sinalTravadoExpirado) {
                countDisp++; corPinoHex = "#059669"; iconeEmojiPino = "🟢"; statusTextoPuro = "EM ROTA / DISPONÍVEL";
                deveAparecerNoMapa = true;
                statusBadge = `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🟢 DISPONÍVEL</span>`;
                detalheTexto = `Em deslocamento / Livre (${concluidasHoje} concluída(s)${apoiosConcluidosHoje > 0 ? ` + <b>${apoiosConcluidosHoje} apoio(s)</b>` : ''} hoje)`;
                ocupacaoLimpa = `Disponível em rota`;
            } else {
                countOffline++; corPinoHex = "#94a3b8"; iconeEmojiPino = "⚪"; statusTextoPuro = "SINAL INATIVO / FORA DO MAPA";
                deveAparecerNoMapa = false;
                statusBadge = `<span class="bg-slate-100 text-slate-500 border border-slate-200 font-bold px-2.5 py-1 rounded-md text-[10px] inline-block">⚪ FORA DO MAPA</span>`;
                detalheTexto = sinalTravadoExpirado && horaSinal
                    ? `<span class="text-amber-800 font-semibold">⏸️ Sinal travado desde ${horaSinal} (Ocultado do mapa por inatividade)</span>`
                    : `Sem turno ativo no momento (${concluidasHoje} concluída(s) hoje)`;
                ocupacaoLimpa = "Fora do mapa por inatividade de sinal";
            }

            let gpsStr = `<span class="text-slate-400 text-[10px]">Sem sinal hoje</span>`;
            let sinalTextoPuro = "Sem sinal hoje";
            if (latFinal !== null && lngFinal !== null && !isNaN(latFinal) && !isNaN(lngFinal)) {
                const coordFormatada = `${latFinal.toFixed(5)}, ${lngFinal.toFixed(5)}`;
                sinalTextoPuro = `${horaSinal || '--:--'} (${melhorSinal.origem || 'GPS'})`;
                gpsStr = `<div class="space-y-0.5"><div class="text-[9px] font-bold ${deveAparecerNoMapa ? 'text-emerald-800' : 'text-slate-500'}">🕒 Às ${horaSinal || '--:--'} • ${melhorSinal.origem}</div><a href="https://www.google.com/maps/search/?api=1&query=${latFinal},${lngFinal}" target="_blank" class="text-blue-600 underline font-mono text-[10px]">🗺️ ${coordFormatada}</a></div>`;

                if (deveAparecerNoMapa) {
                    acaoHtml = `<div class="flex items-center gap-1"><button type="button" onclick="focarTecnicoNoMapa(${latFinal}, ${lngFinal}, '${eq.nome}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[10px] px-2 py-1 rounded">🎯 Mapa</button><button type="button" onclick="encerrarTurnoTecnicoPeloGestor('${eq.nome}')" title="Encerrar turno deste técnico e removê-lo do mapa" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[10px] px-2 py-1 rounded">🔴 Baixar</button></div>`;
                    listaPinosParaMapa.push({
                        nome: eq.nome, lat: latFinal, lng: lngFinal, corHex: corPinoHex,
                        iconeEmoji: iconeEmojiPino, statusTexto: statusTextoPuro, turnoTexto: turnoTextoPuro,
                        ocupacaoLimpa, sinalTexto: sinalTextoPuro, horaCurta: horaSinal
                    });
                } else {
                    acaoHtml = `<span class="text-[10px] text-slate-400 font-semibold">Oculto no mapa (Inativo)</span>`;
                }
            }

            tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b"><td class="p-3 font-bold text-slate-800">${eq.nome}</td><td class="p-3">${obterBadgeSetorHtml(eq.setor)}</td><td class="p-3">${turnoHtml}</td><td class="p-3">${statusBadge}</td><td class="p-3">${detalheTexto}</td><td class="p-3">${gpsStr}</td><td class="p-3 whitespace-nowrap">${acaoHtml}</td></tr>`;
        });

        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        setTxt('disp-card-disponiveis', countDisp);
        setTxt('disp-card-atendimento', countAtend);
        setTxt('disp-card-indisponiveis', countIndisp);
        setTxt('disp-card-offline', countOffline);
        setTxt('badge-aba-indisp', `${countIndisp} indisp.`);
        inicializarOuAtualizarMapaRastreio(listaPinosParaMapa);
    } catch (e) { console.warn("Erro disponibilidade:", e); }
};
