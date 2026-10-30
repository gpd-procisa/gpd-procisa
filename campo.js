function comprimirImagemBase64(file, maxWidth = 780, quality = 0.60) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
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
            const base64Comprimida = await comprimirImagemBase64(arq, 780, 0.60);
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
    const container = document.getElementById('container-blocos-dinamicos');
    if (!container) return;
    container.innerHTML = "";

    const qtdTotal = dadosAtendimento.blocos.length;

    dadosAtendimento.blocos.forEach((b, idx) => {
        if (!b.fotos) b.fotos = [];
        if (!b.concluidasOpcoes) b.concluidasOpcoes = [];
        const mostrarIdentBloco = qtdTotal > 1;
        const d = b.desfecho;

        const btnConcClass = d === 'CONCLUIDA' ? 'ring-2 ring-offset-1 ring-emerald-700 bg-emerald-700 text-white' : 'bg-emerald-600/90 text-white opacity-80';
        const btnPendClass = d === 'PENDENTE' ? 'ring-2 ring-offset-1 ring-amber-600 bg-amber-600 text-white' : 'bg-amber-500/90 text-white opacity-80';
        const btnMaloClass = d === 'MALOGRADA' ? 'ring-2 ring-offset-1 ring-red-700 bg-red-700 text-white' : 'bg-red-600/90 text-white opacity-80';

        const checkboxesConcluidaHtml = OPCOES_CONCLUIDA_PADRAO.map(op => {
            const checked = (b.concluidasOpcoes && b.concluidasOpcoes.includes(op)) ? 'checked' : '';
            return `<label class="flex items-center gap-1.5"><input type="checkbox" name="bloco-concluida-check-${idx}" value="${op}" ${checked}> ${op}</label>`;
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
                <button type="button" onclick="removerFotoBloco(${idx}, ${fIdx})" class="absolute top-0.5 right-0.5 bg-red-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">✕</button>
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
                    <button type="button" onclick="selecionarDesfechoBloco(${idx}, 'CONCLUIDA')" class="${btnConcClass} font-bold p-2 rounded-lg text-[11px] transition">CONCLUÍDA</button>
                    <button type="button" onclick="selecionarDesfechoBloco(${idx}, 'PENDENTE')" class="${btnPendClass} font-bold p-2 rounded-lg text-[11px] transition">PENDENTE</button>
                    <button type="button" onclick="selecionarDesfechoBloco(${idx}, 'MALOGRADA')" class="${btnMaloClass} font-bold p-2 rounded-lg text-[11px] transition">MALOGRADA</button>
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
                    <label class="text-[11px] font-bold text-blue-950 flex items-center gap-1">📷 Fotos do Fechamento (${b.fotos.length}/10)</label>
                    <label class="bg-blue-900 hover:bg-blue-950 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer shadow-sm transition">
                        + Tirar / Anexar Foto
                        <input type="file" accept="image/*" multiple onchange="aoSelecionarFotosBloco(${idx}, this)" class="hidden">
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
}

function salvarRascunhoCampo() {
    const posAberturaVisivel = !document.getElementById('bloco-pos-abertura').classList.contains('hidden');
    if (posAberturaVisivel) {
        lerDadosBlocosDaTela();
    }
    const rascunho = {
        emAndamento: posAberturaVisivel,
        idEmAndamento: dadosAtendimento.idEmAndamento,
        eraReaberta: dadosAtendimento.eraReaberta || false,
        eraProgramada: dadosAtendimento.eraProgramada || false,
        equipe: document.getElementById('sel-equipe').value,
        projeto: document.getElementById('sel-projeto').value,
        imovel: document.getElementById('inp-imovel').value,
        hEntrada: document.getElementById('lbl-h-entrada').innerText,
        gpsEntrada: dadosAtendimento.gpsEntrada,
        endereco: document.getElementById('form-endereco')?.value || '',
        responsavel: document.getElementById('form-responsavel')?.value || '',
        contato: document.getElementById('form-contato')?.value || '',
        email: document.getElementById('form-email')?.value || '',
        qtdBlocos: document.getElementById('inp-qtd-blocos')?.value || 1,
        blocos: dadosAtendimento.blocos
    };
    try {
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
            badgeSetor.innerText = "Aguardando técnico...";
        }
        return;
    }

    const eqObj = equipesSistema.find(e => e.nome === nomeEquipe);
    const setoresArr = obterArraySetores(eqObj ? eqObj.setor : "Instalador");
    const listaProjetos = obterProjetosPermitidosParaSetores(setoresArr);

    if (badgeSetor) {
        badgeSetor.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 border border-indigo-300";
        badgeSetor.innerText = `Grupos: ${setoresArr.join(' + ')}`;
    }

    if (setoresArr.length > 1) {
        selProj.innerHTML = setoresArr.map(s => {
            const projs = PROJETOS_POR_SETOR[s] || [];
            return `<optgroup label="Grupo: ${s.toUpperCase()}">${projs.map(p => `<option value="${p}">${p}</option>`).join('')}</optgroup>`;
        }).join('');
    } else {
        selProj.innerHTML = listaProjetos.map(p => `<option value="${p}">${p}</option>`).join('');
    }

    const projNorm = projetoPreSelecionado ? normalizarNomeProjeto(projetoPreSelecionado) : null;
    if (projNorm && listaProjetos.includes(projNorm)) {
        selProj.value = projNorm;
    } else if (projNorm) {
        selProj.innerHTML += `<option value="${projNorm}">${projNorm}</option>`;
        selProj.value = projNorm;
    } else {
        selProj.value = listaProjetos[0];
    }
    mudarTipoProjeto();
}

function restaurarRascunhoCampo() {
    try {
        const salvo = localStorage.getItem('gpd_rascunho_campo_ativo');
        if (!salvo) {
            if (equipeAutenticadaSessao) {
                const selEq = document.getElementById('sel-equipe');
                if (selEq) selEq.value = equipeAutenticadaSessao;
                document.getElementById('current-user-team').innerText = equipeAutenticadaSessao;
                atualizarProjetosPermitidosCampo(equipeAutenticadaSessao);
                atualizarBarraSegurancaPinCampo();
            }
            return;
        }
        const r = JSON.parse(salvo);

        if (r.equipe) {
            document.getElementById('sel-equipe').value = r.equipe;
            document.getElementById('current-user-team').innerText = r.equipe;
            equipeAutenticadaSessao = r.equipe;
            sessionStorage.setItem('gpd_equipe_autenticada_pin', r.equipe);
            atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
            atualizarBarraSegurancaPinCampo();
        }
        if (r.imovel) document.getElementById('inp-imovel').value = r.imovel;

        if (r.emAndamento) {
            dadosAtendimento.idEmAndamento = r.idEmAndamento || null;
            dadosAtendimento.eraReaberta = r.eraReaberta || false;
            dadosAtendimento.eraProgramada = r.eraProgramada || false;
            dadosAtendimento.hEntrada = r.hEntrada;
            dadosAtendimento.gpsEntrada = r.gpsEntrada;
            dadosAtendimento.blocos = (Array.isArray(r.blocos) && r.blocos.length > 0) ? r.blocos : [criarObjetoBlocoPadrao(1)];

            const projAberto = document.getElementById('sel-projeto').value || normalizarNomeProjeto(r.projeto);
            document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${projAberto})`;
            document.getElementById('lbl-h-entrada').innerText = r.hEntrada || '-';
            document.getElementById('lbl-gps-entrada').innerText = r.gpsEntrada || '-';

            document.getElementById('form-endereco').value = r.endereco || '';
            document.getElementById('form-responsavel').value = r.responsavel || '';
            document.getElementById('form-contato').value = r.contato || '';
            document.getElementById('form-email').value = r.email || '';
            document.getElementById('inp-qtd-blocos').value = dadosAtendimento.blocos.length;

            document.getElementById('form-campo-container').classList.add('hidden');
            document.getElementById('bloco-pos-abertura').classList.remove('hidden');
            mudarTipoProjeto();
            renderizarBlocosCampo();
        }
    } catch (e) {
        console.warn("Erro ao restaurar rascunho de campo:", e);
    }
}

async function cancelarCheckinAberto() {
    if (!confirm("Deseja realmente cancelar a abertura atual e retornar ao seu perfil no Modo Campo?")) return;

    const idAtivo = dadosAtendimento.idEmAndamento;
    if (idAtivo) {
        const regNuvem = registrosSalvos.find(r => r.id === idAtivo);
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
    await carregarRegistrosDaNuvem();
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(false);
}

function aoSelecionarEquipeCampo() {
    const selEq = document.getElementById('sel-equipe');
    const eq = selEq ? selEq.value : "";

    if (!eq) {
        equipeAutenticadaSessao = "";
        sessionStorage.removeItem('gpd_equipe_autenticada_pin');
        document.getElementById('current-user-team').innerText = "Selecione Equipe";
        atualizarProjetosPermitidosCampo("");
        atualizarBarraSegurancaPinCampo();
        verificarImprevistoAtivoEquipeCampo();
        verificarPendenciasReabertasEProgramadasCampo(false);
        return;
    }

    const eqObj = equipesSistema.find(e => e.nome === eq);
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
            verificarImprevistoAtivoEquipeCampo();
            verificarPendenciasReabertasEProgramadasCampo(false);
            return;
        }

        equipeAutenticadaSessao = eq;
        sessionStorage.setItem('gpd_equipe_autenticada_pin', eq);
    }

    document.getElementById('current-user-team').innerText = eq;
    atualizarProjetosPermitidosCampo(eq);
    atualizarBarraSegurancaPinCampo();
    salvarRascunhoCampo();
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(true);
}

function desbloquearTrocaEquipeCampo() {
    const posAberturaVisivel = !document.getElementById('bloco-pos-abertura').classList.contains('hidden');
    if (posAberturaVisivel) {
        alert("⚠️ Você possui um atendimento aberto na tela. Finalize ou cancele o atendimento antes de trocar de técnico.");
        return;
    }
    if (!confirm("Deseja encerrar sua sessão atual e liberar a seleção para outro técnico?")) return;

    equipeAutenticadaSessao = "";
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
    verificarImprevistoAtivoEquipeCampo();
    verificarPendenciasReabertasEProgramadasCampo(false);
}

async function alterarPinPeloTecnicoCampo() {
    const nomeEq = document.getElementById('sel-equipe')?.value;
    if (!nomeEq) return;

    const eqObj = equipesSistema.find(e => e.nome === nomeEq);
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
    registrarLogAuditoria("ALTERAÇÃO DE PIN (CAMPO)", `O técnico ${eqObj.nome} alterou seu próprio PIN de acesso no Modo Campo.`);
    await sincronizarEquipesNaNuvem();
    renderizarTabelaEquipes();
    alert("✅ Seu novo PIN de 4 dígitos foi salvo e sincronizado na nuvem com sucesso!");
}

async function resetarPinEquipeGestor(idEquipe) {
    if (nivelUsuarioLogado !== 'Master' && nivelUsuarioLogado !== 'Operador') {
        alert("⚠️ Apenas Gestores (Master ou Operador) podem resetar o PIN de um técnico.");
        return;
    }

    const eqObj = equipesSistema.find(e => e.id === idEquipe);
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
    renderizarTabelaEquipes();
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

    const reabertas = registrosSalvos.filter(r => r.equipe === equipeSelecionada && r.desfecho === 'REABERTA');
    const programadas = registrosSalvos.filter(r => r.equipe === equipeSelecionada && r.desfecho === 'PROGRAMADA');

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
                    <button type="button" onclick="retomarAtividadeReabertaCampo(${r.id})" class="bg-purple-700 hover:bg-purple-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">
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
                    <button type="button" onclick="iniciarAtividadeProgramadaCampo(${r.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">
                        🚀 Iniciar
                    </button>
                </div>
            `}).join('');
            boxProg.classList.remove('hidden');
        } else {
            boxProg.classList.add('hidden');
        }
    }
}

function retomarAtividadeReabertaCampo(idReg) {
    const r = registrosSalvos.find(item => item.id === idReg);
    if (!r) return;

    atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
    document.getElementById('sel-projeto').value = r.projeto;
    document.getElementById('inp-imovel').value = r.imovel;

    dadosAtendimento.idEmAndamento = r.id;
    dadosAtendimento.eraReaberta = true;
    dadosAtendimento.eraProgramada = false;
    dadosAtendimento.hEntrada = r.hEntrada || new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    dadosAtendimento.gpsEntrada = r.gpsEntrada || "Mantido da abertura";

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
        fotos: Array.isArray(r.fotos) ? [...r.fotos] : []
    };

    dadosAtendimento.blocos = [blocoRecuperado];

    document.getElementById('lbl-status-execucao-campo').innerText = "🔄 Editando Atividade Reaberta pelo Gestor";
    document.getElementById('lbl-imovel-aberto').innerText = `${r.imovel} (${r.projeto})`;
    document.getElementById('lbl-h-entrada').innerText = dadosAtendimento.hEntrada;
    document.getElementById('lbl-gps-entrada').innerText = dadosAtendimento.gpsEntrada;

    document.getElementById('form-endereco').value = r.endereco || '';
    document.getElementById('form-responsavel').value = r.responsavel || '';
    document.getElementById('form-contato').value = r.contato || '';
    document.getElementById('form-email').value = r.email || '';
    document.getElementById('inp-qtd-blocos').value = 1;

    document.getElementById('form-campo-container').classList.add('hidden');
    document.getElementById('box-reabertas-campo').classList.add('hidden');
    document.getElementById('bloco-pos-abertura').classList.remove('hidden');

    mudarTipoProjeto();
    renderizarBlocosCampo();
    salvarRascunhoCampo();
}

async function iniciarAtividadeProgramadaCampo(idReg) {
    const r = registrosSalvos.find(item => item.id === idReg);
    if (!r) return;

    atualizarProjetosPermitidosCampo(r.equipe, r.projeto);
    document.getElementById('sel-projeto').value = r.projeto;
    document.getElementById('inp-imovel').value = r.imovel;

    let coordReal = "Não capturado";
    try {
        coordReal = await capturarGpsReal(10000);
    } catch (err) {
        alert("❌ Ative o GPS do celular para iniciar a atividade programada.");
        return;
    }

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
    document.getElementById('form-responsavel').value = r.responsavel || '';
    document.getElementById('form-contato').value = r.contato || '';
    document.getElementById('form-email').value = r.email || '';
    document.getElementById('inp-qtd-blocos').value = totalBlocos;

    document.getElementById('form-campo-container').classList.add('hidden');
    document.getElementById('box-programadas-campo').classList.add('hidden');
    document.getElementById('bloco-pos-abertura').classList.remove('hidden');

    mudarTipoProjeto();
    renderizarBlocosCampo();
    salvarRascunhoCampo();
    await carregarRegistrosDaNuvem();
}

function verificarImprevistoAtivoEquipeCampo() {
    const equipeSelecionada = document.getElementById('sel-equipe').value;
    const boxImp = document.getElementById('box-imprevisto-ativo-campo');
    if (!equipeSelecionada || !boxImp) {
        if (boxImp) boxImp.classList.add('hidden');
        return;
    }

    const hojeISO = obterDataLocalISO();
    const impAtivo = registrosSalvos.find(r => 
        r.equipe === equipeSelecionada && 
        r.dataRegistro === hojeISO && 
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
    const reg = registrosSalvos.find(r => r.id === idImp);
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

    registrarLogAuditoria("IMPREVISTO RESOLVIDO", `Imprevisto da equipe ${reg?.equipe || ''} encerrado às ${horaFim}. Técnico novamente disponível.`);
    await carregarRegistrosDaNuvem();
    if (chamadoPeloGestor) {
        atualizarDashboardGestor();
        alert("✅ Imprevisto marcado como RESOLVIDO! O técnico voltou a ficar disponível.");
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
    else if (r.desfecho === "REABERTA") iconeDesf = "🔄";
    else if (r.desfecho === "PROGRAMADA") iconeDesf = "📋";

    let linhas = [
        `📋 *GPD MDU • PROCISA RJ*`,
        `📅 *Data:* ${r.dataRegistro}`,
        `👷 *Equipe:* ${r.equipe}`,
        `🏢 *Imóvel:* ${r.imovel}`,
        `📍 *Endereço:* ${r.endereco || '-'}`,
        `🏗️ *Projeto:* ${r.projeto} (${obterMacroGrupoProjeto(r.projeto)})`,
        `🏢 *Andares:* ${r.andares || 0} | *HPs:* ${r.hps || 0}`,
        `${iconeDesf} *Status/Desfecho:* ${r.desfecho}`,
        `🕒 *Horário:* ${r.hEntrada} às ${r.hSaida}`,
        `📍 *GPS:* ${r.gpsEntrada}`
    ];

    if (r.projeto !== "IMPREVISTO / ATRASO") {
        linhas.push(`📦 *Materiais:* RL: ${r.caboRL}m | Drop: ${r.caboDrop}m | Conect: ${r.conectores} | Fusões: ${r.fusoes} | NAP: ${r.nap} | DIO: ${r.dio}`);
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

function copiarBoletimGestorWhatsApp() {
    const emAndamento = dadosFiltradosAtuais.filter(i => i.desfecho === 'EM ANDAMENTO').length;
    const programadas = dadosFiltradosAtuais.filter(i => i.desfecho === 'PROGRAMADA').length;
    const finalizadas = dadosFiltradosAtuais.filter(i => !['EM ANDAMENTO', 'PROGRAMADA', 'REABERTA'].includes(i.desfecho));
    const totalObras = finalizadas.length;
    const conc = finalizadas.filter(i => i.desfecho === 'CONCLUIDA').length;
    const pend = finalizadas.filter(i => i.desfecho === 'PENDENTE').length;
    const malo = finalizadas.filter(i => i.desfecho === 'MALOGRADA').length;
    const impr = listaImprevistosAtuais.length;
    const efic = totalObras > 0 ? ((conc / totalObras) * 100).toFixed(1) : "0.0";

    const totOnGoing = finalizadas.filter(i => obterMacroGrupoProjeto(i.projeto) === 'ON GOING').length;
    const totProjF = finalizadas.filter(i => obterMacroGrupoProjeto(i.projeto) === 'PROJETO F').length;

    const dIni = document.getElementById('gestor-filtro-data-inicio').value;
    const dFim = document.getElementById('gestor-filtro-data-fim').value;
    const periodoStr = (dIni || dFim) ? `${dIni || 'Início'} a ${dFim || 'Hoje'}` : 'Período Geral';

    const tmaStr = document.getElementById('ind-tempo-medio')?.innerText || '--';
    const medTotal = document.getElementById('fin-total-geral')?.innerText || 'R$ 0,00';

    const textoBoletim = [
        `📊 *BOLETIM OPERACIONAL GPD • MDU PROCISA RJ*`,
        `📅 *Período:* ${periodoStr}`,
        `────────────────────`,
        `📋 *Programadas na Fila:* ${programadas}`,
        `🔵 *Em Andamento Agora:* ${emAndamento}`,
        `🏗️ *Total Finalizadas:* ${totalObras}`,
        `🟢 *Concluídas:* ${conc} (${efic}%)`,
        `🟡 *Pendentes:* ${pend}`,
        `🔴 *Malogradas:* ${malo}`,
        `⚠️ *Imprevistos Reportados:* ${impr}`,
        `────────────────────`,
        `🏢 *Grupo ON GOING:* ${totOnGoing} ativ.`,
        `🚀 *Grupo PROJETO F:* ${totProjF} ativ.`,
        `────────────────────`,
        `⏱️ *Tempo Médio (TMA):* ${tmaStr}`,
        `💰 *Medição Estimada:* ${medTotal}`
    ].join('\n');

    copiarTextoAreaTransferencia(textoBoletim, "📲 Boletim Operacional copiado! Pronto para colar no WhatsApp da diretoria/supervisão.");
}

function mudarTipoProjeto() {
    const projeto = document.getElementById('sel-projeto').value;
    const titulo = document.getElementById('titulo-form-dinamico');
    if (!titulo) return;
    if (!projeto) {
        titulo.innerText = "1. Dados Gerais do Condomínio / Imóvel";
    } else if (projeto === 'VISTORIA') {
        titulo.innerText = "1. Dados Gerais da Vistoria e Endereço (ON GOING)";
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
    const equipe = document.getElementById('sel-equipe').value;
    const projeto = document.getElementById('sel-projeto').value;
    const imovel = document.getElementById('inp-imovel').value.trim();
    if (!equipe || !projeto || !imovel) { alert("⚠️ Selecione a Equipe, o Projeto e informe o Cód. Imóvel."); return; }

    const hojeISO = obterDataLocalISO();
    const duplicadoHoje = registrosSalvos.find(r => 
        r.dataRegistro === hojeISO && 
        r.imovel.toUpperCase().trim().startsWith(imovel.toUpperCase()) &&
        r.projeto === projeto &&
        !['EM ANDAMENTO', 'PROGRAMADA', 'REABERTA'].includes(r.desfecho)
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
    } catch (err) {
        alert("❌ Não foi possível capturar o GPS. Verifique se a Localização do celular está ativada e se o navegador tem permissão.");
        if (btnCheckin) {
            btnCheckin.disabled = false;
            btnCheckin.innerText = "🚀 Iniciar Atividade (Status: Em Andamento)";
        }
        return;
    }

    const horaEntradaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const idTemp = Date.now();

    const registroEmAndamentoDB = {
        id: idTemp,
        data_registro: hojeISO,
        equipe: equipe,
        membros: equipe,
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

    const { error } = await supabaseClient.from('registros_producao').insert([registroEmAndamentoDB]);
    if (error) {
        console.warn("Aviso ao registrar status Em Andamento:", error.message);
    } else {
        dadosAtendimento.idEmAndamento = idTemp;
        dadosAtendimento.eraReaberta = false;
        dadosAtendimento.eraProgramada = false;
    }

    if (btnCheckin) {
        btnCheckin.disabled = false;
        btnCheckin.innerText = "🚀 Iniciar Atividade (Status: Em Andamento)";
    }

    dadosAtendimento.blocos = [criarObjetoBlocoPadrao(1)];
    document.getElementById('inp-qtd-blocos').value = 1;

    document.getElementById('lbl-status-execucao-campo').innerText = "Status: Em Andamento no Painel";
    document.getElementById('form-campo-container').classList.add('hidden');
    document.getElementById('bloco-pos-abertura').classList.remove('hidden');
    document.getElementById('lbl-imovel-aberto').innerText = `${imovel} (${projeto})`;
    document.getElementById('lbl-h-entrada').innerText = horaEntradaAtual;
    mudarTipoProjeto();
    renderizarBlocosCampo();
    salvarRascunhoCampo();
    await carregarRegistrosDaNuvem();
}

function abrirModalImprevisto() {
    const equipe = document.getElementById('sel-equipe').value;
    if (!equipe) {
        alert("⚠️ Selecione primeiro a sua Equipe / Técnico antes de informar um imprevisto.");
        return;
    }
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
    const equipe = document.getElementById('sel-equipe').value;
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

    registrarLogAuditoria("IMPREVISTO REPORTADO", `Equipe: ${equipe} | Motivo(s): ${motivoStr} | Status: INDISPONÍVEL`);
    alert("⚠️ Imprevisto registrado! Quando o problema for resolvido, clique no botão verde 'Resolver Imprevisto e Ficar Disponível' na sua tela.");
    fecharModalImprevisto();
    await carregarRegistrosDaNuvem();
    verificarImprevistoAtivoEquipeCampo();
}

function resetarFormularioCampo() {
    const equipeAtual = document.getElementById('sel-equipe')?.value || equipeAutenticadaSessao || '';
    dadosAtendimento.idEmAndamento = null;
    dadosAtendimento.eraReaberta = false;
    dadosAtendimento.eraProgramada = false;
    dadosAtendimento.gpsEntrada = null;
    dadosAtendimento.gpsSaida = null;
    dadosAtendimento.blocos = [];
    document.getElementById('inp-imovel').value = '';
    document.getElementById('form-endereco').value = '';
    document.getElementById('form-responsavel').value = '';
    document.getElementById('form-contato').value = '';
    document.getElementById('form-email').value = '';
    document.getElementById('inp-qtd-blocos').value = '1';
    document.getElementById('container-blocos-dinamicos').innerHTML = '';
    document.getElementById('lbl-gps-entrada').innerText = '-';
    document.getElementById('lbl-imovel-aberto').innerText = '-';
    
    document.getElementById('bloco-pos-abertura').classList.add('hidden');
    document.getElementById('form-campo-container').classList.remove('hidden');
    localStorage.removeItem('gpd_rascunho_campo_ativo');

    if (equipeAtual) {
        const selEq = document.getElementById('sel-equipe');
        if (selEq) selEq.value = equipeAtual;
        document.getElementById('current-user-team').innerText = equipeAtual;
        atualizarProjetosPermitidosCampo(equipeAtual);
        atualizarBarraSegurancaPinCampo();
    }
}

async function salvarRegistro() {
    lerDadosBlocosDaTela();

    const enderecoGeral = document.getElementById('form-endereco').value.trim();
    if (!enderecoGeral) {
        alert("⚠️ O preenchimento do ENDEREÇO DO ATENDIMENTO é obrigatório.");
        document.getElementById('form-endereco').focus();
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
            return;
        }
        if (!b.hps || isNaN(numHps) || numHps <= 0) {
            alert(`⚠️ Informe obrigatoriamente o Nº DE HPs ${nomeBloco}.`);
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

    const btnSalvar = document.getElementById('btn-salvar-final');
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.innerText = "⏳ Capturando GPS de saída e salvando fotos...";
    }

    let gpsSaidaFinal = dadosAtendimento.gpsEntrada || "Não capturado";
    try {
        gpsSaidaFinal = await capturarGpsReal(4000);
    } catch (e) {
        console.warn("Sinal interno fraco na saída, mantendo coordenada real da entrada.");
    }

    const equipeNome = document.getElementById('sel-equipe').value;
    const projetoNome = document.getElementById('sel-projeto').value;
    const imovelBase = document.getElementById('inp-imovel').value.trim();
    const responsavelGeral = document.getElementById('form-responsavel').value.trim();
    const contatoGeral = document.getElementById('form-contato').value.trim();
    const emailGeral = document.getElementById('form-email').value.trim();
    const dataLocalCorreta = obterDataLocalISO();
    const horaEntradaOriginal = document.getElementById('lbl-h-entrada').innerText || "08:30";
    const horaSaidaAtual = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const foiReaberta = dadosAtendimento.eraReaberta;

    if (dadosAtendimento.idEmAndamento) {
        await supabaseClient.from('registros_producao').delete().eq('id', dadosAtendimento.idEmAndamento);
    }

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

        const sufixoFotos = (b.fotos && b.fotos.length > 0) ? ` [FOTOS:${JSON.stringify(b.fotos)}]` : '';
        const obsFinal = `[END: ${enderecoGeral}] ${b.observacoes || ''}${sufixoFotos}`.trim();

        return {
            id: Date.now() + idx,
            data_registro: dataLocalCorreta,
            equipe: equipeNome,
            membros: equipeNome,
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

    const { error } = await supabaseClient.from('registros_producao').insert(listaRegistrosParaInserir);
    
    if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.innerText = "💾 Finalizar e Salvar Atendimento";
    }

    if (error) {
        alert("❌ Erro ao salvar: " + error.message);
        return;
    }

    const primeiroReg = listaRegistrosParaInserir[0];
    const todasFotos = dadosAtendimento.blocos.flatMap(b => b.fotos || []);
    
    ultimoResumoCampoTexto = montarTextoResumoItem({
        dataRegistro: dataLocalCorreta,
        equipe: equipeNome,
        imovel: qtdBlocos > 1 ? `${imovelBase} (${qtdBlocos} Blocos)` : imovelBase,
        endereco: enderecoGeral,
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
        malogros: primeiroReg.malogros,
        motivoDesfecho: primeiroReg.motivo_desfecho,
        fotos: todasFotos
    });
    
    document.getElementById('box-ultimo-resumo-whats').classList.remove('hidden');

    const tipoAcaoAudit = foiReaberta ? "ATIVIDADE REABERTA FINALIZADA" : "INSERÇÃO DE REGISTRO";
    registrarLogAuditoria(tipoAcaoAudit, `Equipe: ${equipeNome} | Imóvel: ${imovelBase} (${qtdBlocos} bloco(s)) | Fotos: ${todasFotos.length}`);
    
    alert(`✅ Atendimento finalizado (${qtdBlocos} bloco(s) e ${todasFotos.length} foto(s)) e sincronizado com sucesso!`);
    resetarFormularioCampo();
    await carregarRegistrosDaNuvem();
    verificarPendenciasReabertasEProgramadasCampo(false);
}
