// ================= VARIÁVEIS GLOBAIS DO MAPA DE RASTREAMENTO (LEAFLET) =================
let mapaRastreioInstancia = null;
let camadaMarcadoresRastreio = null;
let coordenadasPinosAtuais = [];

function inicializarOuAtualizarMapaRastreio(listaPinos) {
    const containerMapa = document.getElementById('mapa-rastreio-equipes');
    if (!containerMapa || typeof L === 'undefined') return;

    if (!mapaRastreioInstancia) {
        // Inicia centralizado no Rio de Janeiro por padrão
        mapaRastreioInstancia = L.map('mapa-rastreio-equipes').setView([-22.9068, -43.1729], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap • GPD PROCISA RJ'
        }).addTo(mapaRastreioInstancia);
        camadaMarcadoresRastreio = L.layerGroup().addTo(mapaRastreioInstancia);
    }

    setTimeout(() => {
        if (mapaRastreioInstancia) mapaRastreioInstancia.invalidateSize();
    }, 180);

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
            html: `
                <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
                    <div style="background:${p.corHex};color:#fff;font-weight:900;font-size:10px;padding:2px 7px;border-radius:8px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);white-space:nowrap;display:flex;align-items:center;gap:4px;">
                        <span>${p.iconeEmoji}</span>
                        <span>${primeiroNome}</span>
                    </div>
                    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${p.corHex};margin-top:-1px;"></div>
                </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });

        const marker = L.marker([p.lat, p.lng], { icon: iconeHtml });
        marker.bindPopup(`
            <div style="font-family:sans-serif;font-size:11px;line-height:1.4;min-width:190px;">
                <div style="font-weight:900;color:#0f172a;font-size:12px;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-bottom:4px;">
                    👷 ${p.nome}
                </div>
                <div><b>Status:</b> <span style="color:${p.corHex};font-weight:800;">${p.statusTexto}</span></div>
                <div><b>Expediente:</b> ${p.turnoTexto}</div>
                <div><b>Ocupação:</b> ${p.ocupacaoLimpa}</div>
                <div><b>Último Sinal:</b> ${p.sinalTexto}</div>
                <div style="margin-top:5px;padding-top:4px;border-top:1px solid #f1f5f9;">
                    <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" style="color:#2563eb;font-weight:bold;text-decoration:underline;">
                        🗺️ Abrir no Google Maps (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})
                    </a>
                </div>
            </div>
        `);
        marker.addTo(camadaMarcadoresRastreio);

        if (containerAtalhos) {
            const btnAtalho = document.createElement('button');
            btnAtalho.type = "button";
            btnAtalho.className = "px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-sm transition hover:opacity-90 flex items-center gap-1";
            btnAtalho.style.backgroundColor = p.corHex;
            btnAtalho.innerHTML = `<span>${p.iconeEmoji}</span> <span>${p.nome}</span>`;
            btnAtalho.onclick = () => focarTecnicoNoMapa(p.lat, p.lng, p.nome);
            containerAtalhos.appendChild(btnAtalho);
        }
    });

    if (containerAtalhos && coordenadasPinosAtuais.length === 0) {
        containerAtalhos.innerHTML = `<span class="text-[11px] text-slate-400 italic">Nenhum técnico transmitiu coordenada GPS hoje até o momento.</span>`;
    }

    const lblCont = document.getElementById('lbl-contador-pinos-mapa');
    if (lblCont) {
        lblCont.innerText = `${coordenadasPinosAtuais.length} técnico(s) no mapa`;
    }

    const badgeAbaMapa = document.getElementById('badge-aba-mapa');
    if (badgeAbaMapa) {
        badgeAbaMapa.innerText = `${coordenadasPinosAtuais.length} no mapa`;
    }
}

function centralizarMapaEquipes() {
    if (!mapaRastreioInstancia) return;
    mapaRastreioInstancia.invalidateSize();
    if (coordenadasPinosAtuais.length === 0) {
        mapaRastreioInstancia.setView([-22.9068, -43.1729], 11);
        alert("ℹ️ Ainda não há coordenadas de GPS ativas hoje para centralizar.");
        return;
    }
    if (coordenadasPinosAtuais.length === 1) {
        mapaRastreioInstancia.setView(coordenadasPinosAtuais[0], 16);
    } else {
        const bounds = L.latLngBounds(coordenadasPinosAtuais);
        mapaRastreioInstancia.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
    }
}

function focarTecnicoNoMapa(lat, lng, nome) {
    if (isNaN(lat) || isNaN(lng)) return;

    // Se o gestor clicar a partir da aba Disponibilidade, muda automaticamente para a aba independente do Mapa
    const subMapa = document.getElementById('subview-mapa');
    if (subMapa && subMapa.classList.contains('hidden')) {
        mudarSubAbaGestor('mapa');
    }

    const elMapa = document.getElementById('mapa-rastreio-equipes');
    if (elMapa) elMapa.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
        if (!mapaRastreioInstancia) {
            renderizarPainelDisponibilidade();
        }
        if (mapaRastreioInstancia) {
            mapaRastreioInstancia.invalidateSize();
            mapaRastreioInstancia.setView([lat, lng], 16);
        }
    }, 280);
}

function converterHorarioParaMinutos(strHora) {
    if (!strHora || typeof strHora !== 'string' || !strHora.includes(':')) return null;
    const partes = strHora.trim().split(':');
    const h = parseInt(partes[0], 10);
    const m = parseInt(partes[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return (h * 60) + m;
}

function formatarMinutosParaHHMM(totalMinutos) {
    if (totalMinutos === null || isNaN(totalMinutos) || totalMinutos < 0) return "--:--";
    const h = Math.floor(totalMinutos / 60);
    const m = Math.round(totalMinutos % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatarDuracaoTexto(totalMinutos) {
    if (totalMinutos === null || isNaN(totalMinutos) || totalMinutos <= 0) return "--h --m";
    const h = Math.floor(totalMinutos / 60);
    const m = Math.round(totalMinutos % 60);
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
}

function stringParaHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
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
            ...chartOriginal.config.options,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                ...chartOriginal.config.options.plugins,
                legend: { display: true, position: 'top' }
            },
            onClick: (event, elements) => {
                if (elements.length > 0 && chartOriginal.config.options.onClick) {
                    chartOriginal.config.options.onClick(event, elements);
                }
            }
        }
    });
}

function fecharModalGraficoExpandido() {
    const modal = document.getElementById('modal-expandir-grafico');
    if (modal) modal.classList.add('hidden');
    if (graficoExpandidoInstancia) {
        graficoExpandidoInstancia.destroy();
        graficoExpandidoInstancia = null;
    }
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
    const theadClone = tabelaClone.querySelector('thead');
    if (theadClone) {
        theadClone.classList.add('sticky', 'top-0', 'z-10', 'shadow-sm');
    }

    const linhasOriginais = tbodyOrigem.querySelectorAll('tr');
    const tbodyClone = tabelaClone.querySelector('tbody');
    if (tbodyClone) {
        tbodyClone.removeAttribute('id');
        const linhasClonadas = tbodyClone.querySelectorAll('tr');
        linhasClonadas.forEach((trClone, idx) => {
            const trOrig = linhasOriginais[idx];
            if (trOrig && typeof trOrig.onclick === 'function') {
                trClone.onclick = (ev) => {
                    fecharModalTabelaExpandida();
                    trOrig.onclick(ev);
                };
            }
        });
    }

    container.appendChild(tabelaClone);
    modal.classList.remove('hidden');
}

function fecharModalTabelaExpandida() {
    const modal = document.getElementById('modal-expandir-tabela');
    if (modal) modal.classList.add('hidden');
}

async function autorizarReaberturaCampo(id) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') {
        alert("⚠️ Apenas Gestores (Master ou Operador) podem autorizar a reabertura de uma atividade.");
        return;
    }
    const reg = registrosSalvos.find(r => r.id === id);
    if (!reg) return;

    const motivoReabertura = prompt(`🔓 AUTORIZAR REABERTURA PARA O TÉCNICO:\n\nImóvel: ${reg.imovel}\nTécnico: ${reg.equipe}\nStatus Atual: ${reg.desfecho}\n\nInforme brevemente o motivo da reabertura (ficará salvo na Auditoria):`, "Correção de dados / inclusão de fotos");
    if (motivoReabertura === null) return;

    const { error } = await supabaseClient
        .from('registros_producao')
        .update({
            desfecho: "REABERTA"
        })
        .eq('id', id);

    if (error) {
        alert("❌ Erro ao reabrir atividade: " + error.message);
        return;
    }

    registrarLogAuditoria(
        "REABERTURA AUTORIZADA",
        `Gestor ${usuarioLogado} autorizou a reabertura do imóvel ${reg.imovel} (ID: ${id}) para o técnico ${reg.equipe}. Status anterior: ${reg.desfecho} | Motivo: ${motivoReabertura || 'Ajuste operacional'}`
    );

    alert(`✅ Atividade do imóvel "${reg.imovel}" foi REABERTA!\n\nO técnico ${reg.equipe} já pode visualizá-la e editá-la no Modo Campo.`);
    await recarregarDadosGestor();
}

// ================= MOVIMENTAÇÃO / TRANSFERÊNCIA DE ATIVIDADE ENTRE TÉCNICOS =================

function abrirModalTransferirAtividade(id) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') {
        alert("⚠️ Apenas usuários Master ou Operador podem movimentar atividades entre técnicos.");
        return;
    }

    const reg = registrosSalvos.find(r => r.id === id);
    if (!reg) return;

    if (['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(reg.desfecho)) {
        alert("⚠️ Não é permitido transferir atividades que já estejam Concluídas, Pendentes ou Malogradas.");
        return;
    }

    document.getElementById('transf-reg-id').value = reg.id;
    document.getElementById('transf-lbl-imovel').innerText = reg.imovel;
    document.getElementById('transf-lbl-projeto').innerText = reg.projeto;
    document.getElementById('transf-lbl-status').innerText = reg.desfecho;
    document.getElementById('transf-lbl-atual').innerText = reg.equipe;
    document.getElementById('inp-motivo-transf').value = "";

    const selDestino = document.getElementById('sel-tecnico-destino-transf');
    if (selDestino) {
        const equipesAtivas = equipesSistema.filter(e => e.status === 'Ativo' && e.nome !== reg.equipe);
        selDestino.innerHTML = `<option value="">Selecione o técnico de destino...</option>` +
            equipesAtivas.map(eq => `<option value="${eq.nome}">${eq.nome} (${formatarSetoresString(eq.setor)})</option>`).join('');
    }

    document.getElementById('modal-transferir-atividade').classList.remove('hidden');
}

function fecharModalTransferirAtividade() {
    const modal = document.getElementById('modal-transferir-atividade');
    if (modal) modal.classList.add('hidden');
}

async function confirmarTransferenciaAtividade() {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') return;

    const id = Number(document.getElementById('transf-reg-id').value);
    const novoTecnico = document.getElementById('sel-tecnico-destino-transf').value;
    const motivo = document.getElementById('inp-motivo-transf').value.trim();

    if (!novoTecnico) {
        alert("⚠️ Selecione o técnico de destino para realizar a transferência.");
        return;
    }

    const reg = registrosSalvos.find(r => r.id === id);
    if (!reg) return;

    const tecnicoAnterior = reg.equipe;
    const infoMotivo = motivo ? ` (Motivo: ${motivo})` : '';
    const novoMotivoDesfecho = `${reg.motivoDesfecho ? reg.motivoDesfecho + ' | ' : ''}🔀 Transferida de ${tecnicoAnterior} para ${novoTecnico}${infoMotivo}`;

    const { error } = await supabaseClient
        .from('registros_producao')
        .update({
            equipe: novoTecnico,
            membros: novoTecnico,
            motivo_desfecho: novoMotivoDesfecho
        })
        .eq('id', id);

    if (error) {
        alert("❌ Erro ao transferir atividade: " + error.message);
        return;
    }

    registrarLogAuditoria(
        "TRANSFERÊNCIA DE ATIVIDADE",
        `Imóvel ${reg.imovel} (${reg.projeto} - Status: ${reg.desfecho}) movimentado de '${tecnicoAnterior}' para '${novoTecnico}' por ${usuarioLogado}.${infoMotivo}`
    );

    fecharModalTransferirAtividade();
    await recarregarDadosGestor();
    alert(`✅ Atividade do imóvel "${reg.imovel}" transferida com sucesso para ${novoTecnico}!`);
}

function abrirModalImportarPlanilha() {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') {
        alert("⚠️ Permissão insuficiente para importar planilha de atividades.");
        return;
    }
    document.getElementById('inp-arquivo-planilha').value = "";
    document.getElementById('txt-linhas-planilha').value = "";
    document.getElementById('modal-importar-planilha').classList.remove('hidden');
}

function fecharModalImportarPlanilha() {
    document.getElementById('modal-importar-planilha').classList.add('hidden');
}

function baixarModeloPlanilhaCSV() {
    const cabecalho = "IMOVEL;ENDERECO;PROJETO;TECNICO;QTD_BLOCOS;ANDARES;HPS;RESPONSAVEL;CONTATO;EMAIL;OBSERVACOES\n";
    const ex1 = "IMO-1001;Rua Conde de Bonfim 450 - Tijuca;VISTORIA;ANDREO FAGUNDES;2;10;40;Sr. Carlos (Síndico);21 99888-7766;sindico@bonfim450.com.br;Condomínio com 2 blocos (Bloco A e B)\n";
    const ex2 = "IMO-2002;Av Nossa Senhora de Copacabana 800;CONSTRUÇÃO F;BRUNO SOARES DA SILVA;1;12;60;Dona Maria (Zeladora);21 98777-6655;portaria@copa800.com.br;Procurar zeladora até as 16h\n";
    const ex3 = "IMO-3003;Rua Voluntários da Pátria 190 - Botafogo;ATIVAÇÃO ON GOING;CESAR SALES ROSA;3;8;32;Portaria Central;21 97666-5544;adm@voluntarios190.com.br;3 Blocos independentes - liberado acesso\n";
    const blob = new Blob(['\ufeff' + cabecalho + ex1 + ex2 + ex3], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planilha_carga_gpd_procisa_${obterDataLocalISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function lerArquivoPlanilhaUpload(inputEl) {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('txt-linhas-planilha').value = e.target.result || "";
    };
    reader.readAsText(file, 'UTF-8');
}

async function processarImportacaoPlanilha() {
    const textoBruto = document.getElementById('txt-linhas-planilha').value.trim();
    if (!textoBruto) {
        alert("⚠️ Selecione um arquivo .CSV ou cole as linhas da planilha na caixa de texto.");
        return;
    }

    const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const hojeISO = obterDataLocalISO();
    const novosRegistros = [];

    linhas.forEach((linha, idx) => {
        if (idx === 0 && (linha.toUpperCase().startsWith("IMOVEL") || linha.toUpperCase().startsWith("IMÓVEL") || linha.toUpperCase().includes("ENDERECO;PROJETO"))) {
            return;
        }

        let delimitador = ';';
        if (linha.includes('\t')) delimitador = '\t';
        else if (!linha.includes(';') && linha.includes(',')) delimitador = ',';

        const partes = linha.split(delimitador).map(p => p.trim());
        if (partes.length < 4) return;

        const imovel      = partes[0];
        const endereco    = partes[1] || "Endereço a confirmar";
        const projeto     = normalizarNomeProjeto(partes[2] || "CONSTRUÇÃO ON GOING");
        const tecnico     = (partes[3] || "").toUpperCase().trim();
        const qtdBlocos   = Math.max(1, Math.min(20, Number(partes[4]) || 1));
        const andares     = Number(partes[5]) || 0;
        const hps         = Number(partes[6]) || 0;
        const responsavel = partes[7] || "";
        const contato     = partes[8] || "";
        const email       = partes[9] || "";
        const obsGestao   = partes[10] || "Atividade programada pela gestão.";

        if (!imovel || !tecnico) return;

        novosRegistros.push({
            id: Date.now() + idx + Math.floor(Math.random() * 1000),
            data_registro: hojeISO,
            equipe: tecnico,
            membros: tecnico,
            projeto: TODOS_OS_PROJETOS.includes(projeto) ? projeto : "CONSTRUÇÃO ON GOING",
            imovel: imovel,
            h_entrada: "Programada",
            h_saida: "Aguardando",
            gps_entrada: "Carga Gestor",
            gps_saida: "-",
            desfecho: "PROGRAMADA",
            motivo_desfecho: `Carga Programada (${qtdBlocos} Bloco${qtdBlocos > 1 ? 's' : ''}) por ${usuarioLogado || 'Gestor'}`,
            malogros: [],
            responsavel: responsavel,
            contato: contato,
            email: email,
            agendamento: null,
            andares: andares,
            hps: hps,
            servico_obra: "SIM",
            observacoes: `[END: ${endereco}] [BLOCOS: ${qtdBlocos}] ${obsGestao}`.trim()
        });
    });

    if (novosRegistros.length === 0) {
        alert("⚠️ Nenhuma linha válida encontrada. Certifique-se de informar pelo menos: IMOVEL ; ENDERECO ; PROJETO ; TECNICO ; QTD_BLOCOS");
        return;
    }

    const btn = document.getElementById('btn-confirmar-importacao');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Enviando carga para a nuvem...";
    }

    const { error } = await supabaseClient.from('registros_producao').insert(novosRegistros);

    if (btn) {
        btn.disabled = false;
        btn.innerText = "🚀 Enviar Atividades para os Técnicos";
    }

    if (error) {
        alert("❌ Erro ao importar planilha: " + error.message);
        return;
    }

    registrarLogAuditoria(
        "IMPORTAÇÃO DE PLANILHA",
        `Importadas ${novosRegistros.length} atividade(s) programada(s) com definição de blocos diretamente para os técnicos.`
    );

    fecharModalImportarPlanilha();
    await recarregarDadosGestor();
    alert(`✅ Sucesso! ${novosRegistros.length} atividade(s) foram enviadas para os técnicos com a quantidade de blocos configurada!`);
}

// ================= PAINEL DE DISPONIBILIDADE + ABA INDEPENDENTE DO MAPA =================

function renderizarPainelDisponibilidade() {
    try {
        const tbody = document.getElementById('tabela-disponibilidade-corpo');
        if (!tbody) return;
        tbody.innerHTML = "";

        const hojeISO = obterDataLocalISO();
        const equipesAtivas = equipesSistema.filter(e => e.status === 'Ativo');

        let countDisp = 0;
        let countAtend = 0;
        let countIndisp = 0;
        let countOffline = 0;

        const listaPinosParaMapa = [];

        equipesAtivas.forEach(eq => {
            const regsHoje = registrosSalvos.filter(r => r.equipe === eq.nome && r.dataRegistro === hojeISO);
            const impAberto = regsHoje.find(r => r.desfecho === 'IMPREVISTO');
            const obraParalisada = regsHoje.find(r => r.desfecho === 'PARALISADA');
            const obraAndamento = regsHoje.find(r => r.desfecho === 'EM ANDAMENTO' || r.desfecho === 'REABERTA');
            const programadasHoje = registrosSalvos.filter(r => r.equipe === eq.nome && r.desfecho === 'PROGRAMADA').length;
            const concluidasHoje = regsHoje.filter(r => r.desfecho === 'CONCLUIDA').length;

            const tel = (telemetriaEquipes && telemetriaEquipes[eq.nome] && telemetriaEquipes[eq.nome].data === hojeISO)
                ? telemetriaEquipes[eq.nome]
                : null;

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

            let latFinal = (tel && tel.lat) ? Number(tel.lat) : null;
            let lngFinal = (tel && tel.lng) ? Number(tel.lng) : null;
            let horaSinal = (tel && tel.horaUltimoSinal) ? tel.horaUltimoSinal : null;
            let tsSinal = (tel && tel.timestampUltimoSinal) ? Number(tel.timestampUltimoSinal) : null;

            const ultimoRegHojeComGps = regsHoje.find(r => r.gpsEntrada && r.gpsEntrada.includes(','));
            if ((latFinal === null || isNaN(latFinal)) && ultimoRegHojeComGps) {
                const partes = ultimoRegHojeComGps.gpsEntrada.split(',').map(s => parseFloat(s.trim()));
                if (partes.length === 2 && !isNaN(partes[0])) {
                    latFinal = partes[0];
                    lngFinal = partes[1];
                    horaSinal = ultimoRegHojeComGps.hEntrada;
                }
            }

            let statusBadge = "";
            let detalheTexto = "";
            let ocupacaoLimpa = "";
            let acaoHtml = "-";
            let corPinoHex = "#64748b";
            let iconeEmojiPino = "⚪";
            let statusTextoPuro = "OFFLINE";

            if (impAberto) {
                countIndisp++;
                corPinoHex = "#dc2626";
                iconeEmojiPino = "🔴";
                statusTextoPuro = "INDISPONÍVEL (IMPREVISTO)";
                statusBadge = `<span class="bg-red-100 text-red-800 border border-red-300 font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🔴 INDISPONÍVEL (IMPREVISTO)</span>`;
                const mot = (impAberto.malogros && impAberto.malogros.length > 0) ? impAberto.malogros.join(' + ') : impAberto.motivoDesfecho;
                detalheTexto = `<span class="font-bold text-red-900">${mot}</span> <span class="text-slate-500">(Desde ${impAberto.hEntrada})</span>`;
                ocupacaoLimpa = `Imprevisto: ${mot}`;
                if (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador') {
                    acaoHtml = `<button onclick="resolverImprevistoPorId(${impAberto.id}, true)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow-sm">✅ Liberar</button>`;
                }
            } else if (obraParalisada) {
                countAtend++;
                corPinoHex = "#ea580c";
                iconeEmojiPino = "⏸️";
                statusTextoPuro = "ATIVIDADE PARALISADA";
                statusBadge = `<span class="bg-orange-500 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block animate-pulse">⏸️ ATIVIDADE PARALISADA</span>`;
                detalheTexto = `Imóvel: <b>${obraParalisada.imovel}</b> (${obraParalisada.projeto}) • <span class="text-orange-800 font-semibold">${obraParalisada.motivoDesfecho || 'Em pausa'}</span>`;
                ocupacaoLimpa = `Pausa no imóvel ${obraParalisada.imovel}`;
                acaoHtml = `<button onclick="abrirDetalhesAtividade(registrosSalvos.find(r => r.id === ${obraParalisada.id}))" class="bg-orange-50 text-orange-800 font-bold text-[10px] px-2.5 py-1 rounded border border-orange-200">👁️ Ver Obra</button>`;
            } else if (obraAndamento) {
                countAtend++;
                corPinoHex = "#2563eb";
                iconeEmojiPino = "🔵";
                statusTextoPuro = "EM ATENDIMENTO";
                statusBadge = `<span class="bg-blue-600 text-white font-black px-2.5 py-1 rounded-md text-[10px] inline-block animate-pulse">🔵 EM ATENDIMENTO</span>`;
                detalheTexto = `Imóvel: <b>${obraAndamento.imovel}</b> (${obraAndamento.projeto}) • Início às <b>${obraAndamento.hEntrada}</b>`;
                ocupacaoLimpa = `Atendendo ${obraAndamento.imovel} (${obraAndamento.projeto})`;
                acaoHtml = `<button onclick="abrirDetalhesAtividade(registrosSalvos.find(r => r.id === ${obraAndamento.id}))" class="bg-blue-50 text-blue-800 font-bold text-[10px] px-2.5 py-1 rounded border border-blue-200">👁️ Ver Obra</button>`;
            } else if (turnoEncerrado) {
                countOffline++;
                corPinoHex = "#475569";
                iconeEmojiPino = "🏁";
                statusTextoPuro = "EXPEDIENTE ENCERRADO";
                statusBadge = `<span class="bg-slate-200 text-slate-700 border border-slate-300 font-bold px-2.5 py-1 rounded-md text-[10px] inline-block">🏁 EXPEDIENTE ENCERRADO</span>`;
                detalheTexto = `<span class="text-slate-500">Turno finalizado às ${tel.horaFim || '--:--'} (${concluidasHoje} concluída(s) hoje)</span>`;
                ocupacaoLimpa = `Turno encerrado (${concluidasHoje} concluída(s) hoje)`;
            } else if (turnoIniciado || regsHoje.length > 0) {
                countDisp++;
                corPinoHex = "#059669";
                iconeEmojiPino = "🟢";
                statusTextoPuro = "EM ROTA / DISPONÍVEL";
                statusBadge = `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-black px-2.5 py-1 rounded-md text-[10px] inline-block">🟢 EM ROTA / DISPONÍVEL</span>`;
                const txtProg = programadasHoje > 0 ? ` • <b class="text-cyan-800">${programadasHoje} programada(s) na fila</b>` : '';
                detalheTexto = `<span class="text-emerald-900 font-medium">Em deslocamento / Livre (${concluidasHoje} concluída(s) hoje${txtProg})</span>`;
                ocupacaoLimpa = `Disponível em rota (${concluidasHoje} concluída(s) hoje)`;
            } else {
                countOffline++;
                corPinoHex = "#94a3b8";
                iconeEmojiPino = "⚪";
                statusTextoPuro = "AGUARDANDO INÍCIO";
                statusBadge = `<span class="bg-slate-100 text-slate-500 border border-slate-200 font-bold px-2.5 py-1 rounded-md text-[10px] inline-block">⚪ AGUARDANDO INÍCIO</span>`;
                const txtProg = programadasHoje > 0 ? `<b class="text-cyan-800">${programadasHoje} programada(s) na fila</b>` : 'Sem check-in hoje';
                detalheTexto = `<span class="text-slate-400">Ainda não clicou em Iniciar Expediente (${txtProg})</span>`;
                ocupacaoLimpa = "Aguardando início do expediente";
            }

            let gpsStr = `<span class="text-slate-400 text-[10px]">Sem sinal hoje</span>`;
            let sinalTextoPuro = "Sem sinal hoje";

            if (latFinal !== null && lngFinal !== null && !isNaN(latFinal) && !isNaN(lngFinal)) {
                let badgeIdadeSinal = "";
                if (tsSinal) {
                    const diffMin = Math.max(0, Math.round((Date.now() - tsSinal) / 60000));
                    if (diffMin <= 3) {
                        badgeIdadeSinal = `<span class="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[9px]">📡 Há ${diffMin <= 1 ? '1 min' : diffMin + ' min'} (Ao vivo)</span>`;
                        sinalTextoPuro = `${horaSinal || ''} (Há ${diffMin} min - Ao vivo)`;
                    } else {
                        badgeIdadeSinal = `<span class="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded text-[9px]">⏸️ Há ${diffMin} min (2º plano)</span>`;
                        sinalTextoPuro = `${horaSinal || ''} (Há ${diffMin} min)`;
                    }
                } else if (horaSinal) {
                    badgeIdadeSinal = `<span class="bg-blue-50 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[9px]">🕒 Às ${horaSinal}</span>`;
                    sinalTextoPuro = `Às ${horaSinal}`;
                }

                const coordFormatada = `${latFinal.toFixed(5)}, ${lngFinal.toFixed(5)}`;
                gpsStr = `
                    <div class="flex flex-col gap-1">
                        <div>${badgeIdadeSinal}</div>
                        <a href="https://www.google.com/maps/search/?api=1&query=${latFinal},${lngFinal}" target="_blank" class="text-blue-600 underline font-mono text-[10px]">🗺️ ${coordFormatada}</a>
                    </div>
                `;

                const btnFocarMapa = `<button type="button" onclick="focarTecnicoNoMapa(${latFinal}, ${lngFinal}, '${eq.nome}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[10px] px-2 py-1 rounded mr-1">🎯 Ver no Mapa</button>`;
                acaoHtml = acaoHtml === "-" ? btnFocarMapa : `${btnFocarMapa} ${acaoHtml}`;

                listaPinosParaMapa.push({
                    nome: eq.nome,
                    lat: latFinal,
                    lng: lngFinal,
                    corHex: corPinoHex,
                    iconeEmoji: iconeEmojiPino,
                    statusTexto: statusTextoPuro,
                    turnoTexto: turnoTextoPuro,
                    ocupacaoLimpa: ocupacaoLimpa,
                    sinalTexto: sinalTextoPuro
                });
            }

            const setorBadge = obterBadgeSetorHtml(eq.setor);

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50 border-b">
                    <td class="p-3 font-bold text-slate-800">${eq.nome}</td>
                    <td class="p-3">${setorBadge}</td>
                    <td class="p-3">${turnoHtml}</td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3">${detalheTexto}</td>
                    <td class="p-3">${gpsStr}</td>
                    <td class="p-3 whitespace-nowrap">${acaoHtml}</td>
                </tr>
            `;
        });

        const elDisp = document.getElementById('disp-card-disponiveis');
        const elAtend = document.getElementById('disp-card-atendimento');
        const elIndisp = document.getElementById('disp-card-indisponiveis');
        const elOff = document.getElementById('disp-card-offline');
        const elBadgeIndisp = document.getElementById('badge-aba-indisp');

        if (elDisp) elDisp.innerText = countDisp;
        if (elAtend) elAtend.innerText = countAtend;
        if (elIndisp) elIndisp.innerText = countIndisp;
        if (elOff) elOff.innerText = countOffline;
        if (elBadgeIndisp) elBadgeIndisp.innerText = `${countIndisp} indisp.`;

        inicializarOuAtualizarMapaRastreio(listaPinosParaMapa);
    } catch (e) {
        console.warn("Aviso ao renderizar disponibilidade e mapa:", e);
    }
}

async function atualizarDashboardGestor() {
    if (!registrosSalvos || registrosSalvos.length === 0) {
        await carregarRegistrosDaNuvem(true);
    }

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

    let filtradosBase = registrosSalvos.filter(item => {
        let mData = true;
        if (dataInicio && dataFim) {
            mData = item.dataRegistro >= dataInicio && item.dataRegistro <= dataFim;
        } else if (dataInicio) {
            mData = item.dataRegistro >= dataInicio;
        } else if (dataFim) {
            mData = item.dataRegistro <= dataFim;
        }

        let mEquipe = fEquipe ? item.equipe === fEquipe : true;

        let mBusca = true;
        if (termoBusca) {
            mBusca = (item.imovel && item.imovel.toLowerCase().includes(termoBusca)) ||
                     (item.endereco && item.endereco.toLowerCase().includes(termoBusca)) ||
                     (item.liberouAcesso && item.liberouAcesso.toLowerCase().includes(termoBusca)) ||
                     (item.equipe && item.equipe.toLowerCase().includes(termoBusca)) ||
                     (item.projeto && item.projeto.toLowerCase().includes(termoBusca)) ||
                     (item.motivoDesfecho && item.motivoDesfecho.toLowerCase().includes(termoBusca)) ||
                     (item.desfecho && item.desfecho.toLowerCase().includes(termoBusca));
        }

        return mData && mEquipe && mBusca;
    });

    let listaImprevistos = filtradosBase.filter(i => i.projeto === 'IMPREVISTO / ATRASO' || i.desfecho === 'IMPREVISTO' || i.desfecho === 'IMPREVISTO RESOLVIDO');
    
    let filtrados = filtradosBase.filter(i => 
        i.projeto !== 'IMPREVISTO / ATRASO' && 
        i.desfecho !== 'IMPREVISTO' && 
        i.desfecho !== 'IMPREVISTO RESOLVIDO' && 
        (fProjeto ? i.projeto === fProjeto : true) &&
        (fDesfecho ? i.desfecho === fDesfecho : true)
    );

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

    const alertaImp = document.getElementById('alerta-imprevistos-supervisao');
    if (alertaImp) {
        if (nivelUsuarioLogado === 'Visualizador') {
            alertaImp.classList.add('hidden');
        } else if (imprevistosAbertos > 0 && alertaImp.dataset.fechadoPeloGestor !== "true") {
            alertaImp.classList.remove('hidden');
            setTxt('txt-alerta-imprevistos', `Existem ${imprevistosAbertos} técnico(s) com imprevisto ATIVO (indisponíveis) neste momento.`);
        } else if (imprevistosAbertos === 0) {
            alertaImp.classList.add('hidden');
        }
    }

    if (corpoImp) {
        if (listaImprevistos.length === 0) {
            corpoImp.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Nenhum imprevisto ou atraso reportado no período.</td></tr>`;
        } else {
            listaImprevistos.forEach(imp => {
                const motivoPrincipal = (imp.malogros && imp.malogros.length > 0) ? imp.malogros.join(' + ') : "IMPREVISTO";
                const obsTexto = imp.observacoes || imp.motivoDesfecho || "-";
                const linkGps = (imp.gpsEntrada && imp.gpsEntrada.includes(',')) ?
                    `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(imp.gpsEntrada)}" target="_blank" onclick="event.stopPropagation()" class="text-blue-600 underline font-bold hover:text-blue-800">🗺️ ${imp.gpsEntrada}</a>` :
                    (imp.gpsEntrada || "-");

                const estaAberto = imp.desfecho === 'IMPREVISTO';
                const badgeSituacao = estaAberto
                    ? `<span class="bg-red-100 text-red-800 border border-red-300 font-black px-2 py-0.5 rounded text-[10px]">🔴 EM ABERTO (Indisponível)</span>`
                    : `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">🟢 RESOLVIDO (Disponível)</span>`;

                let acoesImp = "";
                if (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador') {
                    if (estaAberto) {
                        acoesImp += `<button onclick="resolverImprevistoPorId(${imp.id}, true)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded mr-1 shadow-sm">✅ Resolver</button>`;
                    }
                    acoesImp += `<button onclick="excluirRegistro(${imp.id}, 'IMPREVISTO')" class="text-red-500 font-bold text-[10px] bg-red-50 px-2 py-1 rounded">Excluir</button>`;
                } else {
                    acoesImp = `<span class="text-slate-400 text-[10px]">Somente Leitura</span>`;
                }

                const trImp = document.createElement('tr');
                trImp.className = "hover:bg-amber-50/50 border-b cursor-pointer transition";
                trImp.onclick = () => abrirDetalhesAtividade(imp);

                trImp.innerHTML = `
                    <td class="p-3"><div class="font-bold text-slate-800">${imp.dataRegistro}</div><div class="text-[10px] font-mono text-slate-500">Início: ${imp.hEntrada} | Fim: ${imp.hSaida}</div></td>
                    <td class="p-3 font-bold text-blue-900">${imp.equipe}</td>
                    <td class="p-3"><span class="bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded text-[10px]">${motivoPrincipal}</span></td>
                    <td class="p-3">${badgeSituacao}</td>
                    <td class="p-3 text-slate-600">${obsTexto}</td>
                    <td class="p-3 font-mono text-[10px]">${linkGps}</td>
                    <td class="p-3" onclick="event.stopPropagation()">${acoesImp}</td>
                `;
                corpoImp.appendChild(trImp);
            });
        }
    }

    const finalizadas = filtrados.filter(i => !['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(i.desfecho));

    setTxt('kpi-proj-vistoria', finalizadas.filter(i => i.projeto === 'VISTORIA').length);
    setTxt('kpi-proj-const-f', finalizadas.filter(i => i.projeto === 'CONSTRUÇÃO F').length);
    setTxt('kpi-proj-const-ongoing', finalizadas.filter(i => i.projeto === 'CONSTRUÇÃO ON GOING').length);
    setTxt('kpi-proj-const-nap', finalizadas.filter(i => i.projeto === 'CONSTRUÇÃO NAP LOTADA').length);
    setTxt('kpi-proj-ativ-f', finalizadas.filter(i => i.projeto === 'ATIVAÇÃO F').length);
    setTxt('kpi-proj-ativ-ongoing', finalizadas.filter(i => i.projeto === 'ATIVAÇÃO ON GOING').length);
    setTxt('kpi-proj-ativ-nap', finalizadas.filter(i => i.projeto === 'ATIVAÇÃO NAP LOTADA').length);

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
        if (i.projeto === 'VISTORIA' && i.desfecho === 'CONCLUIDA') sumVistorias++;
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

    totaisFinanceirosAtuais = {
        vistorias: sumVistorias,
        caboRL: sumCaboRL,
        conectores: sumConectores,
        fusoes: sumFusoes,
        caboDrop: sumCaboDrop,
        nap: sumNap,
        dio: sumDio,
        cxSobrepor: sumSobrepor,
        cxEmbutida: sumEmbutida
    };
    renderizarTabelaFinanceiro(totaisFinanceirosAtuais);

    if (filtrados.length === 0) {
        if (corpoAtiv) corpoAtiv.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Nenhum registro encontrado para este filtro/período.</td></tr>`;
        if (corpoMat) corpoMat.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-slate-400">Nenhum material registrado.</td></tr>`;
    } else {
        const prioridadeStatus = { 'EM ANDAMENTO': 1, 'PARALISADA': 2, 'REABERTA': 3, 'PROGRAMADA': 4 };
        const filtradosOrdenados = [...filtrados].sort((a, b) => {
            const pA = prioridadeStatus[a.desfecho] || 5;
            const pB = prioridadeStatus[b.desfecho] || 5;
            if (pA !== pB) return pA - pB;
            return b.id - a.id;
        });

        const mapaAgrupado = {};
        filtradosOrdenados.forEach(item => {
            let codigoBase = (item.imovel || "").trim();
            const idxTraco = codigoBase.toUpperCase().lastIndexOf(" - BLOCO");
            if (idxTraco !== -1) {
                codigoBase = codigoBase.substring(0, idxTraco).trim();
            }

            const chaveAgrupamento = `${item.dataRegistro}_${item.equipe}_${codigoBase.toUpperCase()}_${item.projeto}`;
            if (!mapaAgrupado[chaveAgrupamento]) {
                mapaAgrupado[chaveAgrupamento] = {
                    codigoBase: codigoBase,
                    projeto: item.projeto,
                    equipe: item.equipe,
                    dataRegistro: item.dataRegistro,
                    endereco: item.endereco,
                    liberouAcesso: item.liberouAcesso,
                    hEntrada: item.hEntrada,
                    hSaida: item.hSaida,
                    gpsEntrada: item.gpsEntrada,
                    gpsSaida: item.gpsSaida,
                    itens: []
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
                const totalFotosGrupo = grupo.itens.reduce((acc, i) => acc + (Array.isArray(i.fotos) ? i.fotos.length : 0), 0);
                const todasOpcoesGrupo = [...new Set(grupo.itens.flatMap(i => Array.isArray(i.malogros) ? i.malogros : []))];

                const trPrincipal = document.createElement('tr');
                trPrincipal.className = (itemMaster.desfecho === 'EM ANDAMENTO' || itemMaster.desfecho === 'REABERTA')
                    ? "bg-blue-50/70 hover:bg-blue-100/60 border-b cursor-pointer transition" 
                    : (itemMaster.desfecho === 'PARALISADA' 
                        ? "bg-orange-50/70 hover:bg-orange-100/60 border-b cursor-pointer transition"
                        : (itemMaster.desfecho === 'PROGRAMADA' ? "bg-cyan-50/40 hover:bg-cyan-100/50 border-b cursor-pointer transition" : "hover:bg-blue-50/50 border-b cursor-pointer transition"));
                trPrincipal.title = qtdBlocosNoGrupo > 1 ? "Clique em 'Expandir Blocos' para ver cada bloco individualmente ou clique na linha para ver o resumo" : "Clique para ver todos os detalhes e fotos";
                trPrincipal.onclick = () => abrirDetalhesAtividade(itemMaster);
                
                let botoesAcao = "";
                if (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador') {
                    const podeFinalizadasReabrir = ['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(itemMaster.desfecho);
                    const btnReabrir = podeFinalizadasReabrir
                        ? `<button onclick="autorizarReaberturaCampo(${itemMaster.id})" class="text-purple-800 hover:bg-purple-200 font-bold text-[10px] bg-purple-100 border border-purple-300 px-2 py-1 rounded" title="Autorizar que o técnico reabra e edite esta atividade no Modo Campo">🔓 Reabrir</button>`
                        : '';

                    const btnMover = !podeFinalizadasReabrir
                        ? `<button onclick="abrirModalTransferirAtividade(${itemMaster.id})" class="text-indigo-900 hover:bg-indigo-200 font-bold text-[10px] bg-indigo-100 border border-indigo-300 px-2 py-1 rounded" title="Movimentar / Transferir esta atividade para outro técnico">🔀 Mover</button>`
                        : '';

                    botoesAcao = `
                        <div class="flex flex-wrap gap-1">
                            ${btnMover}
                            ${btnReabrir}
                            <button onclick="abrirModalEdicao(${itemMaster.id})" class="text-blue-600 font-bold text-[10px] bg-blue-50 border border-blue-200 px-2 py-1 rounded">✏️ Editar</button>
                            <button onclick="excluirRegistro(${itemMaster.id}, '${itemMaster.imovel}')" class="text-red-500 font-bold text-[10px] bg-red-50 border border-red-200 px-2 py-1 rounded">Excluir</button>
                        </div>
                    `;
                } else {
                    botoesAcao = `<span class="text-slate-400 text-[10px] font-semibold">👁️ Visualização</span>`;
                }

                const minIn = converterHorarioParaMinutos(grupo.hEntrada);
                const minOut = converterHorarioParaMinutos(grupo.hSaida);
                let duracaoStr = "-";
                if (minIn !== null && minOut !== null && minOut >= minIn) {
                    const durLiquida = Math.max(0, (minOut - minIn) - somaTempoPausado);
                    duracaoStr = formatarDuracaoTexto(durLiquida);
                } else if (itemMaster.desfecho === 'EM ANDAMENTO') {
                    duracaoStr = '⏳ Em execução';
                } else if (itemMaster.desfecho === 'PARALISADA') {
                    duracaoStr = '⏸️ Em pausa';
                } else if (itemMaster.desfecho === 'REABERTA') {
                    duracaoStr = '🔄 Aguardando edição';
                } else if (itemMaster.desfecho === 'PROGRAMADA') {
                    duracaoStr = `📋 Na fila (${itemMaster.qtdBlocosProgramados || 1} Bloco${(itemMaster.qtdBlocosProgramados || 1) > 1 ? 's' : ''})`;
                }

                const badgePausaLinha = somaTempoPausado > 0 
                    ? `<div class="text-[10px] text-orange-700 font-bold">⏸️ Pausa: ${somaTempoPausado} min</div>` 
                    : '';

                const infoLiberouLinha = grupo.liberouAcesso
                    ? `<div class="text-[10px] text-amber-900 font-semibold truncate max-w-[200px]" title="Liberou o Acesso: ${grupo.liberouAcesso}">🔑 Liberou: ${grupo.liberouAcesso}</div>`
                    : '';

                const classeCorDesfecho = obterClasseCorDesfecho(desfechoExibicao);
                const eqObj = equipesSistema.find(e => e.nome === grupo.equipe);
                const setorStr = eqObj ? eqObj.setor : "Instalador";
                const macroGrupo = obterMacroGrupoProjeto(grupo.projeto);
                const badgeGrupoCor = macroGrupo === 'PROJETO F' ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' : 'bg-cyan-50 text-cyan-900 border border-cyan-200';

                const tagsOpcoesHtml = (todasOpcoesGrupo.length > 0)
                    ? `<div class="mt-1 flex flex-wrap gap-1">${todasOpcoesGrupo.map(op => `<span class="text-[9px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">${op}</span>`).join('')}</div>`
                    : '';

                const badgeFotosHtml = (totalFotosGrupo > 0)
                    ? `<span class="ml-1 bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold px-2 py-0.5 rounded-md text-[10px] inline-block" title="Clique para ver e baixar as fotos">📷 ${totalFotosGrupo} foto(s)</span>`
                    : '';

                const botaoExpandirBlocos = qtdBlocosNoGrupo > 1 ? `
                    <button type="button" onclick="event.stopPropagation(); alternarVisualizacaoBlocosAgrupados('${idGrupoUnico}', this)" class="mt-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 transition">
                        📂 Expandir Blocos (${qtdBlocosNoGrupo})
                    </button>
                ` : '';

                trPrincipal.innerHTML = `
                    <td class="p-3">
                        <div class="font-black text-slate-800">${qtdBlocosNoGrupo > 1 ? `${grupo.codigoBase} <span class="text-blue-700 font-bold text-[11px]">(${qtdBlocosNoGrupo} Blocos)</span>` : itemMaster.imovel}</div>
                        <div class="text-[10px] text-blue-900 font-medium truncate max-w-[200px]" title="${grupo.endereco || ''}">📍 ${grupo.endereco || 'Endereço não informado'}</div>
                        ${infoLiberouLinha}
                        <div class="text-[10px] text-slate-400">${grupo.dataRegistro}</div>
                        ${botaoExpandirBlocos}
                    </td>
                    <td class="p-3">
                        <div class="font-semibold text-slate-800 mb-0.5">${grupo.equipe}</div>
                        ${obterBadgeSetorHtml(setorStr)}
                    </td>
                    <td class="p-3">
                        <div class="flex flex-wrap items-center gap-1">
                            <span class="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[10px] inline-block">${grupo.projeto}</span>
                            <span class="font-bold px-1.5 py-0.5 rounded text-[9px] ${badgeGrupoCor}">${macroGrupo}</span>
                        </div>
                        <div class="text-[10px] text-slate-500 mt-1 font-semibold">🏢 Andares: <b>${somaAndares}</b> | HPs: <b>${somaHps}</b></div>
                    </td>
                    <td class="p-3">
                        <div class="flex flex-wrap items-center gap-1">
                            <span class="font-bold px-2.5 py-1 rounded-md text-[10px] inline-block ${classeCorDesfecho}">${desfechoExibicao}</span>
                            ${badgeFotosHtml}
                        </div>
                        ${tagsOpcoesHtml}
                    </td>
                    <td class="p-3">
                        <div class="text-[11px]">🟢 Início: <b>${grupo.hEntrada}</b></div>
                        <div class="text-[11px]">🔴 Fim: <b>${grupo.hSaida}</b></div>
                        ${badgePausaLinha}
                        <div class="text-[10px] text-emerald-700 font-bold mt-0.5">⏱️ ${duracaoStr}</div>
                    </td>
                    <td class="p-3 text-[10px] font-mono text-slate-600">
                        <div>In: ${grupo.gpsEntrada}</div>
                        <div>Out: ${grupo.gpsSaida}</div>
                    </td>
                    <td class="p-3" onclick="event.stopPropagation()">
                        ${botoesAcao}
                    </td>
                `;
                corpoAtiv.appendChild(trPrincipal);

                if (qtdBlocosNoGrupo > 1) {
                    const trDetalheBlocos = document.createElement('tr');
                    trDetalheBlocos.id = idGrupoUnico;
                    trDetalheBlocos.dataset.qtdBlocos = qtdBlocosNoGrupo;
                    trDetalheBlocos.className = "hidden bg-slate-100/90 border-b";

                    let cardsBlocosHtml = grupo.itens.map(blocoItem => {
                        const corDesfB = obterClasseCorDesfecho(blocoItem.desfecho);
                        const qtdFotosB = Array.isArray(blocoItem.fotos) ? blocoItem.fotos.length : 0;
                        const acoesIndividuais = (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador') ? `
                            <div class="flex flex-wrap gap-1 pt-2 border-t border-slate-200 mt-1.5" onclick="event.stopPropagation()">
                                ${['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(blocoItem.desfecho) ? `<button onclick="autorizarReaberturaCampo(${blocoItem.id})" class="bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 font-bold text-[9px] px-2 py-0.5 rounded">🔓 Reabrir</button>` : `<button onclick="abrirModalTransferirAtividade(${blocoItem.id})" class="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-300 font-bold text-[9px] px-2 py-0.5 rounded">🔀 Mover</button>`}
                                <button onclick="abrirModalEdicao(${blocoItem.id})" class="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[9px] px-2 py-0.5 rounded">✏️ Editar</button>
                                <button onclick="excluirRegistro(${blocoItem.id}, '${blocoItem.imovel}')" class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[9px] px-2 py-0.5 rounded">🗑️ Excluir</button>
                            </div>
                        ` : '';

                        return `
                            <div class="card-bloco-interno bg-white p-3 rounded-xl border border-blue-200 shadow-sm space-y-1 cursor-pointer hover:border-blue-500 transition" onclick="abrirDetalhesAtividade(registrosSalvos.find(r => r.id === ${blocoItem.id}))">
                                <div class="flex justify-between items-center gap-1">
                                    <span class="font-black text-blue-950 text-xs">🏢 ${blocoItem.imovel}</span>
                                    <span class="px-2 py-0.5 rounded text-[9px] font-bold ${corDesfB}">${blocoItem.desfecho}</span>
                                </div>
                                <div class="text-[10px] text-slate-600 font-semibold">Andares: <b>${blocoItem.andares || 0}</b> | HPs: <b>${blocoItem.hps || 0}</b> ${qtdFotosB > 0 ? `| 📷 <b>${qtdFotosB} foto(s)</b>` : ''}</div>
                                <div class="text-[10px] text-slate-500">📦 RL: <b>${blocoItem.caboRL}m</b> | Drop: <b>${blocoItem.caboDrop}m</b> | Conect: <b>${blocoItem.conectores}</b> | Fusões: <b>${blocoItem.fusoes}</b> | NAP: <b>${blocoItem.nap}</b> | DIO: <b>${blocoItem.dio}</b></div>
                                ${blocoItem.motivoDesfecho ? `<div class="text-[10px] text-amber-900 bg-amber-50 px-2 py-1 rounded">💬 ${blocoItem.motivoDesfecho}</div>` : ''}
                                ${acoesIndividuais}
                            </div>
                        `;
                    }).join('');

                    trDetalheBlocos.innerHTML = `
                        <td colspan="7" class="p-3 pl-6">
                            <div class="bg-blue-50/60 p-3 rounded-xl border border-blue-200 space-y-2">
                                <div class="flex justify-between items-center border-b border-blue-200 pb-1.5">
                                    <span class="font-black text-blue-950 text-xs uppercase">📂 Detalhamento Individual dos ${qtdBlocosNoGrupo} Blocos do Imóvel ${grupo.codigoBase}</span>
                                    <span class="text-[10px] text-blue-800">Clique em qualquer bloco abaixo para abrir detalhes e fotos</span>
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                    ${cardsBlocosHtml}
                                </div>
                            </div>
                        </td>
                    `;
                    corpoAtiv.appendChild(trDetalheBlocos);
                }
            }

            grupo.itens.forEach(item => {
                if (!['EM ANDAMENTO', 'PARALISADA', 'PROGRAMADA', 'REABERTA'].includes(item.desfecho) && corpoMat) {
                    const trMat = document.createElement('tr');
                    trMat.className = "hover:bg-slate-50 border-b transition";
                    trMat.innerHTML = `
                        <td class="p-2.5 font-bold text-slate-800">${item.imovel}<div class="text-[9px] text-slate-400 font-normal">${item.dataRegistro}</div></td>
                        <td class="p-2.5">${item.equipe}<div class="text-[9px] text-blue-900">${item.projeto}</div></td>
                        <td class="p-2.5 font-semibold">${item.caboRL} m</td>
                        <td class="p-2.5 font-semibold">${item.conectores}</td>
                        <td class="p-2.5 font-semibold">${item.caboDrop} m</td>
                        <td class="p-2.5 font-bold text-blue-900">${item.nap}</td>
                        <td class="p-2.5 font-bold text-indigo-700">${item.dio}</td>
                        <td class="p-2.5 font-bold text-amber-700">${item.cxSobrepor}</td>
                        <td class="p-2.5 font-bold text-orange-700">${item.cxEmbutida}</td>
                        <td class="p-2.5 font-bold text-purple-700">${item.cxFosc}</td>
                        <td class="p-2.5 font-semibold">${item.fusoes}</td>
                    `;
                    corpoMat.appendChild(trMat);
                }
            });
        });
    }

    try { renderizarPainelPrincipalExecutores(finalizadas); } catch (e) { console.warn("Aviso Painel Executores:", e); }
    try { renderizarPainelMallingEProjetoF(finalizadas); } catch (e) { console.warn("Aviso Painel OnGoing/ProjF:", e); }
    try { renderizarGraficos(finalizadas, filtrados); } catch (e) { console.warn("Aviso Gráficos Gerais:", e); }
    try { renderizarRankingTecnicos(finalizadas); } catch (e) { console.warn("Aviso Ranking Técnicos:", e); }
    try { renderizarOfensoresMalogro(finalizadas); } catch (e) { console.warn("Aviso Ofensores Malogro:", e); }
    try { renderizarTabelaConsolidada(finalizadas); } catch (e) { console.warn("Aviso Tabela Consolidada:", e); }
    try { renderizarRankingsSeparados(finalizadas); } catch (e) { console.warn("Aviso Rankings Separados:", e); }
    try { renderizarTabelaUsuariosPermissao(); } catch (e) { console.warn("Aviso Tabela Usuários:", e); }
}

function renderizarPainelPrincipalExecutores(dados) {
    const tbody = document.getElementById('tabela-principal-executores-corpo');
    if (!tbody) return;
    tbody.innerHTML = "";

    const hojeISO = obterDataLocalISO();
    const datasPresentes = [...new Set(dados.map(d => d.dataRegistro).filter(Boolean))].sort();
    const dataRefDiaria = datasPresentes.includes(hojeISO)
        ? hojeISO
        : (datasPresentes.length > 0 ? datasPresentes[datasPresentes.length - 1] : hojeISO);

    const lblDataRef = document.getElementById('lbl-data-ref-diaria');
    if (lblDataRef) lblDataRef.innerText = dataRefDiaria === hojeISO ? `Hoje (${hojeISO})` : dataRefDiaria;

    const mapaExec = {};
    equipesSistema.filter(e => e.status === 'Ativo').forEach(eq => {
        mapaExec[eq.nome] = {
            nome: eq.nome,
            setor: eq.setor,
            prodDiaria: 0,
            consolidadoConcluidas: 0,
            totalGeral: 0,
            diasAtivosSet: new Set()
        };
    });

    dados.forEach(d => {
        const nome = d.equipe || "NÃO IDENTIFICADO";
        if (!mapaExec[nome]) {
            const eqCadastrada = equipesSistema.find(e => e.nome === nome);
            mapaExec[nome] = {
                nome: nome,
                setor: eqCadastrada ? eqCadastrada.setor : "Instalador",
                prodDiaria: 0,
                consolidadoConcluidas: 0,
                totalGeral: 0,
                diasAtivosSet: new Set()
            };
        }
        const ex = mapaExec[nome];
        ex.totalGeral++;
        if (d.dataRegistro) ex.diasAtivosSet.add(d.dataRegistro);

        if (d.desfecho === 'CONCLUIDA') {
            ex.consolidadoConcluidas++;
            if (d.dataRegistro === dataRefDiaria) {
                ex.prodDiaria++;
            }
        }
    });

    const listaTodos = Object.values(mapaExec).map(ex => {
        const dias = ex.diasAtivosSet.size;
        const media = dias > 0 ? (ex.consolidadoConcluidas / dias) : 0;
        const efic = ex.totalGeral > 0 ? ((ex.consolidadoConcluidas / ex.totalGeral) * 100) : 0;
        return { ...ex, diasAtivos: dias, mediaDiaria: media, eficacia: efic };
    });

    const atualizarCardGrupo = (setorAlvo, prefixoId) => {
        const doSetor = listaTodos.filter(i => tecnicoPertenceAoSetor(i.setor, setorAlvo));
        const comProducao = doSetor.filter(i => i.totalGeral > 0);
        const somaDiaria = doSetor.reduce((acc, i) => acc + i.prodDiaria, 0);
        const somaCons = doSetor.reduce((acc, i) => acc + i.consolidadoConcluidas, 0);
        const mediaGrupo = comProducao.length > 0
            ? (comProducao.reduce((acc, i) => acc + i.mediaDiaria, 0) / comProducao.length)
            : 0;

        const elQtd = document.getElementById(`card-${prefixoId}-qtd-tec`);
        const elDia = document.getElementById(`card-${prefixoId}-diaria`);
        const elCon = document.getElementById(`card-${prefixoId}-consolidado`);
        const elMed = document.getElementById(`card-${prefixoId}-media`);

        if (elQtd) elQtd.innerText = `${doSetor.length} cadastrados (${comProducao.length} c/ prod.)`;
        if (elDia) elDia.innerText = somaDiaria;
        if (elCon) elCon.innerText = somaCons;
        if (elMed) elMed.innerText = mediaGrupo.toFixed(1);
    };

    atualizarCardGrupo('Vistoriador', 'vist');
    atualizarCardGrupo('Instalador', 'inst');
    atualizarCardGrupo('Ativador', 'ativ');

    const filtroSetor = document.getElementById('filtro-setor-grafico-principal')?.value || 'TODOS';
    let listaExibicao = listaTodos.filter(ex => tecnicoPertenceAoSetor(ex.setor, filtroSetor));

    listaExibicao.sort((a, b) => {
        if (b.consolidadoConcluidas !== a.consolidadoConcluidas) return b.consolidadoConcluidas - a.consolidadoConcluidas;
        if (b.totalGeral !== a.totalGeral) return b.totalGeral - a.totalGeral;
        return a.nome.localeCompare(b.nome);
    });

    listaExibicao.forEach((ex, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-blue-50/60 border-b cursor-pointer transition";
        tr.onclick = () => dispararExplosaoGrafico('equipe', ex.nome);

        let corEfic = "bg-slate-100 text-slate-600";
        if (ex.totalGeral > 0) {
            if (ex.eficacia >= 80) corEfic = "bg-emerald-100 text-emerald-800";
            else if (ex.eficacia >= 50) corEfic = "bg-amber-100 text-amber-800";
            else corEfic = "bg-red-100 text-red-800";
        }

        tr.innerHTML = `
            <td class="p-2.5 text-center font-bold text-slate-500">${idx + 1}º</td>
            <td class="p-2.5 font-bold text-blue-950 underline decoration-dotted">${ex.nome}</td>
            <td class="p-2.5">${obterBadgeSetorHtml(ex.setor)}</td>
            <td class="p-2.5 text-center font-black text-blue-700 bg-blue-50/50 text-sm">${ex.prodDiaria}</td>
            <td class="p-2.5 text-center font-black text-emerald-700 bg-emerald-50/50 text-sm">${ex.consolidadoConcluidas}</td>
            <td class="p-2.5 text-center font-semibold text-slate-600">${ex.totalGeral}</td>
            <td class="p-2.5 text-center font-mono text-slate-600">${ex.diasAtivos} d</td>
            <td class="p-2.5 text-center font-black text-indigo-950 bg-indigo-50/80 text-sm">${ex.mediaDiaria.toFixed(2)} / dia</td>
            <td class="p-2.5 text-right"><span class="px-2 py-0.5 rounded font-bold text-[10px] ${corEfic}">${ex.eficacia.toFixed(1)}%</span></td>
        `;
        tbody.appendChild(tr);
    });

    let listaGrafico = listaExibicao.filter(e => e.totalGeral > 0);
    if (listaGrafico.length === 0) listaGrafico = listaExibicao.slice(0, 10);

    const ctxExec = document.getElementById('graficoPrincipalExecutores')?.getContext('2d');
    if (ctxExec) {
        if (graficoPrincipalExecutoresInstancia) graficoPrincipalExecutoresInstancia.destroy();
        graficoPrincipalExecutoresInstancia = new Chart(ctxExec, {
            type: 'bar',
            data: {
                labels: listaGrafico.map(e => `${e.nome.split(' ')[0]}`),
                datasets: [
                    {
                        label: 'Consolidado (Concluídas)',
                        data: listaGrafico.map(e => e.consolidadoConcluidas),
                        backgroundColor: '#059669',
                        borderRadius: 5
                    },
                    {
                        label: `Produção Diária (${dataRefDiaria})`,
                        data: listaGrafico.map(e => e.prodDiaria),
                        backgroundColor: '#2563eb',
                        borderRadius: 5
                    },
                    {
                        label: 'Média Diária do Executor',
                        data: listaGrafico.map(e => Number(e.mediaDiaria.toFixed(2))),
                        backgroundColor: '#7c3aed',
                        borderRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: { y: { beginAtZero: true } },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        dispararExplosaoGrafico('equipe', listaGrafico[index].nome);
                    }
                }
            }
        });
    }
}

function renderizarPainelMallingEProjetoF(dados) {
    const dadosOnGoing = dados.filter(d => obterMacroGrupoProjeto(d.projeto) === 'ON GOING');
    const badgeOnGoing = document.getElementById('badge-total-malling');
    if (badgeOnGoing) badgeOnGoing.innerText = `${dadosOnGoing.length} total`;

    const onGoingConcluidas = PROJETOS_GRUPO_MALLING.map(p => dadosOnGoing.filter(d => d.projeto === p && d.desfecho === 'CONCLUIDA').length);
    const onGoingPendMalo   = PROJETOS_GRUPO_MALLING.map(p => dadosOnGoing.filter(d => d.projeto === p && d.desfecho !== 'CONCLUIDA').length);

    const ctxOnGoing = document.getElementById('graficoGrupoMalling')?.getContext('2d');
    if (ctxOnGoing) {
        if (graficoGrupoMallingInstancia) graficoGrupoMallingInstancia.destroy();
        graficoGrupoMallingInstancia = new Chart(ctxOnGoing, {
            type: 'bar',
            data: {
                labels: PROJETOS_GRUPO_MALLING,
                datasets: [
                    { label: 'Concluídas', data: onGoingConcluidas, backgroundColor: '#0284c7', borderRadius: 5 },
                    { label: 'Pendentes / Malogradas', data: onGoingPendMalo, backgroundColor: '#f59e0b', borderRadius: 5 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } },
                onClick: (e, el) => {
                    if (el.length > 0) dispararExplosaoGrafico('projeto', PROJETOS_GRUPO_MALLING[el[0].index]);
                }
            }
        });
    }

    const dadosProjF = dados.filter(d => obterMacroGrupoProjeto(d.projeto) === 'PROJETO F');
    const badgeProjF = document.getElementById('badge-total-projetof');
    if (badgeProjF) badgeProjF.innerText = `${dadosProjF.length} total`;

    const projFConcluidas = PROJETOS_GRUPO_PROJETO_F.map(p => dadosProjF.filter(d => d.projeto === p && d.desfecho === 'CONCLUIDA').length);
    const projFPendMalo   = PROJETOS_GRUPO_PROJETO_F.map(p => dadosProjF.filter(d => d.projeto === p && d.desfecho !== 'CONCLUIDA').length);

    const ctxProjF = document.getElementById('graficoGrupoProjetoF')?.getContext('2d');
    if (ctxProjF) {
        if (graficoGrupoProjetoFInstancia) graficoGrupoProjetoFInstancia.destroy();
        graficoGrupoProjetoFInstancia = new Chart(ctxProjF, {
            type: 'bar',
            data: {
                labels: PROJETOS_GRUPO_PROJETO_F,
                datasets: [
                    { label: 'Concluídas', data: projFConcluidas, backgroundColor: '#4f46e5', borderRadius: 6 },
                    { label: 'Pendentes / Malogradas', data: projFPendMalo, backgroundColor: '#ec4899', borderRadius: 6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } },
                onClick: (e, el) => {
                    if (el.length > 0) dispararExplosaoGrafico('projeto', PROJETOS_GRUPO_PROJETO_F[el[0].index]);
                }
            }
        });
    }

    const datasOrdenadas = [...new Set(dados.map(d => d.dataRegistro).filter(Boolean))].sort();
    const serieOnGoingDia = datasOrdenadas.map(dt => dados.filter(d => d.dataRegistro === dt && obterMacroGrupoProjeto(d.projeto) === 'ON GOING').length);
    const serieProjFDia   = datasOrdenadas.map(dt => dados.filter(d => d.dataRegistro === dt && obterMacroGrupoProjeto(d.projeto) === 'PROJETO F').length);

    const ctxEvo = document.getElementById('graficoEvolucaoGrupos')?.getContext('2d');
    if (ctxEvo) {
        if (graficoEvolucaoGruposInstancia) graficoEvolucaoGruposInstancia.destroy();
        graficoEvolucaoGruposInstancia = new Chart(ctxEvo, {
            type: 'line',
            data: {
                labels: datasOrdenadas.length > 0 ? datasOrdenadas : ['Sem datas'],
                datasets: [
                    {
                        label: '🏢 Evolução Grupo ON GOING',
                        data: datasOrdenadas.length > 0 ? serieOnGoingDia : [0],
                        borderColor: '#0284c7',
                        backgroundColor: 'rgba(2, 132, 199, 0.15)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: '🚀 Evolução Grupo PROJETO F',
                        data: datasOrdenadas.length > 0 ? serieProjFDia : [0],
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79, 70, 229, 0.15)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    const tbodyCruz = document.getElementById('tabela-cruzamento-executores-corpo');
    if (!tbodyCruz) return;
    tbodyCruz.innerHTML = "";

    const mapaCruz = {};
    dados.forEach(d => {
        const nome = d.equipe || "NÃO IDENTIFICADO";
        if (!mapaCruz[nome]) {
            const eqObj = equipesSistema.find(e => e.nome === nome);
            mapaCruz[nome] = {
                nome: nome,
                setor: eqObj ? eqObj.setor : 'Instalador',
                contagem: {}
            };
            TODOS_OS_PROJETOS.forEach(p => mapaCruz[nome].contagem[p] = 0);
        }
        if (mapaCruz[nome].contagem[d.projeto] !== undefined) {
            mapaCruz[nome].contagem[d.projeto]++;
        }
    });

    const listaCruz = Object.values(mapaCruz).sort((a, b) => a.nome.localeCompare(b.nome));

    if (listaCruz.length === 0) {
        tbodyCruz.innerHTML = `<tr><td colspan="12" class="p-4 text-center text-slate-400">Nenhuma atividade registrada no período para exibir o cruzamento entre executores e projetos.</td></tr>`;
        return;
    }

    listaCruz.forEach(item => {
        const c = item.contagem;
        const subOnGoing = (c['VISTORIA'] || 0) + (c['CONSTRUÇÃO ON GOING'] || 0) + (c['CONSTRUÇÃO NAP LOTADA'] || 0) + (c['ATIVAÇÃO ON GOING'] || 0) + (c['ATIVAÇÃO NAP LOTADA'] || 0);
        const subProjF   = (c['CONSTRUÇÃO F'] || 0) + (c['ATIVAÇÃO F'] || 0);
        const totalGeral = subOnGoing + subProjF;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b cursor-pointer";
        tr.onclick = () => dispararExplosaoGrafico('equipe', item.nome);

        tr.innerHTML = `
            <td class="p-2.5 font-bold text-slate-800">${item.nome}</td>
            <td class="p-2.5">${obterBadgeSetorHtml(item.setor)}</td>
            <td class="p-2 text-center ${c['VISTORIA'] > 0 ? 'font-bold text-purple-800' : 'text-slate-300'}">${c['VISTORIA']}</td>
            <td class="p-2 text-center ${c['CONSTRUÇÃO ON GOING'] > 0 ? 'font-bold text-blue-800' : 'text-slate-300'}">${c['CONSTRUÇÃO ON GOING']}</td>
            <td class="p-2 text-center ${c['CONSTRUÇÃO NAP LOTADA'] > 0 ? 'font-bold text-blue-800' : 'text-slate-300'}">${c['CONSTRUÇÃO NAP LOTADA']}</td>
            <td class="p-2 text-center ${c['ATIVAÇÃO ON GOING'] > 0 ? 'font-bold text-emerald-800' : 'text-slate-300'}">${c['ATIVAÇÃO ON GOING']}</td>
            <td class="p-2 text-center ${c['ATIVAÇÃO NAP LOTADA'] > 0 ? 'font-bold text-emerald-800' : 'text-slate-300'}">${c['ATIVAÇÃO NAP LOTADA']}</td>
            <td class="p-2 text-center font-black bg-blue-100/70 text-blue-950">${subOnGoing}</td>
            <td class="p-2 text-center ${c['CONSTRUÇÃO F'] > 0 ? 'font-bold text-indigo-800' : 'text-slate-300'}">${c['CONSTRUÇÃO F']}</td>
            <td class="p-2 text-center ${c['ATIVAÇÃO F'] > 0 ? 'font-bold text-indigo-800' : 'text-slate-300'}">${c['ATIVAÇÃO F']}</td>
            <td class="p-2 text-center font-black bg-indigo-100/70 text-indigo-950">${subProjF}</td>
            <td class="p-2.5 text-center font-black bg-slate-100 text-slate-900">${totalGeral}</td>
        `;
        tbodyCruz.appendChild(tr);
    });
}

function renderizarOfensoresMalogro(dados) {
    const tbody = document.getElementById('tabela-ofensores-malogro-corpo');
    const badgeTotal = document.getElementById('badge-total-ocorrencias-malogro');
    if (!tbody) return;
    tbody.innerHTML = "";

    const contagemOfensores = {};
    OPCOES_MALOGRO_PADRAO.forEach(o => contagemOfensores[o] = 0);

    let totalOcorrenciasMalogro = 0;

    dados.forEach(d => {
        if (d.desfecho === 'MALOGRADA' && Array.isArray(d.malogros)) {
            d.malogros.forEach(m => {
                const chave = m.trim().toUpperCase();
                contagemOfensores[chave] = (contagemOfensores[chave] || 0) + 1;
                totalOcorrenciasMalogro++;
            });
        }
    });

    if (badgeTotal) {
        badgeTotal.innerText = `${totalOcorrenciasMalogro} ocorrência(s)`;
    }

    const ordenados = Object.entries(contagemOfensores).sort((a, b) => b[1] - a[1]);

    ordenados.forEach(([ofensor, qtd], idx) => {
        const perc = totalOcorrenciasMalogro > 0 ? ((qtd / totalOcorrenciasMalogro) * 100).toFixed(1) : "0.0";
        const tr = document.createElement('tr');
        tr.className = "hover:bg-red-50/60 border-b cursor-pointer transition";
        tr.title = `Clique para ver os imóveis afetados por ${ofensor}`;
        tr.onclick = () => dispararExplosaoGrafico('ofensor', ofensor);

        tr.innerHTML = `
            <td class="py-2 font-bold text-slate-400">${idx + 1}º</td>
            <td class="py-2 font-bold text-red-900 underline decoration-dotted">${ofensor}</td>
            <td class="py-2 text-center font-black text-slate-800">${qtd}</td>
            <td class="py-2 text-right">
                <div class="flex items-center justify-end gap-2">
                    <div class="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-red-600 h-1.5" style="width: ${perc}%"></div>
                    </div>
                    <span class="text-[10px] font-bold text-slate-600 w-9">${perc}%</span>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const ctxOfensores = document.getElementById('graficoOfensoresMalogro')?.getContext('2d');
    if (ctxOfensores) {
        if (graficoOfensoresMalogroInstancia) graficoOfensoresMalogroInstancia.destroy();
        const labelsOfensores = ordenados.map(item => item[0]);
        const valoresOfensores = ordenados.map(item => item[1]);

        graficoOfensoresMalogroInstancia = new Chart(ctxOfensores, {
            type: 'bar',
            data: {
                labels: labelsOfensores,
                datasets: [{
                    label: 'Ocorrências de Malogro',
                    data: valoresOfensores,
                    backgroundColor: '#dc2626',
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        dispararExplosaoGrafico('ofensor', labelsOfensores[index]);
                    }
                }
            }
        });
    }
}

function renderizarRankingTecnicos(dados) {
    const tbody = document.getElementById('tabela-ranking-tecnicos-corpo');
    const badgeContador = document.getElementById('contador-tecnicos-ativos');
    if (!tbody) return;
    tbody.innerHTML = "";

    const mapaTecnicos = {};

    dados.forEach(d => {
        const nome = d.equipe || "NÃO IDENTIFICADO";
        if (!mapaTecnicos[nome]) {
            mapaTecnicos[nome] = {
                equipe: nome,
                total: 0,
                concluidas: 0,
                pendentes: 0,
                malogradas: 0,
                minutosPausa: 0,
                entradas: [],
                saidas: [],
                duracoes: []
            };
        }

        const t = mapaTecnicos[nome];
        t.total++;
        if (d.desfecho === 'CONCLUIDA') t.concluidas++;
        else if (d.desfecho === 'PENDENTE') t.pendentes++;
        else if (d.desfecho === 'MALOGRADA') t.malogradas++;

        const pausaMin = Number(d.tempoPausadoMinutos) || 0;
        t.minutosPausa += pausaMin;

        const minIn = converterHorarioParaMinutos(d.hEntrada);
        const minOut = converterHorarioParaMinutos(d.hSaida);

        if (minIn !== null) t.entradas.push(minIn);
        if (minOut !== null) t.saidas.push(minOut);
        if (minIn !== null && minOut !== null && minOut >= minIn) {
            const durLiquida = Math.max(0, (minOut - minIn) - pausaMin);
            if (durLiquida > 0 && durLiquida <= 840) t.duracoes.push(durLiquida);
        }
    });

    const listaOrdenada = Object.values(mapaTecnicos).sort((a, b) => {
        if (b.concluidas !== a.concluidas) return b.concluidas - a.concluidas;
        return b.total - a.total;
    });

    if (badgeContador) {
        badgeContador.innerText = `${listaOrdenada.length} técnico(s) acionado(s)`;
    }

    if (listaOrdenada.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-slate-400">Nenhuma atividade registrada para compor o ranking de técnicos no período.</td></tr>`;
        return;
    }

    listaOrdenada.forEach((t, index) => {
        const mediaIn = t.entradas.length > 0 ? formatarMinutosParaHHMM(t.entradas.reduce((a, b) => a + b, 0) / t.entradas.length) : "--:--";
        const mediaOut = t.saidas.length > 0 ? formatarMinutosParaHHMM(t.saidas.reduce((a, b) => a + b, 0) / t.saidas.length) : "--:--";
        const tma = t.duracoes.length > 0 ? formatarDuracaoTexto(t.duracoes.reduce((a, b) => a + b, 0) / t.duracoes.length) : "--h --m";
        const eficacia = t.total > 0 ? ((t.concluidas / t.total) * 100).toFixed(1) : "0.0";

        let corEficacia = "bg-emerald-100 text-emerald-800";
        if (eficacia < 50) corEficacia = "bg-red-100 text-red-800";
        else if (eficacia < 80) corEficacia = "bg-amber-100 text-amber-800";

        let medalha = `${index + 1}º`;
        if (index === 0) medalha = "🥇 1º";
        else if (index === 1) medalha = "🥈 2º";
        else if (index === 2) medalha = "🥉 3º";

        const tr = document.createElement('tr');
        tr.className = "hover:bg-blue-50/60 border-b cursor-pointer transition";
        tr.title = `Clique para ver todas as atividades de ${t.equipe}`;
        tr.onclick = () => dispararExplosaoGrafico('equipe', t.equipe);

        tr.innerHTML = `
            <td class="p-3 text-center font-bold text-slate-700">${medalha}</td>
            <td class="p-3 font-bold text-blue-900 underline decoration-dotted">${t.equipe}</td>
            <td class="p-3 text-center font-bold text-slate-800">${t.total}</td>
            <td class="p-3 text-center font-bold text-emerald-700 bg-emerald-50/40">${t.concluidas}</td>
            <td class="p-3 text-center font-semibold text-amber-600">${t.pendentes}</td>
            <td class="p-3 text-center font-semibold text-red-600">${t.malogradas}</td>
            <td class="p-3 text-center font-mono text-slate-600">${mediaIn}</td>
            <td class="p-3 text-center font-mono text-slate-600">${mediaOut}</td>
            <td class="p-3 text-center font-bold text-orange-700 bg-orange-50/40">${t.minutosPausa > 0 ? `${t.minutosPausa} min` : '0 min'}</td>
            <td class="p-3 text-center font-bold text-indigo-900 bg-indigo-50/40">${tma}</td>
            <td class="p-3 text-right"><span class="px-2 py-0.5 rounded font-bold text-[10px] ${corEficacia}">${eficacia}%</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalEdicao(id) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') {
        alert("⚠️ Acesso restrito para edição.");
        return;
    }
    let reg = registrosSalvos.find(r => r.id === id);
    if (!reg) return;

    document.getElementById('edit-reg-id').value = reg.id;
    document.getElementById('edit-reg-imovel').value = reg.imovel;
    document.getElementById('edit-reg-endereco').value = reg.endereco || '';
    if (document.getElementById('edit-reg-liberou-acesso')) {
        document.getElementById('edit-reg-liberou-acesso').value = reg.liberouAcesso || '';
    }
    document.getElementById('edit-reg-projeto').value = reg.projeto;
    document.getElementById('edit-reg-desfecho').value = reg.desfecho;
    document.getElementById('edit-reg-andares').value = reg.andares || 0;
    document.getElementById('edit-reg-hps').value = reg.hps || 0;
    document.getElementById('edit-reg-cabo-rl').value = reg.caboRL;
    document.getElementById('edit-reg-conectores').value = reg.conectores;
    document.getElementById('edit-reg-cabo-drop').value = reg.caboDrop;
    document.getElementById('edit-reg-nap').value = reg.nap;
    document.getElementById('edit-reg-dio').value = reg.dio;
    document.getElementById('edit-reg-fusoes').value = reg.fusoes;
    document.getElementById('edit-reg-cx-sobrepor').value = reg.cxSobrepor;
    document.getElementById('edit-reg-cx-embutida').value = reg.cxEmbutida;
    document.getElementById('edit-reg-cx-fosc').value = reg.cxFosc;

    document.getElementById('modal-edicao').classList.remove('hidden');
}

function fecharModalEdicao() {
    document.getElementById('modal-edicao').classList.add('hidden');
}

async function salvarEdicaoRegistro() {
    let id = Number(document.getElementById('edit-reg-id').value);
    let regOriginal = registrosSalvos.find(r => r.id === id);
    let imovel = document.getElementById('edit-reg-imovel').value.trim();
    let endereco = document.getElementById('edit-reg-endereco').value.trim();
    let liberouAcesso = document.getElementById('edit-reg-liberou-acesso') 
        ? document.getElementById('edit-reg-liberou-acesso').value.trim() 
        : (regOriginal ? regOriginal.liberouAcesso : '');
    let projeto = document.getElementById('edit-reg-projeto').value;
    let desfecho = document.getElementById('edit-reg-desfecho').value;
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

    let obsLimpa = regOriginal ? (regOriginal.observacoes || '') : '';
    let tagEnd = endereco ? `[END: ${endereco}] ` : '';
    let tagLiberou = liberouAcesso ? `[LIBEROU_ACESSO: ${liberouAcesso}] ` : '';
    let tagPausa = (regOriginal && regOriginal.tempoPausadoMinutos > 0)
        ? `[PAUSA_TOTAL: ${regOriginal.tempoPausadoMinutos}] `
        : '';
    let sufixoBlocos = (regOriginal && regOriginal.qtdBlocosProgramados > 1)
        ? ` [BLOCOS: ${regOriginal.qtdBlocosProgramados}]`
        : '';
    let sufixoFotos = (regOriginal && regOriginal.fotos && regOriginal.fotos.length > 0)
        ? ` [FOTOS:${JSON.stringify(regOriginal.fotos)}]`
        : '';
    let obsComTagsEFotos = `${tagEnd}${tagLiberou}${tagPausa}${obsLimpa}${sufixoBlocos}${sufixoFotos}`.trim();

    let dadosAtualizados = {
        imovel: imovel,
        projeto: projeto,
        desfecho: desfecho,
        andares: andares,
        hps: hps,
        observacoes: obsComTagsEFotos,
        cabo_rl: cabo_rl,
        conectores: conectores,
        cabo_drop: cabo_drop,
        nap: nap,
        dio: dio,
        fusoes: fusoes,
        cx_sobrepor: cx_sobrepor,
        cx_embutida: cx_embutida,
        cx_fosc: cx_fosc
    };

    const { error } = await supabaseClient
        .from('registros_producao')
        .update(dadosAtualizados)
        .eq('id', id);

    if (error) {
        alert("Erro ao atualizar registro: " + error.message);
        return;
    }

    registrarLogAuditoria("EDIÇÃO DE REGISTRO", `Registro ID ${id} (Imóvel: ${imovel}) atualizado para status ${desfecho}.`);
    alert("Registro atualizado com sucesso!");
    fecharModalEdicao();
    await recarregarDadosGestor();
}

async function excluirRegistro(id, imovelCod) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') {
        alert("⚠️ Acesso restrito para exclusão.");
        return;
    }
    if (confirm("Deseja excluir este registro de produção?")) {
        const { error } = await supabaseClient.from('registros_producao').delete().eq('id', id);
        if (error) {
            alert("Erro ao excluir: " + error.message);
        } else {
            registrarLogAuditoria("EXCLUSÃO DE REGISTRO", `Registro do imóvel ${imovelCod} (ID: ${id}) foi apagado.`);
            await recarregarDadosGestor();
        }
    }
}

function renderizarTabelaFinanceiro(totais) {
    const corpo = document.getElementById('tabela-financeiro-corpo');
    const spanTotalGeral = document.getElementById('fin-total-geral');
    if (!corpo) return;
    corpo.innerHTML = "";

    let itensMedicao = [
        { chave: "VISTORIA", qtd: totais.vistorias },
        { chave: "CABO RL", qtd: totais.caboRL },
        { chave: "CONECTORES", qtd: totais.conectores },
        { chave: "FUSÕES", qtd: totais.fusoes },
        { chave: "CABO DROP", qtd: totais.caboDrop },
        { chave: "NAP", qtd: totais.nap },
        { chave: "DIO", qtd: totais.dio },
        { chave: "CX SOBREPOR", qtd: totais.cxSobrepor },
        { chave: "CX EMBUTIDA", qtd: totais.cxEmbutida }
    ];

    let valorGeralAcumulado = 0;

    itensMedicao.forEach(item => {
        let cfg = TABELA_PRECOS[item.chave];
        let qtd = item.qtd;
        let totalItem = qtd * cfg.valor;
        valorGeralAcumulado += totalItem;

        corpo.innerHTML += `
            <tr class="hover:bg-slate-50 border-b">
                <td class="p-3 font-mono font-bold text-slate-700">${cfg.codigo}</td>
                <td class="p-3 font-semibold text-slate-800">${cfg.desc}</td>
                <td class="p-3 text-slate-600">${cfg.unidade}</td>
                <td class="p-3 text-center font-bold text-blue-900">${qtd.toLocaleString('pt-BR')}</td>
                <td class="p-3 text-right text-slate-600">R$ ${cfg.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td class="p-3 text-right font-black text-emerald-700">R$ ${totalItem.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    });

    if (spanTotalGeral) spanTotalGeral.innerText = `R$ ${valorGeralAcumulado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}

function renderizarTabelaUsuariosPermissao() {
    const corpo = document.getElementById('tabela-usuarios-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";

    let listaVisivel = usuariosSistema;
    if (nivelUsuarioLogado === 'Visualizador' || nivelUsuarioLogado === 'Operador') {
        listaVisivel = usuariosSistema.filter(u => u.email.toLowerCase() === usuarioLogado.toLowerCase());
    }

    listaVisivel.forEach(u => {
        let acoesHtml = `<button onclick="abrirModalUsuario(${u.id})" class="bg-blue-50 text-blue-700 font-bold text-[10px] px-2.5 py-1 rounded">✏️ Alterar Senha</button>`;
        if (nivelUsuarioLogado === 'Master') {
            acoesHtml += ` <button onclick="excluirUsuario(${u.id}, '${u.email}')" class="bg-red-50 text-red-600 font-bold text-[10px] px-2.5 py-1 rounded">🗑️ Excluir</button>`;
        }

        corpo.innerHTML += `
            <tr class="hover:bg-slate-50 border-b">
                <td class="p-3"><div class="font-bold">${u.nome}</div><div class="text-[10px] text-slate-400">${u.email}</div></td>
                <td class="p-3"><span class="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px]">${u.nivel}</span></td>
                <td class="p-3"><span class="text-emerald-600 font-semibold">${u.status}</span></td>
                <td class="p-3">${acoesHtml}</td>
            </tr>
        `;
    });
}

function renderizarRankingsSeparados(dados) {
    let totalGeral = dados.length;

    function preencherTabelaRank(desfechoAlvo, idTabela, idTotal) {
        const tbody = document.getElementById(idTabela);
        const spanTotal = document.getElementById(idTotal);
        if (!tbody || !spanTotal) return;
        tbody.innerHTML = "";

        let subset = dados.filter(d => d.desfecho === desfechoAlvo);
        spanTotal.innerText = `${subset.length} total`;

        let contagemProj = {};
        TODOS_OS_PROJETOS.forEach(p => contagemProj[p] = 0);
        subset.forEach(d => {
            if (contagemProj[d.projeto] !== undefined) contagemProj[d.projeto]++;
        });

        let ordenados = Object.entries(contagemProj).sort((a, b) => b[1] - a[1]);

        ordenados.forEach(([proj, qtd]) => {
            let perc = totalGeral > 0 ? ((qtd / totalGeral) * 100).toFixed(1) : 0;
            tbody.innerHTML += `
                <tr class="border-b hover:bg-slate-50">
                    <td class="py-1.5 font-medium text-slate-700 truncate max-w-[140px]">${proj}</td>
                    <td class="py-1.5 text-center font-bold text-blue-900">${qtd}</td>
                    <td class="py-1.5 text-right text-slate-500">${perc}%</td>
                </tr>
            `;
        });
    }

    preencherTabelaRank('CONCLUIDA', 'tabela-rank-concluida', 'rank-conc-total');
    preencherTabelaRank('PENDENTE', 'tabela-rank-pendente', 'rank-pend-total');
    preencherTabelaRank('MALOGRADA', 'tabela-rank-malograda', 'rank-malo-total');
}

function renderizarTabelaConsolidada(dados) {
    const corpo = document.getElementById('tabela-consolidada-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";

    let total = dados.length;
    let categorias = {};

    dados.forEach(d => {
        let chave = `[${obterMacroGrupoProjeto(d.projeto)}] ${d.projeto} (${d.desfecho})`;
        categorias[chave] = (categorias[chave] || 0) + 1;
    });

    if (Object.keys(categorias).length === 0) {
        corpo.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400">Nenhum dado consolidado no período.</td></tr>`;
        return;
    }

    for (let [cat, qtd] of Object.entries(categorias)) {
        let perc = total > 0 ? ((qtd / total) * 100).toFixed(1) : 0;
        corpo.innerHTML += `
            <tr class="hover:bg-slate-50 border-b">
                <td class="p-3 font-semibold text-slate-800">${cat}</td>
                <td class="p-3 text-center font-bold text-blue-900">${qtd}</td>
                <td class="p-3 text-center text-slate-600">${perc}%</td>
            </tr>
        `;
    }
}

function abrirDetalhesAtividade(item) {
    if (!item) return;
    itemDetalheAtualModal = item;
    const modal = document.getElementById('modal-detalhes');
    const conteudo = document.getElementById('modal-detalhes-conteudo');
    document.getElementById('modal-detalhes-titulo').innerText = `Detalhes do Registro: ${item.imovel}`;

    let linkGpsEntrada = item.gpsEntrada && item.gpsEntrada.includes(',') ? 
        `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.gpsEntrada)}" target="_blank" class="text-blue-600 underline font-bold hover:text-blue-800">🗺️ ${item.gpsEntrada} (Abrir no Maps)</a>` : item.gpsEntrada;

    let linkGpsSaida = item.gpsSaida && item.gpsSaida.includes(',') ? 
        `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.gpsSaida)}" target="_blank" class="text-blue-600 underline font-bold hover:text-blue-800">🗺️ ${item.gpsSaida} (Abrir no Maps)</a>` : item.gpsSaida;

    let malogrosStr = item.malogros && item.malogros.length > 0 ? item.malogros.join(' + ') : 'Nenhum';

    const minIn = converterHorarioParaMinutos(item.hEntrada);
    const minOut = converterHorarioParaMinutos(item.hSaida);
    const pausaMin = Number(item.tempoPausadoMinutos) || 0;
    const duracaoStr = (minIn !== null && minOut !== null && minOut >= minIn) 
        ? formatarDuracaoTexto(Math.max(0, (minOut - minIn) - pausaMin)) 
        : "-";
    const classeCorDesfecho = obterClasseCorDesfecho(item.desfecho);

    const codigoLimpo = (item.imovel || 'imovel').replace(/[^a-zA-Z0-9_-]/g, '_');
    let galeriaFotosHtml = '';
    if (item.fotos && item.fotos.length > 0) {
        const cardsFotos = item.fotos.map((fSrc, idx) => {
            const nomeArq = `${codigoLimpo}_foto_${idx + 1}.jpg`;
            return `
                <div class="bg-white p-2 rounded-xl border border-indigo-200 shadow-sm flex flex-col items-center gap-1.5">
                    <img src="${fSrc}" onclick="abrirZoomFoto('${fSrc}', '${nomeArq}')" class="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-90 transition border" title="Clique para ampliar">
                    <div class="flex gap-1 w-full">
                        <button type="button" onclick="abrirZoomFoto('${fSrc}', '${nomeArq}')" class="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-[10px] py-1 rounded">🔍 Ampliar</button>
                        <button type="button" onclick="baixarFotoDireto('${fSrc}', '${nomeArq}')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1 rounded">⬇️ Baixar</button>
                    </div>
                </div>
            `;
        }).join('');

        galeriaFotosHtml = `
            <div class="bg-indigo-50/70 p-3 rounded-lg border border-indigo-200 space-y-2">
                <h4 class="font-bold text-indigo-950 text-xs uppercase flex items-center justify-between">
                    <span>📷 Fotos Anexadas em Campo (${item.fotos.length}/10)</span>
                    <span class="text-[10px] font-normal text-indigo-700">Clique na imagem para dar zoom ou baixar</span>
                </h4>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    ${cardsFotos}
                </div>
            </div>
        `;
    } else {
        galeriaFotosHtml = `
            <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-400 text-[11px] flex items-center gap-1.5">
                <span>📷 Nenhuma foto anexada neste fechamento.</span>
            </div>
        `;
    }

    let barraAcoesTopoModal = '';
    if (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador') {
        if (['CONCLUIDA', 'PENDENTE', 'MALOGRADA'].includes(item.desfecho)) {
            barraAcoesTopoModal = `
                <div class="bg-purple-50 border border-purple-200 p-3 rounded-lg flex justify-between items-center">
                    <span class="text-[11px] font-bold text-purple-950">Deseja liberar esta atividade para o técnico editar no celular?</span>
                    <button onclick="fecharModalDetalhes(); autorizarReaberturaCampo(${item.id})" class="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm">🔓 Autorizar Reabertura</button>
                </div>
            `;
        } else {
            barraAcoesTopoModal = `
                <div class="bg-indigo-50 border border-indigo-200 p-3 rounded-lg flex justify-between items-center">
                    <span class="text-[11px] font-bold text-indigo-950">Deseja movimentar esta atividade para outro técnico?</span>
                    <button onclick="fecharModalDetalhes(); abrirModalTransferirAtividade(${item.id})" class="bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm">🔀 Transferir Técnico</button>
                </div>
            `;
        }
    }

    conteudo.innerHTML = `
        ${barraAcoesTopoModal}
        <div class="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border">
            <div class="col-span-2"><strong>📍 Endereço do Atendimento:</strong> <span class="font-bold text-blue-950">${item.endereco || 'Não informado'}</span></div>
            <div class="col-span-2 bg-amber-50 p-2 rounded border border-amber-200"><strong>🔑 Liberou o Acesso:</strong> <span class="font-black text-amber-950">${item.liberouAcesso || 'Não informado'}</span></div>
            <div><strong>Data do Registro:</strong> ${item.dataRegistro}</div>
            <div><strong>Técnico / Equipe:</strong> ${item.equipe}</div>
            <div><strong>Projeto / Grupo:</strong> ${item.projeto} (${obterMacroGrupoProjeto(item.projeto)})</div>
            <div><strong>Desfecho:</strong> <span class="font-bold px-2 py-0.5 rounded text-[10px] ${classeCorDesfecho}">${item.desfecho}</span></div>
            <div><strong>Serviço de Obra:</strong> <span class="font-bold">${item.servicoObra || 'SIM'}</span></div>
            <div><strong>Andares:</strong> ${item.andares || 0}</div>
            <div><strong>HPs:</strong> ${item.hps || 0}</div>
            <div><strong>Responsável:</strong> ${item.responsavel || '-'}</div>
            <div><strong>Contato:</strong> ${item.contato || '-'}</div>
        </div>

        ${galeriaFotosHtml}

        <div class="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-1">
            <h4 class="font-bold text-blue-900 text-xs uppercase">🕒 Horários, Pausas, Duração e GPS</h4>
            <div><strong>Horário de Entrada:</strong> ${item.hEntrada}</div>
            <div><strong>GPS Entrada:</strong> ${linkGpsEntrada}</div>
            <div class="pt-1"><strong>Horário de Saída:</strong> ${item.hSaida}</div>
            <div><strong>GPS Saída:</strong> ${linkGpsSaida}</div>
            ${pausaMin > 0 ? `<div class="pt-1 text-orange-700 font-bold"><strong>⏸️ Tempo Paralisado:</strong> ${pausaMin} min</div>` : ''}
            <div class="pt-1 text-emerald-800 font-bold"><strong>⏱️ Tempo Líquido de Execução:</strong> ${duracaoStr}</div>
        </div>

        <div class="bg-emerald-50 p-3 rounded-lg border border-emerald-200 space-y-1">
            <h4 class="font-bold text-emerald-900 text-xs uppercase">📦 Materiais e Caixas Utilizados</h4>
            <div class="grid grid-cols-3 gap-2 text-xs">
                <div>Fusões: <b>${item.fusoes}</b></div>
                <div>Conectores: <b>${item.conectores}</b></div>
                <div>Cabo RL: <b>${item.caboRL}m</b></div>
                <div>Cabo Drop: <b>${item.caboDrop}m</b></div>
                <div>NAP: <b>${item.nap}</b></div>
                <div>DIO: <b>${item.dio}</b></div>
                <div>Sobrepor: <b>${item.cxSobrepor}</b></div>
                <div>Embutida: <b>${item.cxEmbutida}</b></div>
                <div>FOSC: <b>${item.cxFosc}</b></div>
            </div>
        </div>

        ${(item.malogros && item.malogros.length > 0) ? `<div class="bg-red-50 p-3 rounded-lg border border-red-200"><strong>Opções Marcadas / Ofensores:</strong> <span class="font-bold text-red-900">${malogrosStr}</span></div>` : ''}
        ${item.motivoDesfecho ? `<div class="bg-amber-50 p-3 rounded-lg border border-amber-200"><strong>Detalhamento / Observação:</strong> ${item.motivoDesfecho}</div>` : ''}
        ${item.observacoes ? `<div class="bg-slate-50 p-3 rounded-lg border border-slate-200"><strong>Observações Gerais:</strong> ${item.observacoes}</div>` : ''}
    `;
    modal.classList.remove('hidden');
}

function fecharModalDetalhes() { document.getElementById('modal-detalhes').classList.add('hidden'); }

function dispararExplosaoGrafico(filtroTipo, filtroValor) {
    const modal = document.getElementById('modal-explosao');
    const corpo = document.getElementById('tabela-explosao-corpo');
    document.getElementById('modal-explosao-titulo').innerText = `Modo Explosão Executivo: ${filtroTipo.toUpperCase()} -> ${filtroValor}`;
    corpo.innerHTML = "";

    let subset = dadosFiltradosAtuais.filter(item => {
        if (filtroTipo === 'projeto') return item.projeto === filtroValor;
        if (filtroTipo === 'desfecho') return item.desfecho === filtroValor;
        if (filtroTipo === 'equipe') return item.equipe === filtroValor;
        if (filtroTipo === 'ofensor') return item.desfecho === 'MALOGRADA' && Array.isArray(item.malogros) && item.malogros.map(m => m.trim().toUpperCase()).includes(filtroValor.toUpperCase());
        return false;
    });

    if (subset.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Nenhum registro encontrado para esta seleção.</td></tr>`;
    } else {
        subset.forEach(item => {
            let detalheInfo = item.malogros && item.malogros.length > 0 ? `Opções: ${item.malogros.join(' + ')}` : (item.motivoDesfecho || 'Concluído sem pendências');
            const classeCorDesfecho = obterClasseCorDesfecho(item.desfecho);
            corpo.innerHTML += `
                <tr class="hover:bg-slate-50 border-b text-xs cursor-pointer" onclick="fecharModalExplosao(); fecharModalGraficoExpandido(); fecharModalTabelaExpandida(); abrirDetalhesAtividade(registrosSalvos.find(r => r.id === ${item.id}))">
                    <td class="p-2.5 font-mono text-slate-600 font-bold">${item.dataRegistro}</td>
                    <td class="p-2.5"><div class="font-bold text-slate-800">${item.imovel}</div><div class="text-[10px] text-slate-500">📍 ${item.endereco || '-'}</div></td>
                    <td class="p-2.5 font-semibold text-blue-900">${item.equipe}</td>
                    <td class="p-2.5"><b>${item.projeto}</b> <span class="text-[9px] text-slate-400">(${obterMacroGrupoProjeto(item.projeto)})</span></td>
                    <td class="p-2.5"><span class="font-bold px-2 py-0.5 rounded text-[10px] inline-block ${classeCorDesfecho}">${item.desfecho}</span></td>
                    <td class="p-2.5 text-slate-500">${detalheInfo}</td>
                </tr>
            `;
        });
    }
    modal.classList.remove('hidden');
}

function fecharModalExplosao() {
    document.getElementById('modal-explosao').classList.add('hidden');
}

function renderizarGraficos(dados, todosFiltrados = []) {
    let projetosCount = {};
    TODOS_OS_PROJETOS.forEach(p => projetosCount[p] = 0);

    let desfechosCount = { 'CONCLUIDA': 0, 'PENDENTE': 0, 'MALOGRADA': 0 };

    let totalMinutosPausaPeriodo = 0;
    let qtdAtividadesComPausa = 0;

    const basePausas = (Array.isArray(todosFiltrados) && todosFiltrados.length > 0) ? todosFiltrados : dados;
    basePausas.forEach(item => {
        const pMin = Number(item.tempoPausadoMinutos) || 0;
        if (pMin > 0 || item.desfecho === 'PARALISADA') {
            totalMinutosPausaPeriodo += pMin;
            qtdAtividadesComPausa++;
        }
    });

    const elTempoParalisado = document.getElementById('ind-tempo-paralisado');
    const elDetalheParalisado = document.getElementById('ind-detalhe-paralisado');
    if (elTempoParalisado) {
        elTempoParalisado.innerText = totalMinutosPausaPeriodo > 0 ? formatarDuracaoTexto(totalMinutosPausaPeriodo) : "0 min";
    }
    if (elDetalheParalisado) {
        elDetalheParalisado.innerText = `${qtdAtividadesComPausa} atividade(s) com pausa`;
    }

    let listaMinutosEntrada = [];
    let listaMinutosSaida = [];
    let listaDuracoes = [];
    let aberturasPorHora = new Array(24).fill(0);
    let fechamentosPorHora = new Array(24).fill(0);
    let duracaoPorProjeto = {};
    TODOS_OS_PROJETOS.forEach(k => duracaoPorProjeto[k] = []);

    dados.forEach(d => {
        if (projetosCount[d.projeto] !== undefined) {
            projetosCount[d.projeto]++;
        }
        if (desfechosCount[d.desfecho] !== undefined) {
            desfechosCount[d.desfecho]++;
        }

        const minIn = converterHorarioParaMinutos(d.hEntrada);
        const minOut = converterHorarioParaMinutos(d.hSaida);
        const pausaItem = Number(d.tempoPausadoMinutos) || 0;

        if (minIn !== null) {
            listaMinutosEntrada.push(minIn);
            const horaIn = Math.floor(minIn / 60);
            if (horaIn >= 0 && horaIn < 24) aberturasPorHora[horaIn]++;
        }

        if (minOut !== null) {
            listaMinutosSaida.push(minOut);
            const horaOut = Math.floor(minOut / 60);
            if (horaOut >= 0 && horaOut < 24) fechamentosPorHora[horaOut]++;
        }

        if (minIn !== null && minOut !== null && minOut >= minIn) {
            const durLiquida = Math.max(0, (minOut - minIn) - pausaItem);
            if (durLiquida > 0 && durLiquida <= 840) {
                listaDuracoes.push(durLiquida);
                if (duracaoPorProjeto[d.projeto]) {
                    duracaoPorProjeto[d.projeto].push(durLiquida);
                }
            }
        }
    });

    if (listaMinutosEntrada.length > 0) {
        const somaIn = listaMinutosEntrada.reduce((a, b) => a + b, 0);
        const mediaIn = somaIn / listaMinutosEntrada.length;
        const menorIn = Math.min(...listaMinutosEntrada);
        document.getElementById('ind-media-abertura').innerText = formatarMinutosParaHHMM(mediaIn);
        document.getElementById('ind-detalhe-abertura').innerText = `Primeiro check-in às ${formatarMinutosParaHHMM(menorIn)}`;
    } else {
        document.getElementById('ind-media-abertura').innerText = "--:--";
        document.getElementById('ind-detalhe-abertura').innerText = "Sem dados no período";
    }

    if (listaMinutosSaida.length > 0) {
        const somaOut = listaMinutosSaida.reduce((a, b) => a + b, 0);
        const mediaOut = somaOut / listaMinutosSaida.length;
        const maiorOut = Math.max(...listaMinutosSaida);
        document.getElementById('ind-media-fechamento').innerText = formatarMinutosParaHHMM(mediaOut);
        document.getElementById('ind-detalhe-fechamento').innerText = `Último check-out às ${formatarMinutosParaHHMM(maiorOut)}`;
    } else {
        document.getElementById('ind-media-fechamento').innerText = "--:--";
        document.getElementById('ind-detalhe-fechamento').innerText = "Sem dados no período";
    }

    if (listaDuracoes.length > 0) {
        const somaDur = listaDuracoes.reduce((a, b) => a + b, 0);
        const mediaDur = somaDur / listaDuracoes.length;
        const minDur = Math.min(...listaDuracoes);
        const maxDur = Math.max(...listaDuracoes);
        document.getElementById('ind-tempo-medio').innerText = formatarDuracaoTexto(mediaDur);
        document.getElementById('ind-detalhe-tma').innerText = `Mín: ${formatarDuracaoTexto(minDur)} | Máx: ${formatarDuracaoTexto(maxDur)}`;
    } else {
        document.getElementById('ind-tempo-medio').innerText = "--h --m";
        document.getElementById('ind-detalhe-tma').innerText = "Aguardando durações válidas";
    }

    let maxAtivHora = 0;
    let horaPico = null;
    for (let h = 0; h < 24; h++) {
        if (aberturasPorHora[h] > maxAtivHora) {
            maxAtivHora = aberturasPorHora[h];
            horaPico = h;
        }
    }
    if (horaPico !== null && maxAtivHora > 0) {
        document.getElementById('ind-horario-pico').innerText = `${String(horaPico).padStart(2, '0')}h às ${String(horaPico + 1).padStart(2, '0')}h`;
        document.getElementById('ind-detalhe-pico').innerText = `${maxAtivHora} atividade(s) iniciada(s) na faixa`;
    } else {
        document.getElementById('ind-horario-pico').innerText = "--:--";
        document.getElementById('ind-detalhe-pico').innerText = "Sem picos registrados";
    }

    const ctxProj = document.getElementById('graficoProjetos')?.getContext('2d');
    if (ctxProj) {
        if (graficoProjetosInstancia) graficoProjetosInstancia.destroy();
        graficoProjetosInstancia = new Chart(ctxProj, {
            type: 'bar',
            data: {
                labels: Object.keys(projetosCount),
                datasets: [{
                    label: 'Volume de Atendimentos',
                    data: Object.values(projetosCount),
                    backgroundColor: ['#7c3aed', '#4f46e5', '#2563eb', '#ea580c', '#059669', '#0d9488', '#d97706'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        let index = elements[0].index;
                        let chaveProjeto = Object.keys(projetosCount)[index];
                        dispararExplosaoGrafico('projeto', chaveProjeto);
                    }
                }
            }
        });
    }

    const ctxDesf = document.getElementById('graficoDesfechos')?.getContext('2d');
    if (ctxDesf) {
        if (graficoDesfechosInstancia) graficoDesfechosInstancia.destroy();
        graficoDesfechosInstancia = new Chart(ctxDesf, {
            type: 'doughnut',
            data: {
                labels: ['CONCLUIDA', 'PENDENTE', 'MALOGRADA'],
                datasets: [{
                    data: [desfechosCount['CONCLUIDA'], desfechosCount['PENDENTE'], desfechosCount['MALOGRADA']],
                    backgroundColor: ['#059669', '#d97706', '#dc2626']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        let index = elements[0].index;
                        let chaveDesfecho = ['CONCLUIDA', 'PENDENTE', 'MALOGRADA'][index];
                        dispararExplosaoGrafico('desfecho', chaveDesfecho);
                    }
                }
            }
        });
    }

    const ctxHoras = document.getElementById('graficoHorasPico')?.getContext('2d');
    if (ctxHoras) {
        if (graficoHorasPicoInstancia) graficoHorasPicoInstancia.destroy();
        const labelsHoras = [];
        const dadosAberturaSlice = [];
        const dadosFechamentoSlice = [];
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
                    {
                        label: '🟢 Aberturas (Check-in)',
                        data: dadosAberturaSlice,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.15)',
                        fill: true,
                        tension: 0.35
                    },
                    {
                        label: '🔴 Fechamentos (Check-out)',
                        data: dadosFechamentoSlice,
                        borderColor: '#059669',
                        backgroundColor: 'rgba(5, 150, 105, 0.12)',
                        fill: true,
                        tension: 0.35
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'top' } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    const ctxTempoProj = document.getElementById('graficoTempoProjeto')?.getContext('2d');
    if (ctxTempoProj) {
        if (graficoTempoProjetoInstancia) graficoTempoProjetoInstancia.destroy();
        const labelsProj = Object.keys(projetosCount);
        const mediasMinutosProj = labelsProj.map(proj => {
            const arr = duracaoPorProjeto[proj] || [];
            if (arr.length === 0) return 0;
            const soma = arr.reduce((a, b) => a + b, 0);
            return Math.round(soma / arr.length);
        });

        graficoTempoProjetoInstancia = new Chart(ctxTempoProj, {
            type: 'bar',
            data: {
                labels: labelsProj,
                datasets: [{
                    label: 'Tempo Médio Líquido (Minutos)',
                    data: mediasMinutosProj,
                    backgroundColor: '#0d9488',
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    }
}

function exportarExcel() {
    const listaParaExportar = (dadosFiltradosAtuais.length > 0 || listaImprevistosAtuais.length > 0) 
        ? [...dadosFiltradosAtuais, ...listaImprevistosAtuais] 
        : registrosSalvos;

    if (listaParaExportar.length === 0) {
        alert("Nenhum registro para exportar no filtro atual.");
        return;
    }

    let colunas = [
        "ID", "Data", "Equipe", "Setor", "Projeto", "Macrogrupo", "Imóvel / Bloco", "Endereço do Atendimento", "Liberou o Acesso",
        "Hora Entrada", "Hora Saída", "Tempo Paralisado (min)", "Duração Líquida", "GPS Entrada", "GPS Saída", 
        "Desfecho", "Qtd Fotos", "Serviço Obra", "Opções Marcadas", "Motivo Desfecho", "Responsável", "Contato", 
        "E-mail", "Andares", "HPs", 
        "Fusões", "Conectores", "Cabo RL (m)", "Cabo Drop (m)", 
        "NAP", "DIO", "Cx Sobrepor", "Cx Embutida", "Cx FOSC", "Observações Gerais"
    ];

    let linhas = listaParaExportar.map(r => {
        const minIn = converterHorarioParaMinutos(r.hEntrada);
        const minOut = converterHorarioParaMinutos(r.hSaida);
        const pausaMin = Number(r.tempoPausadoMinutos) || 0;
        const durStr = (minIn !== null && minOut !== null && minOut >= minIn) 
            ? formatarDuracaoTexto(Math.max(0, (minOut - minIn) - pausaMin)) 
            : "-";
        const eqObj = equipesSistema.find(e => e.nome === r.equipe);
        const setorStr = eqObj ? eqObj.setor : "Instalador";

        return [
            r.id || "",
            r.dataRegistro || "",
            r.equipe || "",
            setorStr,
            r.projeto || "",
            obterMacroGrupoProjeto(r.projeto),
            r.imovel || "",
            r.endereco || "",
            r.liberouAcesso || "",
            r.hEntrada || "",
            r.hSaida || "",
            pausaMin,
            durStr,
            r.gpsEntrada || "",
            r.gpsSaida || "",
            r.desfecho || "",
            r.fotos ? r.fotos.length : 0,
            r.servicoObra || "SIM",
            r.malogros ? r.malogros.join(' + ') : "",
            r.motivoDesfecho || "",
            r.responsavel || "",
            r.contato || "",
            r.email || "",
            r.andares !== "" ? r.andares : 0,
            r.hps !== "" ? r.hps : 0,
            r.fusoes !== "" ? r.fusoes : 0,
            r.conectores !== "" ? r.conectores : 0,
            r.caboRL !== "" ? r.caboRL : 0,
            r.caboDrop !== "" ? r.caboDrop : 0,
            r.nap !== "" ? r.nap : 0,
            r.dio !== "" ? r.dio : 0,
            r.cxSobrepor !== "" ? r.cxSobrepor : 0,
            r.cxEmbutida !== "" ? r.cxEmbutida : 0,
            r.cxFosc !== "" ? r.cxFosc : 0,
            r.observacoes || ""
        ];
    });

    let tabelaHTML = `<table border="1"><thead><tr>${colunas.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
    linhas.forEach(l => {
        tabelaHTML += `<tr>${l.map(cel => `<td>${cel}</td>`).join('')}</tr>`;
    });
    tabelaHTML += `</tbody></table>`;

    let blob = new Blob(['\ufeff' + tabelaHTML], { type: 'application/vnd.ms-excel' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_gpd_procisa_${obterDataLocalISO()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    registrarLogAuditoria("EXPORTAÇÃO DE RELATÓRIO", `Baixado relatório Excel com ${listaParaExportar.length} registros filtrados.`);
}

function exportarExcelFinanceiro() {
    if (!totaisFinanceirosAtuais) {
        alert("Atualize os dados antes de exportar a medição.");
        return;
    }

    let itensMedicao = [
        { chave: "VISTORIA", qtd: totaisFinanceirosAtuais.vistorias },
        { chave: "CABO RL", qtd: totaisFinanceirosAtuais.caboRL },
        { chave: "CONECTORES", qtd: totaisFinanceirosAtuais.conectores },
        { chave: "FUSÕES", qtd: totaisFinanceirosAtuais.fusoes },
        { chave: "CABO DROP", qtd: totaisFinanceirosAtuais.caboDrop },
        { chave: "NAP", qtd: totaisFinanceirosAtuais.nap },
        { chave: "DIO", qtd: totaisFinanceirosAtuais.dio },
        { chave: "CX SOBREPOR", qtd: totaisFinanceirosAtuais.cxSobrepor },
        { chave: "CX EMBUTIDA", qtd: totaisFinanceirosAtuais.cxEmbutida }
    ];

    let valorGeral = 0;
    let tabelaHTML = `<table border="1"><thead><tr><th>Código</th><th>Descrição do Item</th><th>Unidade</th><th>Qtd. Produzida</th><th>Valor Unitário (R$)</th><th>Total (R$)</th></tr></thead><tbody>`;

    itensMedicao.forEach(item => {
        let cfg = TABELA_PRECOS[item.chave];
        let totalItem = item.qtd * cfg.valor;
        valorGeral += totalItem;
        tabelaHTML += `<tr>
            <td>${cfg.codigo}</td>
            <td>${cfg.desc}</td>
            <td>${cfg.unidade}</td>
            <td>${item.qtd}</td>
            <td>R$ ${cfg.valor.toFixed(2).replace('.', ',')}</td>
            <td>R$ ${totalItem.toFixed(2).replace('.', ',')}</td>
        </tr>`;
    });

    tabelaHTML += `<tr><td colspan="5"><b>VALOR TOTAL DA MEDIÇÃO</b></td><td><b>R$ ${valorGeral.toFixed(2).replace('.', ',')}</b></td></tr></tbody></table>`;

    let blob = new Blob(['\ufeff' + tabelaHTML], { type: 'application/vnd.ms-excel' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `medicao_financeira_mdu_${obterDataLocalISO()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    registrarLogAuditoria("EXPORTAÇÃO FINANCEIRA", `Baixada planilha de Medição Financeira (Total: R$ ${valorGeral.toFixed(2)}).`);
}

function alternarChaveSetorEquipe(setorEscolhido) {
    let inputHidden = document.getElementById('inp-setor-equipe');
    let atuais = obterArraySetores(inputHidden.value);

    if (atuais.includes(setorEscolhido)) {
        if (atuais.length > 1) {
            atuais = atuais.filter(s => s !== setorEscolhido);
        } else {
            alert("⚠️ O técnico precisa pertencer a pelo menos um grupo de atuação.");
            return;
        }
    } else {
        atuais.push(setorEscolhido);
    }

    inputHidden.value = formatarSetoresString(atuais);

    const btnVist = document.getElementById('btn-chave-vistoriador');
    const btnInst = document.getElementById('btn-chave-instalador');
    const btnAtiv = document.getElementById('btn-chave-ativador');

    const aplicarEstilo = (btn, ativo, corBg) => {
        if (!btn) return;
        if (ativo) {
            btn.className = `py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 ${corBg} text-white shadow-sm`;
        } else {
            btn.className = "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 text-slate-600 hover:bg-slate-200 bg-slate-100";
        }
    };

    aplicarEstilo(btnVist, atuais.includes('Vistoriador'), 'bg-purple-800');
    aplicarEstilo(btnInst, atuais.includes('Instalador'), 'bg-blue-900');
    aplicarEstilo(btnAtiv, atuais.includes('Ativador'), 'bg-emerald-700');
}

function abrirModalEquipe(id = null) {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Usuários visualizadores não podem gerenciar equipes."); return; }
    document.getElementById('modal-equipe').classList.remove('hidden');
    if (id) {
        document.getElementById('modal-equipe-titulo').innerText = "Editar Equipe / Setor(es)";
        let eq = equipesSistema.find(e => e.id === id);
        if (eq) {
            document.getElementById('edit-equipe-id').value = eq.id;
            document.getElementById('inp-nome-equipe').value = eq.nome;
            document.getElementById('sel-status-equipe').value = eq.status;
            
            document.getElementById('inp-setor-equipe').value = formatarSetoresString(eq.setor);
            const setoresAtuais = obterArraySetores(eq.setor);
            
            const btnVist = document.getElementById('btn-chave-vistoriador');
            const btnInst = document.getElementById('btn-chave-instalador');
            const btnAtiv = document.getElementById('btn-chave-ativador');

            if (btnVist) btnVist.className = setoresAtuais.includes('Vistoriador') ? "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 bg-purple-800 text-white shadow-sm" : "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 text-slate-600 hover:bg-slate-200 bg-slate-100";
            if (btnInst) btnInst.className = setoresAtuais.includes('Instalador') ? "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 bg-blue-900 text-white shadow-sm" : "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 text-slate-600 hover:bg-slate-200 bg-slate-100";
            if (btnAtiv) btnAtiv.className = setoresAtuais.includes('Ativador') ? "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 bg-emerald-700 text-white shadow-sm" : "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 text-slate-600 hover:bg-slate-200 bg-slate-100";
        }
    } else {
        document.getElementById('modal-equipe-titulo').innerText = "Cadastrar Nova Equipe";
        document.getElementById('edit-equipe-id').value = "";
        document.getElementById('inp-nome-equipe').value = "";
        document.getElementById('sel-status-equipe').value = "Ativo";
        document.getElementById('inp-setor-equipe').value = "Instalador";
        
        const btnVist = document.getElementById('btn-chave-vistoriador');
        const btnInst = document.getElementById('btn-chave-instalador');
        const btnAtiv = document.getElementById('btn-chave-ativador');
        if (btnVist) btnVist.className = "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 text-slate-600 hover:bg-slate-200 bg-slate-100";
        if (btnInst) btnInst.className = "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 bg-blue-900 text-white shadow-sm";
        if (btnAtiv) btnAtiv.className = "py-2.5 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1 text-slate-600 hover:bg-slate-200 bg-slate-100";
    }
}

function fecharModalEquipe() { document.getElementById('modal-equipe').classList.add('hidden'); }

async function salvarOuAtualizarEquipe() {
    if (nivelUsuarioLogado === 'Visualizador') return;
    const editId = document.getElementById('edit-equipe-id').value;
    const nome = document.getElementById('inp-nome-equipe').value.trim().toUpperCase();
    const setor = formatarSetoresString(document.getElementById('inp-setor-equipe').value || "Instalador");
    const status = document.getElementById('sel-status-equipe').value;

    if (!nome) { alert("Preencha o nome da equipe ou técnico."); return; }

    if (editId) {
        let eq = equipesSistema.find(e => e.id == editId);
        if (eq) { 
            registrarLogAuditoria("EDIÇÃO DE EQUIPE", `Equipe ${eq.nome} atualizada: ${nome} | Setor(es): ${setor} (${status})`);
            eq.nome = nome; 
            eq.setor = setor;
            eq.status = status; 
            if (!eq.pin) eq.pin = "1234";
        }
    } else {
        registrarLogAuditoria("CADASTRO DE EQUIPE", `Nova equipe cadastrada: ${nome} | Setor(es): ${setor} (${status}) | PIN inicial: 1234`);
        equipesSistema.push({ id: Date.now(), nome, setor, status, pin: "1234" });
    }

    await sincronizarEquipesNaNuvem();
    fecharModalEquipe();
    popularSelectEquipes();
    renderizarTabelaEquipes();
    renderizarPainelDisponibilidade();
    alert("☁️ Equipe e Setor(es) de Atuação salvos e sincronizados na nuvem!");
}

async function alternarSetorDiretoNaTabela(idEquipe, setorAlvo) {
    if (nivelUsuarioLogado === 'Visualizador') { alert("⚠️ Permissão insuficiente."); return; }
    const eq = equipesSistema.find(e => e.id === idEquipe);
    if (!eq) return;

    let setoresAtuais = obterArraySetores(eq.setor);
    if (setoresAtuais.includes(setorAlvo)) {
        if (setoresAtuais.length > 1) {
            setoresAtuais = setoresAtuais.filter(s => s !== setorAlvo);
        } else {
            alert("⚠️ O técnico precisa pertencer a pelo menos um grupo de atuação.");
            return;
        }
    } else {
        setoresAtuais.push(setorAlvo);
    }

    eq.setor = formatarSetoresString(setoresAtuais);
    registrarLogAuditoria("ALTERAÇÃO DE SETOR", `Técnico ${eq.nome} atualizado para o(s) grupo(s): ${eq.setor}`);
    await sincronizarEquipesNaNuvem();
    popularSelectEquipes();
    renderizarTabelaEquipes();
    renderizarPainelDisponibilidade();
}

function renderizarTabelaEquipes() {
    const corpo = document.getElementById('tabela-equipes-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";
    equipesSistema.forEach(eq => {
        const setoresAtuais = obterArraySetores(eq.setor);
        const pinAtual = obterPinDaEquipe(eq);
        const chaveSetorHtml = `
            <div class="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-300 gap-1">
                <button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Vistoriador')" class="px-2 py-1 rounded-md text-[10px] font-bold transition ${setoresAtuais.includes('Vistoriador') ? 'bg-purple-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 bg-white'}">
                    🔍 Vistoriador
                </button>
                <button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Instalador')" class="px-2 py-1 rounded-md text-[10px] font-bold transition ${setoresAtuais.includes('Instalador') ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 bg-white'}">
                    🛠️ Instalador
                </button>
                <button onclick="alternarSetorDiretoNaTabela(${eq.id}, 'Ativador')" class="px-2 py-1 rounded-md text-[10px] font-bold transition ${setoresAtuais.includes('Ativador') ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 bg-white'}">
                    ⚡ Ativador
                </button>
            </div>
        `;

        const projsHabilitados = obterProjetosPermitidosParaSetores(setoresAtuais).map(p => `<span class="bg-slate-100 border border-slate-300 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded">${p}</span>`).join(' ');

        const badgePin = (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador')
            ? `<div class="mt-1"><span class="bg-amber-50 text-amber-900 border border-amber-300 font-mono font-bold text-[10px] px-2 py-0.5 rounded">🔑 PIN: ${pinAtual}</span></div>`
            : '';

        let acoesEq = (nivelUsuarioLogado === 'Master' || nivelUsuarioLogado === 'Operador') ? 
            `<button onclick="resetarPinEquipeGestor(${eq.id})" class="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-[10px] px-2.5 py-1 rounded" title="Redefinir ou alterar o PIN de 4 dígitos deste técnico">🔄 Resetar PIN</button>
             <button onclick="abrirModalEquipe(${eq.id})" class="bg-blue-50 text-blue-700 font-bold text-[10px] px-2.5 py-1 rounded">✏️ Editar</button>` :
            `<span class="text-slate-400 text-[10px]">Somente Leitura</span>`;

        if (nivelUsuarioLogado === 'Master') {
            acoesEq += ` <button onclick="excluirEquipe(${eq.id}, '${eq.nome}')" class="bg-red-50 text-red-600 font-bold text-[10px] px-2.5 py-1 rounded">🗑️ Excluir</button>`;
        }

        corpo.innerHTML += `
            <tr class="hover:bg-slate-50 border-b">
                <td class="p-3">
                    <div class="font-bold text-slate-800">${eq.nome}</div>
                    ${badgePin}
                </td>
                <td class="p-3">${chaveSetorHtml}</td>
                <td class="p-3"><div class="flex flex-wrap gap-1">${projsHabilitados}</div></td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${eq.status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                        ${eq.status}
                    </span>
                </td>
                <td class="p-3 space-x-1 whitespace-nowrap">${acoesEq}</td>
            </tr>
        `;
    });
}

async function excluirEquipe(id, nome) {
    if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas usuários Master podem excluir equipes."); return; }
    if (confirm(`Deseja realmente excluir a equipe ${nome} do sistema?`)) {
        registrarLogAuditoria("EXCLUSÃO DE EQUIPE", `Equipe removida: ${nome}`);
        equipesSistema = equipesSistema.filter(e => e.id !== id);
        await sincronizarEquipesNaNuvem();
        popularSelectEquipes();
        renderizarTabelaEquipes();
    }
}

function abrirModalUsuario(id = null) {
    if (nivelUsuarioLogado === 'Visualizador' && id) {
        let uSelf = usuariosSistema.find(u => u.email.toLowerCase() === usuarioLogado.toLowerCase());
        if (uSelf) id = uSelf.id;
    }

    document.getElementById('modal-usuario').classList.remove('hidden');
    if (id) {
        let u = usuariosSistema.find(user => user.id === id);
        if (u) {
            document.getElementById('edit-user-id').value = u.id;
            document.getElementById('novo-user-nome').value = u.nome;
            document.getElementById('novo-user-email').value = u.email;
            document.getElementById('novo-user-senha').value = u.senha;
            document.getElementById('novo-user-nivel').value = u.nivel;

            if (nivelUsuarioLogado !== 'Master') {
                document.getElementById('novo-user-nome').disabled = true;
                document.getElementById('novo-user-email').disabled = true;
                document.getElementById('novo-user-nivel').disabled = true;
            } else {
                document.getElementById('novo-user-nome').disabled = false;
                document.getElementById('novo-user-email').disabled = false;
                document.getElementById('novo-user-nivel').disabled = false;
            }
        }
    } else {
        if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas usuários Master podem cadastrar novos usuários."); fecharModalUsuario(); return; }
        document.getElementById('edit-user-id').value = "";
        document.getElementById('novo-user-nome').value = "";
        document.getElementById('novo-user-email').value = "";
        document.getElementById('novo-user-senha').value = "";
        document.getElementById('novo-user-nivel').value = "Visualizador";
        document.getElementById('novo-user-nome').disabled = false;
        document.getElementById('novo-user-email').disabled = false;
        document.getElementById('novo-user-nivel').disabled = false;
    }
}

function fecharModalUsuario() { document.getElementById('modal-usuario').classList.add('hidden'); }

async function salvarOuAtualizarUsuario() {
    const editId = document.getElementById('edit-user-id').value;
    const nome = document.getElementById('novo-user-nome').value.trim();
    const email = document.getElementById('novo-user-email').value.trim().toLowerCase();
    const senha = document.getElementById('novo-user-senha').value.trim();
    const nivel = document.getElementById('novo-user-nivel').value;

    if (!nome || !email || !senha) { alert("Preencha todos os campos."); return; }

    if (editId) {
        let u = usuariosSistema.find(user => user.id == editId);
        if (u) { 
            registrarLogAuditoria("EDIÇÃO DE USUÁRIO", `Dados/senha atualizados para o usuário: ${email}`);
            if (nivelUsuarioLogado === 'Master') {
                u.nome = nome; u.email = email; u.senha = senha; u.nivel = nivel; 
            } else {
                u.senha = senha;
            }
        }
    } else {
        if (nivelUsuarioLogado !== 'Master') { alert("Acesso negado."); return; }
        let jaExiste = usuariosSistema.find(u => u.email.toLowerCase() === email);
        if (jaExiste) {
            jaExiste.nome = nome;
            jaExiste.senha = senha;
            jaExiste.nivel = nivel;
            jaExiste.status = "Ativo";
        } else {
            usuariosSistema.push({ id: Date.now(), nome, email, senha, nivel, status: "Ativo" });
        }
        registrarLogAuditoria("NOVO USUÁRIO", `Cadastrado novo usuário na nuvem: ${email} (${nivel})`);
    }

    await sincronizarUsuariosNaNuvem();
    fecharModalUsuario();
    renderizarTabelaUsuariosPermissao();
    alert("☁️ Usuário salvo e sincronizado na nuvem! Já pode acessar de qualquer computador ou celular.");
}

async function excluirUsuario(id, email) {
    if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas usuários Master podem excluir usuários."); return; }
    if (email.toLowerCase() === "lsimoes@procisa.com.br") {
        alert("⚠️ O usuário Master principal não pode ser removido.");
        return;
    }
    if (confirm(`Deseja realmente remover o acesso de ${email} em todos os dispositivos?`)) {
        registrarLogAuditoria("EXCLUSÃO DE USUÁRIO", `Removido usuário: ${email}`);
        usuariosSistema = usuariosSistema.filter(u => u.id !== id);
        await sincronizarUsuariosNaNuvem();
        renderizarTabelaUsuariosPermissao();
    }
}

function renderizarTabelaAuditoria() {
    const corpo = document.getElementById('tabela-auditoria-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";
    if (trilhaAuditoria.length === 0) {
        corpo.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">Nenhum registo de auditoria recente.</td></tr>`;
        return;
    }
    trilhaAuditoria.forEach(log => {
        const destaqueReabertura = log.acao.includes("REABERTURA") || log.acao.includes("REABERTA") || log.acao.includes("IMPORTAÇÃO") || log.acao.includes("PIN") || log.acao.includes("TRANSFERÊNCIA") || log.acao.includes("EXPEDIENTE")
            ? "bg-purple-100 text-purple-900 border border-purple-300"
            : "bg-slate-100 text-slate-800";

        corpo.innerHTML += `
            <tr class="hover:bg-slate-50 border-b text-xs">
                <td class="p-3 font-mono text-slate-500">${log.dataHora}</td>
                <td class="p-3 font-bold text-blue-900">${log.usuario}</td>
                <td class="p-3"><span class="${destaqueReabertura} font-bold px-2 py-0.5 rounded text-[10px]">${log.acao}</span></td>
                <td class="p-3 text-slate-600">${log.detalhes}</td>
            </tr>
        `;
    });
}

function limparLogsAuditoria() {
    if (nivelUsuarioLogado !== 'Master') { alert("⚠️ Apenas usuários Master podem limpar os logs."); return; }
    if (confirm("Deseja limpar o histórico de logs de auditoria?")) {
        trilhaAuditoria = [];
        localStorage.removeItem('gpd_trilha_auditoria');
        renderizarTabelaAuditoria();
    }
}

// PONTO 01 + PONTO 05: Navegação de Sub-Abas do Gestor com a nova aba independente 'mapa'
function mudarSubAbaGestor(aba) {
    if (nivelUsuarioLogado === 'Visualizador' && !['atividades', 'graficos', 'materiais'].includes(aba)) {
        alert("⚠️ Seu perfil (Visualizador) possui acesso restrito às abas: Atividades, Gráficos & Indicadores e Materiais.");
        return;
    }

    const subs = ['atividades', 'disponibilidade', 'mapa', 'graficos', 'imprevistos', 'materiais', 'financeiro', 'equipes', 'opcoes', 'usuarios', 'bonificacao', 'auditoria'];
    subs.forEach(s => {
        const el = document.getElementById(`subview-${s}`);
        const btn = document.getElementById(`subtab-btn-${s}`);
        if (el) el.classList.add('hidden');
        if (btn) {
            const ocultoVisualizador = (nivelUsuarioLogado === 'Visualizador' && !['atividades', 'graficos', 'materiais'].includes(s));
            btn.className = `px-3 py-1.5 text-xs font-bold rounded-lg transition bg-white text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 ${ocultoVisualizador ? 'hidden' : ''}`;
        }
    });
    
    const targetView = document.getElementById(`subview-${aba}`);
    const targetBtn = document.getElementById(`subtab-btn-${aba}`);
    if (targetView) targetView.classList.remove('hidden');
    if (targetBtn) targetBtn.className = "px-3 py-1.5 text-xs font-bold rounded-lg transition bg-blue-900 text-white shadow-sm flex items-center gap-1";

    if (aba === 'usuarios') renderizarTabelaUsuariosPermissao();
    if (aba === 'equipes') renderizarTabelaEquipes();
    if (aba === 'opcoes') renderizarPainelOpcoesSistema();
    if (aba === 'auditoria') renderizarTabelaAuditoria();
    if (aba === 'disponibilidade') renderizarPainelDisponibilidade();
    if (aba === 'mapa') {
        renderizarPainelDisponibilidade();
        setTimeout(() => {
            if (mapaRastreioInstancia) {
                mapaRastreioInstancia.invalidateSize();
                if (coordenadasPinosAtuais.length > 0) {
                    const bounds = L.latLngBounds(coordenadasPinosAtuais);
                    mapaRastreioInstancia.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
                }
            }
        }, 220);
    }
    if (aba === 'graficos') atualizarDashboardGestor();
    if (aba === 'bonificacao') atualizarDashboardGestor();
    if (aba === 'financeiro') atualizarDashboardGestor();
    if (aba === 'materiais') atualizarDashboardGestor();
    if (aba === 'atividades') atualizarDashboardGestor();
    if (aba === 'imprevistos') atualizarDashboardGestor();
}

function aplicarAtalhoPeriodo(tipo) {
    const inpInicio = document.getElementById('gestor-filtro-data-inicio');
    const inpFim = document.getElementById('gestor-filtro-data-fim');
    const hoje = new Date();

    if (tipo === 'hoje') {
        const strHoje = obterDataLocalISO(hoje);
        inpInicio.value = strHoje;
        inpFim.value = strHoje;
    } else if (tipo === 'ontem') {
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        const strOntem = obterDataLocalISO(ontem);
        inpInicio.value = strOntem;
        inpFim.value = strOntem;
    } else if (tipo === '7dias') {
        const seteDiasAtras = new Date(hoje);
        seteDiasAtras.setDate(hoje.getDate() - 6);
        inpInicio.value = obterDataLocalISO(seteDiasAtras);
        inpFim.value = obterDataLocalISO(hoje);
    } else if (tipo === 'mes') {
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        inpInicio.value = obterDataLocalISO(primeiroDiaMes);
        inpFim.value = obterDataLocalISO(hoje);
    } else if (tipo === 'tudo') {
        inpInicio.value = '';
        inpFim.value = '';
    }
    atualizarDashboardGestor();
}
