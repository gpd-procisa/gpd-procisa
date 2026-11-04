// ================= MÓDULO DE CARTEIRA DE FISCAIS, VISÃO RESTRITA E COBERTURA DE FÉRIAS =================

const CATALOGO_FISCAIS_MDU = [
    { nome: "FRANCISCO DE SOUZA MOURA", email: "fiscal01@mdu.com.br" },
    { nome: "JEFFERSON SILVA DE OLIVEIRA", email: "fiscal02@mdu.com.br" },
    { nome: "MARCELO FRANCISCO SOARES", email: "fiscal03@mdu.com.br" }
];

// Mapa oficial inicial conforme planilha anexada
const MAPA_PADRAO_EQUIPE_FISCAL = {
    // Carteira: JEFFERSON SILVA DE OLIVEIRA (fiscal02@mdu.com.br)
    "BRUNO MARCUS CORREA FERNANDES": "fiscal02@mdu.com.br",
    "MATHEUS FRANCINI ALMEIDA": "fiscal02@mdu.com.br",
    "HEVERTON ALESSANDRO RODRIGUES GUSMAO": "fiscal02@mdu.com.br",
    "MATHEUS MAGNO FERREIRA DA ROCHA": "fiscal02@mdu.com.br",
    "PAULO RICARDO MATOLLA DE FIGUEIREDO SOARES": "fiscal02@mdu.com.br",
    "LUCIANO SANTOS FERREIRA": "fiscal02@mdu.com.br",
    "ANDREO FAGUNDES": "fiscal02@mdu.com.br",

    // Carteira: MARCELO FRANCISCO SOARES (fiscal03@mdu.com.br)
    "FELIPE BAPTISTA FERREIRA": "fiscal03@mdu.com.br",
    "WILSON JOSE DE SOUSA JUNIOR": "fiscal03@mdu.com.br",
    "WEVERTON OTACILIO DA SILVA VERAS": "fiscal03@mdu.com.br",
    "TIAGO SILVA DE PAULA": "fiscal03@mdu.com.br",
    "MARCOS VINICIUS SANTOS DA SILVA": "fiscal03@mdu.com.br",
    "PAULO CESAR FERNANDES JUNIOR": "fiscal03@mdu.com.br",

    // Carteira: FRANCISCO DE SOUZA MOURA (fiscal01@mdu.com.br)
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

function normalizarTextoComparacaoFiscal(str) {
    return String(str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
}

function obterFiscalObjPorEmailOuNome(valor) {
    if (!valor) return null;
    const vNorm = normalizarTextoComparacaoFiscal(valor);
    return CATALOGO_FISCAIS_MDU.find(f =>
        f.email.toLowerCase() === String(valor).toLowerCase().trim() ||
        normalizarTextoComparacaoFiscal(f.nome) === vNorm
    ) || null;
}

function obterEmailFiscalDaEquipe(eqObjOuNome) {
    let eqObj = typeof eqObjOuNome === 'object' ? eqObjOuNome : (equipesSistema || []).find(e => normalizarTextoComparacaoFiscal(e.nome) === normalizarTextoComparacaoFiscal(eqObjOuNome));
    if (eqObj && eqObj.fiscalEmail) {
        return String(eqObj.fiscalEmail).toLowerCase().trim();
    }
    const nomeChave = normalizarTextoComparacaoFiscal(eqObj ? eqObj.nome : eqObjOuNome);
    return MAPA_PADRAO_EQUIPE_FISCAL[nomeChave] || "";
}

function obterNomeFiscalDaEquipe(eqObjOuNome) {
    const email = obterEmailFiscalDaEquipe(eqObjOuNome);
    const fObj = obterFiscalObjPorEmailOuNome(email);
    return fObj ? fObj.nome : "SEM FISCAL DEFINIDO";
}

// Verifica se o usuário logado atualmente no Modo Gestor é um Fiscal com visão restrita
function obterFiscalLogadoRestrito() {
    const emailLogado = String(usuarioLogado || "").toLowerCase().trim();
    if (!emailLogado) return null;

    // 1. Verifica se é um dos 3 e-mails de fiscais oficiais
    const fiscalCatalogo = CATALOGO_FISCAIS_MDU.find(f => f.email.toLowerCase() === emailLogado);
    if (fiscalCatalogo) return fiscalCatalogo;

    // 2. Ou se é um usuário Visualizador que possui equipes vinculadas ao e-mail dele
    const nivelNorm = String(nivelUsuarioLogado || "").toLowerCase().trim();
    if (nivelNorm === "visualizador") {
        const temEquipeVinculada = (equipesSistema || []).some(e => obterEmailFiscalDaEquipe(e) === emailLogado);
        if (temEquipeVinculada) {
            const uSistema = (usuariosSistema || []).find(u => u.email.toLowerCase() === emailLogado);
            return { nome: uSistema ? uSistema.nome.toUpperCase() : emailLogado.toUpperCase(), email: emailLogado };
        }
    }
    return null;
}

// Retorna o Set com os nomes de todos os técnicos que o usuário atual pode visualizar
function obterSetNomesEquipesPermitidasParaUsuarioAtual() {
    const fiscalRestrito = obterFiscalLogadoRestrito();
    if (!fiscalRestrito) return null; // null = Visão Global (Master / Operador vê 100% de tudo)

    const emailFiscal = fiscalRestrito.email.toLowerCase().trim();
    const permitidas = new Set();

    (equipesSistema || []).forEach(eq => {
        if (obterEmailFiscalDaEquipe(eq) === emailFiscal) {
            permitidas.add(eq.nome.toUpperCase().trim());
        }
    });

    // Garante também pelo mapa padrão caso alguma equipe ainda não tenha sido salva
    Object.entries(MAPA_PADRAO_EQUIPE_FISCAL).forEach(([nomeTec, emailPadrao]) => {
        const eqCad = (equipesSistema || []).find(e => normalizarTextoComparacaoFiscal(e.nome) === nomeTec);
        const emailAtual = eqCad && eqCad.fiscalEmail ? eqCad.fiscalEmail.toLowerCase().trim() : emailPadrao;
        if (emailAtual === emailFiscal) {
            permitidas.add(eqCad ? eqCad.nome.toUpperCase().trim() : nomeTec);
        }
    });

    return permitidas;
}

function registroPertenceAoFiscalAtual(reg, setPermitidas) {
    if (!setPermitidas) return true; // Gestor Master/Operador vê tudo
    if (!reg) return false;
    const titular = String(reg.equipe || "").toUpperCase().trim();
    if (setPermitidas.has(titular)) return true;

    // Se um técnico da carteira deste fiscal atuou em Apoio Conjunto validado no registro, o fiscal também visualiza!
    const apoios = typeof extrairApoiosDoRegistro === 'function' ? extrairApoiosDoRegistro(reg) : [];
    return apoios.some(ap => setPermitidas.has(String(ap || "").toUpperCase().trim()));
}

// Sincroniza o vínculo inicial da planilha nas equipes cadastradas (sem sobrescrever alterações futuras)
async function aplicarVinculoInicialFiscaisNasEquipes() {
    if (!Array.isArray(equipesSistema) || equipesSistema.length === 0) return;
    let houveMudanca = false;

    equipesSistema.forEach(eq => {
        if (!eq.fiscalEmail) {
            const chave = normalizarTextoComparacaoFiscal(eq.nome);
            if (MAPA_PADRAO_EQUIPE_FISCAL[chave]) {
                eq.fiscalEmail = MAPA_PADRAO_EQUIPE_FISCAL[chave];
                eq.fiscal = obterNomeFiscalDaEquipe(eq);
                houveMudanca = true;
            }
        }
    });

    if (houveMudanca && typeof sincronizarEquipesNaNuvem === "function") {
        try { await sincronizarEquipesNaNuvem(); } catch (e) {}
    }
}

// Injeta o seletor de Fiscal dentro do Modal "Editar Equipe" e o Painel de Férias na aba Equipes
function inicializarInterfaceGestaoFiscais() {
    // 1. Campo "Fiscal Responsável" dentro do modal de Editar/Nova Equipe
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
            <p class="text-[10px] text-slate-500 mt-1">O fiscal selecionado visualizará este técnico no painel dele. Pode ser alterado a qualquer momento em caso de férias.</p>
        `;
        selStatusEq.parentNode.appendChild(divFiscal);
    }

    // 2. Painel de Transferência de Férias / Cobertura de Carteira no topo da Aba Equipes
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
                    <select id="sel-ferias-fiscal-origem" class="w-full bg-slate-900 border border-indigo-600 rounded-xl p-2 text-white font-bold text-xs">
                        ${opcoesFiscais}
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-indigo-200 uppercase mb-1">2. Passar a visão do grupo para o Fiscal:</label>
                    <select id="sel-ferias-fiscal-destino" class="w-full bg-slate-900 border border-emerald-500 rounded-xl p-2 text-emerald-300 font-bold text-xs">
                        ${opcoesFiscais}
                    </select>
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

    atualizarResumoContagemCarteirasFiscais();
}

function atualizarResumoContagemCarteirasFiscais() {
    const container = document.getElementById('resumo-contagem-carteiras-fiscais');
    if (!container) return;

    container.innerHTML = CATALOGO_FISCAIS_MDU.map(f => {
        const qtd = (equipesSistema || []).filter(e => e.status === 'Ativo' && obterEmailFiscalDaEquipe(e) === f.email).length;
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

// Altera rapidamente o fiscal de um técnico direto na linha da tabela de Equipes
async function alterarFiscalDiretoNaTabela(idEquipe, novoEmailFiscal) {
    if (String(nivelUsuarioLogado || '').trim().toLowerCase() === 'visualizador') return;
    const eq = (equipesSistema || []).find(e => e.id === idEquipe);
    if (!eq) return;

    const fObj = obterFiscalObjPorEmailOuNome(novoEmailFiscal);
    eq.fiscalEmail = fObj ? fObj.email : "";
    eq.fiscal = fObj ? fObj.nome : "";

    await sincronizarEquipesNaNuvem();
    renderizarTabelaEquipes();
    atualizarResumoContagemCarteirasFiscais();
    registrarLogAuditoria("ALTERAÇÃO DE FISCAL", `Técnico ${eq.nome} vinculado ao fiscal ${eq.fiscal || 'Sem Fiscal'}.`);
}

// Transfere todos os técnicos de um Fiscal em férias para outro Fiscal cobrir
async function transferirGrupoFiscalFeriasEmLote() {
    const nivelNorm = String(nivelUsuarioLogado || '').trim().toLowerCase();
    if (nivelNorm !== 'master' && nivelNorm !== 'operador') {
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

    if (!confirm(`🏖️ COBERTURA DE FÉRIAS / TRANSFERÊNCIA DE GRUPO\n\nDeseja transferir temporariamente os ${tecnicosAfetados.length} técnico(s) do grupo de:\n👉 ${fOrig.nome} (${emailOrigem})\n\nPara a visão do fiscal:\n👉 ${fDest.nome} (${emailDestino})?`)) {
        return;
    }

    tecnicosAfetados.forEach(eq => {
        if (!eq.fiscalOriginalEmail) eq.fiscalOriginalEmail = emailOrigem;
        eq.fiscalEmail = fDest.email;
        eq.fiscal = fDest.nome;
    });

    await sincronizarEquipesNaNuvem();
    renderizarTabelaEquipes();
    atualizarResumoContagemCarteirasFiscais();
    registrarLogAuditoria("TRANSFERÊNCIA DE GRUPO (FÉRIAS)", `${tecnicosAfetados.length} técnicos transferidos de ${fOrig.nome} para ${fDest.nome}.`);
    alert(`✅ Grupo transferido com sucesso!\n\nAgora ${fDest.nome} (${fDest.email}) visualiza também os ${tecnicosAfetados.length} técnicos de ${fOrig.nome}.`);
}

// Restaura a divisão original dos 23 técnicos exatamente como na planilha enviada
async function restaurarCarteiraOriginalPadraoFiscais() {
    const nivelNorm = String(nivelUsuarioLogado || '').trim().toLowerCase();
    if (nivelNorm !== 'master' && nivelNorm !== 'operador') {
        alert("⚠️ Apenas usuários Master ou Operador podem restaurar a divisão padrão.");
        return;
    }

    if (!confirm("🔄 RESTAURAR DIVISÃO ORIGINAL DE FISCAIS\n\nDeseja retornar todos os técnicos para a distribuição original de cada fiscal (Francisco, Jefferson e Marcelo)?")) {
        return;
    }

    (equipesSistema || []).forEach(eq => {
        const chave = normalizarTextoComparacaoFiscal(eq.nome);
        const emailPadrao = MAPA_PADRAO_EQUIPE_FISCAL[chave] || eq.fiscalOriginalEmail || "";
        const fObj = obterFiscalObjPorEmailOuNome(emailPadrao);
        eq.fiscalEmail = fObj ? fObj.email : "";
        eq.fiscal = fObj ? fObj.nome : "";
        delete eq.fiscalOriginalEmail;
    });

    await sincronizarEquipesNaNuvem();
    renderizarTabelaEquipes();
    atualizarResumoContagemCarteirasFiscais();
    registrarLogAuditoria("RESTAURAÇÃO DE CARTEIRA DE FISCAIS", "Divisão padrão de técnicos por fiscal restaurada conforme planilha oficial.");
    alert("✅ Divisão original de fiscais restaurada com sucesso!");
}

// Sobrescreve abrirModalEquipe e salvarOuAtualizarEquipe para ler/gravar o Fiscal Responsável
const _origAbrirModalEquipeFiscal = window.abrirModalEquipe;
window.abrirModalEquipe = function(id = null) {
    inicializarInterfaceGestaoFiscais();
    if (typeof _origAbrirModalEquipeFiscal === 'function') _origAbrirModalEquipeFiscal(id);

    const selFiscal = document.getElementById('sel-fiscal-equipe');
    if (!selFiscal) return;

    if (id) {
        const eq = (equipesSistema || []).find(e => e.id === id);
        selFiscal.value = eq ? obterEmailFiscalDaEquipe(eq) : "";
    } else {
        selFiscal.value = CATALOGO_FISCAIS_MDU[0].email;
    }
};

const _origSalvarOuAtualizarEquipeFiscal = window.salvarOuAtualizarEquipe;
window.salvarOuAtualizarEquipe = async function() {
    const editId = document.getElementById('edit-equipe-id')?.value;
    const nomeDigitado = (document.getElementById('inp-nome-equipe')?.value || "").trim().toUpperCase();
    const emailFiscalEscolhido = document.getElementById('sel-fiscal-equipe')?.value || "";
    const fObj = obterFiscalObjPorEmailOuNome(emailFiscalEscolhido);

    if (typeof _origSalvarOuAtualizarEquipeFiscal === 'function') {
        await _origSalvarOuAtualizarEquipeFiscal();
    }

    const eqAlvo = editId
        ? (equipesSistema || []).find(e => e.id == editId)
        : (equipesSistema || []).find(e => e.nome === nomeDigitado);

    if (eqAlvo) {
        eqAlvo.fiscalEmail = fObj ? fObj.email : "";
        eqAlvo.fiscal = fObj ? fObj.nome : "";
        await sincronizarEquipesNaNuvem();
        renderizarTabelaEquipes();
        atualizarResumoContagemCarteirasFiscais();
    }
};

// Sobrescreve renderizarTabelaEquipes para exibir a coluna/seletor do Fiscal Responsável em cada técnico
renderizarTabelaEquipes = function() {
    inicializarInterfaceGestaoFiscais();
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
    const nivelNorm = String(nivelUsuarioLogado || '').trim().toLowerCase();
    const podeEditar = (nivelNorm === 'master' || nivelNorm === 'operador');

    equipesSistema.forEach(eq => {
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
        if (nivelNorm === 'master') acoesEq += ` <button onclick="excluirEquipe(${eq.id}, '${eq.nome}')" class="bg-red-50 text-red-600 font-bold text-[10px] px-2.5 py-1 rounded">🗑️ Excluir</button>`;

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
};

// Exibe um Banner informativo no topo quando um dos 3 Fiscais está logado e filtra o select de Equipes
function aplicarFiltroSelectEquipesEBannerFiscal() {
    const fiscalAtivo = obterFiscalLogadoRestrito();
    const setPermitidas = obterSetNomesEquipesPermitidasParaUsuarioAtual();

    // Filtra o select de equipes do topo do Gestor para mostrar apenas os técnicos do fiscal logado
    const selFiltroEq = document.getElementById('gestor-filtro-equipe');
    if (selFiltroEq) {
        const valorAtual = selFiltroEq.value;
        const listaEq = (equipesSistema || []).filter(e => !setPermitidas || setPermitidas.has(e.nome.toUpperCase().trim()));
        selFiltroEq.innerHTML = `<option value="">${fiscalAtivo ? `👷 Minha Carteira (${listaEq.length} Técnicos)` : 'Todas as Equipes'}</option>` +
            listaEq.map(e => `<option value="${e.nome}">${e.nome}</option>`).join('');
        if (valorAtual && (!setPermitidas || setPermitidas.has(valorAtual.toUpperCase().trim()))) {
            selFiltroEq.value = valorAtual;
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

    const qtdMeusTecnicos = setPermitidas ? setPermitidas.size : 0;
    banner.classList.remove('hidden');
    banner.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="bg-cyan-400 text-slate-950 font-black px-2 py-0.5 rounded text-[10px] uppercase">Visão Restrita do Fiscal</span>
            <span>👮 Olá, <b>${fiscalAtivo.nome}</b>! Você está visualizando exclusivamente os <b>${qtdMeusTecnicos} técnicos</b> vinculados ao seu grupo.</span>
        </div>
        <span class="text-[10px] text-cyan-300 font-mono">${fiscalAtivo.email}</span>
    `;
}

// Intercepta atualizarDashboardGestor e renderizarPainelDisponibilidade para filtrar automaticamente a carteira do Fiscal logado!
const _origAtualizarDashboardGestorFiscal = window.atualizarDashboardGestor;
window.atualizarDashboardGestor = async function(forcarRecargaMobile = false) {
    await aplicarVinculoInicialFiscaisNasEquipes();
    aplicarFiltroSelectEquipesEBannerFiscal();

    const setPermitidas = obterSetNomesEquipesPermitidasParaUsuarioAtual();
    if (!setPermitidas) {
        return await _origAtualizarDashboardGestorFiscal.apply(this, arguments);
    }

    // Se ainda não carregou os registros da nuvem (ex.: smartphone do fiscal), carrega antes de filtrar!
    const registrosReais = (registrosSalvos || []).filter(r => r.equipe !== "__CONFIG_SISTEMA__" && r.projeto !== "__CONFIG_AUDITORIA__");
    if ((forcarRecargaMobile || !cargaInicialGestorConcluida || registrosReais.length === 0) && !modoConsultaBackupAtivo && typeof carregarRegistrosDaNuvem === "function") {
        await carregarRegistrosDaNuvem(true);
        cargaInicialGestorConcluida = true;
    }

    // Filtra temporariamente registrosSalvos e equipesSistema apenas para a carteira do Fiscal durante a renderização
    const backupRegistros = registrosSalvos;
    const backupEquipes = equipesSistema;
    try {
        registrosSalvos = (backupRegistros || []).filter(r =>
            r.equipe === "__CONFIG_SISTEMA__" ||
            r.projeto === "__CONFIG_AUDITORIA__" ||
            registroPertenceAoFiscalAtual(r, setPermitidas)
        );
        equipesSistema = (backupEquipes || []).filter(e => setPermitidas.has(e.nome.toUpperCase().trim()));
        return await _origAtualizarDashboardGestorFiscal.apply(this, [false]);
    } finally {
        registrosSalvos = backupRegistros;
        equipesSistema = backupEquipes;
    }
};

const _origRenderizarPainelDisponibilidadeFiscal = window.renderizarPainelDisponibilidade;
window.renderizarPainelDisponibilidade = function() {
    const setPermitidas = obterSetNomesEquipesPermitidasParaUsuarioAtual();
    if (!setPermitidas) {
        return _origRenderizarPainelDisponibilidadeFiscal.apply(this, arguments);
    }

    const backupRegistros = registrosSalvos;
    const backupEquipes = equipesSistema;
    try {
        registrosSalvos = (backupRegistros || []).filter(r => registroPertenceAoFiscalAtual(r, setPermitidas));
        equipesSistema = (backupEquipes || []).filter(e => setPermitidas.has(e.nome.toUpperCase().trim()));
        return _origRenderizarPainelDisponibilidadeFiscal.apply(this, arguments);
    } finally {
        registrosSalvos = backupRegistros;
        equipesSistema = backupEquipes;
    }
};

// Também filtra o Modal de Filtro Múltiplo para listar apenas os técnicos do Fiscal logado
const _origAbrirModalFiltroMultiploFiscal = window.abrirModalFiltroMultiplo;
window.abrirModalFiltroMultiplo = function() {
    const setPermitidas = obterSetNomesEquipesPermitidasParaUsuarioAtual();
    const backupEquipes = equipesSistema;
    try {
        if (setPermitidas) {
            equipesSistema = (backupEquipes || []).filter(e => setPermitidas.has(e.nome.toUpperCase().trim()));
        }
        return _origAbrirModalFiltroMultiploFiscal.apply(this, arguments);
    } finally {
        equipesSistema = backupEquipes;
    }
};

// Garante que os 3 fiscais estejam cadastrados na lista de usuários caso ainda não estejam
setTimeout(async () => {
    await aplicarVinculoInicialFiscaisNasEquipes();
    inicializarInterfaceGestaoFiscais();
}, 600);
