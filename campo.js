// ================= CONTROLE DE RASTREIO GPS, WAKE LOCK, FILA OFFLINE E SOLICITAÇÕES =================
let watchIdRastreioGps = null;
let timerEnvioRastreioGps = null;
let wakeLockAtivo = null;
let ultimaCoordRastreioCache = null;
let encerrandoExpedienteEmCurso = false;
let ultimoDisparoGpsCampoTs = 0;
let parceiroApoioPreSelecionadoSuporte = "";

let fotosSolicCombustivelTemp = {
    painel: null,
    mapa: null,
    cartao: null
};

// Garante a opção "REDE GPON NÃO CONSTRUÍDA" nos itens verificados de Concluída
function garantirOpcaoRedeGponNaoConstruida() {
    if (typeof OPCOES_CONCLUIDA_PADRAO !== 'undefined' && Array.isArray(OPCOES_CONCLUIDA_PADRAO)) {
        if (!OPCOES_CONCLUIDA_PADRAO.includes("REDE GPON NÃO CONSTRUÍDA")) {
            OPCOES_CONCLUIDA_PADRAO.push("REDE GPON NÃO CONSTRUÍDA");
        }
    }
}
garantirOpcaoRedeGponNaoConstruida();

// Força todos os inputs de imagem a abrirem o seletor da Galeria/Arquivos (evitando estourar a RAM com a câmera no navegador)
function forcarInputsFotoApenasGaleria() {
    try {
        garantirOpcaoRedeGponNaoConstruida();
        const inputsFoto = document.querySelectorAll('input[type="file"]');
        inputsFoto.forEach(inp => {
            const acc = (inp.getAttribute('accept') || '').toLowerCase();
            if (acc.includes('image') || acc.includes('.jpg') || inp.id.includes('foto') || inp.id.includes('comb')) {
                inp.removeAttribute('capture');
                inp.setAttribute('accept', '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp');
            }
        });
    } catch (e) {}
}

setInterval(forcarInputsFotoApenasGaleria, 1500);

async function ativarWakeLockTela() {
    try {
        if ('wakeLock' in navigator && !wakeLockAtivo) {
            wakeLockAtivo = await navigator.wakeLock.request('screen');
            wakeLockAtivo.addEventListener('release', () => {
                wakeLockAtivo = null;
            });
        }
    } catch (e) {
        console.warn("Aviso WakeLock:", e);
    }
}

function liberarWakeLockTela() {
    try {
        if (wakeLockAtivo) {
            wakeLockAtivo.release();
            wakeLockAtivo = null;
        }
    } catch (e) {
        console.warn("Aviso ao liberar WakeLock:", e);
    }
}

document.addEventListener('visibilitychange', () => {
    const nomeEq = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao;
    const hojeISO = obterDataLocalISO();
    const dadosTel = (nomeEq && typeof telemetriaEquipes !== 'undefined') ? telemetriaEquipes[nomeEq] : null;
    if (document.visibilityState === 'visible' && dadosTel && dadosTel.data === hojeISO && dadosTel.statusTurno === 'DISPONIVEL') {
        ativarWakeLockTela();
        capturarEEnviarPosicaoRastreio(nomeEq, false);
    }
});

// ================= SOLICITAÇÃO DE COMBUSTÍVEL EXTRA E DE MATERIAL NO MODO CAMPO =================

function validarTecnicoSelecionadoParaSolicitacao() {
    const selEq = document.getElementById('sel-equipe');
    const nomeEq = selEq?.value || equipeAutenticadaSessao || "";
    if (!nomeEq || equipeAutenticadaSessao !== nomeEq) {
        alert("⚠️ Selecione primeiro o seu nome em 'Equipe / Técnico' e digite seu PIN de 4 dígitos para acessar esta opção.");
        if (selEq) selEq.focus();
        return null;
    }
    return nomeEq;
}

function abrirModalSolicitacaoCombustivelCampo() {
    const nomeEq = validarTecnicoSelecionadoParaSolicitacao();
    if (!nomeEq) return;

    forcarInputsFotoApenasGaleria();

    document.getElementById('lbl-tec-solic-comb').innerText = nomeEq;
    document.getElementById('inp-comb-placa').value = localStorage.getItem(`gpd_ultima_placa_${nomeEq}`) || "";
    document.getElementById('inp-comb-km').value = "";
    document.getElementById('inp-comb-motivo').value = "";

    const selSug = document.getElementById('sel-comb-motivo-sugerido');
    if (selSug) {
        const opcoes = (typeof OPCOES_COMBUSTIVEL_PADRAO !== 'undefined' && Array.isArray(OPCOES_COMBUSTIVEL_PADRAO))
            ? OPCOES_COMBUSTIVEL_PADRAO
            : [];
        selSug.innerHTML = `<option value="">Selecione um motivo rápido (opcional) ou digite abaixo...</option>` +
            opcoes.map(op => `<option value="${op}">⛽ ${op}</option>`).join('');
    }

    fotosSolicCombustivelTemp = { painel: null, mapa: null, cartao: null };
    atualizarPreviewSlotCombustivel('painel', null, 'Nenhuma foto anexada (Anexar da Galeria)');
    atualizarPreviewSlotCombustivel('mapa', null, 'Nenhuma foto anexada (Anexar da Galeria)');
    atualizarPreviewSlotCombustivel('cartao', null, 'Opcional (Anexar da Galeria)');

    document.getElementById('modal-solic-combustivel').classList.remove('hidden');
}

function fecharModalSolicitacaoCombustivelCampo() {
    document.getElementById('modal-solic-combustivel')?.classList.add('hidden');
}

function aoSelecionarMotivoSugeridoCombustivel(valor) {
    if (valor) {
        document.getElementById('inp-comb-motivo').value = valor;
    }
}

function atualizarPreviewSlotCombustivel(slot, base64, textoPadrao) {
    const imgEl = document.getElementById(`prev-foto-comb-${slot}`);
    const statusEl = document.getElementById(`status-foto-comb-${slot}`);
    if (base64) {
        if (imgEl) {
            imgEl.src = base64;
            imgEl.classList.remove('hidden');
        }
        if (statusEl) {
            statusEl.innerText = "✅ Foto anexada da galeria com sucesso";
            statusEl.className = "text-[10px] text-emerald-700 font-bold";
        }
    } else {
        if (imgEl) {
            imgEl.src = "";
            imgEl.classList.add('hidden');
        }
        if (statusEl) {
            statusEl.innerText = textoPadrao;
            statusEl.className = "text-[10px] text-slate-500";
        }
    }
}

async function processarFotoSlotCombustivel(slot, inputEl) {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;

    const statusEl = document.getElementById(`status-foto-comb-${slot}`);
    if (statusEl) {
        statusEl.innerText = "⏳ Otimizando foto (economia de memória)...";
        statusEl.className = "text-[10px] text-blue-700 font-bold animate-pulse";
    }

    try {
        const comprimida = await comprimirImagemBase64(file, 720, 0.58);
        fotosSolicCombustivelTemp[slot] = comprimida;
        atualizarPreviewSlotCombustivel(slot, comprimida, "");
    } catch (e) {
        console.warn("Erro ao comprimir foto combustível:", e);
        atualizarPreviewSlotCombustivel(slot, null, "Erro ao ler imagem. Escolha da Galeria.");
        alert("⚠️ Não foi possível processar a imagem. Tire a foto primeiro pela câmera normal do celular e selecione-a pela Galeria.");
    }
    inputEl.value = "";
}

async function enviarSolicitacaoCombustivelCampo() {
    const nomeEq = validarTecnicoSelecionadoParaSolicitacao();
    if (!nomeEq) return;

    const placa = (document.getElementById('inp-comb-placa')?.value || "").trim().toUpperCase();
    const km = (document.getElementById('inp-comb-km')?.value || "").trim();
    const motivo = (document.getElementById('inp-comb-motivo')?.value || "").trim() || "Solicitação de recarga em campo";

    if (!placa) {
        alert("⚠️ Informe obrigatoriamente a PLACA do veículo.");
        document.getElementById('inp-comb-placa')?.focus();
        return;
    }
    if (!km || isNaN(Number(km)) || Number(km) <= 0) {
        alert("⚠️ Informe obrigatoriamente o KM ATUAL do veículo.");
        document.getElementById('inp-comb-km')?.focus();
        return;
    }
    if (!fotosSolicCombustivelTemp.painel) {
        alert("⚠️ A foto do PAINEL DO CARRO é obrigatória.");
        return;
    }
    if (!fotosSolicCombustivelTemp.mapa) {
        alert("⚠️ A foto do MAPA DE BORDO é obrigatória.");
        return;
    }

    localStorage.setItem(`gpd_ultima_placa_${nomeEq}`, placa);

    const btn = document.getElementById('btn-enviar-solic-comb');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Enviando solicitação e fotos...";
    }

    let gpsAtual = "Sem GPS no momento";
    try {
        gpsAtual = await capturarGpsReal(5000);
    } catch (e) {}

    const fotosArray = [
        fotosSolicCombustivelTemp.painel,
        fotosSolicCombustivelTemp.mapa
    ];
    if (fotosSolicCombustivelTemp.cartao) {
        fotosArray.push(fotosSolicCombustivelTemp.cartao);
    }

    const tagsLabelsFotos = fotosSolicCombustivelTemp.cartao
        ? ["PAINEL DO CARRO", "MAPA DE BORDO", "CARTÃO DE COMBUSTÍVEL"]
        : ["PAINEL DO CARRO", "MAPA DE BORDO"];

    const hojeISO = obterDataLocalISO();
    const horaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    const novoRegDB = {
        id: Date.now(),
        data_registro: hojeISO,
        equipe: nomeEq,
        membros: nomeEq,
        projeto: PROJETO_SOLIC_COMBUSTIVEL,
        imovel: `PLACA: ${placa} | KM: ${km}`,
        h_entrada: horaAtual,
        h_saida: "Pendente",
        gps_entrada: gpsAtual,
        gps_saida: "-",
        desfecho: "AGUARDANDO TRATATIVA",
        motivo_desfecho: motivo,
        malogros: tagsLabelsFotos,
        responsavel: placa,
        contato: String(km),
        email: "",
        agendamento: null,
        andares: Number(km) || 0,
        hps: fotosArray.length,
        servico_obra: "NÃO",
        observacoes: `[END: Placa ${placa} • KM ${km}] ${motivo} [FOTOS:${JSON.stringify(fotosArray)}]`
    };

    try {
        const { error } = await supabaseClient.from('registros_producao').insert([novoRegDB]);
        if (error) throw error;

        if (btn) {
            btn.disabled = false;
            btn.innerText = "🚀 Enviar Solicitação de Recarga";
        }

        fotosSolicCombustivelTemp = { painel: null, mapa: null, cartao: null };
        fecharModalSolicitacaoCombustivelCampo();
        await carregarRegistrosModoCampoLeve();
        renderizarResumoSolicitacoesCampo();
        alert(`✅ Solicitação de Combustível enviada com sucesso!\n\nPlaca: ${placa} | KM: ${km}\nA gestão já recebeu seu pedido em tempo real.`);
    } catch (err) {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "🚀 Enviar Solicitação de Recarga";
        }
        alert("❌ Erro ao enviar solicitação: " + (err.message || "Verifique sua conexão."));
    }
}

function abrirModalSolicitacaoMaterialCampo() {
    const nomeEq = validarTecnicoSelecionadoParaSolicitacao();
    if (!nomeEq) return;

    document.getElementById('lbl-tec-solic-mat').innerText = nomeEq;
    document.getElementById('inp-obs-solic-material').value = "";

    const container = document.getElementById('lista-itens-solic-material-campo');
    if (container) {
        const catalogoMat = (typeof OPCOES_MATERIAL_SOLICITACAO !== 'undefined' && Array.isArray(OPCOES_MATERIAL_SOLICITACAO) && OPCOES_MATERIAL_SOLICITACAO.length > 0)
            ? OPCOES_MATERIAL_SOLICITACAO
            : ["CABO RL (m)", "CONECTORES (un)", "CABO DROP (m)", "NAP (un)", "DIO (un)", "FUSÕES / TUBETES (un)", "CX. SOBREPOR (un)", "CX. EMBUTIDA (un)", "CX. FOSC (un)"];

        container.innerHTML = catalogoMat.map((item, idx) => `
            <div class="py-1.5 flex justify-between items-center gap-2">
                <label class="font-bold text-slate-800 text-[11px] flex-1" for="inp-qtd-mat-solic-${idx}">📦 ${item}</label>
                <input type="number" id="inp-qtd-mat-solic-${idx}" data-nome-material="${item}" min="0" placeholder="0" class="w-20 text-center font-black text-xs border-2 border-indigo-200 rounded-lg p-1.5 bg-white text-indigo-950 outline-none focus:border-indigo-600">
            </div>
        `).join('');
    }

    document.getElementById('modal-solic-material').classList.remove('hidden');
}

function fecharModalSolicitacaoMaterialCampo() {
    document.getElementById('modal-solic-material')?.classList.add('hidden');
}

async function enviarSolicitacaoMaterialCampo() {
    const nomeEq = validarTecnicoSelecionadoParaSolicitacao();
    if (!nomeEq) return;

    const inputs = document.querySelectorAll('#lista-itens-solic-material-campo input[data-nome-material]');
    const itensPedidos = [];

    inputs.forEach(inp => {
        const qtd = Number(inp.value) || 0;
        if (qtd > 0) {
            itensPedidos.push(`${inp.dataset.nomeMaterial}: ${qtd}`);
        }
    });

    if (itensPedidos.length === 0) {
        alert("⚠️ Informe a quantidade (maior que zero) em pelo menos 1 item de material.");
        return;
    }

    const obs = (document.getElementById('inp-obs-solic-material')?.value || "").trim();
    const btn = document.getElementById('btn-enviar-solic-mat');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Enviando pedido de material...";
    }

    let gpsAtual = "Sem GPS no momento";
    try {
        gpsAtual = await capturarGpsReal(4000);
    } catch (e) {}

    const hojeISO = obterDataLocalISO();
    const horaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const resumoPedido = itensPedidos.join(" | ");

    const novoRegDB = {
        id: Date.now(),
        data_registro: hojeISO,
        equipe: nomeEq,
        membros: nomeEq,
        projeto: PROJETO_SOLIC_MATERIAL,
        imovel: `PEDIDO (${itensPedidos.length} item/itens)`,
        h_entrada: horaAtual,
        h_saida: "Pendente",
        gps_entrada: gpsAtual,
        gps_saida: "-",
        desfecho: "AGUARDANDO TRATATIVA",
        motivo_desfecho: resumoPedido,
        malogros: itensPedidos,
        responsavel: obs || "Solicitação via Modo Campo",
        contato: "",
        email: "",
        agendamento: null,
        andares: itensPedidos.length,
        hps: 0,
        servico_obra: "NÃO",
        observacoes: obs || "Aguardando separação/entrega"
    };

    try {
        const { error } = await supabaseClient.from('registros_producao').insert([novoRegDB]);
        if (error) throw error;

        if (btn) {
            btn.disabled = false;
            btn.innerText = "🚀 Enviar Pedido de Material";
        }

        fecharModalSolicitacaoMaterialCampo();
        await carregarRegistrosModoCampoLeve();
        renderizarResumoSolicitacoesCampo();
        alert(`✅ Pedido de Material enviado com sucesso!\n\nItens solicitados:\n• ${itensPedidos.join('\n• ')}`);
    } catch (err) {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "🚀 Enviar Pedido de Material";
        }
        alert("❌ Erro ao enviar pedido de material: " + (err.message || "Verifique sua conexão."));
    }
}

function renderizarResumoSolicitacoesCampo() {
    const box = document.getElementById('box-status-solicitacoes-campo');
    if (!box) return;

    const nomeEq = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "";
    if (!nomeEq) {
        box.classList.add('hidden');
        return;
    }

    const minhasSolic = (registrosSalvos || []).filter(r =>
        r.equipe === nomeEq &&
        (r.projeto === PROJETO_SOLIC_COMBUSTIVEL || r.projeto === PROJETO_SOLIC_MATERIAL)
    ).slice(0, 4);

    if (minhasSolic.length === 0) {
        box.classList.add('hidden');
        return;
    }

    box.classList.remove('hidden');
    box.innerHTML = minhasSolic.map(s => {
        const ehComb = s.projeto === PROJETO_SOLIC_COMBUSTIVEL;
        const icone = ehComb ? "⛽" : "🧰";
        const tipoTitulo = ehComb ? s.imovel : `Material (${(s.malogros || []).length} itens)`;
        const tratada = s.desfecho === 'TRATADA';
        const badge = tratada
            ? `<span class="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-1.5 py-0.5 rounded text-[9px]">🟢 TRATADA por ${s.tratadoPor || 'Gestor'} (${s.tratadoDataHora || s.hSaida})</span>`
            : `<span class="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded text-[9px]">🟡 AGUARDANDO TRATATIVA (${s.hEntrada})</span>`;

        return `
            <div class="bg-white p-2 rounded-lg border border-slate-200 flex flex-col gap-0.5 text-[10px]">
                <div class="flex justify-between items-center gap-1">
                    <span class="font-bold text-slate-800">${icone} ${tipoTitulo}</span>
                    <span class="text-[9px] text-slate-400">${s.dataRegistro}</span>
                </div>
                <div>${badge}</div>
            </div>
        `;
    }).join('');
}

// ================= FILA OFFLINE DE SALVAMENTO =================
function obterFilaOfflineCampo() {
    try {
        const bruto = localStorage.getItem('gpd_fila_offline_campo');
        if (!bruto) return [];
        const parsed = JSON.parse(bruto);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function salvarNaFilaOfflineCampo(pacoteRegistros, resumoTexto) {
    const fila = obterFilaOfflineCampo();
    fila.push({
        idFila: Date.now(),
        dataHora: new Date().toLocaleString('pt-BR'),
        idEmAndamentoParaDeletar: dadosAtendimento.idEmAndamento || null,
        registros: pacoteRegistros,
        resumoWhats: resumoTexto
    });
    localStorage.setItem('gpd_fila_offline_campo', JSON.stringify(fila));
    renderizarBannerFilaOfflineCampo();
}

function renderizarBannerFilaOfflineCampo() {
    const fila = obterFilaOfflineCampo();
    let banner = document.getElementById('banner-fila-offline-campo');
    const containerPai = document.getElementById('subview-campo-lancamento');
    if (!containerPai) return;

    if (fila.length === 0) {
        if (banner) banner.classList.add('hidden');
        return;
    }

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'banner-fila-offline-campo';
        banner.className = 'bg-amber-100 border-2 border-amber-500 p-3 rounded-xl space-y-2 shadow-sm';
        containerPai.insertBefore(banner, containerPai.firstChild);
    }

    banner.classList.remove('hidden');
    banner.innerHTML = `
        <div class="flex justify-between items-start gap-2">
            <div>
                <h4 class="text-xs font-black text-amber-950 uppercase flex items-center gap-1">
                    📡 ${fila.length} Atendimento(s) Guardado(s) na Fila Offline
                </h4>
                <p class="text-[10px] text-amber-900 mt-0.5">
                    Salvo(s) no celular durante queda de sinal 4G. Assim que a conexão estabilizar, clique abaixo ou aguarde o envio automático.
                </p>
            </div>
        </div>
        <button type="button" onclick="sincronizarFilaOfflineCampo(true)" title="Enviar agora os atendimentos que foram salvos sem internet no subsolo/DG para a nuvem do GPD" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2 rounded-lg text-xs transition shadow-sm">
            🔄 Sincronizar Fila Offline Agora (${fila.length})
        </button>
    `;
}

async function sincronizarFilaOfflineCampo(exibirFeedback = false) {
    const fila = obterFilaOfflineCampo();
    if (fila.length === 0) return;

    let restantes = [];
    let enviados = 0;

    for (const item of fila) {
        try {
            if (item.idEmAndamentoParaDeletar) {
                await supabaseClient.from('registros_producao').delete().eq('id', item.idEmAndamentoParaDeletar);
            }
            const { error } = await supabaseClient.from('registros_producao').insert(item.registros);
            if (error) {
                restantes.push(item);
            } else {
                enviados++;
            }
        } catch (err) {
            restantes.push(item);
        }
    }

    localStorage.setItem('gpd_fila_offline_campo', JSON.stringify(restantes));
    renderizarBannerFilaOfflineCampo();

    if (enviados > 0) {
        await carregarRegistrosModoCampoLeve();
        atualizarAbaMinhasAtividadesCampo(false);
        if (exibirFeedback) {
            alert(`✅ ${enviados} atendimento(s) da Fila Offline foram sincronizados com sucesso na nuvem!`);
        }
    } else if (exibirFeedback && restantes.length > 0) {
        alert("⚠️ Ainda sem conexão estável com a nuvem. Os dados continuam seguros no aparelho.");
    }
}

window.addEventListener('online', () => {
    sincronizarFilaOfflineCampo(true);
});

async function encerrarImprevistosAbertosAoIniciarAtividade(nomeEquipe, gpsAtual = null) {
    if (!nomeEquipe) return;
    try {
        const imprevistosAbertos = (registrosSalvos || []).filter(r =>
            r.equipe === nomeEquipe &&
            r.desfecho === 'IMPREVISTO'
        );

        const horaFim = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

        await supabaseClient
            .from('registros_producao')
            .update({
                desfecho: "IMPREVISTO RESOLVIDO",
                h_saida: horaFim,
                gps_saida: gpsAtual || "Encerrado ao iniciar atividade"
            })
            .eq('equipe', nomeEquipe)
            .eq('desfecho', 'IMPREVISTO');

        if (imprevistosAbertos.length > 0) {
            imprevistosAbertos.forEach(imp => {
                imp.desfecho = "IMPREVISTO RESOLVIDO";
                imp.hSaida = horaFim;
            });
        }

        const boxImp = document.getElementById('box-imprevisto-ativo-campo');
        if (boxImp) boxImp.classList.add('hidden');
    } catch (e) {
        console.warn("Aviso ao encerrar imprevisto automaticamente:", e);
    }
}

function verificarHistoricoReincidenciaImovelCampo(codDigitado) {
    try {
        const codigo = (codDigitado || "").trim().toUpperCase();
        const inpImovel = document.getElementById('inp-imovel');
        if (!inpImovel) return null;

        let boxAlerta = document.getElementById('box-alerta-reincidencia-imovel');
        if (!boxAlerta) {
            boxAlerta = document.createElement('div');
            boxAlerta.id = 'box-alerta-reincidencia-imovel';
            boxAlerta.className = 'mt-1.5 p-2.5 rounded-xl border text-[11px] hidden space-y-1';
            inpImovel.parentNode.appendChild(boxAlerta);
        }

        if (codigo.length < 3 || !Array.isArray(registrosSalvos)) {
            boxAlerta.classList.add('hidden');
            return null;
        }

        const historico = registrosSalvos.filter(r => {
            const codReg = (r.imovel || "").toUpperCase().trim();
            return (codReg === codigo || codReg.startsWith(codigo + " -")) &&
                   ['PENDENTE', 'MALOGRADA', 'CONCLUIDA'].includes(r.desfecho);
        });

        if (historico.length === 0) {
            boxAlerta.classList.add('hidden');
            return null;
        }

        const ultimo = historico[0];
        const opcoesStr = (Array.isArray(ultimo.malogros) && ultimo.malogros.length > 0) ? ultimo.malogros.join(' + ') : 'Sem ofensor marcado';
        const motivoStr = ultimo.motivoDesfecho || ultimo.observacoes || 'Sem observações detalhadas';

        if (ultimo.desfecho === 'PENDENTE' || ultimo.desfecho === 'MALOGRADA') {
            boxAlerta.className = 'mt-1.5 p-2.5 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-950 text-[11px] space-y-1 shadow-sm';
            boxAlerta.innerHTML = `
                <div class="font-black uppercase flex items-center justify-between">
                    <span>⚠️ Histórico de Reincidência (${ultimo.desfecho})</span>
                    <span class="text-[10px] font-mono bg-amber-200 px-1.5 py-0.5 rounded">${ultimo.dataRegistro}</span>
                </div>
                <div><b>Projeto:</b> ${ultimo.projeto} • <b>Técnico:</b> ${ultimo.equipe}</div>
                <div><b>Ofensor/Opção:</b> <span class="font-bold text-red-800">${opcoesStr}</span></div>
                <div class="italic text-[10px] bg-white p-1.5 rounded border border-amber-200">💬 "${motivoStr}"</div>
            `;
        } else {
            boxAlerta.className = 'mt-1.5 p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950 text-[11px] space-y-0.5';
            boxAlerta.innerHTML = `
                <div class="font-bold flex items-center justify-between">
                    <span>ℹ️ Imóvel com registro anterior CONCLUÍDO</span>
                    <span class="text-[10px] font-mono">${ultimo.dataRegistro}</span>
                </div>
                <div class="text-[10px]"><b>Projeto:</b> ${ultimo.projeto} • <b>Técnico:</b> ${ultimo.equipe}</div>
            `;
        }

        boxAlerta.classList.remove('hidden');
        return ultimo;
    } catch (e) {
        return null;
    }
}

// ================= BARRA DE INICIAR E ENCERRAR EXPEDIENTE (ITEM 02) =================
function atualizarBarraExpedienteCampo() {
    const nomeEq = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "";
    const boxExp = document.getElementById('box-controle-expediente-campo');
    if (!boxExp) return;

    if (!nomeEq || equipeAutenticadaSessao !== nomeEq) {
        boxExp.classList.add('hidden');
        return;
    }

    boxExp.classList.remove('hidden');
    const hojeISO = obterDataLocalISO();
    const info = (typeof telemetriaEquipes !== 'undefined' && telemetriaEquipes) ? telemetriaEquipes[nomeEq] : null;
    const turnoAtivoHoje = info && info.data === hojeISO && info.statusTurno === 'DISPONIVEL';
    const turnoEncerradoHoje = info && info.data === hojeISO && info.statusTurno === 'ENCERRADO';

    const dot = document.getElementById('dot-rastreio-campo');
    const lblStatus = document.getElementById('lbl-status-expediente-campo');
    const lblHoraIni = document.getElementById('lbl-hora-inicio-expediente');
    const lblInfoGps = document.getElementById('lbl-info-rastreio-gps');
    const btnIniciar = document.getElementById('btn-iniciar-expediente-campo');
    const btnEncerrar = document.getElementById('btn-encerrar-expediente-campo');

    if (turnoAtivoHoje) {
        boxExp.className = "p-3 rounded-xl border-2 border-emerald-400 bg-emerald-50/70 space-y-2";
        if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping inline-block";
        if (lblStatus) {
            lblStatus.className = "text-emerald-950 font-black";
            lblStatus.innerText = "🟢 Expediente Ativo (Em Rota)";
        }
        if (lblHoraIni) lblHoraIni.innerText = `Início: ${info.horaInicio || '--:--'}`;
        if (lblInfoGps) {
            lblInfoGps.className = "text-[10px] text-emerald-800 font-semibold leading-tight";
            lblInfoGps.innerText = `📡 Rastreamento GPS Ativo • Último envio: ${info.horaUltimoSinal || '--:--'} (${info.lat ? `${info.lat}, ${info.lng}` : 'Aguardando sinal'})`;
        }
        if (btnIniciar) btnIniciar.classList.add('hidden');
        if (btnEncerrar) btnEncerrar.classList.remove('hidden');

        if (!watchIdRastreioGps) {
            iniciarMonitoramentoContinuoGps(nomeEq);
        }
    } else if (turnoEncerradoHoje) {
        boxExp.className = "p-3 rounded-xl border-2 border-red-200 bg-red-50/50 space-y-2";
        if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-red-500 inline-block";
        if (lblStatus) {
            lblStatus.className = "text-red-900 font-black";
            lblStatus.innerText = "🔴 Expediente Encerrado Hoje";
        }
        if (lblHoraIni) lblHoraIni.innerText = `${info.horaInicio || '--:--'} às ${info.horaFim || '--:--'}`;
        if (lblInfoGps) {
            lblInfoGps.className = "text-[10px] text-red-700 leading-tight";
            lblInfoGps.innerText = `Turno finalizado às ${info.horaFim || '--:--'}. Caso precise retornar à rota hoje, clique abaixo para reativar.`;
        }
        if (btnIniciar) {
            btnIniciar.innerText = "🟢 Reativar Expediente / Voltar para Rota";
            btnIniciar.classList.remove('hidden');
        }
        if (btnEncerrar) btnEncerrar.classList.add('hidden');
    } else {
        boxExp.className = "p-3 rounded-xl border-2 border-slate-200 bg-slate-50 space-y-2";
        if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-slate-400 inline-block";
        if (lblStatus) {
            lblStatus.className = "text-slate-800 font-black";
            lblStatus.innerText = "⚪ Expediente Não Iniciado";
        }
        if (lblHoraIni) lblHoraIni.innerText = "Início: --:--";
        if (lblInfoGps) {
            lblInfoGps.className = "text-[10px] text-slate-500 leading-tight";
            lblInfoGps.innerText = "Clique abaixo ao sair para campo para ficar Disponível no painel e transmitir sua posição em rota.";
        }
        if (btnIniciar) {
            btnIniciar.innerText = "🟢 Iniciar Expediente / Ficar Disponível em Rota";
            btnIniciar.classList.remove('hidden');
        }
        if (btnEncerrar) btnEncerrar.classList.add('hidden');
    }
}

async function capturarEEnviarPosicaoRastreio(nomeEq, exibirAlertaErro = false) {
    if (!nomeEq) return null;
    try {
        const coordStr = await capturarGpsReal(10000);
        const partes = coordStr.split(',').map(s => parseFloat(s.trim()));
        if (partes.length === 2 && !isNaN(partes[0]) && !isNaN(partes[1])) {
            ultimaCoordRastreioCache = { lat: partes[0], lng: partes[1] };
            await registrarPontoTelemetriaEquipe(nomeEq, partes[0], partes[1]);
            return coordStr;
        }
    } catch (e) {
        if (exibirAlertaErro) {
            alert("⚠️ Não foi possível obter o sinal de GPS. Verifique se a Localização do celular está ativada.");
        }
    }
    return null;
}

async function registrarPontoTelemetriaEquipe(nomeEq, lat, lng, statusCustom = null) {
    if (!nomeEq) return;
    const hojeISO = obterDataLocalISO();
    const horaAgora = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const anterior = (telemetriaEquipes[nomeEq] && telemetriaEquipes[nomeEq].data === hojeISO) ? telemetriaEquipes[nomeEq] : {};

    const novoObjeto = {
        equipe: nomeEq,
        data: hojeISO,
        statusTurno: statusCustom || anterior.statusTurno || 'DISPONIVEL',
        horaInicio: anterior.horaInicio || horaAgora,
        horaFim: statusCustom === 'ENCERRADO' ? horaAgora : (anterior.horaFim || null),
        lat: lat !== null && lat !== undefined ? Number(Number(lat).toFixed(6)) : (anterior.lat || null),
        lng: lng !== null && lng !== undefined ? Number(Number(lng).toFixed(6)) : (anterior.lng || null),
        horaUltimoSinal: horaAgora,
        timestampUltimoSinal: Date.now()
    };

    telemetriaEquipes[nomeEq] = novoObjeto;
    await sincronizarTelemetriaNaNuvem(nomeEq, novoObjeto);
    atualizarBarraExpedienteCampo();
}

function iniciarMonitoramentoContinuoGps(nomeEq) {
    pararMonitoramentoContinuoGps();
    if (!navigator.geolocation || !nomeEq) return;

    ativarWakeLockTela();

    watchIdRastreioGps = navigator.geolocation.watchPosition(
        (pos) => {
            const lat = Number(pos.coords.latitude.toFixed(6));
            const lng = Number(pos.coords.longitude.toFixed(6));
            ultimaCoordRastreioCache = { lat, lng };
        },
        (err) => {
            console.warn("Aviso watchPosition:", err);
        },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    timerEnvioRastreioGps = setInterval(async () => {
        const eqAtual = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao;
        const info = eqAtual ? telemetriaEquipes[eqAtual] : null;
        if (!eqAtual || !info || info.statusTurno !== 'DISPONIVEL') {
            pararMonitoramentoContinuoGps();
            return;
        }
        if (ultimaCoordRastreioCache) {
            await registrarPontoTelemetriaEquipe(eqAtual, ultimaCoordRastreioCache.lat, ultimaCoordRastreioCache.lng, 'DISPONIVEL');
        } else {
            await capturarEEnviarPosicaoRastreio(eqAtual, false);
        }
    }, 60000);
}

function pararMonitoramentoContinuoGps() {
    if (watchIdRastreioGps !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRastreioGps);
        watchIdRastreioGps = null;
    }
    if (timerEnvioRastreioGps !== null) {
        clearInterval(timerEnvioRastreioGps);
        timerEnvioRastreioGps = null;
    }
    liberarWakeLockTela();
}

async function iniciarExpedienteRastreioCampo() {
    const nomeEq = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao;
    if (!nomeEq) {
        alert("⚠️ Selecione a sua Equipe / Técnico primeiro.");
        return;
    }

    const btn = document.getElementById('btn-iniciar-expediente-campo');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "📡 Capturando GPS e iniciando expediente...";
    }

    let latIni = null, lngIni = null;
    try {
        const coord = await capturarGpsReal(12000);
        const partes = coord.split(',').map(s => parseFloat(s.trim()));
        if (partes.length === 2 && !isNaN(partes[0])) {
            latIni = partes[0];
            lngIni = partes[1];
            ultimaCoordRastreioCache = { lat: latIni, lng: lngIni };
        }
    } catch (e) {
        alert("❌ Ative o GPS / Localização do celular para iniciar o expediente e ficar disponível em rota.");
        if (btn) {
            btn.disabled = false;
            btn.innerText = "🟢 Iniciar Expediente / Ficar Disponível em Rota";
        }
        return;
    }

    const hojeISO = obterDataLocalISO();
    const horaAgora = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    const dadosTurno = {
        equipe: nomeEq,
        data: hojeISO,
        statusTurno: 'DISPONIVEL',
        horaInicio: telemetriaEquipes[nomeEq]?.data === hojeISO && telemetriaEquipes[nomeEq]?.horaInicio ? telemetriaEquipes[nomeEq].horaInicio : horaAgora,
        horaFim: null,
        lat: latIni,
        lng: lngIni,
        horaUltimoSinal: horaAgora,
        timestampUltimoSinal: Date.now()
    };

    telemetriaEquipes[nomeEq] = dadosTurno;
    await sincronizarTelemetriaNaNuvem(nomeEq, dadosTurno);

    if (btn) {
        btn.disabled = false;
        btn.innerText = "🟢 Iniciar Expediente / Ficar Disponível em Rota";
    }

    iniciarMonitoramentoContinuoGps(nomeEq);
    atualizarBarraExpedienteCampo();
    alert(`🟢 Expediente iniciado às ${horaAgora}!\nVocê já consta como DISPONÍVEL EM ROTA no mapa da gestão.`);
}

async function encerrarExpedienteRastreioCampo() {
    if (encerrandoExpedienteEmCurso) return;

    const nomeEq = (document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "").trim().toUpperCase();
    if (!nomeEq) return;

    const posAberturaVisivel = !document.getElementById('bloco-pos-abertura')?.classList.contains('hidden');
    if (posAberturaVisivel) {
        alert("🚫 NÃO É PERMITIDO ENCERRAR O EXPEDIENTE!\n\nVocê possui uma atividade aberta na sua tela neste momento. Finalize e salve o atendimento (ou cancele a abertura) antes de encerrar o turno.");
        return;
    }

    const checarPendenciasLocais = () => (registrosSalvos || []).filter(r =>
        r.equipe === nomeEq &&
        r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
        r.projeto !== PROJETO_SOLIC_MATERIAL &&
        ['EM ANDAMENTO', 'PARALISADA', 'REABERTA', 'IMPREVISTO'].includes(r.desfecho)
    );

    let pendentes = checarPendenciasLocais();
    if (pendentes.length > 0) {
        const resumo = pendentes.map(p => `• ${p.imovel} (${p.desfecho})`).join('\n');
        alert(`🚫 ENCERRAMENTO DE EXPEDIENTE BLOQUEADO!\n\nVocê ainda possui ${pendentes.length} atividade(s) ou imprevisto(s) em aberto:\n\n${resumo}\n\nFinalize todas antes de encerrar o seu turno.`);
        return;
    }

    if (!confirm(`🔴 ENCERRAR EXPEDIENTE DO DIA\n\nConfirmar o encerramento do turno de hoje para ${nomeEq}?\nO compartilhamento de GPS em rota será desligado imediatamente.`)) {
        return;
    }

    encerrandoExpedienteEmCurso = true;
    ultimoDisparoGpsCampoTs = Date.now() + 60000;

    pararMonitoramentoContinuoGps();

    const btnEnc = document.getElementById('btn-encerrar-expediente-campo');
    if (btnEnc) {
        btnEnc.disabled = true;
        btnEnc.innerText = "🔴 Encerrando turno...";
    }

    try {
        if (typeof carregarRegistrosModoCampoLeve === 'function') {
            await Promise.race([
                carregarRegistrosModoCampoLeve(),
                new Promise(res => setTimeout(res, 2500))
            ]);
        }

        pendentes = checarPendenciasLocais();
        if (pendentes.length > 0) {
            const resumo = pendentes.map(p => `• ${p.imovel} (${p.desfecho})`).join('\n');
            alert(`🚫 ENCERRAMENTO BLOQUEADO!\n\nConsta(m) ${pendentes.length} atividade(s) em aberto na nuvem:\n\n${resumo}`);
            return;
        }

        let latFim = ultimaCoordRastreioCache?.lat || telemetriaEquipes[nomeEq]?.lat || null;
        let lngFim = ultimaCoordRastreioCache?.lng || telemetriaEquipes[nomeEq]?.lng || null;

        if (!latFim && typeof capturarCoordenadaGpsFrescaCampo === 'function') {
            const coordRapida = await Promise.race([
                capturarCoordenadaGpsFrescaCampo(1500),
                new Promise(res => setTimeout(() => res(null), 1500))
            ]);
            if (coordRapida) {
                latFim = coordRapida.lat;
                lngFim = coordRapida.lng;
            }
        }

        const hojeISO = obterDataLocalISO();
        const horaFim = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const anterior = (telemetriaEquipes[nomeEq] && telemetriaEquipes[nomeEq].data === hojeISO) ? telemetriaEquipes[nomeEq] : {};

        const dadosEncerramento = {
            equipe: nomeEq,
            data: hojeISO,
            statusTurno: 'ENCERRADO',
            horaInicio: anterior.horaInicio || horaFim,
            horaFim: horaFim,
            lat: latFim !== null ? Number(Number(latFim).toFixed(6)) : (anterior.lat || null),
            lng: lngFim !== null ? Number(Number(lngFim).toFixed(6)) : (anterior.lng || null),
            horaUltimoSinal: horaFim,
            timestampUltimoSinal: Date.now()
        };

        telemetriaEquipes[nomeEq] = dadosEncerramento;
        atualizarBarraExpedienteCampo();

        await sincronizarTelemetriaNaNuvem(nomeEq, dadosEncerramento);
        atualizarBarraExpedienteCampo();

        alert(`🔴 Expediente encerrado com sucesso às ${horaFim}! Bom descanso.`);
    } catch (e) {
        console.warn("Aviso ao encerrar expediente:", e);
        atualizarBarraExpedienteCampo();
    } finally {
        encerrandoExpedienteEmCurso = false;
        if (btnEnc) {
            btnEnc.disabled = false;
            btnEnc.innerText = "🔴 Encerrar Expediente do Dia";
        }
    }
}

// ================= COMPRESSÃO ULTRA-LEVE DE IMAGENS (MODO GALERIA) =================
function comprimirImagemBase64(file, maxWidth = 720, quality = 0.58) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error("Arquivo inválido"));
            return;
        }

        const blobUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = function() {
            URL.revokeObjectURL(blobUrl);

            try {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxWidth) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxWidth) / height);
                        height = maxWidth;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);

                ctx.clearRect(0, 0, width, height);
                canvas.width = 1;
                canvas.height = 1;
                img.src = "";

                resolve(dataUrl);
            } catch (err) {
                reject(err);
            }
        };

        img.onerror = function(err) {
            URL.revokeObjectURL(blobUrl);
            reject(err);
        };

        img.src = blobUrl;
    });
}

async function aoSelecionarFotosBloco(idx, inputEl) {
    lerDadosBlocosDaTela();
    const arquivos = Array.from(inputEl.files || []);
    if (arquivos.length === 0) return;

    const bloco = dadosAtendimento.blocos[idx];
    if (!bloco.fotos) bloco.fotos = [];

    if (bloco.fotos.length + arquivos.length > 10) {
        alert("⚠️ Você pode anexar no máximo 10 fotos por bloco.");
        inputEl.value = "";
        return;
    }

    for (const arq of arquivos) {
        try {
            const base64Comprimida = await comprimirImagemBase64(arq, 720, 0.58);
            bloco.fotos.push(base64Comprimida);
        } catch (e) {
            console.warn("Erro ao processar foto:", e);
        }
    }

    inputEl.value = "";
    renderizarBlocosCampo();
    salvarRascunhoCampo();
}

function removerFotoBloco(idxBloco, idxFoto) {
    lerDadosBlocosDaTela();
    const bloco = dadosAtendimento.blocos[idxBloco];
    if (bloco && Array.isArray(bloco.fotos)) {
        bloco.fotos.splice(idxFoto, 1);
        renderizarBlocosCampo();
        salvarRascunhoCampo();
    }
}

function abrirZoomFoto(srcBase64, nomeArquivo = "foto_gpd.jpg") {
    const modal = document.getElementById('modal-zoom-foto');
    const img = document.getElementById('img-zoom-alvo');
    const btnDown = document.getElementById('btn-download-zoom-foto');
    const lbl = document.getElementById('lbl-titulo-zoom-foto');
    if (!modal || !img) return;

    img.src = srcBase64;
    btnDown.href = srcBase64;
    btnDown.download = nomeArquivo;
    lbl.innerText = `📷 ${nomeArquivo}`;
    modal.classList.remove('hidden');
}

function fecharZoomFoto() {
    document.getElementById('modal-zoom-foto').classList.add('hidden');
}

function baixarFotoDireto(srcBase64, nomeArquivo) {
    const a = document.createElement('a');
    a.href = srcBase64;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
// ================= SUB-ABAS DO MODO CAMPO (ATENDIMENTO vs MINHAS ATIVIDADES) =================

function mudarSubAbaCampo(aba) {
    const vLanc = document.getElementById('subview-campo-lancamento');
    const vPainel = document.getElementById('subview-campo-painel');
    const btnLanc = document.getElementById('btn-aba-campo-lancamento');
    const btnPainel = document.getElementById('btn-aba-campo-painel');

    if (!vLanc || !vPainel) return;

    if (aba === 'painel') {
        vLanc.classList.add('hidden');
        vPainel.classList.remove('hidden');
        if (btnPainel) btnPainel.className = "py-2 px-3 rounded-lg font-bold text-xs transition bg-blue-900 text-white shadow-sm flex items-center justify-center gap-1.5";
        if (btnLanc) btnLanc.className = "py-2 px-3 rounded-lg font-bold text-xs transition bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1.5";
        atualizarAbaMinhasAtividadesCampo(false);
    } else {
        vPainel.classList.add('hidden');
        vLanc.classList.remove('hidden');
        if (btnLanc) btnLanc.className = "py-2 px-3 rounded-lg font-bold text-xs transition bg-blue-900 text-white shadow-sm flex items-center justify-center gap-1.5";
        if (btnPainel) btnPainel.className = "py-2 px-3 rounded-lg font-bold text-xs transition bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1.5";
        organizarTelaPrincipalEBotaoSuporteRodape();
    }
}

async function atualizarAbaMinhasAtividadesCampo(forcarRecarregamentoNuvem = false) {
    if (forcarRecarregamentoNuvem) {
        await carregarRegistrosModoCampoLeve();
    }

    renderizarResumoSolicitacoesCampo();

    const equipeSelecionada = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || "";
    const container = document.getElementById('lista-minhas-atividades-campo');
    const badgeQtd = document.getElementById('badge-qtd-minhas-ativ');

    if (!container) return;

    if (!equipeSelecionada) {
        if (badgeQtd) badgeQtd.innerText = "0";
        container.innerHTML = `
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center text-xs text-slate-500">
                🔒 Selecione a sua <b>Equipe / Técnico</b> e autentique seu PIN na aba "Atendimento" para visualizar e controlar todas as suas atividades no painel de gestão.
            </div>
        `;
        return;
    }

    const hojeISO = obterDataLocalISO();
    const meusRegistros = (registrosSalvos || []).filter(r =>
        (r.equipe === equipeSelecionada || extrairListaApoiosDoMembros(r.membros, r.equipe).includes(equipeSelecionada)) &&
        r.projeto !== 'IMPREVISTO / ATRASO' &&
        r.projeto !== PROJETO_SOLIC_COMBUSTIVEL &&
        r.projeto !== PROJETO_SOLIC_MATERIAL
    );

    const ativasPainel = meusRegistros.filter(r => ['EM ANDAMENTO', 'PARALISADA', 'REABERTA', 'PROGRAMADA'].includes(r.desfecho));
    const finalizadasHoje = meusRegistros.filter(r => r.dataRegistro === hojeISO && ['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(r.desfecho));

    if (badgeQtd) badgeQtd.innerText = ativasPainel.length;

    const ordemPrioridade = { 'EM ANDAMENTO': 1, 'PARALISADA': 2, 'REABERTA': 3, 'PROGRAMADA': 4 };
    ativasPainel.sort((a, b) => (ordemPrioridade[a.desfecho] || 9) - (ordemPrioridade[b.desfecho] || 9));

    let html = "";

    if (ativasPainel.length === 0) {
        html += `
            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center text-xs text-emerald-900 font-semibold">
                ✅ Você não possui atividades pendentes, programadas ou em aberto na fila do painel neste momento.
            </div>
        `;
    } else {
        html += `<div class="text-[11px] font-black text-slate-700 uppercase px-1">🔥 Ativas / Na Fila do Painel (${ativasPainel.length})</div>`;
        ativasPainel.forEach(r => {
            const corBadge = obterClasseCorDesfecho(r.desfecho);
            const qtdB = r.qtdBlocosProgramados || 1;
            const ehApoio = r.equipe !== equipeSelecionada;
            let btnAcao = "";

            if (ehApoio) {
                btnAcao = `<span class="bg-purple-100 text-purple-900 font-bold text-[10px] px-2.5 py-1 rounded">🤝 Em Apoio a ${r.equipe}</span>`;
            } else if (r.desfecho === 'PROGRAMADA') {
                btnAcao = `<button type="button" onclick="mudarSubAbaCampo('lancamento'); iniciarAtividadeProgramadaCampo(${r.id})" title="Capturar GPS e iniciar esta atividade programada" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">🚀 Iniciar Agora</button>`;
            } else if (r.desfecho === 'REABERTA') {
                btnAcao = `<button type="button" onclick="mudarSubAbaCampo('lancamento'); retomarAtividadeReabertaCampo(${r.id})" title="Abrir atividade liberada pelo gestor para edição" class="bg-purple-700 hover:bg-purple-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">✏️ Editar Reaberta</button>`;
            } else if (r.desfecho === 'EM ANDAMENTO' || r.desfecho === 'PARALISADA') {
                btnAcao = `<button type="button" onclick="mudarSubAbaCampo('lancamento'); retomarAtividadeEmAndamentoOuParalisadaNuvem(${r.id})" title="Retomar o preenchimento desta atividade em andamento" class="bg-blue-800 hover:bg-blue-900 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">▶️ Abrir / Continuar</button>`;
            }

            html += `
                <div class="bg-white p-3 rounded-xl border-2 border-slate-200 shadow-sm space-y-1.5">
                    <div class="flex justify-between items-start gap-2">
                        <div>
                            <span class="font-black text-blue-950 text-xs">🏢 ${r.imovel}</span>
                            <span class="ml-1 bg-blue-50 text-blue-900 border border-blue-200 px-1.5 py-0.5 rounded text-[9px] font-bold">${r.projeto}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold ${corBadge}">${r.desfecho}</span>
                    </div>
                    <div class="text-[11px] text-slate-600">📍 ${r.endereco || 'Endereço a confirmar'}</div>
                    <div class="flex justify-between items-center pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                        <span>📅 ${r.dataRegistro} • Blocos: <b>${qtdB}</b> ${r.tempoPausadoMinutos > 0 ? `• ⏸️ Pausa: <b>${r.tempoPausadoMinutos}m</b>` : ''}</span>
                        ${btnAcao}
                    </div>
                </div>
            `;
        });
    }

    if (finalizadasHoje.length > 0) {
        html += `<div class="text-[11px] font-black text-slate-700 uppercase px-1 pt-3 border-t border-slate-200">✔️ Finalizadas por Você Hoje (${finalizadasHoje.length})</div>`;
        finalizadasHoje.forEach(r => {
            const corBadge = obterClasseCorDesfecho(r.desfecho);
            html += `
                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center gap-2 text-xs">
                    <div>
                        <div class="font-bold text-slate-800">🏢 ${r.imovel} <span class="text-[10px] font-normal text-slate-500">(${r.projeto})</span></div>
                        <div class="text-[10px] text-slate-500">🕒 ${r.hEntrada} às ${r.hSaida} ${r.tempoPausadoMinutos > 0 ? `• ⏸️ ${r.tempoPausadoMinutos}m pausa` : ''}</div>
                    </div>
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold ${corBadge}">${r.desfecho}</span>
                </div>
            `;
        });
    }

    container.innerHTML = html;
}

// ================= RETOMADA E PARALISAÇÃO DE ATIVIDADES EM CAMPO =================
function retomarAtividadeEmAndamentoOuParalisadaNuvem(idReg) {
    if (dadosAtendimento.idEmAndamento && dadosAtendimento.idEmAndamento === idReg) {
        mudarSubAbaCampo('lancamento');
        return;
    }

    const r = (registrosSalvos || []).find(item => item.id === idReg);
    if (!r) return;

    encerrarImprevistosAbertosAoIniciarAtividade(r.equipe, r.gpsEntrada);
    atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
    document.getElementById('sel-projeto').value = r.projeto;
    document.getElementById('inp-imovel').value = r.imovel;

    dadosAtendimento.idEmAndamento = r.id;
    dadosAtendimento.eraReaberta = false;
    dadosAtendimento.eraProgramada = (r.motivoDesfecho || '').includes('[ORIGEM:PROGRAMADA]');
    dadosAtendimento.hEntrada = (r.hEntrada && r.hEntrada !== 'Programada') ? r.hEntrada : new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    dadosAtendimento.gpsEntrada = r.gpsEntrada || "Mantido da abertura";
    dadosAtendimento.minutosPausados = Number(r.tempoPausadoMinutos) || 0;
    dadosAtendimento.emPausa = (r.desfecho === 'PARALISADA');
    dadosAtendimento.inicioPausa = dadosAtendimento.emPausa ? Date.now() : null;
    dadosAtendimento.motivoPausaAtual = dadosAtendimento.emPausa ? (r.motivoDesfecho || 'Atividade paralisada') : '';

    const totalBlocos = Math.max(1, Math.min(20, Number(r.qtdBlocosProgramados) || 1));
    dadosAtendimento.blocos = [];
    for (let i = 1; i <= totalBlocos; i++) {
        const b = criarObjetoBlocoPadrao(i);
        if (r.andares) b.andares = r.andares;
        if (r.hps) b.hps = r.hps;
        if (r.observacoes && r.observacoes !== 'Em andamento') b.observacoes = r.observacoes;
        dadosAtendimento.blocos.push(b);
    }

    document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${r.projeto})`;
    document.getElementById('lbl-h-entrada').innerText = dadosAtendimento.hEntrada;
    document.getElementById('lbl-gps-entrada').innerText = dadosAtendimento.gpsEntrada;

    document.getElementById('form-endereco').value = r.endereco || '';
    document.getElementById('form-liberou-acesso').value = r.liberouAcesso || '';
    document.getElementById('form-responsavel').value = r.responsavel || '';
    document.getElementById('form-contato').value = r.contato || '';
    document.getElementById('form-email').value = r.email || '';
    document.getElementById('inp-qtd-blocos').value = totalBlocos;

    document.getElementById('form-campo-container').classList.add('hidden');
    document.getElementById('bloco-pos-abertura').classList.remove('hidden');

    mudarTipoProjeto();
    renderizarBlocosCampo();
    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
}

function sincronizarVisualPausaCampo() {
    const btnParalisar = document.getElementById('btn-paralisar-atividade');
    const bannerPausa = document.getElementById('banner-atividade-paralisada-ativa');
    const corpoForm = document.getElementById('corpo-formulario-blocos-campo');
    const lblStatus = document.getElementById('lbl-status-execucao-campo');
    const lblAcumulado = document.getElementById('lbl-tempo-pausado-acumulado');
    const dotStatus = document.getElementById('dot-status-execucao');

    if (lblAcumulado) {
        lblAcumulado.innerText = dadosAtendimento.minutosPausados > 0 ? `(⏸️ Pausas: ${dadosAtendimento.minutosPausados} min)` : "";
    }

    if (dadosAtendimento.emPausa) {
        if (btnParalisar) btnParalisar.classList.add('hidden');
        if (bannerPausa) bannerPausa.classList.remove('hidden');
        if (corpoForm) corpoForm.classList.add('opacity-50', 'pointer-events-none');
        if (lblStatus) lblStatus.innerText = "⏸️ ATIVIDADE PARALISADA";
        if (dotStatus) dotStatus.className = "inline-block w-2 h-2 rounded-full bg-orange-500 animate-ping";

        const horaPausa = dadosAtendimento.inicioPausa
            ? new Date(dadosAtendimento.inicioPausa).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
            : '--:--';
        const elHora = document.getElementById('lbl-hora-inicio-pausa');
        const elMot = document.getElementById('lbl-motivo-pausa-atual');
        if (elHora) elHora.innerText = `Desde ${horaPausa}`;
        if (elMot) elMot.innerText = `Motivo: ${dadosAtendimento.motivoPausaAtual || 'Não informado'}`;
    } else {
        if (btnParalisar) btnParalisar.classList.remove('hidden');
        if (bannerPausa) bannerPausa.classList.add('hidden');
        if (corpoForm) corpoForm.classList.remove('opacity-50', 'pointer-events-none');
        if (lblStatus) lblStatus.innerText = dadosAtendimento.eraReaberta ? "🔄 Editando Atividade Reaberta" : "Status: Em Andamento no Painel";
        if (dotStatus) dotStatus.className = "inline-block w-2 h-2 rounded-full bg-blue-600 animate-ping";
    }
}

async function paralisarAtividadeAtualCampo() {
    if (!dadosAtendimento.idEmAndamento) return;
    lerDadosBlocosDaTela();

    const motivo = prompt("⏸️ PARALISAR ATIVIDADE TEMPORARIAMENTE\n\nInforme o motivo da paralisação (Ex: Horário de almoço, chuva, aguardando síndico/material):");
    if (motivo === null) return;
    const motivoLimpo = motivo.trim() || "Paralisação temporária em campo";

    const agora = Date.now();
    const horaStr = new Date(agora).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    dadosAtendimento.emPausa = true;
    dadosAtendimento.inicioPausa = agora;
    dadosAtendimento.motivoPausaAtual = motivoLimpo;

    const endAtual = document.getElementById('form-endereco')?.value.trim() || '';
    const libAtual = document.getElementById('form-liberou-acesso')?.value.trim() || '';
    const tagEnd = endAtual ? `[END: ${endAtual}] ` : '';
    const tagLib = libAtual ? `[LIBEROU_ACESSO: ${libAtual}] ` : '';
    const tagPausa = `[PAUSA_INICIO: ${agora}] [PAUSA_TOTAL: ${dadosAtendimento.minutosPausados || 0}]`;

    await supabaseClient.from('registros_producao').update({
        desfecho: "PARALISADA",
        h_saida: "Paralisada",
        motivo_desfecho: `⏸️ Paralisada às ${horaStr}: ${motivoLimpo}`,
        observacoes: `${tagEnd}${tagLib}${tagPausa}`.trim()
    }).eq('id', dadosAtendimento.idEmAndamento);

    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
    await carregarRegistrosModoCampoLeve();
    atualizarAbaMinhasAtividadesCampo(false);
    alert(`⏸️ Atividade paralisada às ${horaStr}!\nSeus dados preenchidos estão salvos. Clique em "Retomar Atividade Agora" quando voltar ao serviço.`);
}

async function retomarAtividadeParalisadaCampo() {
    if (!dadosAtendimento.idEmAndamento || !dadosAtendimento.emPausa) return;

    const agora = Date.now();
    const inicio = dadosAtendimento.inicioPausa || agora;
    const minutosDestaPausa = Math.max(1, Math.round((agora - inicio) / 60000));

    dadosAtendimento.minutosPausados = (Number(dadosAtendimento.minutosPausados) || 0) + minutosDestaPausa;
    dadosAtendimento.emPausa = false;
    dadosAtendimento.inicioPausa = null;
    dadosAtendimento.motivoPausaAtual = "";

    const horaStr = new Date(agora).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const endAtual = document.getElementById('form-endereco')?.value.trim() || '';
    const libAtual = document.getElementById('form-liberou-acesso')?.value.trim() || '';
    const tagEnd = endAtual ? `[END: ${endAtual}] ` : '';
    const tagLib = libAtual ? `[LIBEROU_ACESSO: ${libAtual}] ` : '';
    const tagPausa = `[PAUSA_TOTAL: ${dadosAtendimento.minutosPausados}]`;

    await supabaseClient.from('registros_producao').update({
        desfecho: "EM ANDAMENTO",
        h_saida: "Em Andamento",
        motivo_desfecho: `▶️ Retomada às ${horaStr} (Pausa acumulada: ${dadosAtendimento.minutosPausados} min)`,
        observacoes: `${tagEnd}${tagLib}${tagPausa}`.trim()
    }).eq('id', dadosAtendimento.idEmAndamento);

    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
    await carregarRegistrosModoCampoLeve();
    atualizarAbaMinhasAtividadesCampo(false);
    alert(`▶️ Atividade retomada com sucesso!\nTempo desta pausa: ${minutosDestaPausa} min (Total acumulado: ${dadosAtendimento.minutosPausados} min).`);
}

// ================= BLOCOS DINÂMICOS E OPÇÃO "REDE GPON NÃO CONSTRUÍDA" =================
function criarObjetoBlocoPadrao(numero) {
    return {
        identificacao: `BLOCO ${numero}`,
        andares: "",
        hps: "",
        fusoes: 0,
        conectores: 0,
        caboRL: 0,
        caboDrop: 0,
        nap: 0,
        dio: 0,
        cxSobrepor: 0,
        cxEmbutida: 0,
        cxFosc: 0,
        desfecho: null,
        servicoObra: "SIM",
        concluidasOpcoes: [],
        obsConcluida: "",
        obsPendente: "",
        pendenciasOpcoes: [],
        obsMalograda: "",
        malogros: [],
        observacoes: "",
        fotos: []
    };
}

function lerDadosBlocosDaTela() {
    const qtd = dadosAtendimento.blocos.length;
    for (let i = 0; i < qtd; i++) {
        const b = dadosAtendimento.blocos[i];
        const elId = document.getElementById(`bloco-ident-${i}`);
        if (!elId) continue;
        b.identificacao = elId.value;
        b.andares = document.getElementById(`bloco-andares-${i}`)?.value || "";
        b.hps = document.getElementById(`bloco-hps-${i}`)?.value || "";
        b.fusoes = document.getElementById(`bloco-fusoes-${i}`)?.value || 0;
        b.conectores = document.getElementById(`bloco-conectores-${i}`)?.value || 0;
        b.caboRL = document.getElementById(`bloco-cabo-rl-${i}`)?.value || 0;
        b.caboDrop = document.getElementById(`bloco-cabo-drop-${i}`)?.value || 0;
        b.nap = document.getElementById(`bloco-nap-${i}`)?.value || 0;
        b.dio = document.getElementById(`bloco-dio-${i}`)?.value || 0;
        b.cxSobrepor = document.getElementById(`bloco-cx-sobrepor-${i}`)?.value || 0;
        b.cxEmbutida = document.getElementById(`bloco-cx-embutida-${i}`)?.value || 0;
        b.cxFosc = document.getElementById(`bloco-cx-fosc-${i}`)?.value || 0;
        b.servicoObra = document.getElementById(`bloco-servico-obra-${i}`)?.value || "SIM";
        b.obsConcluida = document.getElementById(`bloco-obs-conc-${i}`)?.value || "";
        b.obsPendente = document.getElementById(`bloco-obs-pend-${i}`)?.value || "";
        b.obsMalograda = document.getElementById(`bloco-obs-malo-${i}`)?.value || "";
        b.observacoes = document.getElementById(`bloco-observacoes-${i}`)?.value || "";

        const checksConc = document.querySelectorAll(`input[name="bloco-concluida-check-${i}"]:checked`);
        b.concluidasOpcoes = Array.from(checksConc).map(c => c.value);

        const checksPend = document.querySelectorAll(`input[name="bloco-pendencia-check-${i}"]:checked`);
        b.pendenciasOpcoes = Array.from(checksPend).map(c => c.value);

        const checksMalo = document.querySelectorAll(`input[name="bloco-malogro-check-${i}"]:checked`);
        b.malogros = Array.from(checksMalo).map(c => c.value);
    }
}

function alterarQuantidadeBlocos(novaQtd) {
    lerDadosBlocosDaTela();
    let qtd = parseInt(novaQtd, 10);
    if (isNaN(qtd) || qtd < 1) qtd = 1;
    if (qtd > 20) qtd = 20;
    document.getElementById('inp-qtd-blocos').value = qtd;

    while (dadosAtendimento.blocos.length < qtd) {
        dadosAtendimento.blocos.push(criarObjetoBlocoPadrao(dadosAtendimento.blocos.length + 1));
    }
    if (dadosAtendimento.blocos.length > qtd) {
        dadosAtendimento.blocos = dadosAtendimento.blocos.slice(0, qtd);
    }
    renderizarBlocosCampo();
    salvarRascunhoCampo();
}

function selecionarDesfechoBloco(idx, tipo) {
    lerDadosBlocosDaTela();
    if (dadosAtendimento.blocos[idx]) {
        dadosAtendimento.blocos[idx].desfecho = tipo;
    }
    renderizarBlocosCampo();
    salvarRascunhoCampo();
}

function renderizarBlocosCampo() {
    garantirOpcaoRedeGponNaoConstruida();
    const container = document.getElementById('container-blocos-dinamicos');
    if (!container) return;
    container.innerHTML = "";

    const qtdTotal = dadosAtendimento.blocos.length;

    const listaOpcoesConcluida = (typeof OPCOES_CONCLUIDA_PADRAO !== 'undefined' && Array.isArray(OPCOES_CONCLUIDA_PADRAO))
        ? [...OPCOES_CONCLUIDA_PADRAO]
        : [];
    if (!listaOpcoesConcluida.includes("REDE GPON NÃO CONSTRUÍDA")) {
        listaOpcoesConcluida.push("REDE GPON NÃO CONSTRUÍDA");
    }

    dadosAtendimento.blocos.forEach((b, idx) => {
        if (!b.fotos) b.fotos = [];
        if (!b.concluidasOpcoes) b.concluidasOpcoes = [];
        const mostrarIdentBloco = qtdTotal > 1;
        const d = b.desfecho;

        const btnConcClass = d === 'CONCLUIDA' ? 'ring-2 ring-offset-1 ring-emerald-700 bg-emerald-700 text-white' : 'bg-emerald-600/90 text-white opacity-80';
        const btnPendClass = d === 'PENDENTE' ? 'ring-2 ring-offset-1 ring-amber-600 bg-amber-600 text-white' : 'bg-amber-500/90 text-white opacity-80';
        const btnMaloClass = d === 'MALOGRADA' ? 'ring-2 ring-offset-1 ring-red-700 bg-red-700 text-white' : 'bg-red-600/90 text-white opacity-80';

        const checkboxesConcluidaHtml = listaOpcoesConcluida.map(op => {
            const checked = (b.concluidasOpcoes && b.concluidasOpcoes.includes(op)) ? 'checked' : '';
            const destaqueGpon = op === 'REDE GPON NÃO CONSTRUÍDA' ? 'font-black text-emerald-950 bg-emerald-100/80 px-1.5 py-0.5 rounded' : '';
            return `<label class="flex items-center gap-1.5 ${destaqueGpon}"><input type="checkbox" name="bloco-concluida-check-${idx}" value="${op}" ${checked}> ${op}</label>`;
        }).join('');

        const checkboxesPendenciaHtml = OPCOES_PENDENCIA_PADRAO.map(op => {
            const checked = (b.pendenciasOpcoes && b.pendenciasOpcoes.includes(op)) ? 'checked' : '';
            const destaque = op === 'REDE CORRETIVA' ? 'font-black text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded' : '';
            return `<label class="flex items-center gap-1.5 ${destaque}"><input type="checkbox" name="bloco-pendencia-check-${idx}" value="${op}" ${checked}> ${op}</label>`;
        }).join('');

        const checkboxesMalogroHtml = OPCOES_MALOGRO_PADRAO.map(ofensor => {
            const checked = (b.malogros && b.malogros.includes(ofensor)) ? 'checked' : '';
            const destaque = ofensor === 'REDE CORRETIVA' ? 'font-black text-red-900 bg-red-100/70 px-1.5 py-0.5 rounded' : '';
            return `<label class="flex items-center gap-1.5 ${destaque}"><input type="checkbox" name="bloco-malogro-check-${idx}" value="${ofensor}" ${checked}> ${ofensor}</label>`;
        }).join('');

        const miniaturasFotosHtml = b.fotos.map((fotoSrc, fIdx) => `
            <div class="relative group border border-slate-300 rounded-lg overflow-hidden w-16 h-16 bg-slate-100">
                <img src="${fotoSrc}" onclick="abrirZoomFoto('${fotoSrc}', 'Foto_${fIdx + 1}.jpg')" class="w-full h-full object-cover cursor-pointer">
                <button type="button" onclick="removerFotoBloco(${idx}, ${fIdx})" title="Remover esta foto" class="absolute top-0.5 right-0.5 bg-red-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">✕</button>
            </div>
        `).join('');

        const card = document.createElement('div');
        card.className = "bg-white p-3.5 rounded-xl border-2 border-blue-900/20 shadow-sm space-y-3";
        card.innerHTML = `
            <div class="flex justify-between items-center border-b border-slate-200 pb-2">
                <span class="bg-blue-900 text-white font-black text-[11px] px-2.5 py-1 rounded-md uppercase">
                    🏢 ${qtdTotal > 1 ? `Bloco ${idx + 1} de ${qtdTotal}` : 'Dados Técnicos do Bloco / Imóvel'}
                </span>
                ${mostrarIdentBloco ? `
                    <div class="flex items-center gap-1">
                        <span class="text-[10px] font-bold text-slate-600">Nome/Nº:</span>
                        <input type="text" id="bloco-ident-${idx}" value="${b.identificacao}" placeholder="Ex: BLOCO A" class="w-28 text-xs font-bold border border-blue-300 rounded px-2 py-1 uppercase text-blue-950 outline-none">
                    </div>
                ` : `<input type="hidden" id="bloco-ident-${idx}" value="${b.identificacao}">`}
            </div>

            <div class="grid grid-cols-2 gap-2 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
                <div>
                    <label class="block text-[11px] font-bold text-slate-800">Nº de Andares <span class="text-red-600">*</span></label>
                    <input type="number" id="bloco-andares-${idx}" value="${b.andares}" min="1" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white outline-none" placeholder="Obrigatório">
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-800">Nº de HPs <span class="text-red-600">*</span></label>
                    <input type="number" id="bloco-hps-${idx}" value="${b.hps}" min="1" class="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white outline-none" placeholder="Obrigatório">
                </div>
            </div>

            <div class="space-y-2 pt-1">
                <h4 class="text-[10px] font-bold text-blue-900 uppercase">Materiais e Caixas (${qtdTotal > 1 ? b.identificacao : 'Rede MDU'})</h4>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="block text-[10px] font-semibold text-slate-600">Fusões</label><input type="number" id="bloco-fusoes-${idx}" value="${b.fusoes}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                    <div><label class="block text-[10px] font-semibold text-slate-600">Conectores</label><input type="number" id="bloco-conectores-${idx}" value="${b.conectores}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="block text-[10px] font-semibold text-slate-600">Cabo RL (m)</label><input type="number" id="bloco-cabo-rl-${idx}" value="${b.caboRL}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                    <div><label class="block text-[10px] font-semibold text-slate-600">Cabo Drop (m)</label><input type="number" id="bloco-cabo-drop-${idx}" value="${b.caboDrop}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="block text-[10px] font-semibold text-slate-600">NAP</label><input type="number" id="bloco-nap-${idx}" value="${b.nap}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                    <div><label class="block text-[10px] font-semibold text-slate-600">DIO</label><input type="number" id="bloco-dio-${idx}" value="${b.dio}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                </div>
                <div class="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                    <div><label class="block text-[9px] font-semibold text-slate-600">Cx. Sobrepor</label><input type="number" id="bloco-cx-sobrepor-${idx}" value="${b.cxSobrepor}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                    <div><label class="block text-[9px] font-semibold text-slate-600">Cx. Embutida</label><input type="number" id="bloco-cx-embutida-${idx}" value="${b.cxEmbutida}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                    <div><label class="block text-[9px] font-semibold text-slate-600">Cx. FOSC</label><input type="number" id="bloco-cx-fosc-${idx}" value="${b.cxFosc}" class="w-full text-xs border rounded-lg p-1.5 outline-none"></div>
                </div>
            </div>

            <div class="space-y-2 pt-2 border-t border-slate-200">
                <label class="block text-[11px] font-bold text-slate-800 uppercase">Desfecho ${qtdTotal > 1 ? `deste Bloco` : `da Atividade`}: <span class="text-red-600">*</span></label>
                <div class="grid grid-cols-3 gap-2">
                    <button type="button" onclick="selecionarDesfechoBloco(${idx}, 'CONCLUIDA')" title="Marcar este bloco como Concluído" class="${btnConcClass} font-bold p-2 rounded-lg text-[11px] transition">CONCLUÍDA</button>
                    <button type="button" onclick="selecionarDesfechoBloco(${idx}, 'PENDENTE')" title="Marcar este bloco como Pendente" class="${btnPendClass} font-bold p-2 rounded-lg text-[11px] transition">PENDENTE</button>
                    <button type="button" onclick="selecionarDesfechoBloco(${idx}, 'MALOGRADA')" title="Marcar este bloco como Malogrado" class="${btnMaloClass} font-bold p-2 rounded-lg text-[11px] transition">MALOGRADA</button>
                </div>

                <div class="${d === 'CONCLUIDA' ? '' : 'hidden'} space-y-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <label class="block text-[11px] font-bold text-emerald-900">Houve Serviço de Obra?</label>
                    <select id="bloco-servico-obra-${idx}" class="w-full text-xs border border-emerald-300 rounded-lg p-2 bg-white outline-none">
                        <option value="SIM" ${b.servicoObra === 'SIM' ? 'selected' : ''}>SIM</option>
                        <option value="NÃO" ${b.servicoObra === 'NÃO' ? 'selected' : ''}>NÃO</option>
                    </select>
                    <label class="block text-[11px] font-bold text-emerald-900 mt-1">Itens Verificados / Entregues (Marcação Múltipla):</label>
                    <div class="grid grid-cols-1 gap-1 text-[11px] bg-white p-2 rounded-lg border border-emerald-200">
                        ${checkboxesConcluidaHtml}
                    </div>
                    <label class="block text-[11px] font-semibold text-emerald-900">Informação Complementar (Opcional)</label>
                    <input type="text" id="bloco-obs-conc-${idx}" value="${b.obsConcluida}" class="w-full text-xs border border-emerald-300 rounded-lg p-2 bg-white" placeholder="Detalhe opcional...">
                </div>

                <div class="${d === 'PENDENTE' ? '' : 'hidden'} space-y-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <label class="block text-[11px] font-bold text-amber-900">Selecione a(s) Opção(ões) da Pendência (Marcação Múltipla):*</label>
                    <div class="grid grid-cols-1 gap-1 text-[11px] bg-white p-2 rounded-lg border border-amber-200 max-h-36 overflow-y-auto">
                        ${checkboxesPendenciaHtml}
                    </div>
                    <label class="block text-[11px] font-bold text-amber-900 mt-1">Descrição / Motivo da Pendência (Obrigatório)*</label>
                    <textarea id="bloco-obs-pend-${idx}" rows="2" class="w-full text-xs border border-amber-300 rounded-lg p-2 bg-white" placeholder="Descreva o motivo...">${b.obsPendente}</textarea>
                </div>

                <div class="${d === 'MALOGRADA' ? '' : 'hidden'} space-y-2 bg-red-50 p-2.5 rounded-xl border border-red-200">
                    <label class="block text-[11px] font-bold text-red-900">Selecione o(s) Ofensor(es) / Malogro(s) (Marcação Múltipla):*</label>
                    <div class="grid grid-cols-1 gap-1 text-[11px] bg-white p-2 rounded-lg border border-red-200 max-h-40 overflow-y-auto">
                        ${checkboxesMalogroHtml}
                    </div>
                    <label class="block text-[11px] font-bold text-red-900 mt-1">Descrição / Motivo do Malogro (Obrigatório)*</label>
                    <textarea id="bloco-obs-malo-${idx}" rows="2" class="w-full text-xs border border-red-300 rounded-lg p-2 bg-white" placeholder="Descreva o motivo...">${b.obsMalograda}</textarea>
                </div>
            </div>

            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                <div class="flex justify-between items-center">
                    <label class="text-[11px] font-bold text-blue-950 flex items-center gap-1">📷 Fotos da Galeria (${b.fotos.length}/10)</label>
                    <label title="Selecionar fotos direto da Galeria ou Arquivos (otimizado para 4G)" class="bg-blue-900 hover:bg-blue-950 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer shadow-sm transition">
                        📂 + Anexar da Galeria
                        <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png" multiple onchange="aoSelecionarFotosBloco(${idx}, this)" class="hidden">
                    </label>
                </div>
                ${b.fotos.length > 0 ? `<div class="flex flex-wrap gap-2 pt-1">${miniaturasFotosHtml}</div>` : `<p class="text-[10px] text-slate-400">Nenhuma foto anexada neste bloco (Máx. 10 fotos).</p>`}
            </div>

            <div>
                <label class="block text-[11px] font-semibold text-slate-600">Observações Gerais ${qtdTotal > 1 ? `(${b.identificacao})` : ''}</label>
                <textarea id="bloco-observacoes-${idx}" rows="2" class="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none" placeholder="Ocorrências...">${b.observacoes}</textarea>
            </div>
        `;
        container.appendChild(card);
    });
    forcarInputsFotoApenasGaleria();
}

// ================= RASCUNHO, SELEÇÃO DE EQUIPE, CHECK-IN E SALVAMENTO COMPLETO =================
function salvarRascunhoCampo() {
    try {
        const posAberturaVisivel = !document.getElementById('bloco-pos-abertura').classList.contains('hidden');
        if (posAberturaVisivel) {
            lerDadosBlocosDaTela();
        }
        const rascunho = {
            emAndamento: posAberturaVisivel,
            idEmAndamento: dadosAtendimento.idEmAndamento,
            eraReaberta: dadosAtendimento.eraReaberta || false,
            eraProgramada: dadosAtendimento.eraProgramada || false,
            emPausa: dadosAtendimento.emPausa || false,
            inicioPausa: dadosAtendimento.inicioPausa || null,
            motivoPausaAtual: dadosAtendimento.motivoPausaAtual || "",
            minutosPausados: dadosAtendimento.minutosPausados || 0,
            equipe: document.getElementById('sel-equipe')?.value || '',
            projeto: document.getElementById('sel-projeto')?.value || '',
            imovel: document.getElementById('inp-imovel')?.value || '',
            hEntrada: document.getElementById('lbl-h-entrada')?.innerText || '',
            gpsEntrada: dadosAtendimento.gpsEntrada,
            endereco: document.getElementById('form-endereco')?.value || '',
            liberouAcesso: document.getElementById('form-liberou-acesso')?.value || '',
            responsavel: document.getElementById('form-responsavel')?.value || '',
            contato: document.getElementById('form-contato')?.value || '',
            email: document.getElementById('form-email')?.value || '',
            qtdBlocos: document.getElementById('inp-qtd-blocos')?.value || 1,
            blocos: dadosAtendimento.blocos
        };
        localStorage.setItem('gpd_rascunho_campo_ativo', JSON.stringify(rascunho));
    } catch (e) {
        console.warn("Aviso ao salvar rascunho local:", e);
    }
}

function atualizarProjetosPermitidosCampo(nomeEquipe, projetoPreSelecionado = null) {
    const selProj = document.getElementById('sel-projeto');
    const badgeSetor = document.getElementById('badge-setor-campo');
    if (!selProj) return;

    if (!nomeEquipe) {
        selProj.innerHTML = `<option value="">Selecione primeiro o técnico acima...</option>`;
        if (badgeSetor) {
            badgeSetor.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600";
            badgeSetor.innerText = "Selecione o técnico";
        }
        return;
    }

    if (!TODOS_OS_PROJETOS || TODOS_OS_PROJETOS.length === 0) {
        if (typeof reconstruirMapasDeProjetosDinamicos === "function") {
            reconstruirMapasDeProjetosDinamicos(false);
        }
    }

    const eqObj = (equipesSistema || []).find(e => e.nome === nomeEquipe);
    const setoresArr = obterArraySetores(eqObj ? eqObj.setor : "Instalador");
    let listaProjetos = obterProjetosPermitidosParaSetores(setoresArr);
    if (!listaProjetos || listaProjetos.length === 0) {
        listaProjetos = TODOS_OS_PROJETOS.length > 0 ? TODOS_OS_PROJETOS : ["VISTORIA", "CONSTRUÇÃO F", "CONSTRUÇÃO ON GOING"];
    }

    if (badgeSetor) {
        badgeSetor.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 border border-indigo-300";
        badgeSetor.innerText = `Grupos: ${setoresArr.join(' + ')}`;
    }

    if (setoresArr.length > 1) {
        selProj.innerHTML = setoresArr.map(s => {
            const projs = PROJETOS_POR_SETOR[s] || [];
            return `<optgroup label="Função: ${s.toUpperCase()}">${projs.map(p => `<option value="${p}">${p} (${obterMacroGrupoProjeto(p)})</option>`).join('')}</optgroup>`;
        }).join('');
    } else {
        selProj.innerHTML = listaProjetos.map(p => `<option value="${p}">${p} (${obterMacroGrupoProjeto(p)})</option>`).join('');
    }

    const projNorm = projetoPreSelecionado ? normalizarNomeProjeto(projetoPreSelecionado) : null;
    if (projNorm && listaProjetos.includes(projNorm)) {
        selProj.value = projNorm;
    } else if (projNorm) {
        selProj.innerHTML += `<option value="${projNorm}">${projNorm}</option>`;
        selProj.value = projNorm;
    } else if (listaProjetos.length > 0) {
        selProj.value = listaProjetos[0];
    }
    mudarTipoProjeto();
}

function restaurarRascunhoCampo() {
    try {
        renderizarBannerFilaOfflineCampo();
        organizarTelaPrincipalEBotaoSuporteRodape();
        const salvo = localStorage.getItem('gpd_rascunho_campo_ativo');
        if (!salvo) {
            if (equipeAutenticadaSessao) {
                const selEq = document.getElementById('sel-equipe');
                if (selEq) selEq.value = equipeAutenticadaSessao;
                document.getElementById('current-user-team').innerText = equipeAutenticadaSessao;
                atualizarProjetosPermitidosCampo(equipeAutenticadaSessao);
                atualizarBarraSegurancaPinCampo();
                atualizarBarraExpedienteCampo();
                renderizarResumoSolicitacoesCampo();
            }
            return;
        }
        const r = JSON.parse(salvo);

        if (r && r.equipe) {
            const selEq = document.getElementById('sel-equipe');
            if (selEq) selEq.value = r.equipe;
            document.getElementById('current-user-team').innerText = r.equipe;
            equipeAutenticadaSessao = r.equipe;
            sessionStorage.setItem('gpd_equipe_autenticada_pin', r.equipe);
            atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
            atualizarBarraSegurancaPinCampo();
            atualizarBarraExpedienteCampo();
            renderizarResumoSolicitacoesCampo();
        }
        if (r && r.imovel) document.getElementById('inp-imovel').value = r.imovel;

        if (r && r.emAndamento) {
            dadosAtendimento.idEmAndamento = r.idEmAndamento || null;
            dadosAtendimento.eraReaberta = r.eraReaberta || false;
            dadosAtendimento.eraProgramada = r.eraProgramada || false;
            dadosAtendimento.emPausa = r.emPausa || false;
            dadosAtendimento.inicioPausa = r.inicioPausa || null;
            dadosAtendimento.motivoPausaAtual = r.motivoPausaAtual || "";
            dadosAtendimento.minutosPausados = Number(r.minutosPausados) || 0;
            dadosAtendimento.hEntrada = r.hEntrada;
            dadosAtendimento.gpsEntrada = r.gpsEntrada;
            dadosAtendimento.blocos = (Array.isArray(r.blocos) && r.blocos.length > 0) ? r.blocos : [criarObjetoBlocoPadrao(1)];

            const projAberto = document.getElementById('sel-projeto').value || normalizarNomeProjeto(r.projeto);
            document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${projAberto})`;
            document.getElementById('lbl-h-entrada').innerText = r.hEntrada || '-';
            document.getElementById('lbl-gps-entrada').innerText = r.gpsEntrada || '-';

            document.getElementById('form-endereco').value = r.endereco || '';
            if (document.getElementById('form-liberou-acesso')) {
                document.getElementById('form-liberou-acesso').value = r.liberouAcesso || '';
            }
            document.getElementById('form-responsavel').value = r.responsavel || '';
            document.getElementById('form-contato').value = r.contato || '';
            document.getElementById('form-email').value = r.email || '';
            document.getElementById('inp-qtd-blocos').value = dadosAtendimento.blocos.length;

            document.getElementById('form-campo-container').classList.add('hidden');
            document.getElementById('bloco-pos-abertura').classList.remove('hidden');
            mudarTipoProjeto();
            renderizarBlocosCampo();
            sincronizarVisualPausaCampo();
        }
    } catch (e) {
        console.warn("Rascunho inválido limpo automaticamente:", e);
        localStorage.removeItem('gpd_rascunho_campo_ativo');
    }
}

async function cancelarCheckinAberto() {
    if (!confirm("Deseja realmente cancelar a abertura atual e retornar ao seu perfil no Modo Campo?")) return;

    const idAtivo = dadosAtendimento.idEmAndamento;
    if (idAtivo) {
        const regNuvem = (registrosSalvos || []).find(r => r.id === idAtivo);
        const veioDeProgramada = dadosAtendimento.eraProgramada ||
            (regNuvem && ((regNuvem.motivoDesfecho || '').includes('[ORIGEM:PROGRAMADA]') || (regNuvem.motivoDesfecho || '').includes('programada iniciada')));

        if (dadosAtendimento.eraReaberta) {
            await supabaseClient.from('registros_producao').update({
                desfecho: "REABERTA"
            }).eq('id', idAtivo);
        } else if (veioDeProgramada) {
            await supabaseClient.from('registros_producao').update({
                desfecho: "PROGRAMADA",
                h_entrada: "Programada",
                h_saida: "Aguardando",
                gps_entrada: "Carga Gestor",
                motivo_desfecho: "Carga Programada (Retornada à fila pelo técnico)"
            }).eq('id', idAtivo);
        } else {
            await supabaseClient.from('registros_producao').delete().eq('id', idAtivo);
        }
    }

    resetarFormularioCampo();
    await carregarRegistrosModoCampoLeve();
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(false);
    atualizarAbaMinhasAtividadesCampo(false);
}

// ITEM 02 RESTAURADO: Ao selecionar a equipe e autenticar o PIN, exibe imediatamente a barra de Iniciar e Encerrar Expediente!
function aoSelecionarEquipeCampo() {
    const selEq = document.getElementById('sel-equipe');
    const eq = selEq ? selEq.value : "";

    if (!eq) {
        pararMonitoramentoContinuoGps();
        equipeAutenticadaSessao = "";
        sessionStorage.removeItem('gpd_equipe_autenticada_pin');
        document.getElementById('current-user-team').innerText = "Selecione Equipe";
        atualizarProjetosPermitidosCampo("");
        atualizarBarraSegurancaPinCampo();
        atualizarBarraExpedienteCampo();
        verificarImprevistoAtivoEquipeCampo();
        verificarPendenciasReabertasEProgramadasCampo(false);
        atualizarAbaMinhasAtividadesCampo(false);
        renderizarResumoSolicitacoesCampo();
        organizarTelaPrincipalEBotaoSuporteRodape();
        return;
    }

    const eqObj = (equipesSistema || []).find(e => e.nome === eq);
    const pinCorreto = obterPinDaEquipe(eqObj);

    if (equipeAutenticadaSessao !== eq) {
        const pinDigitado = prompt(`🔒 AUTENTICAÇÃO DO TÉCNICO\n\nOlá, ${eq}!\nDigite o seu PIN de 4 dígitos para acessar suas atividades:\n(Se for seu primeiro acesso, o PIN padrão é 1234)`);

        if (pinDigitado === null || pinDigitado.trim() !== pinCorreto) {
            if (pinDigitado !== null) {
                alert("❌ PIN incorreto! Acesso negado às atividades deste técnico.");
            }
            selEq.value = "";
            equipeAutenticadaSessao = "";
            sessionStorage.removeItem('gpd_equipe_autenticada_pin');
            document.getElementById('current-user-team').innerText = "Selecione Equipe";
            atualizarProjetosPermitidosCampo("");
            atualizarBarraSegurancaPinCampo();
            atualizarBarraExpedienteCampo();
            verificarImprevistoAtivoEquipeCampo();
            verificarPendenciasReabertasEProgramadasCampo(false);
            atualizarAbaMinhasAtividadesCampo(false);
            renderizarResumoSolicitacoesCampo();
            return;
        }

        equipeAutenticadaSessao = eq;
        sessionStorage.setItem('gpd_equipe_autenticada_pin', eq);
    }

    document.getElementById('current-user-team').innerText = eq;
    atualizarProjetosPermitidosCampo(eq);
    atualizarBarraSegurancaPinCampo();
    atualizarBarraExpedienteCampo();
    salvarRascunhoCampo();
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(true);
    atualizarAbaMinhasAtividadesCampo(false);
    renderizarResumoSolicitacoesCampo();
    popularOpcoesParceiroApoioCampo();
    verificarSolicitacoesApoioParaTitularCampo();
    organizarTelaPrincipalEBotaoSuporteRodape();
}

function desbloquearTrocaEquipeCampo() {
    const posAberturaVisivel = !document.getElementById('bloco-pos-abertura').classList.contains('hidden');
    if (posAberturaVisivel) {
        alert("⚠️ Você possui um atendimento aberto na tela. Finalize ou cancele o atendimento antes de trocar de técnico.");
        return;
    }
    if (!confirm("Deseja encerrar sua sessão atual e liberar a seleção para outro técnico?")) return;

    pararMonitoramentoContinuoGps();
    equipeAutenticadaSessao = "";
    parceiroApoioPreSelecionadoSuporte = "";
    sessionStorage.removeItem('gpd_equipe_autenticada_pin');
    localStorage.removeItem('gpd_rascunho_campo_ativo');
    const selEq = document.getElementById('sel-equipe');
    if (selEq) {
        selEq.disabled = false;
        selEq.value = "";
    }
    document.getElementById('current-user-team').innerText = "Selecione Equipe";
    atualizarProjetosPermitidosCampo("");
    atualizarBarraSegurancaPinCampo();
    atualizarBarraExpedienteCampo();
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(false);
    atualizarAbaMinhasAtividadesCampo(false);
    renderizarResumoSolicitacoesCampo();
}

async function alterarPinPeloTecnicoCampo() {
    const nomeEq = document.getElementById('sel-equipe')?.value;
    if (!nomeEq) return;

    const eqObj = (equipesSistema || []).find(e => e.nome === nomeEq);
    if (!eqObj) return;

    const pinAtualCorreto = obterPinDaEquipe(eqObj);
    const pinAtualInformado = prompt(`🔑 ALTERAR MEU PIN (${nomeEq})\n\nDigite o seu PIN ATUAL:`);
    if (pinAtualInformado === null) return;

    if (pinAtualInformado.trim() !== pinAtualCorreto) {
        alert("❌ O PIN atual informado está incorreto.");
        return;
    }

    const novoPin = prompt("🔑 Digite o NOVO PIN desejado (Exatamente 4 números, ex: 4580):");
    if (novoPin === null) return;

    const novoPinLimpo = novoPin.trim();
    if (!/^\d{4}$/.test(novoPinLimpo)) {
        alert("⚠️ O novo PIN deve conter exatamente 4 dígitos numéricos (ex: 2580).");
        return;
    }

    const confPin = prompt("🔑 Confirme digitando novamente o seu NOVO PIN de 4 dígitos:");
    if (confPin === null || confPin.trim() !== novoPinLimpo) {
        alert("❌ A confirmação não coincide com o novo PIN. Operação cancelada.");
        return;
    }

    eqObj.pin = novoPinLimpo;
    await sincronizarEquipesNaNuvem();
    if (typeof renderizarTabelaEquipes === "function") renderizarTabelaEquipes();
    alert("✅ Seu novo PIN de 4 dígitos foi salvo e sincronizado na nuvem com sucesso!");
}

async function resetarPinEquipeGestor(idEquipe) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') {
        alert("⚠️ Apenas Gestores (Master ou Operador) podem resetar o PIN de um técnico.");
        return;
    }

    const eqObj = (equipesSistema || []).find(e => e.id === idEquipe);
    if (!eqObj) return;

    const pinAtual = obterPinDaEquipe(eqObj);
    const novoPinGestor = prompt(
        `🔄 RESETAR PIN DO TÉCNICO: ${eqObj.nome}\n\nPIN Atual: ${pinAtual}\n\nDigite o novo PIN de 4 dígitos para este técnico (ou mantenha 1234 para o padrão):`,
        "1234"
    );
    if (novoPinGestor === null) return;

    const pinLimpo = novoPinGestor.trim();
    if (!/^\d{4}$/.test(pinLimpo)) {
        alert("⚠️ O PIN deve ter exatamente 4 números (ex: 1234).");
        return;
    }

    eqObj.pin = pinLimpo;
    registrarLogAuditoria("RESET DE PIN (GESTOR)", `Gestor ${usuarioLogado} redefiniu o PIN do técnico ${eqObj.nome} para '${pinLimpo}'.`);
    await sincronizarEquipesNaNuvem();
    if (typeof renderizarTabelaEquipes === "function") renderizarTabelaEquipes();
    alert(`✅ O PIN do técnico ${eqObj.nome} foi redefinido para "${pinLimpo}" com sucesso!`);
}

function verificarPendenciasReabertasEProgramadasCampo(permitirSom = true) {
    const equipeSelecionada = document.getElementById('sel-equipe')?.value;
    const boxReab = document.getElementById('box-reabertas-campo');
    const listaReab = document.getElementById('lista-reabertas-campo');
    const boxProg = document.getElementById('box-programadas-campo');
    const listaProg = document.getElementById('lista-programadas-campo');

    if (!equipeSelecionada) {
        if (boxReab) boxReab.classList.add('hidden');
        if (boxProg) boxProg.classList.add('hidden');
        return;
    }

    const reabertas = (registrosSalvos || []).filter(r => r.equipe === equipeSelecionada && r.desfecho === 'REABERTA');
    const programadas = (registrosSalvos || []).filter(r => r.equipe === equipeSelecionada && r.desfecho === 'PROGRAMADA');

    let chegouNova = false;
    [...reabertas, ...programadas].forEach(item => {
        const chaveNotif = `${item.id}_${item.desfecho}`;
        if (!idsNotificadosNoCelular.has(chaveNotif)) {
            idsNotificadosNoCelular.add(chaveNotif);
            chegouNova = true;
        }
    });

    if (chegouNova && permitirSom) {
        tocarAlertaSonoroCelular();
    }

    if (boxReab && listaReab) {
        if (reabertas.length > 0) {
            listaReab.innerHTML = reabertas.map(r => `
                <div class="bg-white p-2.5 rounded-lg border border-purple-300 flex justify-between items-center gap-2">
                    <div>
                        <div class="font-bold text-purple-950 text-xs">🏢 ${r.imovel} (${r.projeto})</div>
                        <div class="text-[10px] text-slate-500">📍 ${r.endereco || 'Sem endereço'} • Data: ${r.dataRegistro}</div>
                    </div>
                    <button type="button" onclick="retomarAtividadeReabertaCampo(${r.id})" title="Carregar dados desta atividade reaberta pelo gestor para correção" class="bg-purple-700 hover:bg-purple-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">
                        ✏️ Editar Agora
                    </button>
                </div>
            `).join('');
            boxReab.classList.remove('hidden');
        } else {
            boxReab.classList.add('hidden');
        }
    }

    if (boxProg && listaProg) {
        if (programadas.length > 0) {
            listaProg.innerHTML = programadas.map(r => {
                const qtdB = r.qtdBlocosProgramados || 1;
                return `
                <div class="bg-white p-2.5 rounded-lg border border-cyan-300 flex justify-between items-center gap-2">
                    <div>
                        <div class="font-bold text-cyan-950 text-xs flex items-center gap-1 flex-wrap">
                            <span>🏢 ${r.imovel}</span>
                            <span class="bg-cyan-100 text-cyan-900 px-1.5 py-0.5 rounded text-[9px]">${r.projeto}</span>
                            <span class="bg-blue-900 text-white px-1.5 py-0.5 rounded text-[9px] font-black">${qtdB} Bloco(s)</span>
                        </div>
                        <div class="text-[10px] text-slate-600 mt-0.5">📍 ${r.endereco || 'Endereço a confirmar'}</div>
                        <div class="text-[9px] text-slate-500">Andares: <b>${r.andares || '-'}</b> | HPs: <b>${r.hps || '-'}</b> ${r.responsavel ? `| Resp: <b>${r.responsavel}</b>` : ''}</div>
                    </div>
                    <button type="button" onclick="iniciarAtividadeProgramadaCampo(${r.id})" title="Capturar GPS e iniciar esta atividade programada" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">
                        🚀 Iniciar
                    </button>
                </div>
            `}).join('');
            boxProg.classList.remove('hidden');
        } else {
            boxProg.classList.add('hidden');
        }
    }

    atualizarAbaMinhasAtividadesCampo(false);
}

async function retomarAtividadeReabertaCampo(idReg) {
    const r = (registrosSalvos || []).find(item => item.id === idReg);
    if (!r) return;

    encerrarImprevistosAbertosAoIniciarAtividade(r.equipe, r.gpsEntrada);
    atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
    document.getElementById('sel-projeto').value = r.projeto;
    document.getElementById('inp-imovel').value = r.imovel;

    dadosAtendimento.idEmAndamento = r.id;
    dadosAtendimento.eraReaberta = true;
    dadosAtendimento.eraProgramada = false;
    dadosAtendimento.emPausa = false;
    dadosAtendimento.inicioPausa = null;
    dadosAtendimento.motivoPausaAtual = "";
    dadosAtendimento.minutosPausados = Number(r.tempoPausadoMinutos) || 0;
    dadosAtendimento.hEntrada = r.hEntrada || new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    dadosAtendimento.gpsEntrada = r.gpsEntrada || "Mantido da abertura";

    let fotosRecuperadas = Array.isArray(r.fotos) ? [...r.fotos] : [];
    if (fotosRecuperadas.length === 0 && typeof obterFotosSobDemandaDoRegistro === 'function') {
        fotosRecuperadas = await obterFotosSobDemandaDoRegistro(r.id);
    }

    const blocoRecuperado = {
        identificacao: "BLOCO 1",
        andares: r.andares || 1,
        hps: r.hps || 1,
        fusoes: r.fusoes || 0,
        conectores: r.conectores || 0,
        caboRL: r.caboRL || 0,
        caboDrop: r.caboDrop || 0,
        nap: r.nap || 0,
        dio: r.dio || 0,
        cxSobrepor: r.cxSobrepor || 0,
        cxEmbutida: r.cxEmbutida || 0,
        cxFosc: r.cxFosc || 0,
        desfecho: "CONCLUIDA",
        servicoObra: r.servicoObra || "SIM",
        concluidasOpcoes: Array.isArray(r.malogros) ? r.malogros : [],
        obsConcluida: r.motivoDesfecho || "",
        obsPendente: r.motivoDesfecho || "",
        pendenciasOpcoes: Array.isArray(r.malogros) ? r.malogros : [],
        obsMalograda: r.motivoDesfecho || "",
        malogros: Array.isArray(r.malogros) ? r.malogros : [],
        observacoes: r.observacoes || "",
        fotos: fotosRecuperadas
    };

    dadosAtendimento.blocos = [blocoRecuperado];

    document.getElementById('lbl-status-execucao-campo').innerText = "🔄 Editando Atividade Reaberta pelo Gestor";
    document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${r.projeto})`;
    document.getElementById('lbl-h-entrada').innerText = dadosAtendimento.hEntrada;
    document.getElementById('lbl-gps-entrada').innerText = dadosAtendimento.gpsEntrada;

    document.getElementById('form-endereco').value = r.endereco || '';
    if (document.getElementById('form-liberou-acesso')) {
        document.getElementById('form-liberou-acesso').value = r.liberouAcesso || '';
    }
    document.getElementById('form-responsavel').value = r.responsavel || '';
    document.getElementById('form-contato').value = r.contato || '';
    document.getElementById('form-email').value = r.email || '';
    document.getElementById('inp-qtd-blocos').value = 1;

    document.getElementById('form-campo-container').classList.add('hidden');
    document.getElementById('box-reabertas-campo').classList.add('hidden');
    document.getElementById('bloco-pos-abertura').classList.remove('hidden');

    mudarTipoProjeto();
    renderizarBlocosCampo();
    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
}

async function iniciarAtividadeProgramadaCampo(idReg) {
    const r = (registrosSalvos || []).find(item => item.id === idReg);
    if (!r) return;

    atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
    document.getElementById('sel-projeto').value = r.projeto;
    document.getElementById('inp-imovel').value = r.imovel;
    verificarHistoricoReincidenciaImovelCampo(r.imovel);

    let coordReal = "Não capturado";
    try {
        coordReal = await capturarGpsReal(10000);
        const partes = coordReal.split(',').map(s => parseFloat(s.trim()));
        if (partes.length === 2 && !isNaN(partes[0])) {
            const hojeISO = obterDataLocalISO();
            if (telemetriaEquipes[r.equipe]?.data === hojeISO && telemetriaEquipes[r.equipe]?.statusTurno === 'DISPONIVEL') {
                await registrarPontoTelemetriaEquipe(r.equipe, partes[0], partes[1], 'DISPONIVEL');
                iniciarMonitoramentoContinuoGps(r.equipe);
            }
        }
    } catch (err) {
        alert("❌ Ative o GPS do celular para iniciar a atividade programada.");
        return;
    }

    await encerrarImprevistosAbertosAoIniciarAtividade(r.equipe, coordReal);

    const horaEntradaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const hojeISO = obterDataLocalISO();

    await supabaseClient.from('registros_producao').update({
        data_registro: hojeISO,
        h_entrada: horaEntradaAtual,
        h_saida: "Em Andamento",
        gps_entrada: coordReal,
        desfecho: "EM ANDAMENTO",
        motivo_desfecho: "[ORIGEM:PROGRAMADA] Atividade programada iniciada em campo"
    }).eq('id', r.id);

    dadosAtendimento.idEmAndamento = r.id;
    dadosAtendimento.eraReaberta = false;
    dadosAtendimento.eraProgramada = true;
    dadosAtendimento.emPausa = false;
    dadosAtendimento.inicioPausa = null;
    dadosAtendimento.motivoPausaAtual = "";
    dadosAtendimento.minutosPausados = 0;
    dadosAtendimento.hEntrada = horaEntradaAtual;
    dadosAtendimento.gpsEntrada = coordReal;

    const totalBlocos = Math.max(1, Math.min(20, Number(r.qtdBlocosProgramados) || 1));
    dadosAtendimento.blocos = [];
    for (let i = 1; i <= totalBlocos; i++) {
        const novoBloco = criarObjetoBlocoPadrao(i);
        if (r.andares) novoBloco.andares = r.andares;
        if (r.hps) novoBloco.hps = r.hps;
        if (r.observacoes) novoBloco.observacoes = r.observacoes;
        dadosAtendimento.blocos.push(novoBloco);
    }

    document.getElementById('lbl-status-execucao-campo').innerText = `Status: Em Andamento (${totalBlocos} Bloco${totalBlocos > 1 ? 's' : ''})`;
    document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${r.projeto})`;
    document.getElementById('lbl-h-entrada').innerText = horaEntradaAtual;
    document.getElementById('lbl-gps-entrada').innerText = coordReal;

    document.getElementById('form-endereco').value = r.endereco || '';
    if (document.getElementById('form-liberou-acesso')) {
        document.getElementById('form-liberou-acesso').value = r.liberouAcesso || '';
    }
    document.getElementById('form-responsavel').value = r.responsavel || '';
    document.getElementById('form-contato').value = r.contato || '';
    document.getElementById('form-email').value = r.email || '';
    document.getElementById('inp-qtd-blocos').value = totalBlocos;

    document.getElementById('form-campo-container').classList.add('hidden');
    document.getElementById('box-programadas-campo').classList.add('hidden');
    document.getElementById('bloco-pos-abertura').classList.remove('hidden');

    mudarTipoProjeto();
    renderizarBlocosCampo();
    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
    await carregarRegistrosModoCampoLeve();
    verificarImprevistoAtivoEquipeCampo();
    atualizarAbaMinhasAtividadesCampo(false);
}

function verificarImprevistoAtivoEquipeCampo() {
    const equipeSelecionada = document.getElementById('sel-equipe')?.value;
    const boxImp = document.getElementById('box-imprevisto-ativo-campo');
    if (!equipeSelecionada || !boxImp) {
        if (boxImp) boxImp.classList.add('hidden');
        return;
    }

    const impAtivo = (registrosSalvos || []).find(r =>
        r.equipe === equipeSelecionada &&
        r.desfecho === 'IMPREVISTO'
    );

    if (impAtivo) {
        const motivoStr = (impAtivo.malogros && impAtivo.malogros.length > 0) ? impAtivo.malogros.join(' + ') : impAtivo.motivoDesfecho;
        document.getElementById('lbl-info-imprevisto-ativo').innerText = `${motivoStr} (Iniciado às ${impAtivo.hEntrada})`;
        boxImp.dataset.idImprevisto = impAtivo.id;
        boxImp.classList.remove('hidden');
    } else {
        boxImp.classList.add('hidden');
    }
}

async function finalizarImprevistoCampo() {
    const boxImp = document.getElementById('box-imprevisto-ativo-campo');
    const idImp = Number(boxImp?.dataset.idImprevisto);
    if (!idImp) return;

    const btn = document.getElementById('btn-finalizar-imprevisto-campo');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Finalizando imprevisto...";
    }

    await resolverImprevistoPorId(idImp, false);

    if (btn) {
        btn.disabled = false;
        btn.innerText = "✅ Resolver Imprevisto e Ficar Disponível";
    }
    boxImp.classList.add('hidden');
    alert("✅ Imprevisto finalizado! Você já consta como DISPONÍVEL para o painel de gestão.");
}

async function resolverImprevistoPorId(idImp, chamadoPeloGestor = true) {
    const reg = (registrosSalvos || []).find(r => r.id === idImp);
    const horaFim = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const gpsSaida = reg?.gpsEntrada || "Não capturado";

    const { error } = await supabaseClient
        .from('registros_producao')
        .update({
            desfecho: "IMPREVISTO RESOLVIDO",
            h_saida: horaFim,
            gps_saida: gpsSaida
        })
        .eq('id', idImp);

    if (error) {
        alert("Erro ao finalizar imprevisto: " + error.message);
        return;
    }

    if (reg) {
        reg.desfecho = "IMPREVISTO RESOLVIDO";
        reg.hSaida = horaFim;
    }

    if (chamadoPeloGestor) {
        registrarLogAuditoria("IMPREVISTO RESOLVIDO (GESTOR)", `Imprevisto da equipe ${reg?.equipe || ''} encerrado pelo gestor às ${horaFim}.`);
        if (typeof atualizarDashboardGestor === "function") atualizarDashboardGestor();
        alert("✅ Imprevisto marcado como RESOLVIDO! O técnico voltou a ficar disponível.");
    } else {
        await carregarRegistrosModoCampoLeve();
    }
}

async function copiarTextoAreaTransferencia(texto, msgSucesso) {
    try {
        await navigator.clipboard.writeText(texto);
        alert(msgSucesso);
    } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = texto;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert(msgSucesso);
    }
}

function montarTextoResumoItem(r) {
    let iconeDesf = "🟢";
    if (r.desfecho === "PENDENTE" || r.desfecho === "IMPREVISTO") iconeDesf = "🟡";
    else if (r.desfecho === "MALOGRADA") iconeDesf = "🔴";
    else if (r.desfecho === "EM ANDAMENTO") iconeDesf = "🔵";
    else if (r.desfecho === "PARALISADA") iconeDesf = "⏸️";
    else if (r.desfecho === "REABERTA") iconeDesf = "🔄";
    else if (r.desfecho === "PROGRAMADA") iconeDesf = "📋";

    let linhas = [
        `📋 *GPD MDU • PROCISA RJ*`,
        `📅 *Data:* ${r.dataRegistro}`,
        `👷 *Equipe:* ${r.equipe}`,
        `🏢 *Imóvel:* ${r.imovel}`,
        `📍 *Endereço:* ${r.endereco || '-'}`
    ];

    if (r.liberouAcesso) {
        linhas.push(`🔑 *Liberou o Acesso:* ${r.liberouAcesso}`);
    }

    linhas.push(`🏗️ *Projeto:* ${r.projeto} (${obterMacroGrupoProjeto(r.projeto)})`);
    linhas.push(`🕒 *Horário:* ${r.hEntrada} às ${r.hSaida}`);

    if (Number(r.tempoPausadoMinutos) > 0) {
        linhas.push(`⏸️ *Tempo Paralisado:* ${r.tempoPausadoMinutos} min`);
    }

    linhas.push(`📍 *GPS:* ${r.gpsEntrada}`);

    if (Array.isArray(r.blocosDetalhados) && r.blocosDetalhados.length > 1) {
        linhas.push(`────────────────────`);
        linhas.push(`🏢 *DETALHAMENTO POR BLOCO (${r.blocosDetalhados.length} BLOCOS):*`);

        r.blocosDetalhados.forEach((b, idx) => {
            let iconeB = "🟢";
            if (b.desfecho === "PENDENTE") iconeB = "🟡";
            else if (b.desfecho === "MALOGRADA") iconeB = "🔴";

            const nomeBloco = (b.identificacao || `BLOCO ${idx + 1}`).toUpperCase().trim();
            linhas.push(`\n🔹 *${nomeBloco}*`);
            linhas.push(`   • *Andares:* ${b.andares || 0} | *HPs:* ${b.hps || 0}`);
            linhas.push(`   • *Desfecho:* ${iconeB} ${b.desfecho}`);
            linhas.push(`   • *Materiais (${nomeBloco}):* RL: ${Number(b.caboRL) || 0}m | Drop: ${Number(b.caboDrop) || 0}m | Conect: ${Number(b.conectores) || 0} | Fusões: ${Number(b.fusoes) || 0} | NAP: ${Number(b.nap) || 0} | DIO: ${Number(b.dio) || 0}`);

            const cxS = Number(b.cxSobrepor) || 0;
            const cxE = Number(b.cxEmbutida) || 0;
            const cxF = Number(b.cxFosc) || 0;
            if (cxS > 0 || cxE > 0 || cxF > 0) {
                linhas.push(`   • *Caixas (${nomeBloco}):* Sobrepor: ${cxS} | Embutida: ${cxE} | FOSC: ${cxF}`);
            }
            if (Array.isArray(b.opcoesMarcadas) && b.opcoesMarcadas.length > 0) {
                linhas.push(`   • *Opções:* ${b.opcoesMarcadas.join(', ')}`);
            }
            if (b.motivoDesfecho) {
                linhas.push(`   • *Detalhe:* ${b.motivoDesfecho}`);
            }
            if (b.observacoes) {
                linhas.push(`   • *Obs:* ${b.observacoes}`);
            }
            if (Array.isArray(b.fotos) && b.fotos.length > 0) {
                linhas.push(`   • *Fotos:* ${b.fotos.length} anexada(s)`);
            }
        });

        linhas.push(`────────────────────`);
        linhas.push(`📊 *TOTAL GERAL CONSOLIDADO:*`);
        linhas.push(`🏢 *Andares Totais:* ${r.andares || 0} | *HPs Totais:* ${r.hps || 0}`);
        linhas.push(`📦 *Soma Materiais:* RL: ${r.caboRL}m | Drop: ${r.caboDrop}m | Conect: ${r.conectores} | Fusões: ${r.fusoes} | NAP: ${r.nap} | DIO: ${r.dio}`);
        if (r.fotos && r.fotos.length > 0) {
            linhas.push(`📷 *Total de Fotos:* ${r.fotos.length} foto(s) no sistema`);
        }
    } else {
        linhas.push(`🏢 *Andares:* ${r.andares || 0} | *HPs:* ${r.hps || 0}`);
        linhas.push(`${iconeDesf} *Status/Desfecho:* ${r.desfecho}`);

        if (r.projeto !== "IMPREVISTO / ATRASO") {
            linhas.push(`📦 *Materiais:* RL: ${r.caboRL}m | Drop: ${r.caboDrop}m | Conect: ${r.conectores} | Fusões: ${r.fusoes} | NAP: ${r.nap} | DIO: ${r.dio}`);
            const cxS = Number(r.cxSobrepor) || 0;
            const cxE = Number(r.cxEmbutida) || 0;
            const cxF = Number(r.cxFosc) || 0;
            if (cxS > 0 || cxE > 0 || cxF > 0) {
                linhas.push(`🧰 *Caixas:* Sobrepor: ${cxS} | Embutida: ${cxE} | FOSC: ${cxF}`);
            }
        }
        if (r.malogros && r.malogros.length > 0) {
            linhas.push(`⚠️ *Opções Marcadas:* ${r.malogros.join(', ')}`);
        }
        if (r.motivoDesfecho) {
            linhas.push(`💬 *Detalhe:* ${r.motivoDesfecho}`);
        }
        if (r.observacoes) {
            linhas.push(`📝 *Obs:* ${r.observacoes}`);
        }
        if (r.fotos && r.fotos.length > 0) {
            linhas.push(`📷 *Fotos Anexadas:* ${r.fotos.length} foto(s) no sistema`);
        }
    }
    return linhas.join('\n');
}

function copiarUltimoResumoCampoWhatsApp() {
    if (!ultimoResumoCampoTexto) return;
    copiarTextoAreaTransferencia(ultimoResumoCampoTexto, "📲 Resumo da atividade copiado! Agora é só colar no WhatsApp.");
}

function copiarDetalheModalWhatsApp() {
    if (!itemDetalheAtualModal) return;
    const texto = montarTextoResumoItem(itemDetalheAtualModal);
    copiarTextoAreaTransferencia(texto, "📲 Detalhes do registro copiados para o WhatsApp!");
}

function mudarTipoProjeto() {
    const projeto = document.getElementById('sel-projeto')?.value;
    const titulo = document.getElementById('titulo-form-dinamico');
    if (!titulo) return;
    if (!projeto) {
        titulo.innerText = "1. Dados Gerais do Condomínio / Imóvel";
    } else {
        titulo.innerText = `1. Dados Gerais do Imóvel (${projeto} • ${obterMacroGrupoProjeto(projeto)})`;
    }
}

function capturarGpsReal(tempoLimite = 12000) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject("Geolocalização não suportada pelo navegador.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude.toFixed(6);
                const lng = pos.coords.longitude.toFixed(6);
                resolve(`${lat}, ${lng}`);
            },
            (err) => {
                reject(err);
            },
            { enableHighAccuracy: true, timeout: tempoLimite, maximumAge: 0 }
        );
    });
}

async function fazerCheckIn() {
    const equipe = document.getElementById('sel-equipe')?.value;
    const projeto = document.getElementById('sel-projeto')?.value;
    const imovel = document.getElementById('inp-imovel')?.value.trim();
    if (!equipe || !projeto || !imovel) { alert("⚠️ Selecione a Equipe, o Projeto e informe o Cód. Imóvel."); return; }

    const regReincidente = verificarHistoricoReincidenciaImovelCampo(imovel);
    if (regReincidente && (regReincidente.desfecho === 'PENDENTE' || regReincidente.desfecho === 'MALOGRADA')) {
        const ofensorAnt = (regReincidente.malogros && regReincidente.malogros.length > 0) ? regReincidente.malogros.join(' + ') : 'Não especificado';
        const continuarReinc = confirm(
            `⚠️ ALERTA DE HISTÓRICO DO IMÓVEL (${imovel}):\n\n` +
            `Este imóvel teve status "${regReincidente.desfecho}" em ${regReincidente.dataRegistro} (${regReincidente.projeto} - Equipe: ${regReincidente.equipe}).\n` +
            `• Ofensor/Motivo: ${ofensorAnt}\n` +
            `• Detalhe: ${regReincidente.motivoDesfecho || regReincidente.observacoes || '-'}\n\n` +
            `Deseja confirmar a abertura do atendimento para este imóvel?`
        );
        if (!continuarReinc) return;
    }

    const hojeISO = obterDataLocalISO();
    const duplicadoHoje = (registrosSalvos || []).find(r =>
        r.dataRegistro === hojeISO &&
        r.imovel.toUpperCase().trim().startsWith(imovel.toUpperCase()) &&
        r.projeto === projeto &&
        !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(r.desfecho)
    );

    if (duplicadoHoje) {
        const confirmarDup = confirm(`⚠️ ATENÇÃO: O imóvel "${imovel}" já possui um registro de "${projeto}" lançado hoje (${duplicadoHoje.desfecho} por ${duplicadoHoje.equipe}).\n\nDeseja abrir um novo atendimento para este mesmo imóvel?`);
        if (!confirmarDup) return;
    }

    document.getElementById('box-ultimo-resumo-whats').classList.add('hidden');

    const btnCheckin = document.getElementById('btn-checkin');
    if (btnCheckin) {
        btnCheckin.disabled = true;
        btnCheckin.innerText = "📍 Obtendo GPS e iniciando no painel...";
    }

    let coordReal = "Não capturado";
    try {
        coordReal = await capturarGpsReal(12000);
        dadosAtendimento.gpsEntrada = coordReal;
        document.getElementById('lbl-gps-entrada').innerText = coordReal;

        const partes = coordReal.split(',').map(s => parseFloat(s.trim()));
        if (partes.length === 2 && !isNaN(partes[0])) {
            if (telemetriaEquipes[equipe]?.data === hojeISO && telemetriaEquipes[equipe]?.statusTurno === 'DISPONIVEL') {
                await registrarPontoTelemetriaEquipe(equipe, partes[0], partes[1], 'DISPONIVEL');
                iniciarMonitoramentoContinuoGps(equipe);
            }
        }
    } catch (err) {
        alert("❌ Não foi possível capturar o GPS. Verifique se a Localização do celular está ativada e se o navegador tem permissão.");
        if (btnCheckin) {
            btnCheckin.disabled = false;
            btnCheckin.innerText = "🚀 Iniciar Atividade no Imóvel (Status: Em Andamento)";
        }
        return;
    }

    await encerrarImprevistosAbertosAoIniciarAtividade(equipe, coordReal);

    const horaEntradaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const idTemp = Date.now();
    const parceiroApoio = parceiroApoioPreSelecionadoSuporte || "";
    const membrosInicial = parceiroApoio ? formatarStringMembrosApoio(equipe, [parceiroApoio], []) : equipe;

    const registroEmAndamentoDB = {
        id: idTemp,
        data_registro: hojeISO,
        equipe: equipe,
        membros: membrosInicial,
        projeto: projeto,
        imovel: imovel,
        h_entrada: horaEntradaAtual,
        h_saida: "Em Andamento",
        gps_entrada: coordReal,
        gps_saida: "Em Campo",
        desfecho: "EM ANDAMENTO",
        motivo_desfecho: "Atividade iniciada em campo (Em execução)",
        malogros: [],
        responsavel: '',
        contato: '',
        email: '',
        agendamento: null,
        andares: 0,
        hps: 0,
        servico_obra: "SIM",
        observacoes: "Em andamento"
    };

    try {
        const { error } = await supabaseClient.from('registros_producao').insert([registroEmAndamentoDB]);
        if (!error) {
            dadosAtendimento.idEmAndamento = idTemp;
        }
    } catch (e) {
        console.warn("Abertura salva em rascunho local (oscilação de rede).");
    }

    dadosAtendimento.eraReaberta = false;
    dadosAtendimento.eraProgramada = false;
    dadosAtendimento.emPausa = false;
    dadosAtendimento.inicioPausa = null;
    dadosAtendimento.motivoPausaAtual = "";
    dadosAtendimento.minutosPausados = 0;

    if (btnCheckin) {
        btnCheckin.disabled = false;
        btnCheckin.innerText = "🚀 Iniciar Atividade no Imóvel (Status: Em Andamento)";
    }

    dadosAtendimento.blocos = [criarObjetoBlocoPadrao(1)];
    document.getElementById('inp-qtd-blocos').value = 1;

    if (regReincidente && regReincidente.endereco && !document.getElementById('form-endereco').value) {
        document.getElementById('form-endereco').value = regReincidente.endereco;
    }

    const lblBadge = document.getElementById('lbl-parceiro-apoio-atual-campo');
    if (lblBadge) {
        lblBadge.innerText = parceiroApoio ? `✅ Validado: ${parceiroApoio}` : 'Individual';
    }

    document.getElementById('lbl-status-execucao-campo').innerText = "Status: Em Andamento no Painel";
    document.getElementById('form-campo-container').classList.add('hidden');
    document.getElementById('bloco-pos-abertura').classList.remove('hidden');
    document.getElementById('lbl-imovel-aberto').innerText = `${imovel} (${projeto})`;
    document.getElementById('lbl-h-entrada').innerText = horaEntradaAtual;
    mudarTipoProjeto();
    renderizarBlocosCampo();
    sincronizarVisualPausaCampo();
    salvarRascunhoCampo();
    await carregarRegistrosModoCampoLeve();
    verificarImprevistoAtivoEquipeCampo();
    atualizarAbaMinhasAtividadesCampo(false);
}

function abrirModalImprevisto() {
    const equipe = validarTecnicoSelecionadoParaSolicitacao();
    if (!equipe) return;
    document.getElementById('inp-detalhe-imprevisto').value = '';
    popularSelectImprevistos();
    document.getElementById('modal-imprevisto').classList.remove('hidden');
}

function fecharModalImprevisto() {
    document.getElementById('modal-imprevisto').classList.add('hidden');
}

function fecharAlertaImprevistos() {
    const alerta = document.getElementById('alerta-imprevistos-supervisao');
    if (alerta) {
        alerta.classList.add('hidden');
        alerta.dataset.fechadoPeloGestor = "true";
    }
}

async function enviarImprevisto() {
    const equipe = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao;
    const checksImp = document.querySelectorAll('input[name="chk-motivo-imprevisto"]:checked');
    let motivosSelecionados = Array.from(checksImp).map(c => c.value);

    if (motivosSelecionados.length === 0) {
        const fallbackSel = document.getElementById('sel-motivo-imprevisto')?.value;
        if (fallbackSel) motivosSelecionados = [fallbackSel];
    }

    if (motivosSelecionados.length === 0) {
        alert("⚠️ Selecione pelo menos um motivo de imprevisto.");
        return;
    }

    const motivoStr = motivosSelecionados.join(" + ");
    const detalhe = document.getElementById('inp-detalhe-imprevisto').value.trim();

    if (!equipe) {
        alert("⚠️ Equipe não selecionada.");
        return;
    }

    const btnEnviar = document.getElementById('btn-enviar-imprevisto');
    if (btnEnviar) {
        btnEnviar.disabled = true;
        btnEnviar.innerText = "⏳ Capturando GPS...";
    }

    let gpsCapturado = "Não capturado";
    try {
        gpsCapturado = await capturarGpsReal(8000);
    } catch (e) {
        console.warn("Imprevisto enviado sem sinal exato de GPS.");
    }

    const dataLocalCorreta = obterDataLocalISO();
    const horaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    const registroImprevistoDB = {
        id: Date.now(),
        data_registro: dataLocalCorreta,
        equipe: equipe,
        membros: equipe,
        projeto: "IMPREVISTO / ATRASO",
        imovel: "SEM ATIVIDADE (Imprevisto)",
        h_entrada: horaAtual,
        h_saida: "Em Aberto",
        gps_entrada: gpsCapturado,
        gps_saida: gpsCapturado,
        desfecho: "IMPREVISTO",
        motivo_desfecho: detalhe ? `${motivoStr}: ${detalhe}` : motivoStr,
        malogros: motivosSelecionados,
        responsavel: '',
        contato: '',
        email: '',
        agendamento: null,
        andares: 0,
        hps: 0,
        servico_obra: "NÃO",
        observacoes: detalhe,
        fusoes: 0,
        conectores: 0,
        cabo_rl: 0,
        cabo_drop: 0,
        nap: 0,
        dio: 0,
        cx_sobrepor: 0,
        cx_embutida: 0,
        cx_fosc: 0
    };

    const { error } = await supabaseClient.from('registros_producao').insert([registroImprevistoDB]);

    if (btnEnviar) {
        btnEnviar.disabled = false;
        btnEnviar.innerText = "📍 Capturar GPS e Iniciar Imprevisto";
    }

    if (error) {
        alert("❌ Erro ao registrar imprevisto: " + error.message);
        return;
    }

    alert("⚠️ Imprevisto registrado! Assim que você iniciar qualquer atividade em campo (ou clicar no botão verde 'Resolver Imprevisto'), ele será finalizado automaticamente.");
    fecharModalImprevisto();
    await carregarRegistrosModoCampoLeve();
    verificarImprevistoAtivoEquipeCampo();
}

function resetarFormularioCampo() {
    const equipeAtual = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || '';
    dadosAtendimento.idEmAndamento = null;
    dadosAtendimento.eraReaberta = false;
    dadosAtendimento.eraProgramada = false;
    dadosAtendimento.emPausa = false;
    dadosAtendimento.inicioPausa = null;
    dadosAtendimento.motivoPausaAtual = "";
    dadosAtendimento.minutosPausados = 0;
    dadosAtendimento.gpsEntrada = null;
    dadosAtendimento.gpsSaida = null;
    dadosAtendimento.blocos = [];
    parceiroApoioPreSelecionadoSuporte = "";
    document.getElementById('inp-imovel').value = '';
    const boxReinc = document.getElementById('box-alerta-reincidencia-imovel');
    if (boxReinc) boxReinc.classList.add('hidden');
    document.getElementById('form-endereco').value = '';
    if (document.getElementById('form-liberou-acesso')) {
        document.getElementById('form-liberou-acesso').value = '';
    }
    document.getElementById('form-responsavel').value = '';
    document.getElementById('form-contato').value = '';
    document.getElementById('form-email').value = '';
    document.getElementById('inp-qtd-blocos').value = '1';
    document.getElementById('container-blocos-dinamicos').innerHTML = '';
    document.getElementById('lbl-gps-entrada').innerText = '-';
    document.getElementById('lbl-imovel-aberto').innerText = '-';
    if (document.getElementById('lbl-tempo-pausado-acumulado')) {
        document.getElementById('lbl-tempo-pausado-acumulado').innerText = '';
    }

    document.getElementById('bloco-pos-abertura').classList.add('hidden');
    document.getElementById('form-campo-container').classList.remove('hidden');
    sincronizarVisualPausaCampo();
    localStorage.removeItem('gpd_rascunho_campo_ativo');

    if (equipeAtual) {
        const selEq = document.getElementById('sel-equipe');
        if (selEq) selEq.value = equipeAtual;
        document.getElementById('current-user-team').innerText = equipeAtual;
        atualizarProjetosPermitidosCampo(equipeAtual);
        atualizarBarraSegurancaPinCampo();
        atualizarBarraExpedienteCampo();
        renderizarResumoSolicitacoesCampo();
    }
    organizarTelaPrincipalEBotaoSuporteRodape();
}

async function salvarRegistro() {
    if (dadosAtendimento.emPausa) {
        alert("⚠️ A atividade encontra-se PARALISADA. Clique no botão verde '▶️ Retomar Atividade Agora' antes de finalizar o atendimento.");
        return;
    }

    lerDadosBlocosDaTela();

    const enderecoGeral = document.getElementById('form-endereco').value.trim();
    if (!enderecoGeral) {
        alert("⚠️ O preenchimento do ENDEREÇO DO ATENDIMENTO é obrigatório.");
        document.getElementById('form-endereco').focus();
        return;
    }

    const liberouAcessoGeral = document.getElementById('form-liberou-acesso') ? document.getElementById('form-liberou-acesso').value.trim() : '';
    if (!liberouAcessoGeral) {
        alert("⚠️ O preenchimento do campo 'LIBEROU O ACESSO' é obrigatório.");
        document.getElementById('form-liberou-acesso')?.focus();
        return;
    }

    const qtdBlocos = dadosAtendimento.blocos.length;

    for (let i = 0; i < qtdBlocos; i++) {
        const b = dadosAtendimento.blocos[i];
        const nomeBloco = qtdBlocos > 1 ? `(${b.identificacao || 'Bloco ' + (i+1)})` : '';

        const numAndares = Number(b.andares);
        const numHps = Number(b.hps);

        if (!b.andares || isNaN(numAndares) || numAndares <= 0) {
            alert(`⚠️ Informe obrigatoriamente a quantidade de ANDARES ${nomeBloco}.`);
            document.getElementById(`bloco-andares-${i}`)?.focus();
            return;
        }
        if (!b.hps || isNaN(numHps) || numHps <= 0) {
            alert(`⚠️ Informe obrigatoriamente o Nº DE HPs ${nomeBloco}.`);
            document.getElementById(`bloco-hps-${i}`)?.focus();
            return;
        }
        if (!b.desfecho) {
            alert(`⚠️ Selecione o DESFECHO da atividade ${nomeBloco} (CONCLUÍDA, PENDENTE ou MALOGRADA).`);
            return;
        }
        if (b.desfecho === 'PENDENTE' && (!b.obsPendente.trim() || !b.pendenciasOpcoes || b.pendenciasOpcoes.length === 0)) {
            alert(`⚠️ Para atividade PENDENTE ${nomeBloco}, selecione pelo menos uma opção (ex: Rede Corretiva) e descreva o motivo.`);
            return;
        }
        if (b.desfecho === 'MALOGRADA' && (!b.obsMalograda.trim() || !b.malogros || b.malogros.length === 0)) {
            alert(`⚠️ Informe o motivo e selecione pelo menos um ofensor de malogro ${nomeBloco}.`);
            return;
        }
    }

    // Verifica se há apoios na nuvem aguardando validação antes de finalizar
    let validadosNuvem = [];
    if (dadosAtendimento.idEmAndamento) {
        try {
            const { data: regNuvem } = await supabaseClient
                .from('registros_producao')
                .select('id, equipe, membros')
                .eq('id', dadosAtendimento.idEmAndamento)
                .maybeSingle();

            if (regNuvem) {
                validadosNuvem = extrairListaApoiosDoMembros(regNuvem.membros, regNuvem.equipe);
                const pendentesNuvem = extrairListaApoiosPendentesDoMembros(regNuvem.membros, regNuvem.equipe);
                for (const nomePend of pendentesNuvem) {
                    const confirmaPresenca = confirm(
                        `🤝 VALIDAÇÃO DE PRESENÇA DE EQUIPE DE APOIO\n\n` +
                        `O técnico "${nomePend}" registrou entrada de apoio nesta atividade.\n\n` +
                        `Você VALIDA e confirma que "${nomePend}" esteve presente apoiando você nesta atividade?\n` +
                        `(Clique em OK para Validar a presença ou Cancelar para Recusar)`
                    );
                    if (confirmaPresenca && !validadosNuvem.includes(nomePend)) {
                        validadosNuvem.push(nomePend);
                    }
                }
            }
        } catch (e) {}
    }

    const parceiro2 = document.getElementById('sel-adicionar-apoio-em-andamento')?.value?.trim().toUpperCase() || parceiroApoioPreSelecionadoSuporte || '';
    if (parceiro2 && !validadosNuvem.includes(parceiro2)) validadosNuvem.push(parceiro2);

    const btnSalvar = document.getElementById('btn-salvar-final');
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.innerText = "⏳ Capturando GPS de saída e salvando fotos...";
    }

    const equipeNome = document.getElementById('sel-equipe').value;
    let gpsSaidaFinal = dadosAtendimento.gpsEntrada || "Não capturado";
    try {
        gpsSaidaFinal = await capturarGpsReal(4000);
        const partes = gpsSaidaFinal.split(',').map(s => parseFloat(s.trim()));
        const hojeISO = obterDataLocalISO();
        if (partes.length === 2 && !isNaN(partes[0]) && telemetriaEquipes[equipeNome]?.data === hojeISO && telemetriaEquipes[equipeNome]?.statusTurno === 'DISPONIVEL') {
            await registrarPontoTelemetriaEquipe(equipeNome, partes[0], partes[1], 'DISPONIVEL');
        }
    } catch (e) {
        console.warn("Sinal interno fraco na saída, mantendo coordenada real da entrada.");
    }

    const projetoNome = document.getElementById('sel-projeto').value;
    const imovelBase = document.getElementById('inp-imovel').value.trim();
    const responsavelGeral = document.getElementById('form-responsavel').value.trim();
    const contatoGeral = document.getElementById('form-contato').value.trim();
    const emailGeral = document.getElementById('form-email').value.trim();
    const dataLocalCorreta = obterDataLocalISO();
    const horaEntradaOriginal = document.getElementById('lbl-h-entrada').innerText || "08:30";
    const horaSaidaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const minutosPausaTotal = Number(dadosAtendimento.minutosPausados) || 0;
    const membrosFinalSalvar = validadosNuvem.length > 0 ? formatarStringMembrosApoio(equipeNome, validadosNuvem, []) : equipeNome;

    const listaRegistrosParaInserir = dadosAtendimento.blocos.map((b, idx) => {
        let motivoDesfecho = "";
        let opcoesMarcadas = [];

        if (b.desfecho === 'CONCLUIDA') {
            motivoDesfecho = b.obsConcluida.trim();
            opcoesMarcadas = b.concluidasOpcoes || [];
        } else if (b.desfecho === 'PENDENTE') {
            motivoDesfecho = b.obsPendente.trim();
            opcoesMarcadas = b.pendenciasOpcoes || [];
        } else if (b.desfecho === 'MALOGRADA') {
            motivoDesfecho = b.obsMalograda.trim();
            opcoesMarcadas = b.malogros || [];
        }

        const codigoImovelFinal = qtdBlocos > 1
            ? `${imovelBase} - ${(b.identificacao || 'BLOCO ' + (idx + 1)).toUpperCase().trim()}`
            : imovelBase;

        const tagLiberou = `[LIBEROU_ACESSO: ${liberouAcessoGeral}] `;
        const tagPausa = (minutosPausaTotal > 0 && idx === 0) ? `[PAUSA_TOTAL: ${minutosPausaTotal}] ` : '';
        const sufixoFotos = (b.fotos && b.fotos.length > 0) ? ` [FOTOS:${JSON.stringify(b.fotos)}]` : '';
        const obsFinal = `[END: ${enderecoGeral}] ${tagLiberou}${tagPausa}${b.observacoes || ''}${sufixoFotos}`.trim();

        return {
            id: Date.now() + idx,
            data_registro: dataLocalCorreta,
            equipe: equipeNome,
            membros: membrosFinalSalvar,
            projeto: projetoNome,
            imovel: codigoImovelFinal,
            h_entrada: horaEntradaOriginal,
            h_saida: horaSaidaAtual,
            gps_entrada: dadosAtendimento.gpsEntrada || gpsSaidaFinal,
            gps_saida: gpsSaidaFinal,
            desfecho: b.desfecho,
            motivo_desfecho: motivoDesfecho,
            malogros: opcoesMarcadas,
            responsavel: responsavelGeral,
            contato: contatoGeral,
            email: emailGeral,
            agendamento: null,
            andares: Number(b.andares) || 0,
            hps: Number(b.hps) || 0,
            servico_obra: b.servicoObra || "SIM",
            observacoes: obsFinal,
            fusoes: Number(b.fusoes) || 0,
            conectores: Number(b.conectores) || 0,
            cabo_rl: Number(b.caboRL) || 0,
            cabo_drop: Number(b.caboDrop) || 0,
            nap: Number(b.nap) || 0,
            dio: Number(b.dio) || 0,
            cx_sobrepor: Number(b.cxSobrepor) || 0,
            cx_embutida: Number(b.cxEmbutida) || 0,
            cx_fosc: Number(b.cxFosc) || 0
        };
    });

    const primeiroReg = listaRegistrosParaInserir[0];
    const todasFotos = dadosAtendimento.blocos.flatMap(b => b.fotos || []);

    const blocosParaWhats = dadosAtendimento.blocos.map((b, idx) => ({
        identificacao: b.identificacao || `BLOCO ${idx + 1}`,
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
        opcoesMarcadas: b.desfecho === 'CONCLUIDA' ? b.concluidasOpcoes : (b.desfecho === 'PENDENTE' ? b.pendenciasOpcoes : b.malogros),
        motivoDesfecho: b.desfecho === 'CONCLUIDA' ? b.obsConcluida : (b.desfecho === 'PENDENTE' ? b.obsPendente : b.obsMalograda),
        observacoes: (b.observacoes || '').trim(),
        fotos: b.fotos || []
    }));

    let resumoMontado = montarTextoResumoItem({
        dataRegistro: dataLocalCorreta,
        equipe: equipeNome,
        imovel: qtdBlocos > 1 ? `${imovelBase} (${qtdBlocos} Blocos)` : imovelBase,
        endereco: enderecoGeral,
        liberouAcesso: liberouAcessoGeral,
        tempoPausadoMinutos: minutosPausaTotal,
        projeto: projetoNome,
        andares: listaRegistrosParaInserir.reduce((acc, r) => acc + r.andares, 0),
        hps: listaRegistrosParaInserir.reduce((acc, r) => acc + r.hps, 0),
        desfecho: listaRegistrosParaInserir.map(r => r.desfecho).join(' / '),
        hEntrada: horaEntradaOriginal,
        hSaida: horaSaidaAtual,
        gpsEntrada: primeiroReg.gps_entrada,
        caboRL: listaRegistrosParaInserir.reduce((acc, r) => acc + r.cabo_rl, 0),
        caboDrop: listaRegistrosParaInserir.reduce((acc, r) => acc + r.cabo_drop, 0),
        conectores: listaRegistrosParaInserir.reduce((acc, r) => acc + r.conectores, 0),
        fusoes: listaRegistrosParaInserir.reduce((acc, r) => acc + r.fusoes, 0),
        nap: listaRegistrosParaInserir.reduce((acc, r) => acc + r.nap, 0),
        dio: listaRegistrosParaInserir.reduce((acc, r) => acc + r.dio, 0),
        cxSobrepor: listaRegistrosParaInserir.reduce((acc, r) => acc + r.cx_sobrepor, 0),
        cxEmbutida: listaRegistrosParaInserir.reduce((acc, r) => acc + r.cx_embutida, 0),
        cxFosc: listaRegistrosParaInserir.reduce((acc, r) => acc + r.cx_fosc, 0),
        malogros: primeiroReg.malogros,
        motivoDesfecho: primeiroReg.motivo_desfecho,
        observacoes: (dadosAtendimento.blocos[0]?.observacoes || '').trim(),
        fotos: todasFotos,
        blocosDetalhados: blocosParaWhats
    });

    if (validadosNuvem.length > 0) {
        resumoMontado = resumoMontado.replace(
            `👷 *Equipe:* ${equipeNome}`,
            `👷 *Equipe Titular:* ${equipeNome}\n🤝 *Apoio Validado:* ${validadosNuvem.join(', ')}`
        );
    }

    try {
        if (!navigator.onLine) {
            throw new Error("Sem conexão 4G no momento");
        }
        if (dadosAtendimento.idEmAndamento) {
            await supabaseClient.from('registros_producao').delete().eq('id', dadosAtendimento.idEmAndamento);
        }
        const { error } = await supabaseClient.from('registros_producao').insert(listaRegistrosParaInserir);
        if (error) throw error;

        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerText = "💾 Finalizar e Salvar Atendimento";
        }

        ultimoResumoCampoTexto = resumoMontado;
        document.getElementById('box-ultimo-resumo-whats').classList.remove('hidden');

        alert(`✅ Atendimento finalizado (${qtdBlocos} bloco(s) e ${todasFotos.length} foto(s)) e sincronizado com sucesso!`);
        resetarFormularioCampo();
        await carregarRegistrosModoCampoLeve();
        verificarPendenciasReabertasEProgramadasCampo(false);
        atualizarAbaMinhasAtividadesCampo(false);
        await verificarSolicitacoesApoioParaTitularCampo();
    } catch (errOffline) {
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerText = "💾 Finalizar e Salvar Atendimento";
        }

        salvarNaFilaOfflineCampo(listaRegistrosParaInserir, resumoMontado);
        ultimoResumoCampoTexto = resumoMontado;
        document.getElementById('box-ultimo-resumo-whats').classList.remove('hidden');

        resetarFormularioCampo();
        alert(`📡 SINAL 4G INDISPONÍVEL NO LOCAL!\n\nSeu atendimento (${imovelBase}) e todas as fotos foram GUARDADOS COM SEGURANÇA na Fila Offline do aparelho.\n\nVocê já pode copiar o resumo para o WhatsApp e seguir para o próximo prédio. Assim que o sinal voltar, basta clicar em "Sincronizar Fila Offline"!`);
    }
}

// ================= MÓDULO DE APOIO CONJUNTO, VALIDAÇÃO DO TITULAR E BOTÃO SUPORTE NO RODAPÉ =================
function extrairListaApoiosDoMembros(strMembros, nomeTitular) {
    if (!strMembros || typeof strMembros !== 'string') return [];
    const limpo = strMembros.trim();
    if (!limpo || limpo === '__CONFIG_SISTEMA__' || limpo.toUpperCase() === (nomeTitular || '').toUpperCase().trim()) return [];
    const partes = limpo.split('|').map(p => p.trim());
    const validados = [];
    partes.forEach(p => {
        if (p.toUpperCase().startsWith('APOIO_PENDENTE:')) return;
        const sub = p.replace(/^APOIO:/i, '').trim();
        sub.split(',').forEach(n => {
            const nome = n.trim().toUpperCase();
            if (nome && nome !== (nomeTitular || '').toUpperCase().trim() && !validados.includes(nome)) {
                validados.push(nome);
            }
        });
    });
    return validados;
}

function extrairListaApoiosPendentesDoMembros(strMembros, nomeTitular) {
    if (!strMembros || typeof strMembros !== 'string') return [];
    const limpo = strMembros.trim();
    if (!limpo || limpo === '__CONFIG_SISTEMA__') return [];
    const partes = limpo.split('|').map(p => p.trim());
    const pendentes = [];
    partes.forEach(p => {
        if (p.toUpperCase().startsWith('APOIO_PENDENTE:')) {
            const sub = p.replace(/^APOIO_PENDENTE:/i, '').trim();
            sub.split(',').forEach(n => {
                const nome = n.trim().toUpperCase();
                if (nome && nome !== (nomeTitular || '').toUpperCase().trim() && !pendentes.includes(nome)) {
                    pendentes.push(nome);
                }
            });
        }
    });
    return pendentes;
}

function formatarStringMembrosApoio(nomeTitular, arrayValidados, arrayPendentes = []) {
    const titularLimpo = (nomeTitular || '').toUpperCase().trim();
    const valUnicos = [...new Set((arrayValidados || []).map(a => String(a || '').trim().toUpperCase()).filter(a => a && a !== titularLimpo))];
    const pendUnicos = [...new Set((arrayPendentes || []).map(a => String(a || '').trim().toUpperCase()).filter(a => a && a !== titularLimpo && !valUnicos.includes(a)))];

    const blocos = [];
    if (valUnicos.length > 0) blocos.push(`APOIO:${valUnicos.join(', ')}`);
    if (pendUnicos.length > 0) blocos.push(`APOIO_PENDENTE:${pendUnicos.join(', ')}`);
    return blocos.length > 0 ? blocos.join(' | ') : (nomeTitular || '');
}

function capturarCoordenadaGpsFrescaCampo(timeoutMs = 8000) {
    return new Promise((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {
                navigator.geolocation.getCurrentPosition(
                    (pos2) => resolve({ lat: pos2.coords.latitude, lng: pos2.coords.longitude }),
                    () => resolve(null),
                    { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
                );
            },
            { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
        );
    });
}

async function forcarPulsoGpsTempoRealCampo(origem = 'auto') {
    try {
        const selEq = document.getElementById('sel-equipe');
        const nomeTec = (selEq?.value || equipeAutenticadaSessao || '').trim().toUpperCase();
        if (!nomeTec || equipeAutenticadaSessao !== nomeTec) return;

        const agora = Date.now();
        if (origem === 'auto' && (agora - ultimoDisparoGpsCampoTs) < 15000) return;

        const hojeISO = typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
        const telAtual = (typeof telemetriaEquipes !== 'undefined' && telemetriaEquipes && telemetriaEquipes[nomeTec]) ? telemetriaEquipes[nomeTec] : null;

        const turnoAtivoManualmenteHoje = telAtual && telAtual.data === hojeISO && telAtual.statusTurno === 'DISPONIVEL';
        if (!turnoAtivoManualmenteHoje) return;

        const coord = await capturarCoordenadaGpsFrescaCampo(7000);
        if (!coord || isNaN(coord.lat) || isNaN(coord.lng)) return;

        ultimoDisparoGpsCampoTs = Date.now();
        ultimaCoordRastreioCache = { lat: Number(coord.lat.toFixed(6)), lng: Number(coord.lng.toFixed(6)) };

        if (typeof registrarPontoTelemetriaEquipe === 'function') {
            await registrarPontoTelemetriaEquipe(nomeTec, coord.lat, coord.lng, 'DISPONIVEL');
        }
    } catch (e) { console.warn("Aviso no pulso GPS:", e); }
}

function iniciarMonitoramentoGpsAntiCongelamento() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            forcarPulsoGpsTempoRealCampo('retorno_tela');
            verificarSolicitacoesApoioParaTitularCampo();
        }
    });
    window.addEventListener('focus', () => {
        forcarPulsoGpsTempoRealCampo('foco');
        verificarSolicitacoesApoioParaTitularCampo();
    });
    window.addEventListener('pageshow', () => forcarPulsoGpsTempoRealCampo('pageshow'));
    window.addEventListener('online', () => forcarPulsoGpsTempoRealCampo('reconexao'));

    setInterval(() => {
        if (document.visibilityState === 'visible') {
            forcarPulsoGpsTempoRealCampo('auto');
            verificarSolicitacoesApoioParaTitularCampo();
        }
    }, 30000);
}

// ITEM 01, 03 e 04: Oculta todos os botões de Combustível, Material, Imprevisto e Apoio da tela principal e coloca o botão SUPORTE na parte baixa da tela!
function organizarTelaPrincipalEBotaoSuporteRodape() {
// Oculta definitivamente o card "SOLICITAÇÕES RÁPIDAS À GESTÃO (24H)" e botões antigos da tela principal, mantendo-os apenas na Central de Suporte
function organizarTelaPrincipalEBotaoSuporteRodape() {
    // 1. Injeta CSS global de bloqueio para esconder os botões antigos em qualquer ponto do #view-campo (fora do modal de suporte)
    if (!document.getElementById('estilo-ocultar-botoes-suporte-antigos')) {
        const style = document.createElement('style');
        style.id = 'estilo-ocultar-botoes-suporte-antigos';
        style.innerHTML = `
            #view-campo button[onclick*="abrirModalSolicitacaoCombustivelCampo"],
            #view-campo button[onclick*="abrirModalSolicitacaoMaterialCampo"],
            #view-campo button[onclick*="abrirModalImprevisto"],
            #view-campo #box-campo-apoio-conjunto {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    const viewCampo = document.getElementById('view-campo') || document.body;
    const modalSuporte = document.getElementById('modal-central-suporte-campo');

    // 2. Localiza e oculta o card branco "SOLICITAÇÕES RÁPIDAS À GESTÃO (24H)" inteiro
    const botoesAntigos = viewCampo.querySelectorAll(
        'button[onclick*="abrirModalSolicitacaoCombustivelCampo"], ' +
        'button[onclick*="abrirModalSolicitacaoMaterialCampo"], ' +
        'button[onclick*="abrirModalImprevisto"]'
    );

    botoesAntigos.forEach(btn => {
        if (modalSuporte && modalSuporte.contains(btn)) return; // Não oculta os botões de dentro do modal de Suporte!

        btn.style.setProperty('display', 'none', 'important');

        // Sobe na árvore para ocultar também o card pai que tem o título "SOLICITAÇÕES RÁPIDAS À GESTÃO (24H):"
        let ancestral = btn.parentElement;
        while (ancestral && ancestral !== viewCampo && ancestral.id !== 'subview-campo-lancamento' && ancestral.id !== 'form-campo-container' && ancestral.id !== 'bloco-pos-abertura') {
            const textoBloco = (ancestral.innerText || '').toUpperCase();
            // Verifica se este bloco é exclusivamente o card de solicitações rápidas ou a grade dos botões
            const naoTemCamposPrincipais = !ancestral.querySelector('#sel-equipe, #sel-projeto, #inp-imovel, #btn-checkin, #btn-iniciar-expediente-campo');
            if (naoTemCamposPrincipais && (textoBloco.includes('SOLICITAÇÕES RÁPIDAS') || textoBloco.includes('SOLICITACOES RAPIDAS') || ancestral.tagName === 'DIV')) {
                ancestral.style.setProperty('display', 'none', 'important');
                ancestral.classList.add('hidden');
            }
            ancestral = ancestral.parentElement;
        }
    });

    // 3. Caso a frase "SOLICITAÇÕES RÁPIDAS À GESTÃO (24H)" esteja num elemento irmão, garante que o card pai fique oculto
    viewCampo.querySelectorAll('div, section').forEach(div => {
        if (modalSuporte && modalSuporte.contains(div)) return;
        if (div.id === 'view-campo' || div.id === 'subview-campo-lancamento' || div.id === 'form-campo-container' || div.id === 'bloco-pos-abertura') return;
        const txt = (div.innerText || '').toUpperCase();
        if ((txt.includes('SOLICITAÇÕES RÁPIDAS À GESTÃO') || txt.includes('EXCLUSÃO AUTO. 48H')) && !div.querySelector('#sel-equipe, #inp-imovel, #btn-checkin')) {
            // Mantém visível apenas o resumo de status caso exista separado
            if (div.id !== 'box-status-solicitacoes-campo') {
                div.style.setProperty('display', 'none', 'important');
                div.classList.add('hidden');
            }
        }
    });

    // 4. Garante que o botão SUPORTE fique sempre na PARTE BAIXA (rodapé) da tela principal
    const viewLancamento = document.getElementById('subview-campo-lancamento') || document.getElementById('view-campo');
    if (!viewLancamento) return;

    let containerRodape = document.getElementById('container-botao-suporte-rodape');
    if (!containerRodape) {
        containerRodape = document.createElement('div');
        containerRodape.id = 'container-botao-suporte-rodape';
        containerRodape.className = 'w-full pt-4 mt-4 border-t-2 border-slate-200';
        containerRodape.innerHTML = `
            <button type="button" id="btn-central-suporte-rodape" onclick="abrirModalCentralSuporteCampo()" class="w-full box-border bg-slate-900 hover:bg-slate-950 text-white font-black py-3.5 px-4 rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 border-2 border-amber-400">
                <span class="text-base">🛠️</span>
                <span class="tracking-wide uppercase">SUPORTE (Combustível • Material • Imprevisto • Apoio)</span>
            </button>
            <div id="lbl-resumo-apoio-selecionado-rodape" class="text-[10px] text-center font-bold text-purple-800 mt-1 hidden"></div>
        `;
        viewLancamento.appendChild(containerRodape);
    } else if (viewLancamento.lastElementChild !== containerRodape) {
        viewLancamento.appendChild(containerRodape);
    }

    atualizarIndicadorParceiroRodape();
}
                }
            }
        }
    });

    // 3. ITEM 04: Insere o botão SUPORTE na PARTE BAIXA (rodapé) da tela principal do Modo Campo
    let btnSuporteRodape = document.getElementById('btn-central-suporte-rodape');
    if (!btnSuporteRodape) {
        btnSuporteRodape = document.createElement('div');
        btnSuporteRodape.id = 'container-botao-suporte-rodape';
        btnSuporteRodape.className = 'w-full pt-4 mt-4 border-t-2 border-slate-200';
        btnSuporteRodape.innerHTML = `
            <button type="button" id="btn-central-suporte-rodape" onclick="abrirModalCentralSuporteCampo()" class="w-full box-border bg-slate-900 hover:bg-slate-950 text-white font-black py-3.5 px-4 rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 border-2 border-amber-400">
                <span class="text-base">🛠️</span>
                <span class=" tracking-wide uppercase">SUPORTE (Combustível • Material • Imprevisto • Apoio)</span>
            </button>
            <div id="lbl-resumo-apoio-selecionado-rodape" class="text-[10px] text-center font-bold text-purple-800 mt-1 hidden"></div>
        `;
        viewLancamento.appendChild(btnSuporteRodape);
    } else {
        // Garante que fique sempre no final (parte baixa) da viewLancamento
        const containerRodape = document.getElementById('container-botao-suporte-rodape');
        if (containerRodape && viewLancamento.lastElementChild !== containerRodape) {
            viewLancamento.appendChild(containerRodape);
        }
    }

    atualizarIndicadorParceiroRodape();
}

function atualizarIndicadorParceiroRodape() {
    const lbl = document.getElementById('lbl-resumo-apoio-selecionado-rodape');
    if (!lbl) return;
    if (parceiroApoioPreSelecionadoSuporte) {
        lbl.innerText = `🤝 Atuação Conjunta pré-selecionada com: ${parceiroApoioPreSelecionadoSuporte}`;
        lbl.classList.remove('hidden');
    } else {
        lbl.innerText = "";
        lbl.classList.add('hidden');
    }
}

function aoAlterarParceiroApoioDentroDoSuporte(valor) {
    parceiroApoioPreSelecionadoSuporte = (valor || "").trim().toUpperCase();
    const selAberta = document.getElementById('sel-adicionar-apoio-em-andamento');
    if (selAberta && parceiroApoioPreSelecionadoSuporte) {
        selAberta.value = parceiroApoioPreSelecionadoSuporte;
    }
    atualizarIndicadorParceiroRodape();
}

// Modal da Central de Suporte com TODAS as 4 opções + Campo completo de Atuação Conjunta / Equipe de Apoio
function abrirModalCentralSuporteCampo() {
    const nomeEq = validarTecnicoSelecionadoParaSolicitacao();
    if (!nomeEq) return;

    let modal = document.getElementById('modal-central-suporte-campo');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-central-suporte-campo';
        modal.className = 'fixed inset-0 bg-black/65 backdrop-blur-sm flex justify-center items-center p-4 hidden z-[85]';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
                <div class="bg-slate-900 text-white p-4 flex justify-between items-center border-b-4 border-amber-400">
                    <div>
                        <span class="bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Ambiente de Suporte</span>
                        <h3 class="font-bold text-base mt-0.5">🛠️ Central de Suporte & Apoio Operacional</h3>
                    </div>
                    <button type="button" onclick="fecharModalCentralSuporteCampo()" class="text-white font-bold text-lg hover:text-red-300">✕</button>
                </div>
                <div class="p-4 overflow-y-auto space-y-3.5 text-xs text-slate-700">
                    <div class="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                        <div>
                            <span class="text-[9px] text-slate-500 font-bold uppercase block">Técnico Autenticado</span>
                            <span id="lbl-tec-central-suporte" class="font-black text-blue-950 text-xs">-</span>
                        </div>
                        <span class="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded text-[10px]">🟢 PIN Validado</span>
                    </div>

                    <!-- 1. Solicitar Combustível, Material e Imprevisto -->
                    <div class="grid grid-cols-1 gap-2.5">
                        <button type="button" onclick="fecharModalCentralSuporteCampo(); abrirModalSolicitacaoCombustivelCampo();" class="w-full bg-orange-50 hover:bg-orange-100 border-2 border-orange-300 p-3 rounded-xl text-left transition shadow-sm flex items-center gap-3">
                            <span class="text-2xl">⛽</span>
                            <div>
                                <h4 class="font-black text-orange-950 text-xs uppercase">Solicitar Combustível</h4>
                                <p class="text-[10px] text-orange-900">Anexar fotos da Galeria (Painel e Mapa de Bordo) e informar KM.</p>
                            </div>
                        </button>

                        <button type="button" onclick="fecharModalCentralSuporteCampo(); abrirModalSolicitacaoMaterialCampo();" class="w-full bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-300 p-3 rounded-xl text-left transition shadow-sm flex items-center gap-3">
                            <span class="text-2xl">🧰</span>
                            <div>
                                <h4 class="font-black text-indigo-950 text-xs uppercase">Solicitar Material</h4>
                                <p class="text-[10px] text-indigo-900">Solicitar cabos, conectores, NAP, DIO ou caixas para a gestão.</p>
                            </div>
                        </button>

                        <button type="button" onclick="fecharModalCentralSuporteCampo(); abrirModalImprevisto();" class="w-full bg-red-50 hover:bg-red-100 border-2 border-red-300 p-3 rounded-xl text-left transition shadow-sm flex items-center gap-3">
                            <span class="text-2xl">⚠️</span>
                            <div>
                                <h4 class="font-black text-red-950 text-xs uppercase">Informar Imprevisto / Atraso</h4>
                                <p class="text-[10px] text-red-900">Registrar veículo quebrado, chuva forte, bloqueio ou falta de acesso.</p>
                            </div>
                        </button>
                    </div>

                    <!-- 2. Todo o Campo de Atuação Conjunta / Equipe de Apoio -->
                    <div class="bg-purple-50/90 border-2 border-purple-300 rounded-xl p-3.5 space-y-2.5 shadow-sm">
                        <div class="flex flex-wrap justify-between items-center gap-1 border-b border-purple-200 pb-1.5">
                            <label class="block text-xs font-black text-purple-950 uppercase">🤝 Atuação Conjunta / Equipe de Apoio</label>
                            <span class="text-[9px] bg-purple-200 text-purple-900 font-bold px-2 py-0.5 rounded">Validado pelo Titular</span>
                        </div>

                        <div class="space-y-1">
                            <label class="block text-[10px] font-bold text-purple-900">Opção A — Vai iniciar ou está com atividade aberta e recebeu apoio?</label>
                            <select id="sel-equipe-apoio-campo" onchange="aoAlterarParceiroApoioDentroDoSuporte(this.value)" class="w-full box-border text-xs border border-purple-300 rounded-lg p-2.5 bg-white outline-none font-bold text-purple-950">
                                <option value="">Sem apoio (Atuação individual)</option>
                            </select>
                            <button type="button" onclick="confirmarVinculoParceiroPeloSuporte()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-3 rounded-lg text-[11px] shadow-sm transition">
                                ✅ Confirmar / Validar Equipe de Apoio Selecionada Acima
                            </button>
                        </div>

                        <div class="pt-2 border-t border-purple-200 space-y-1">
                            <label class="block text-[10px] font-bold text-purple-900">Opção B — Você ficou livre e foi apoiar outro técnico?</label>
                            <button type="button" onclick="fecharModalCentralSuporteCampo(); abrirModalEntrarEmApoioObraAtivaCampo();" class="w-full box-border bg-purple-700 hover:bg-purple-800 text-white font-black py-2.5 px-3 rounded-lg text-[11px] transition shadow-sm flex items-center justify-center gap-1.5 text-center">
                                🤝 Solicitar Entrada em Apoio (Atividade em Andamento)
                            </button>
                        </div>
                    </div>
                </div>
                <div class="bg-slate-100 p-3 border-t flex justify-end">
                    <button type="button" onclick="fecharModalCentralSuporteCampo()" class="bg-slate-800 text-white text-xs px-5 py-2 rounded-xl font-bold">Fechar Suporte</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('lbl-tec-central-suporte').innerText = nomeEq;
    popularOpcoesParceiroApoioCampo();
    document.getElementById('modal-central-suporte-campo').classList.remove('hidden');
}

function fecharModalCentralSuporteCampo() {
    document.getElementById('modal-central-suporte-campo')?.classList.add('hidden');
}

async function confirmarVinculoParceiroPeloSuporte() {
    const selSup = document.getElementById('sel-equipe-apoio-campo');
    const nomeColega = selSup ? selSup.value.trim().toUpperCase() : '';
    parceiroApoioPreSelecionadoSuporte = nomeColega;
    atualizarIndicadorParceiroRodape();

    if (!nomeColega) {
        alert("ℹ️ Configurado para atuação individual (sem apoio).");
        fecharModalCentralSuporteCampo();
        return;
    }

    // Se já houver atividade em andamento aberta na tela, já grava na nuvem imediatamente!
    if (dadosAtendimento.idEmAndamento) {
        const selAberta = document.getElementById('sel-adicionar-apoio-em-andamento');
        if (selAberta) selAberta.value = nomeColega;
        await vincularColegaApoioNaObraAbertaCampo();
        fecharModalCentralSuporteCampo();
    } else {
        alert(`🤝 Equipe de apoio (${nomeColega}) selecionada!\nAo clicar em "Iniciar Atividade no Imóvel", ela já entrará vinculada automaticamente.`);
        fecharModalCentralSuporteCampo();
    }
}

async function verificarSolicitacoesApoioParaTitularCampo() {
    try {
        const titular = (document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || '').trim().toUpperCase();
        let boxValidacao = document.getElementById('box-validacao-apoio-titular-campo');

        const containerLancamento = document.getElementById('subview-campo-lancamento');
        if (containerLancamento && !boxValidacao) {
            boxValidacao = document.createElement('div');
            boxValidacao.id = 'box-validacao-apoio-titular-campo';
            boxValidacao.className = 'w-full box-border bg-amber-50 border-2 border-amber-500 p-3 rounded-xl space-y-2.5 hidden shadow-md mb-3';
            containerLancamento.insertBefore(boxValidacao, containerLancamento.firstChild);
        }
        if (!boxValidacao) return;

        if (!titular || equipeAutenticadaSessao !== titular) {
            boxValidacao.classList.add('hidden');
            return;
        }

        const hojeISO = typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
        const { data: minhasAtividadesHoje } = await supabaseClient
            .from('registros_producao')
            .select('id, imovel, projeto, equipe, membros, desfecho')
            .eq('data_registro', hojeISO)
            .eq('equipe', titular);

        const atividadesComPendentes = (minhasAtividadesHoje || []).filter(r =>
            extrairListaApoiosPendentesDoMembros(r.membros, r.equipe).length > 0
        );

        const ativAbertaAtual = (minhasAtividadesHoje || []).find(r => r.id === dadosAtendimento.idEmAndamento) || (minhasAtividadesHoje || [])[0];
        if (ativAbertaAtual) {
            const jaValidados = extrairListaApoiosDoMembros(ativAbertaAtual.membros, ativAbertaAtual.equipe);
            const lblBadge = document.getElementById('lbl-parceiro-apoio-atual-campo');
            if (lblBadge) {
                lblBadge.innerText = jaValidados.length > 0 ? `✅ Validado: ${jaValidados.join(', ')}` : 'Individual';
            }
        }

        if (atividadesComPendentes.length === 0) {
            boxValidacao.classList.add('hidden');
            return;
        }

        let htmlCards = `
            <div class="flex items-start gap-2">
                <span class="text-lg animate-bounce">🤝</span>
                <div>
                    <h4 class="text-xs font-black text-amber-950 uppercase">Validação de Presença de Equipe de Apoio!</h4>
                    <p class="text-[11px] text-amber-900">Confirme abaixo se o(s) técnico(s) realmente compareceram para apoiar você nesta atividade:</p>
                </div>
            </div>
        `;

        atividadesComPendentes.forEach(at => {
            const pendentes = extrairListaApoiosPendentesDoMembros(at.membros, at.equipe);
            pendentes.forEach(nomeAp => {
                htmlCards += `
                    <div class="bg-white p-2.5 rounded-xl border-2 border-amber-300 shadow-sm space-y-2 w-full box-border">
                        <div class="text-[11px] text-slate-800 break-words">
                            👷 Técnico de Apoio: <b class="text-purple-950 text-xs">${nomeAp}</b><br>
                            🏢 Atividade / Imóvel: <b>${at.imovel}</b> (${at.projeto})
                        </div>
                        <div class="grid grid-cols-2 gap-2 w-full">
                            <button type="button" onclick="responderValidacaoApoioTitularCampo(${at.id}, '${nomeAp}', true)" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-2 rounded-lg text-[11px] shadow-sm transition text-center">
                                ✅ Validar Presença
                            </button>
                            <button type="button" onclick="responderValidacaoApoioTitularCampo(${at.id}, '${nomeAp}', false)" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-2 rounded-lg text-[11px] shadow-sm transition text-center">
                                ❌ Recusar Apoio
                            </button>
                        </div>
                    </div>
                `;
            });
        });

        boxValidacao.innerHTML = htmlCards;
        boxValidacao.classList.remove('hidden');
    } catch (e) {
        console.warn("Aviso ao checar validações de apoio:", e);
    }
}

async function responderValidacaoApoioTitularCampo(idAtividade, nomeApoiador, aprovar) {
    try {
        const { data: regBanco, error } = await supabaseClient
            .from('registros_producao')
            .select('*')
            .eq('id', idAtividade)
            .maybeSingle();

        if (error || !regBanco) {
            alert("⚠️ Registro não localizado na nuvem.");
            return;
        }

        let validados = extrairListaApoiosDoMembros(regBanco.membros, regBanco.equipe);
        let pendentes = extrairListaApoiosPendentesDoMembros(regBanco.membros, regBanco.equipe).filter(n => n !== nomeApoiador);

        const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        let obsAtual = regBanco.observacoes || '';

        if (aprovar) {
            if (!validados.includes(nomeApoiador)) validados.push(nomeApoiador);
            obsAtual = `${obsAtual} [APOIO_VALIDADO: Presença de ${nomeApoiador} validada pelo titular ${regBanco.equipe} às ${horaAgora}]`.trim();
        } else {
            obsAtual = `${obsAtual} [APOIO_RECUSADO: Solicitação de ${nomeApoiador} recusada pelo titular ${regBanco.equipe} às ${horaAgora}]`.trim();
        }

        const novoMembros = formatarStringMembrosApoio(regBanco.equipe, validados, pendentes);

        const { error: errUpd } = await supabaseClient
            .from('registros_producao')
            .update({ membros: novoMembros, observacoes: obsAtual })
            .eq('id', idAtividade);

        if (errUpd) throw errUpd;

        const lblBadge = document.getElementById('lbl-parceiro-apoio-atual-campo');
        if (lblBadge) {
            lblBadge.innerText = validados.length > 0 ? `✅ Validado: ${validados.join(', ')}` : 'Individual';
        }

        await carregarRegistrosModoCampoLeve();
        await verificarSolicitacoesApoioParaTitularCampo();

        if (aprovar) {
            alert(`✅ PRESENÇA VALIDADA!\n\nVocê confirmou a presença de ${nomeApoiador} atuando em conjunto na atividade do imóvel ${regBanco.imovel}.`);
        } else {
            alert(`❌ Solicitação de apoio de ${nomeApoiador} foi recusada e removida da atividade.`);
        }
    } catch (e) {
        alert("❌ Erro ao validar apoio: " + e.message);
    }
}

function inicializarInterfaceApoioConjuntoCampo() {
    organizarTelaPrincipalEBotaoSuporteRodape();

    if (!document.getElementById('modal-entrar-apoio-campo')) {
        const modal = document.createElement('div');
        modal.id = 'modal-entrar-apoio-campo';
        modal.className = 'fixed inset-0 bg-black/65 backdrop-blur-sm flex justify-center items-center p-4 hidden z-[86]';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-purple-300 flex flex-col max-h-[90vh]">
                <div class="bg-purple-900 text-white p-4 flex justify-between items-center border-b-4 border-purple-400">
                    <div>
                        <span class="bg-purple-300 text-purple-950 font-black text-[9px] px-2 py-0.5 rounded uppercase">Atuação Conjunta • Sujeita à Validação</span>
                        <h3 class="font-bold text-sm mt-0.5">🤝 Solicitar Entrada em Apoio em Atividade</h3>
                    </div>
                    <button type="button" onclick="fecharModalEntrarEmApoioObraAtivaCampo()" class="text-white font-bold text-lg">✕</button>
                </div>
                <div class="p-4 overflow-y-auto space-y-3 text-xs text-slate-700">
                    <div class="bg-purple-50 p-2.5 rounded-xl border border-purple-200 text-[11px] text-purple-950">
                        👷 <b>Técnico Solicitante do Apoio:</b> <span id="lbl-meu-nome-apoio-modal" class="font-black">-</span>
                    </div>
                    <p class="text-[11px] text-slate-600">
                        Selecione a atividade em andamento abaixo. Seu <b>Horário e GPS de chegada</b> serão enviados e o <b>Técnico Titular receberá um alerta na tela dele para validar sua presença</b>:
                    </p>
                    <div id="lista-obras-ativas-para-apoio-campo" class="space-y-2 max-h-64 overflow-y-auto"></div>
                </div>
                <div class="bg-slate-100 p-3 border-t flex justify-end">
                    <button type="button" onclick="fecharModalEntrarEmApoioObraAtivaCampo()" class="bg-slate-400 text-white text-xs px-4 py-2 rounded-xl font-bold">Fechar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    popularOpcoesParceiroApoioCampo();
}

function popularOpcoesParceiroApoioCampo() {
    const selTitular = document.getElementById('sel-equipe');
    const titular = (selTitular?.value || equipeAutenticadaSessao || '').trim().toUpperCase();
    const selApoio1 = document.getElementById('sel-equipe-apoio-campo');
    const selApoio2 = document.getElementById('sel-adicionar-apoio-em-andamento');

    const equipesAtivas = (typeof equipesSistema !== 'undefined' && Array.isArray(equipesSistema))
        ? equipesSistema.filter(e => e.status === 'Ativo' && e.nome !== titular)
        : [];

    if (selApoio1) {
        selApoio1.innerHTML = `<option value="">Sem apoio (Atuação individual)</option>` +
            equipesAtivas.map(eq => `<option value="${eq.nome}">🤝 Em conjunto com: ${eq.nome}</option>`).join('');
        if (parceiroApoioPreSelecionadoSuporte && parceiroApoioPreSelecionadoSuporte !== titular) {
            selApoio1.value = parceiroApoioPreSelecionadoSuporte;
        }
    }

    if (selApoio2) {
        const valAnt2 = selApoio2.value;
        selApoio2.innerHTML = `<option value="">+ Selecionar equipe de apoio para validar...</option>` +
            equipesAtivas.map(eq => `<option value="${eq.nome}">🤝 ${eq.nome}</option>`).join('');
        if (valAnt2 && valAnt2 !== titular) selApoio2.value = valAnt2;
    }
}

async function abrirModalEntrarEmApoioObraAtivaCampo() {
    const meuNome = validarTecnicoSelecionadoParaSolicitacao();
    if (!meuNome) return;

    inicializarInterfaceApoioConjuntoCampo();
    document.getElementById('lbl-meu-nome-apoio-modal').innerText = meuNome;
    const container = document.getElementById('lista-obras-ativas-para-apoio-campo');
    container.innerHTML = `<div class="p-4 text-center text-purple-900 font-bold animate-pulse">☁️ Buscando atividades em andamento hoje...</div>`;
    document.getElementById('modal-entrar-apoio-campo').classList.remove('hidden');

    try {
        const hojeISO = typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
        const { data, error } = await supabaseClient
            .from('registros_producao')
            .select('id, data_registro, equipe, membros, projeto, imovel, h_entrada, desfecho, observacoes')
            .eq('data_registro', hojeISO)
            .in('desfecho', ['EM ANDAMENTO', 'PARALISADA', 'REABERTA']);

        if (error) throw error;

        const atividadesDosColegas = (data || []).filter(r =>
            r.equipe !== '__CONFIG_SISTEMA__' &&
            r.equipe !== meuNome &&
            r.projeto !== 'IMPREVISTO / ATRASO'
        );

        if (atividadesDosColegas.length === 0) {
            container.innerHTML = `<div class="p-4 bg-slate-50 rounded-xl border text-center text-slate-500">Nenhuma atividade de outro técnico está com status "EM ANDAMENTO" hoje neste momento.</div>`;
            return;
        }

        container.innerHTML = atividadesDosColegas.map(at => {
            const validados = extrairListaApoiosDoMembros(at.membros, at.equipe);
            const pendentes = extrairListaApoiosPendentesDoMembros(at.membros, at.equipe);
            const jaValidado = validados.includes(meuNome);
            const jaPendente = pendentes.includes(meuNome);

            let botaoStatusHtml = `<button type="button" onclick="confirmarEntradaApoioObraCampo(${at.id})" class="w-full mt-1 bg-purple-700 hover:bg-purple-800 text-white font-black py-2 rounded-lg text-[11px] shadow-sm transition">🤝 Solicitar Meu Apoio nesta Atividade</button>`;
            if (jaValidado) {
                botaoStatusHtml = `<div class="text-[10px] font-black text-emerald-800 bg-emerald-100 p-1.5 rounded text-center mt-1">✅ Presença já VALIDADA pelo titular ${at.equipe}!</div>`;
            } else if (jaPendente) {
                botaoStatusHtml = `<div class="text-[10px] font-black text-amber-900 bg-amber-100 p-1.5 rounded text-center mt-1 animate-pulse">⏳ Aguardando ${at.equipe} validar sua presença na tela dele...</div>`;
            }

            return `
                <div class="p-3 rounded-xl border-2 ${jaValidado ? 'border-emerald-400 bg-emerald-50/60' : (jaPendente ? 'border-amber-400 bg-amber-50/60' : 'border-purple-200 bg-white')} shadow-sm space-y-1.5">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="font-black text-blue-950 text-xs">🏢 Imóvel: ${at.imovel}</span>
                            <span class="block text-[10px] font-bold text-purple-900">👷 Titular (Validador): ${at.equipe}</span>
                        </div>
                        <span class="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[9px]">${at.projeto}</span>
                    </div>
                    <div class="text-[10px] text-slate-500">🟢 Iniciada às: <b>${at.h_entrada}</b></div>
                    ${botaoStatusHtml}
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div class="p-3 bg-red-50 text-red-700 rounded-xl">Erro ao buscar atividades: ${e.message}</div>`;
    }
}

function fecharModalEntrarEmApoioObraAtivaCampo() {
    document.getElementById('modal-entrar-apoio-campo')?.classList.add('hidden');
}

async function confirmarEntradaApoioObraCampo(idAtividadeAlvo) {
    const meuNome = validarTecnicoSelecionadoParaSolicitacao();
    if (!meuNome) return;

    const coord = await capturarCoordenadaGpsFrescaCampo(7000);
    const gpsStr = coord ? `${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}` : 'GPS Apoio';
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const { data: regBanco, error: errBusca } = await supabaseClient
        .from('registros_producao')
        .select('*')
        .eq('id', idAtividadeAlvo)
        .maybeSingle();

    if (errBusca || !regBanco) {
        alert("❌ Não foi possível localizar a atividade na nuvem.");
        return;
    }

    const validados = extrairListaApoiosDoMembros(regBanco.membros, regBanco.equipe);
    const pendentes = extrairListaApoiosPendentesDoMembros(regBanco.membros, regBanco.equipe);
    if (!validados.includes(meuNome) && !pendentes.includes(meuNome)) {
        pendentes.push(meuNome);
    }

    const novoMembros = formatarStringMembrosApoio(regBanco.equipe, validados, pendentes);
    const notaApoio = `[APOIO_CONJUNTO: ${meuNome} entrou em apoio às ${horaAgora} (GPS: ${gpsStr})]`;
    const obsAtual = regBanco.observacoes || '';
    const novaObs = obsAtual.includes(notaApoio) ? obsAtual : `${notaApoio} ${obsAtual}`.trim();

    const { error: errUpd } = await supabaseClient
        .from('registros_producao')
        .update({ membros: novoMembros, observacoes: novaObs })
        .eq('id', idAtividadeAlvo);

    if (errUpd) {
        alert("❌ Erro ao enviar solicitação de apoio: " + errUpd.message);
        return;
    }

    const hojeISO = typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
    const telMeu = (typeof telemetriaEquipes !== 'undefined' && telemetriaEquipes) ? telemetriaEquipes[meuNome] : null;
    if (coord && telMeu && telMeu.data === hojeISO && telMeu.statusTurno === 'DISPONIVEL' && typeof registrarPontoTelemetriaEquipe === 'function') {
        await registrarPontoTelemetriaEquipe(meuNome, coord.lat, coord.lng, 'DISPONIVEL');
    }

    if (typeof carregarRegistrosModoCampoLeve === 'function') await carregarRegistrosModoCampoLeve();
    fecharModalEntrarEmApoioObraAtivaCampo();
    atualizarAbaMinhasAtividadesCampo(false);
    alert(`⏳ SOLICITAÇÃO DE APOIO ENVIADA!\n\nSua chegada na atividade às ${horaAgora} foi registrada.\nPeça ao técnico titular (${regBanco.equipe}) para clicar em "✅ Validar Presença" na tela dele!`);
}

async function vincularColegaApoioNaObraAbertaCampo() {
    const selColega = document.getElementById('sel-adicionar-apoio-em-andamento') || document.getElementById('sel-equipe-apoio-campo');
    const nomeColega = (selColega ? selColega.value : parceiroApoioPreSelecionadoSuporte || '').trim().toUpperCase();
    if (!nomeColega) {
        alert("⚠️ Selecione o nome da equipe/técnico cuja presença você deseja validar nesta atividade.");
        return;
    }

    try {
        if (dadosAtendimento.idEmAndamento) {
            const { data: regAtual } = await supabaseClient
                .from('registros_producao')
                .select('id, equipe, membros, observacoes')
                .eq('id', dadosAtendimento.idEmAndamento)
                .maybeSingle();

            if (regAtual) {
                const listaVal = extrairListaApoiosDoMembros(regAtual.membros, regAtual.equipe);
                const listaPend = extrairListaApoiosPendentesDoMembros(regAtual.membros, regAtual.equipe).filter(n => n !== nomeColega);
                if (!listaVal.includes(nomeColega)) listaVal.push(nomeColega);
                const novoMemb = formatarStringMembrosApoio(regAtual.equipe, listaVal, listaPend);
                const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const obsNova = `${regAtual.observacoes || ''} [APOIO_VALIDADO: Presença de ${nomeColega} validada pelo titular ${regAtual.equipe} às ${horaAgora}]`.trim();

                await supabaseClient.from('registros_producao').update({ membros: novoMemb, observacoes: obsNova }).eq('id', regAtual.id);

                const lblBadge = document.getElementById('lbl-parceiro-apoio-atual-campo');
                if (lblBadge) lblBadge.innerText = `✅ Validado: ${listaVal.join(', ')}`;
            }
        }
        await verificarSolicitacoesApoioParaTitularCampo();
        alert(`✅ Presença da equipe de apoio (${nomeColega}) VALIDADA em conjunto nesta atividade!`);
    } catch (e) {
        console.warn("Aviso ao validar apoio em andamento:", e);
    }
}

setTimeout(() => {
    inicializarInterfaceApoioConjuntoCampo();
    iniciarMonitoramentoGpsAntiCongelamento();
    verificarSolicitacoesApoioParaTitularCampo();
    organizarTelaPrincipalEBotaoSuporteRodape();
}, 400);
