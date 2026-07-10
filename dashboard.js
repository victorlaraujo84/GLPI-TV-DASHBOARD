let state = {
    open: [],
    solved: [],
    solvedWeek: [],
    expiredCount: 0,
    currentView: 'open',
    rankingMode: 'hoje',
    filters: {
        groups: ['all'],
        urgency: 'all',
        search: ''
    },
    rotation: {
        enabled: false,
        interval: 10,
        currentIndex: 0,
        timer: null
    },
    config: { polling: 60 },
    lastCount: 0,
    soundEnabled: true,
    initialized: false,
    profileSettings: {
        dashTitle: '',
        groupRules: [],
        hiddenCards: [],
        locationMap: null
    }
};

function applyProfileSettings(cfg) {
    // Title
    const titleEl = document.querySelector('.logo-text h1');
    if (titleEl && cfg.dashTitle) titleEl.textContent = cfg.dashTitle.toUpperCase();

    // Group Rules
    state.profileSettings.groupRules = cfg.groupRules || [];

    // Hidden Cards
    state.profileSettings.hiddenCards = cfg.hiddenCards || [];

    // Check if Cronograma rule is present
    const hasLoteRule = state.profileSettings.groupRules.some(r =>
        (r.group && (r.group.toLowerCase().includes('lote') || r.group.toLowerCase().includes('cronograma'))) ||
        (r.keyword && (r.keyword.toLowerCase().includes('lote') || r.keyword.toLowerCase().includes('cronograma')))
    );

    // Apply visibility of cards
    let actuallyHiddenCount = 0;
    ['m-open-card', 'm-crit-card', 'm-sla-card', 'm-expired-card', 'm-solved-card', 'm-solved-week-card', 'm-lote-card'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            let shouldHide = state.profileSettings.hiddenCards.includes(id);
            if (id === 'm-lote-card' && !hasLoteRule) {
                shouldHide = true;
            }
            if (shouldHide) {
                el.style.display = 'none';
                actuallyHiddenCount++;
            } else {
                el.style.display = '';
            }
        }
    });

    // Adjust grid columns based on visible cards
    const grid = document.querySelector('.metrics-grid');
    if (grid) {
        const visibleCount = 7 - actuallyHiddenCount;
        grid.style.gridTemplateColumns = `repeat(${Math.max(1, visibleCount)}, 1fr)`;
    }

    // Location Map
    state.profileSettings.locationMap = cfg.locationMap || null;
}

function manageRotation() {
    if (state.rotation.timer) {
        clearInterval(state.rotation.timer);
        state.rotation.timer = null;
    }

    if (state.rotation.enabled) {
        if (state.filters.groups.length > 1 && !state.filters.groups.includes('all')) {
            state.rotation.timer = setInterval(() => {
                if (state.filters.groups.length > 1) {
                    state.rotation.currentIndex = (state.rotation.currentIndex + 1) % state.filters.groups.length;
                    render();
                }
            }, state.rotation.interval * 1000);
        }
    }
}

const MAPA_LOCALIZACAO = {
    "10VTRJ": "Fórum Marquês do Lavradio - 02º andar",
    "11VTRJ": "Fórum Marquês do Lavradio - 02º andar",
    "12VTRJ": "Fórum Marquês do Lavradio - 02º andar",
    "13VTRJ": "Fórum Marquês do Lavradio - 02º andar",
    "14VTRJ": "Fórum Marquês do Lavradio - 02º andar",
    "15VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 05º andar",
    "16VTRJ": "Fórum Marquês do Lavradio - 03º andar",
    "17VTRJ": "Fórum Marquês do Lavradio - 03º andar",
    "18VTRJ": "Fórum Marquês do Lavradio - 03º andar",
    "19VTRJ": "Fórum Marquês do Lavradio - 03º andar",
    "1VTANG": "Fórum Juiz Mello Porto - 01º andar",
    "1VTANG": "Fórum Juiz Mello Porto - Térreo",
    "1VTANG": "Fórum Juiz Mello Porto - 02º andar",
    "1VTARA": "Fórum Juíza Dóris Castro Neves - 02º andar",
    "1VTARA": "Fórum Juíza Dóris Castro Neves - 01º andar",
    "1VTBM": "1ª Vara do Trabalho de Barra Mansa - 02º andar",
    "1VTBM": "1ª Vara do Trabalho de Barra Mansa - 01º andar",
    "1VTBP": "Fórum Juíza Anna Britto da Rocha Acker - 02º andar",
    "1VTCAM": "1ª a 4ª VTs de Campos dos Goytacazes - 04º andar",
    "1VTCF": "Fórum Juiz Augusto Pimenta de Mello - 02º andar",
    "1VTDC": "Fórum de Duque de Caxias - 01º andar",
    "1VTITB": "Fórum da Comarca de Itaboraí - 05º andar",
    "1VTITG": "Fórum Juiz Carlos Alberto Araújo Drumond - Térreo",
    "1VTITP": "Fórum Juiz Gerson Conde - 02º andar",
    "1VTMA": "Fórum de Macaé (a partir de 2021) - Térreo",
    "1VTMAG": "Fórum Juiz Izidoro Soler Guelman - 02º andar",
    "1VTMAR": "1ª Vara do Trabalho de Maricá - 07º andar",
    "1VTNF": "Fórum Juiz Raymundo Soares de Matos - 01º andar",
    "1VTNI": "Fórum Juiz Azulino de Andrade - Térreo",
    "1VTNIL": "1ª Vara do Trabalho de Nilópolis - Olinda - 01º andar",
    "1VTNT": "Fórum Ministro Bezerra de Menezes - 02º andar",
    "1VTPE": "1ª e 2ª VTs de Petrópolis - 02º andar",
    "1VTQDS": "Vara do Trabalho de Queimados (novo) - Térreo",
    "1VTRES": "Fórum de Resende (Futuro) - Térreo",
    "1VTRJ": "Fórum Marquês do Lavradio - 01º andar",
    "1VTSG": "Fórum Juiz Feliciano Matias Neto - 01º andar",
    "1VTSJM": "Fórum Juiz Pizarro Drummond - Térreo",
    "1VTTE": "Fórum Juiz Vianna Clementino - Térreo",
    "1VTTR": "Fórum Juiz Paulo Roberto Capanema da Fonseca - Andar único",
    "1VTVR": "Fórum Juiz José Maria da Cunha Filho - Térreo",
    "20VTRJ": "Fórum Marquês do Lavradio - 03º andar",
    "21VTRJ": "Fórum Marquês do Lavradio - 03º andar",
    "22VTRJ": "Fórum Marquês do Lavradio - 03º andar",
    "23VTRJ": "Fórum Marquês do Lavradio - 04º andar",
    "24VTRJ": "Fórum Marquês do Lavradio - 04º andar",
    "25VTRJ": "Fórum Marquês do Lavradio - 04º andar",
    "26VTRJ": "Fórum Marquês do Lavradio - 04º andar",
    "27VTRJ": "Fórum Marquês do Lavradio - 04º andar",
    "28VTRJ": "Fórum Marquês do Lavradio - 04º andar",
    "29VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 01º andar",
    "2VTCAM": "1ª a 4ª VTs de Campos dos Goytacazes - 05º andar",
    "2VTCF": "Fórum Juiz Augusto Pimenta de Mello - 02º andar",
    "2VTDC": "Fórum de Duque de Caxias - 01º andar",
    "2VTDC": "Fórum Iralton Benigno Cavalcante - 03º andar",
    "2VTITB": "Fórum da Comarca de Itaboraí - 05º andar",
    "2VTITG": "Fórum Juiz Carlos Alberto Araújo Drummond - 02º andar",
    "2VTMA": "Fórum de Macaé (a partir de 2021) - Térreo",
    "2VTNF": "Fórum Juiz Raymundo Soares de Matos - 02º andar",
    "2VTNI": "Fórum Juiz Azulino de Andrade - 01º andar",
    "2VTNT": "Fórum Ministro Bezerra de Menezes - 03º andar",
    "2VTPE": "1ª e 2ª VTs de Petrópolis - 01º andar",
    "2VTRES": "Fórum de Resende (Futuro) - Térreo",
    "2VTRJ": "Fórum Marquês do Lavradio - 01º andar",
    "2VTSG": "Fórum Juiz Feliciano Matias Neto - 02º andar",
    "2VTSJM": "Fórum Juiz Pizarro Drummond - 02º andar",
    "2VTVR": "Fórum Juiz José Maria da Cunha Filho - 01º andar",
    "30VTRJ": "Fórum Marquês do Lavradio - 05º andar",
    "31VTRJ": "Fórum Marquês do Lavradio - 05º andar",
    "32VTRJ": "Fórum Marquês do Lavradio - 05º andar",
    "33VTRJ": "Fórum Marquês do Lavradio - 05º andar",
    "34VTRJ": "Fórum Marquês do Lavradio - 05º andar",
    "35VTRJ": "Fórum Marquês do Lavradio - 05º andar",
    "36VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 05º andar",
    "37VTRJ": "Fórum Marquês do Lavradio - 06º andar",
    "38VTRJ": "Fórum Marquês do Lavradio - 06º andar",
    "39VTRJ": "Fórum Marquês do Lavradio - 06º andar",
    "3VTCAM": "1ª a 4ª VTs de Campos dos Goytacazes - 06º andar",
    "3VTDC": "Fórum de Duque de Caxias - 02º andar",
    "3VTMA": "Fórum de Macaé (a partir de 2021) - Térreo",
    "3VTNI": "Fórum Juiz Azulino de Andrade - Térreo",
    "3VTNT": "Fórum Ministro Bezerra de Menezes - 04º andar",
    "3VTRJ": "Fórum Marquês do Lavradio - 01º andar",
    "3VTSG": "Fórum Juiz Feliciano Matias Neto - 03º andar",
    "3VTSJM": "Fórum Juiz Pizarro Drummond - 01º andar",
    "3VTVR": "Fórum Juiz José Maria da Cunha Filho - 02º andar",
    "40VTRJ": "Fórum Marquês do Lavradio - 06º andar",
    "41VTRJ": "Fórum Marquês do Lavradio - 06º andar",
    "42VTRJ": "Fórum Marquês do Lavradio - 06º andar",
    "43VTRJ": "Fórum Marquês do Lavradio - 06º andar",
    "44VTRJ": "Fórum Marquês do Lavradio - 07º andar",
    "45VTRJ": "Fórum Marquês do Lavradio - 07º andar",
    "46VTRJ": "Fórum Marquês do Lavradio - 07º andar",
    "47VTRJ": "Fórum Marquês do Lavradio - 07º andar",
    "48VTRJ": "Fórum Marquês do Lavradio - 07º andar",
    "49VTRJ": "Fórum Marquês do Lavradio - 07º andar",
    "4VTCAM": "1ª a 4ª VTs de Campos dos Goytacazes - 06º andar",
    "4VTDC": "Fórum de Duque de Caxias - 02º andar",
    "4VTNI": "Fórum Juiz Azulino de Andrade - 02º andar",
    "4VTNT": "Fórum Ministro Bezerra de Menezes - 05º andar",
    "4VTRJ": "Fórum Marquês do Lavradio - 01º andar",
    "4VTSG": "Fórum Juiz Feliciano Matias Neto - Térreo",
    "50VTRJ": "Fórum Marquês do Lavradio - 10º andar",
    "51VTRJ": "Fórum Marquês do Lavradio - 08º andar",
    "52VTRJ": "Fórum Marquês do Lavradio - 08º andar",
    "53VTRJ": "Fórum Marquês do Lavradio - 08º andar",
    "54VTRJ": "Fórum Marquês do Lavradio - 08º andar",
    "55VTRJ": "Fórum Marquês do Lavradio - 08º andar",
    "56VTRJ": "Fórum Marquês do Lavradio - 08º andar",
    "57VTRJ": "Fórum Marquês do Lavradio - 08º andar",
    "58VTRJ": "Fórum Marquês do Lavradio - 10º andar",
    "59VTRJ": "Fórum Marquês do Lavradio - 09º andar",
    "5VTDC": "Fórum de Duque de Caxias - 03º andar",
    "5VTNI": "Fórum Juiz Azulino de Andrade - 03º andar",
    "5VTNT": "Fórum Ministro Bezerra de Menezes - 06º andar",
    "5VTRJ": "Fórum Marquês do Lavradio - 01º andar",
    "5VTSG": "4ª, 5ª e 6ª VTs de São Gonçalo - 02º andar",
    "60VTRJ": "Fórum Marquês do Lavradio - 09º andar",
    "61VTRJ": "Fórum Marquês do Lavradio - 09º andar",
    "62VTRJ": "Fórum Marquês do Lavradio - 09º andar",
    "63VTRJ": "Fórum Marquês do Lavradio - 09º andar",
    "64VTRJ": "Fórum Marquês do Lavradio - 09º andar",
    "65VTRJ": "Fórum Marquês do Lavradio - 09º andar",
    "66VTRJ": "Fórum Marquês do Lavradio - 09º andar",
    "67VTRJ": "Fórum Marquês do Lavradio - 10º andar",
    "68VTRJ": "Fórum Marquês do Lavradio - 10º andar",
    "69VTRJ": "Fórum Marquês do Lavradio - 10º andar",
    "6VTDC": "Fórum Iralton Benigno Cavalcante - 02º andar",
    "6VTNI": "Fórum Juiz Azulino de Andrade - 03º andar",
    "6VTNT": "Fórum Ministro Bezerra de Menezes - 07º andar",
    "6VTRJ": "Fórum Marquês do Lavradio - 01º andar",
    "6VTSG": "4ª, 5ª e 6ª VTs de São Gonçalo - 02º andar",
    "70VTRJ": "Fórum Marquês do Lavradio - 10º andar",
    "71VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 01º andar",
    "72VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 01º andar",
    "73VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 02º andar",
    "74VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 02º andar",
    "75VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 02º andar",
    "76VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 02º andar",
    "77VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 03º andar",
    "78VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 03º andar",
    "79VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 03º andar",
    "7VTDC": "Fórum Iralton Benigno Cavalcante - 06º andar",
    "7VTNI": "Fórum Juiz Azulino de Andrade - Sobreloja",
    "7VTNT": "Fórum Ministro Bezerra de Menezes - 08º andar",
    "7VTRJ": "Fórum Marquês do Lavradio - 01º andar",
    "80VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 03º andar",
    "81VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 04º andar",
    "82VTRJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - 04º andar",
    "8VTNT": "Fórum Ministro Bezerra de Menezes - 09º andar",
    "8VTRJ": "Fórum Marquês do Lavradio - 01º andar",
    "9VTRJ": "Fórum Marquês do Lavradio - 02º andar",
    "AAP": "Fórum Ministro Arnaldo Süssekind - 14º andar",
    "ACF": "Fórum Ministro Arnaldo Süssekind - 14º andar",
    "AGA": "Fórum Ministro Arnaldo Süssekind - 14º andar",
    "AGE": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "AGI": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "AGP": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "AIM": "Fórum Ministro Arnaldo Süssekind - 04º andar",
    "AJU": "Fórum Ministro Arnaldo Süssekind - 06º andar",
    "ALC": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "AMI": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "AMO": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "AOF": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "CAEI": "Fórum Ministro Arnaldo Süssekind - 07º andar",
    "CAEX": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "CAGC": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "CAGI": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "CAPE": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "CAUP": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "CCAL": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "CCIN": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "CCON": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "CDIS": "Fórum Ministro Arnaldo Süssekind - 14º andar",
    "CEJUSC": "Fórum Ministro Arnaldo Süssekind - Térreo",
    "CEPE": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "CEST": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "CFIN": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "CGEP": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "CGNC": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "CGOC": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "CGOV": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "CIPP": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "CJID": "Fórum Marquês do Lavradio - 04º andar",
    "CJUD-1": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "CJUD-2": "Fórum Ministro Arnaldo Süssekind - 07º andar",
    "CJUR": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "CMAC": "Seção de Depósito Judicial (Futura) - Térreo",
    "CMAM": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "CNUP": "Fórum Ministro Arnaldo Süssekind - Térreo",
    "COAD": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "COED": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "COES": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "CPOL": "Fórum Ministro Arnaldo Süssekind - Sobreloja",
    "CPOR": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "CPPE": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "CPRI": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "CREC": "Edifício Darcy Vargas - 04º andar",
    "CSAD": "Fórum Advogado Eugenio Roberto Haddock Lobo - 06º andar",
    "CSET": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "CSIS": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "CSUP": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "CTEL": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DACME": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "DAESP": "Fórum Ministro Arnaldo Süssekind - Sobreloja",
    "DAGCO": "Fórum Ministro Arnaldo Süssekind - Sobreloja",
    "DAMAP": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "DATOS": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DCALC-2": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "DCAPO": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DCMAT": "Fórum Ministro Arnaldo Süssekind - 04º andar",
    "DCONT": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "DCTIC": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DDESF": "Depósito da DDESF e DIMAP - 01º andar",
    "DDOPE": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DECOM": "Fórum Ministro Arnaldo Süssekind - 04º andar",
    "DEFIN": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "DEMIC": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DG": "Fórum Ministro Arnaldo Süssekind - 14º andar",
    "DG-GAB": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "DGEBI": "Fórum Ministro Arnaldo Süssekind - 04º andar",
    "DGESD": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DGINF": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DGMAN": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DGTEL": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DIAAD": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "DIABD": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DIAND": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DIAPC": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DIAPJ": "Fórum Marquês do Lavradio - 04º andar",
    "DIARQ": "Fórum Ministro Arnaldo Süssekind",
    "DIASF": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DIBEN": "Fórum Advogado Eugenio Roberto Haddock Lobo - 01º andar",
    "DIBIB": "Fórum Marquês do Lavradio - Térreo",
    "DICAJ": "Fórum Advogado Eugenio Roberto Haddock Lobo - Térreo",
    "DICCO": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DICEO": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "DICER": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "DICMA": "Fórum Advogado Eugenio Roberto Haddock Lobo - Térreo",
    "DICOD": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DICOF": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DICOG": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "DICOP": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "DICSO": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "DIDAT": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "DIDEM": "Fórum Ministro Arnaldo Süssekind - Sobreloja",
    "DIEAD": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "DIEST": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "DIFIS": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "DIFOM": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "DIFTD": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DIGAC": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DIGEA": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DIGEP": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "DIGOC": "Fórum Ministro Arnaldo Süssekind - Térreo",
    "DIJID": "Fórum Marquês do Lavradio - Prédio Anexo",
    "DIJUD": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DILPA": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DIMAC": "Edifício Darcy Vargas - 07º andar",
    "DIMAN": "Fórum Advogado Eugenio Roberto Haddock Lobo - Térreo",
    "DIMAP": "Depósito da DIMAP - Térreo",
    "DIMOV": "Fórum Ministro Arnaldo Süssekind - 04º andar",
    "DIMUC": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "DINFF": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DINUC": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DIPAG": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "DIPAI": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DIPAQ": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DIPAR": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DIPEC": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DIPEJ": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "DIPEP": "Fórum Ministro Arnaldo Süssekind - Sobreloja",
    "DIPER": "Fórum Advogado Eugenio Roberto Haddock Lobo - 06º andar",
    "DIPES": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DIPJE": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DIPOB": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "DIPOD": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "DIPOL": "Fórum Marquês do Lavradio - Térreo",
    "DIRCO": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DIREX": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "DIRPC": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DISAD": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DISAI": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "DISAR": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "DISEP": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "DITEC": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DITRA": "Fórum Ministro Arnaldo Süssekind - Subsolo",
    "DIVAT": "Fórum Ministro Arnaldo Süssekind - SS",
    "DIVEN": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "DMANP-CAP1": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DMANP-CAP2": "Fórum Marquês do Lavradio - Cobertura",
    "DMANP-CAP3": "Edifício Darcy Vargas - 09º andar",
    "DMANP-INT1": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DMANP-INT2": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DPECR": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DPLAN": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DPLOR": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "DPMOV": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "DPPAF-CG": "1ª a 4ª VTs de Campos dos Goytacazes - 05º andar",
    "DPPAF-DC": "Fórum Iralton Benigno Cavalcante - 06º andar",
    "DPPAF-NI": "Fórum Juiz Azulino de Andrade - Térreo",
    "DPPAF-NT": "Fórum Ministro Bezerra de Menezes - 02º andar",
    "DPPAF-SG": "Fórum Juiz Feliciano Matias Neto - Térreo",
    "DPPRE": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "DPROJ": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "DPROR": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "DPROS": "Fórum Advogado Eugenio Roberto Haddock Lobo - 06º andar",
    "DPSEG": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "DSICO": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "JS": "Itinerante",
    "NINTE": "Edifício Darcy Vargas - 02º andar",
    "NUCIN": "Edifício Darcy Vargas - 05º andar",
    "NUGEPNAC": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "NUMASE": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "NUPEP": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "OUV": "Fórum Ministro Arnaldo Süssekind - Térreo",
    "PR": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "SAE": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "SAE-GAB": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "SAJ": "Fórum Marquês do Lavradio - 03º andar",
    "SAU": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "SAU-GAB": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "SCC-GAB": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "SCR": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "SCR-GAB": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "SDO": "Fórum Ministro Arnaldo Süssekind - Sobreloja",
    "SDO-GAB": "Fórum Ministro Arnaldo Süssekind - Sobreloja",
    "SECACI": "Fórum Ministro Arnaldo Süssekind - 14º andar",
    "SECADM": "Fórum Ministro Arnaldo Süssekind - Térreo",
    "SECAJS": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "SECARQ-GP": "Depósito da SGC - Bonsucesso - 03º andar",
    "SECATE": "Fórum Marquês do Lavradio - Prédio Anexo",
    "SECCOP": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "SECEDI": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "SECEXP": "Fórum Ministro Arnaldo Süssekind - Térreo",
    "SECGRA": "Fórum Ministro Arnaldo Süssekind - Subsolo",
    "SECPOL-1": "Fórum Juiz Feliciano Matias Neto - Térreo",
    "SECPOL-2": "Fórum de Macaé (a partir de 2021) - Térreo",
    "SECPOL-3": "Fórum Juiz Azulino de Andrade - Térreo",
    "SECPOL-4": "Fórum Iralton Benigno Cavalcante - Térreo",
    "SECPOL-GF": "Fórum Advogado Eugenio Roberto Haddock Lobo - Térreo",
    "SECTAR-1": "Depósito da SGC - Bonsucesso - Térreo",
    "SECTAR-2": "Setor de Arquivo Judicial de Duque de Caxias - Térreo",
    "SECTAR-3": "Setor de Arquivo Judicial de Niterói - R. Dr. Celestino - Térreo",
    "SECTAR-4": "Arquivo Judicial - Térreo do prédio 1",
    "SEDI-GAB": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "SEESPP": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "SEGCOM": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "SEJUD1": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "SEPPAF-CF": "Fórum Juiz Augusto Pimenta de Mello - Térreo",
    "SEPPAF-ITB": "Fórum da Comarca de Itaboraí - 05º andar",
    "SEPPAF-ITG": "1ª e 2ª VTs de Itaguaí - Térreo",
    "SEPPAF-MAC": "Fórum de Macaé (a partir de 2021) - Térreo",
    "SEPPAF-NF": "Posto Avançado das VTs de Nova Friburgo - Térreo",
    "SEPPAF-PET": "1ª e 2ª VTs de Petrópolis - Térreo",
    "SEPPAF-RES": "Fórum de Resende (Futuro) - Térreo",
    "SEPPAF-SJM": "Fórum Juiz Pizarro Drummond - Térreo",
    "SEPPAF-VR": "Fórum Juiz José Maria da Cunha Filho - 02º andar",
    "SEPPAG": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "SEQTIC": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "SER-GAB": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "SGE": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "SGE-GAB": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "SGJ": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "SGJ-GAB": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "SGP": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "SGP-GAB": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "SLC": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "SLC-GAB": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "SMI-GAB": "Fórum Ministro Arnaldo Süssekind - 03º andar",
    "SML": "Fórum Ministro Arnaldo Süssekind - 04º andar",
    "SML-GAB": "Fórum Ministro Arnaldo Süssekind - 04º andar",
    "SOF": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "SOF-GAB": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "SOP": "Fórum Ministro Arnaldo Süssekind - 13º andar",
    "SP": "Fórum Ministro Arnaldo Süssekind - 09º andar",
    "SPE": "Fórum Ministro Arnaldo Süssekind - 02º andar",
    "SPR": "Fórum Ministro Arnaldo Süssekind - 08º andar",
    "ST1": "Fórum Ministro Arnaldo Süssekind - 05º andar",
    "ST10": "Fórum Ministro Arnaldo Süssekind - 05º andar",
    "ST2": "Fórum Ministro Arnaldo Süssekind - 05º andar",
    "ST3": "Fórum Ministro Arnaldo Süssekind - 05º andar",
    "ST4": "Fórum Ministro Arnaldo Süssekind - 05º andar",
    "ST5": "Fórum Ministro Arnaldo Süssekind - 05º andar",
    "ST6": "Fórum Ministro Arnaldo Süssekind - 05º andar",
    "ST7": "Fórum Ministro Arnaldo Süssekind - 05º andar",
    "ST8": "Fórum Ministro Arnaldo Süssekind - 05º andar",
    "ST9": "Fórum Ministro Arnaldo Süssekind - 05º andar",
    "STI": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "STI-GAB": "Fórum Ministro Arnaldo Süssekind - 12º andar",
    "GDAVGFS": "10º andar - 1006",
    "GDATFBC": "10º andar - 1015",
    "GDAABF": "6º andar - 604",
    "GDALCM": "7º andar - 701",
    "GDAGZ": "6º andar - 613",
    "GDACCD": "7º andar - 716",
    "GDAPA": "7º andar - 711",
    "GDCRB": "10º andar - 1014",
    "GDCHC": "10º andar - 1012",
    "GDCJC": "11º andar - 1114",
    "GDCMC": "11º andar - 1103",
    "GDCSGF": "6º andar - 611",
    "GDCMSPS": "7º andar - 705",
    "GDCRVMB": "10º andar - 1009",
    "GDCJM": "11º andar - 1110",
    "GDDAO": "6º andar - 605",
    "GDDM": "7º andar - 714",
    "GDEMCT": "7º andar - 709",
    "GDEHRVA": "11º andar - 1102",
    "GDERS": "10º andar - 1003",
    "GDECGG": "7º andar - 718",
    "GDGBLR": "11º andar - 1109",
    "GDGZFB": "11º andar - 1106",
    "GDGTA": "6º andar - 601",
    "GDHJR": "11º andar - 1104",
    "GDJFGF": "7º andar - 713",
    "GDJOSR": "6º andar - 615",
    "GDJFMJ": "6º andar - 607",
    "GDJLCX": "6º andar - 612",
    "GDJNAN": "6º andar - 603",
    "GDLSP": "10º andar - 1005",
    "GDLDB": "6º andar - 609",
    "GDMAC": "11º andar - 1101",
    "GDMASO": "11º andar - 1115",
    "GDMRLC": "10º andar - 1010",
    "GDMPC": "7º andar - 704",
    "GDMACM": "10º andar - 1011",
    "GDMHM": "10º andar - 1002",
    "GDMSMP": "10º andar - 1001",
    "GDMCR": "11º andar - 1112",
    "GDMPBPD": "6º andar - 614",
    "GDMBVP": "10º andar - 1004",
    "GDROM": "6º andar - 602",
    "GDRAMB": "7º andar - 715",
    "GDRN": "11º andar - 1105",
    "GDRLM": "11º andar - 1113",
    "GDRLD": "11º andar 1111",
    "GDRSVT": "7º andar - 707",
    "GDRRC": "6º andar - 616",
    "GDSGC": "10º andar - 1013",
    "GDTBSF": "7º andar - 703",
    "GDNOP": "7º andar - 702",
    "GDJML": "10º andar - 1007"
};

const SELECTORS = {
    time: document.getElementById('current-time'),
    date: document.getElementById('current-date'),
    tbody: document.getElementById('ticket-body'),
    metrics: {
        open: document.getElementById('val-open'),
        crit: document.getElementById('val-crit'),
        sla: document.getElementById('val-sla'),
        expired: document.getElementById('val-expired'),
        solved: document.getElementById('val-solved'),
        solvedWeek: document.getElementById('val-solved-week'),
        lote: document.getElementById('val-lote')
    }
};

/* INITIALIZATION */
function init() {
    updateClock();
    setInterval(updateClock, 1000);

    const toggleRotation = document.getElementById('toggle-rotation');
    const intervalInput = document.getElementById('rotation-interval');

    if (toggleRotation) {
        toggleRotation.onchange = (e) => {
            state.rotation.enabled = e.target.checked;
            manageRotation();
            render();
        };
    }
    if (intervalInput) {
        intervalInput.onchange = (e) => {
            state.rotation.interval = Math.max(5, parseInt(e.target.value) || 10);
            manageRotation();
        };
    }

    // Listeners
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.filters.urgency = chip.dataset.urg;
            render();
        };
    });

    // Metric cards click listeners for table filtering
    const cardViews = {
        'm-open-card': 'open',
        'm-crit-card': 'crit',
        'm-sla-card': 'sla',
        'm-expired-card': 'expired',
        'm-solved-card': 'solved',
        'm-solved-week-card': 'solvedWeek',
        'm-lote-card': 'lote'
    };

    Object.keys(cardViews).forEach(cardId => {
        const cardEl = document.getElementById(cardId);
        if (cardEl) {
            cardEl.style.cursor = 'pointer';
            cardEl.onclick = () => {
                state.currentView = cardViews[cardId];
                render();
            };
        }
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.oninput = (e) => {
            state.filters.search = e.target.value.toLowerCase();
            render();
        };
    }

    const refreshBtn = document.getElementById('manual-refresh');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            remainingSeconds = 0;
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.style.display = 'block';
            chrome.runtime.sendMessage({ type: 'FORCE_REFRESH' });
        };
    }

    const soundBtn = document.getElementById('toggle-sound');
    if (soundBtn) {
        soundBtn.onclick = () => {
            state.soundEnabled = !state.soundEnabled;
            soundBtn.classList.toggle('off', !state.soundEnabled);
            soundBtn.querySelector('svg').style.opacity = state.soundEnabled ? '1' : '0.3';
            showToast(state.soundEnabled ? 'Som Ativado' : 'Som Silenciado', 'success');
        };
    }

    // Configuração de Tema
    const savedTheme = localStorage.getItem('glpi_theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('theme-light');
    }

    const themeBtn = document.getElementById('toggle-theme');
    if (themeBtn) {
        if (savedTheme === 'light') {
            themeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
        }

        themeBtn.onclick = () => {
            const isLight = document.body.classList.toggle('theme-light');
            localStorage.setItem('glpi_theme', isLight ? 'light' : 'dark');

            if (isLight) {
                themeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
            } else {
                themeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
            }
        };
    }

    const fsBtn = document.getElementById('toggle-fs');
    if (fsBtn) {
        fsBtn.onclick = () => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else if (document.exitFullscreen) document.exitFullscreen();
        };
    }

    // Ranking toggle
    const toggleRankingBtn = document.getElementById('ranking-toggle-btn');
    if (toggleRankingBtn) {
        toggleRankingBtn.onclick = () => {
            state.rankingMode = state.rankingMode === 'hoje' ? 'semana' : 'hoje';
            render();
        };
    }

    // Extensão
    if (typeof chrome !== 'undefined' && chrome.storage) {
        // Limpa cache antigo se estiver em formato errado
        chrome.storage.local.get(['glpi_data', 'glpi_config'], (res) => {
            if (res.glpi_data) {
                // Se o dado antigo for apenas uma lista, ignoramos e esperamos a nova carga
                if (Array.isArray(res.glpi_data)) {
                    console.log("Detectado formato antigo, aguardando nova carga...");
                } else {
                    updateState(res.glpi_data);
                }
            }
            if (res.glpi_config) {
                let activeCfg = res.glpi_config;
                if (activeCfg.profiles && activeCfg.activeProfileId) {
                    activeCfg = activeCfg.profiles.find(p => p.id === activeCfg.activeProfileId) || activeCfg.profiles[0];
                }
                state.config.polling = (activeCfg.intervalMin || 1) * 60;
                if (activeCfg.soundNew) {
                    const sndNew = document.getElementById('snd-new');
                    if (sndNew) sndNew.src = activeCfg.soundNew;
                }
                if (activeCfg.soundCrit) {
                    const sndCrit = document.getElementById('snd-crit');
                    if (sndCrit) sndCrit.src = activeCfg.soundCrit;
                }
                applyProfileSettings(activeCfg);
                startCountdown();
            }
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.glpi_config) {
                let newCfg = changes.glpi_config.newValue;
                if (newCfg) {
                    if (newCfg.profiles && newCfg.activeProfileId) {
                        newCfg = newCfg.profiles.find(p => p.id === newCfg.activeProfileId) || newCfg.profiles[0];
                    }
                    if (newCfg.soundNew) {
                        const sndNew = document.getElementById('snd-new');
                        if (sndNew) sndNew.src = newCfg.soundNew;
                    }
                    if (newCfg.soundCrit) {
                        const sndCrit = document.getElementById('snd-crit');
                        if (sndCrit) sndCrit.src = newCfg.soundCrit;
                    }
                    state.config.polling = (newCfg.intervalMin || 1) * 60;
                    applyProfileSettings(newCfg);
                }
            }
        });

        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === 'DATA_UPDATED') {
                updateState(msg.payload);
                showToast('Dados atualizados', 'success');
                resetCountdown();
            }
        });
    }

    setInterval(checkAutoScroll, 5000);
}

let countdownTimer;
let remainingSeconds = 60;

function startCountdown() {
    remainingSeconds = state.config.polling;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        const el = document.getElementById('countdown');
        const spinner = document.getElementById('loading-spinner');

        if (remainingSeconds > 0) {
            remainingSeconds--;
            if (el) el.textContent = remainingSeconds;
            if (spinner) spinner.style.display = 'none';
        } else {
            if (el) el.textContent = '...';
            if (spinner) spinner.style.display = 'block';
        }
    }, 1000);
}

function resetCountdown() {
    remainingSeconds = state.config.polling;
}

let tableScrollTimer;
let currentScrollPos = 0;

function checkAutoScroll() {
    // Scroll for Main Table
    const container = document.getElementById('table-scroll-area');
    const table = document.getElementById('main-table');
    if (container && table) {
        if (table.offsetHeight > container.offsetHeight) {
            if (!tableScrollTimer) {
                tableScrollTimer = setInterval(() => {
                    if (!container.matches(':hover')) {
                        currentScrollPos += 1;
                        container.scrollTop = currentScrollPos;
                        if (currentScrollPos >= (table.offsetHeight - container.offsetHeight + 100)) {
                            currentScrollPos = 0;
                        }
                    }
                }, 30);
            }
        } else {
            if (tableScrollTimer) clearInterval(tableScrollTimer);
            tableScrollTimer = null;
            currentScrollPos = 0;
            container.scrollTop = 0;
        }
    }

    // Scroll for Ranking
    const rankList = document.getElementById('ranking-list');
    const rankContent = document.getElementById('ranking-scroll-content');
    if (rankList && rankContent) {
        if (rankContent.offsetHeight > rankList.offsetHeight && rankList.offsetHeight > 0) {
            rankList.classList.add('scrolling-active');
            const rankDuration = Math.round(rankContent.offsetHeight / 15);
            rankList.style.setProperty('--scroll-duration', `${rankDuration}s`);
        } else {
            rankList.classList.remove('scrolling-active');
        }
    }
}

function updateClock() {
    const now = new Date();
    if (SELECTORS.time) SELECTORS.time.textContent = now.toLocaleTimeString('pt-BR');
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    if (SELECTORS.date) SELECTORS.date.textContent = now.toLocaleDateString('pt-BR', options).toUpperCase();
}

function updateState(data) {
    if (!data) return;

    // Verifica erro de sessão
    if (data.error === 'SESSION_EXPIRED') {
        showToast('SESSÃO EXPIRADA - Faça login no GLPI', 'critical');
        return;
    }

    // Garanter que sempre teremos arrays
    state.open = Array.isArray(data.openTickets) ? data.openTickets : [];
    state.solved = Array.isArray(data.solvedTickets) ? data.solvedTickets : [];
    state.solvedWeek = Array.isArray(data.solvedWeekTickets) ? data.solvedWeekTickets : [];
    state.expiredCount = data.expiredCount || 0;

    // Separa com base nas REGRAS DINÂMICAS do perfil
    const applyGroupRules = (t) => {
        const rules = state.profileSettings.groupRules || [];
        for (const rule of rules) {
            if (rule.keyword && t.title && t.title.toLowerCase().includes(rule.keyword.toLowerCase())) {
                t.group = rule.group;
                break;
            }
        }
    };
    state.open.forEach(applyGroupRules);
    state.solved.forEach(applyGroupRules);
    state.solvedWeek.forEach(applyGroupRules);

    // Alerta Sonoro e Rastreamento de Críticos
    state.knownCriticals = state.knownCriticals || new Set();
    state.knownTickets = state.knownTickets || new Set(state.open.map(t => t.id));

    const currentCriticals = state.open.filter(t => t.urgency === 'critica');

    if (state.initialized) {
        let shouldAlarmCrit = false;
        let shouldAlarmNew = false;

        // Verifica novos chamados na fila
        state.open.forEach(t => {
            if (!state.knownTickets.has(t.id)) {
                shouldAlarmNew = true;
            }
        });

        // Novos Críticos
        currentCriticals.forEach(t => {
            if (!state.knownCriticals.has(t.id)) {
                shouldAlarmCrit = true;
                showToast(`🚨 CRÍTICO NA FILA: #${t.id} - ${t.title}`, 'critical');
            }
        });

        // Alerta de SLA prestes a vencer (< 60 min)
        state.knownSlaAlerts = state.knownSlaAlerts || new Set();
        const slaUrgent = state.open.filter(t => t.slaMinutes !== null && t.slaMinutes >= 0 && t.slaMinutes <= 60);
        slaUrgent.forEach(t => {
            if (!state.knownSlaAlerts.has(t.id)) {
                shouldAlarmCrit = true;
                showToast(`⏰ SLA CRÍTICO: #${t.id} - Faltam ${t.slaMinutes} min`, 'critical');
            }
        });
        state.knownSlaAlerts = new Set(slaUrgent.map(t => t.id));

        if (state.soundEnabled && (shouldAlarmCrit || shouldAlarmNew)) {
            const sndId = (shouldAlarmCrit) ? 'snd-crit' : 'snd-new';
            const snd = document.getElementById(sndId);
            if (snd) {
                snd.volume = 0.8;
                snd.currentTime = 0;
                snd.play().catch(() => { });
            }
        }
    } else {
        state.initialized = true;
    }

    // Atualiza rastreamento
    state.knownTickets = new Set(state.open.map(t => t.id));
    state.knownCriticals = new Set(currentCriticals.map(t => t.id));

    const lastUpdate = document.getElementById('last-update-time');
    if (lastUpdate) lastUpdate.textContent = data.scrapedAt ? new Date(data.scrapedAt).toLocaleTimeString('pt-BR') : '--:--:--';

    const sysPath = document.getElementById('system-path');
    if (sysPath && data.urlOpen) {
        const cleanUrl = data.urlOpen.split('?')[0];
        sysPath.textContent = `GLPI SOURCE: ${cleanUrl}`;
    }

    render();
}

/* RENDER LOGIC */
function filterDataset(dataset) {
    if (!dataset || !Array.isArray(dataset)) return [];

    let activeGroupFilter = state.filters.groups;
    if (state.rotation.enabled && state.filters.groups.length > 1 && !state.filters.groups.includes('all')) {
        let activeIdx = state.rotation.currentIndex % state.filters.groups.length;
        activeGroupFilter = [state.filters.groups[activeIdx]];
    }

    return dataset.filter(t => {
        const matchUrg = state.filters.urgency === 'all' || t.urgency === state.filters.urgency;
        const matchGrp = activeGroupFilter.includes('all') || activeGroupFilter.includes(t.group);
        const matchSearch = !state.filters.search ||
            String(t.id).includes(state.filters.search) ||
            (t.title && t.title.toLowerCase().includes(state.filters.search));
        return matchUrg && matchGrp && matchSearch;
    });
}

function getExpiredCount(dataset) {
    let count = 0;
    dataset.forEach(t => {
        if (t.solDate && t.slaText) {
            const parseDate = (str) => {
                let m = str.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
                return m ? new Date(m[3], m[2] - 1, m[1], m[4], m[5]) : null;
            };
            const sol = parseDate(t.solDate);
            const deadline = parseDate(t.slaText);
            if (sol && deadline && sol >= deadline) {
                count++;
            }
        }
    });
    return count;
}

function highlightActiveCard() {
    const cardViews = {
        'open': 'm-open-card',
        'crit': 'm-crit-card',
        'sla': 'm-sla-card',
        'expired': 'm-expired-card',
        'solved': 'm-solved-card',
        'solvedWeek': 'm-solved-week-card',
        'lote': 'm-lote-card'
    };
    const activeId = cardViews[state.currentView] || 'm-open-card';
    document.querySelectorAll('.metric-card').forEach(c => {
        if (c.id === activeId) {
            c.classList.add('active');
        } else {
            c.classList.remove('active');
        }
    });
}

function render() {
    highlightActiveCard();
    renderMetrics();
    renderTable();
    renderRanking();
    renderGroupFilters();
}

function renderMetrics() {
    const filteredOpen = filterDataset(state.open);
    const filteredSolved = filterDataset(state.solved);
    const filteredSolvedWeek = filterDataset(state.solvedWeek);

    const criticalCount = filteredOpen.filter(t => t.urgency === 'critica').length;
    const slaWarningCount = filteredOpen.filter(t => t.slaMinutes !== null && t.slaMinutes >= 0 && t.slaMinutes <= 60).length;
    const loteCount = filteredOpen.filter(t =>
        (t.title && t.title.toLowerCase().includes('atendimentos em lote')) ||
        (t.group && (t.group.toLowerCase().includes('lote') || t.group.toLowerCase().includes('cronograma')))
    ).length;
    const openExpiredCount = filteredOpen.filter(t => t.slaPercent >= 100 || (t.slaMinutes !== null && t.slaMinutes < 0)).length;
    const expiredCountFiltered = getExpiredCount(filteredSolvedWeek) + openExpiredCount;

    if (SELECTORS.metrics.open) SELECTORS.metrics.open.textContent = filteredOpen.length;
    if (SELECTORS.metrics.crit) SELECTORS.metrics.crit.textContent = criticalCount;
    if (SELECTORS.metrics.sla) SELECTORS.metrics.sla.textContent = slaWarningCount;
    if (SELECTORS.metrics.expired) SELECTORS.metrics.expired.textContent = expiredCountFiltered;
    if (SELECTORS.metrics.solved) SELECTORS.metrics.solved.textContent = filteredSolved.length;
    if (SELECTORS.metrics.solvedWeek) SELECTORS.metrics.solvedWeek.textContent = filteredSolvedWeek.length;
    if (SELECTORS.metrics.lote) SELECTORS.metrics.lote.textContent = loteCount;

    const totalActivity = filteredOpen.length + filteredSolved.length;
    const ratio = totalActivity > 0 ? Math.round((filteredSolved.length / totalActivity) * 100) : 0;
    const gauge = document.getElementById('gauge-path');
    if (gauge) gauge.style.strokeDasharray = `${ratio}, 100`;
    const gVal = document.getElementById('gauge-val');
    if (gVal) gVal.textContent = ratio + '%';
}

function renderTable() {
    if (!SELECTORS.tbody) return;

    let dataset = [];
    let titlePrefix = "Fila de Atendimento";

    if (state.currentView === 'open') {
        dataset = state.open;
        titlePrefix = "Fila de Atendimento (Abertos)";
    } else if (state.currentView === 'crit') {
        dataset = state.open.filter(t => t.urgency === 'critica');
        titlePrefix = "Chamados Críticos";
    } else if (state.currentView === 'sla') {
        dataset = state.open.filter(t => t.slaMinutes !== null && t.slaMinutes >= 0 && t.slaMinutes <= 60);
        titlePrefix = "Chamados com SLA < 60 Minutos";
    } else if (state.currentView === 'expired') {
        // Combinado
        const openExp = state.open.filter(t => t.slaPercent >= 100 || (t.slaMinutes !== null && t.slaMinutes < 0));
        let solvedExp = [];
        state.solvedWeek.forEach(t => {
            if (t.solDate && t.slaText) {
                const parseDate = (str) => {
                    let m = str.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
                    return m ? new Date(m[3], m[2] - 1, m[1], m[4], m[5]) : null;
                };
                const sol = parseDate(t.solDate);
                const deadline = parseDate(t.slaText);
                if (sol && deadline && sol >= deadline) {
                    solvedExp.push(t);
                }
            }
        });
        dataset = [...openExp, ...solvedExp];
        titlePrefix = "Chamados Expirados";
    } else if (state.currentView === 'solved') {
        dataset = state.solved;
        titlePrefix = "Chamados Solucionados Hoje";
    } else if (state.currentView === 'solvedWeek') {
        dataset = state.solvedWeek;
        titlePrefix = "Chamados Solucionados na Semana";
    } else if (state.currentView === 'lote') {
        dataset = state.open.filter(t =>
            (t.title && t.title.toLowerCase().includes('atendimentos em lote')) ||
            (t.group && (t.group.toLowerCase().includes('lote') || t.group.toLowerCase().includes('cronograma')))
        );
        titlePrefix = "Atendimentos em Lote (Cronograma)";
    } else {
        dataset = state.open;
    }

    const filtered = filterDataset(dataset);

    const titleEl = document.querySelector('.section-title h2');
    if (titleEl) titleEl.textContent = titlePrefix;

    const totalEl = document.getElementById('ticket-total');
    if (totalEl) totalEl.textContent = `${filtered.length} TICKETS`;

    if (filtered.length === 0) {
        SELECTORS.tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 40px; color: var(--text-dim);">NENHUM CHAMADO ENCONTRADO</td></tr>`;
        return;
    }

    SELECTORS.tbody.innerHTML = filtered.map((t, i) => {
        const cleanId = String(t.id).replace(/\D/g, '');
        const isSolvedView = state.currentView === 'solved' || state.currentView === 'solvedWeek';
        return `
        <tr style="animation-delay: ${i * 0.05}s">
            <td style="font-family: var(--font-mono); font-weight: 700;">
                <a href="https://atendimento.trt1.jus.br/front/ticket.form.php?id=${cleanId}" target="_blank" class="ticket-link">#${cleanId}</a>
            </td>
            <td>
                <div style="font-weight: 600; color: var(--text-main);">${t.title}</div>
                <div style="font-size: 11px; color: var(--accent); font-weight: 500; margin-top: 2px;">${t.assignee || 'Pendente'}</div>
            </td>
            <td>
                <div class="user-cell">
                    <div class="avatar">${(t.user || '?')[0]}</div>
                    <div style="line-height: 1.2;">
                        <div style="font-weight: 600; color: var(--text-main);">${t.user || 'N/I'}</div>
                        <div style="font-size: 10px; color: var(--text-muted);">
                           ${(() => {
                const sector = (t.userSector || '').trim();
                const activeMap = state.profileSettings.locationMap
                    ? Object.assign({}, MAPA_LOCALIZACAO, state.profileSettings.locationMap)
                    : MAPA_LOCALIZACAO;
                const location = activeMap[sector.toUpperCase()];
                return location ? `${sector} <span style="color: var(--accent); font-weight: 700;">[${location}]</span>` : sector;
            })()}
                        </div>
                    </div>
                </div>
            </td>
            <td><div class="badge urg-${t.urgency}"><span class="badge-dot"></span>${t.urgency.toUpperCase()}</div></td>
            <td><span class="status-pill">${t.status}</span></td>
            <td>
                <div style="font-size: 12px; font-weight: 600; color: var(--text-main);">${t.group || 'Geral'}</div>
            </td>
            <td class="sla-cell">
                ${isSolvedView
                ? `<span style="font-size: 11px; color: var(--green); font-weight: 700;">✔ Solucionado</span>`
                : formatSlaCell(t)
            }
            </td>
            <td>
                <div style="font-size: 11px; color: var(--text-muted);">
                    ${isSolvedView
                ? (t.solDate ? `<span style="color:var(--text-dim)">Sol: </span>${t.solDate}` : '--')
                : (t.slaText || '--')
            }
                </div>
            </td>
            <td>
                <div style="font-size: 11px; color: var(--text-muted);">${t.date || '--'}</div>
            </td>
            <td>
                <button class="btn-notify" data-id="${t.id}" title="Enviar Notificação Manual">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </td>
        </tr>
        `;
    }).join('');

    // Adiciona Listeners para os botões de notificação
    document.querySelectorAll('.btn-notify').forEach(btn => {
        btn.onclick = (e) => {
            const tid = btn.dataset.id;
            const ticket = state.open.find(t => String(t.id) === tid);
            if (ticket) {
                btn.classList.add('loading');
                chrome.runtime.sendMessage({ type: 'MANUAL_NOTIFY', ticket }, (res) => {
                    btn.classList.remove('loading');
                    if (res && res.status === 'ok') {
                        showToast('Notificação enviada!', 'success');
                    } else {
                        showToast('Erro ao enviar', 'critical');
                    }
                });
            }
        };
    });
}

function formatSlaCell(t) {
    const percent = t.slaPercent || 0;
    const color = t.slaColor || 'var(--accent)';

    // Calcula o tempo relativo apenas para a bolinha de status
    const min = t.slaMinutes;
    const isNegative = (min !== null && min < 0) || percent >= 100;
    const isUrgent = min !== null && min >= 0 && min <= 60;

    let statusColor = color;
    if (isNegative) statusColor = 'var(--red)';
    else if (isUrgent) statusColor = 'var(--amber)';

    return `
        <div class="sla-text" style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-weight: 800; font-size: 14px; color: ${statusColor}">${percent}%</span>
        </div>
        <div class="sla-container" style="margin-top: 4px;">
            <div class="sla-bar" style="width: ${Math.min(100, percent)}%; background: ${color}; box-shadow: 0 0 8px ${color}88;"></div>
        </div>
    `;
}

function renderRanking() {
    const techs = {};

    const btn = document.getElementById('ranking-toggle-btn');
    if (btn) {
        btn.textContent = state.rankingMode === 'semana' ? 'PRODUTIVIDADE SEMANA' : 'PRODUTIVIDADE HOJE';
    }

    let dataset = state.rankingMode === 'semana' ? filterDataset(state.solvedWeek) : filterDataset(state.solved);

    dataset.forEach(t => {
        let name = (t.assignee && t.assignee.trim() !== '') ? t.assignee : 'Não Atribuído';

        // Em casos de múltiplos técnicos na mesma string, podemos manter como uma equipe para o número bater
        // ou dividir. Optamos por manter o agregado para que a soma bata perfeitamente com os fechados.
        if (!techs[name]) techs[name] = { name, count: 0 };
        techs[name].count++;
    });

    let sorted = Object.values(techs).sort((a, b) => b.count - a.count);

    if (sorted.length > 10) {
        let top = sorted.slice(0, 9);
        let othersCount = sorted.slice(9).reduce((acc, curr) => acc + curr.count, 0);
        if (othersCount > 0) {
            top.push({ name: 'Outros', count: othersCount });
        }
        sorted = top;
    }

    const list = document.getElementById('ranking-list');
    if (!list) return;

    list.innerHTML = '<div id="ranking-scroll-content">' + (sorted.map((r, i) => `
        <div class="ranking-item">
            <div class="rank-pos top${i + 1}">${i + 1}</div>
            <div class="rank-info"><div class="rank-name">${r.name}</div></div>
            <div class="rank-count">${r.count}</div>
        </div>
    `).join('') || '<div style="text-align:center; padding:20px; color:gray">Sem registros</div>') + '</div>';
}

function renderGroupFilters() {
    const groups = ['all', ...new Set(state.open.map(t => t.group).filter(Boolean))].sort();
    const container = document.getElementById('group-filters');
    if (!container) return;

    container.innerHTML = groups.map(g => {
        let isActive = state.filters.groups.includes(g);
        let isRotatingActive = state.rotation.enabled && state.filters.groups.length > 1 && !state.filters.groups.includes('all') && state.filters.groups[state.rotation.currentIndex % state.filters.groups.length] === g;

        let classes = ['filter-chip'];
        if (isActive) classes.push('active');
        if (isRotatingActive) classes.push('rotating-highlight');

        return `
        <div class="${classes.join(' ')}" data-group="${g}">
            ${g === 'all' ? 'TODAS FILAS' : g.toUpperCase()}
        </div>
        `;
    }).join('');

    container.querySelectorAll('.filter-chip').forEach(chip => {
        chip.onclick = () => {
            const grp = chip.dataset.group;
            if (grp === 'all') {
                state.filters.groups = ['all'];
            } else {
                state.filters.groups = state.filters.groups.filter(g => g !== 'all');
                if (state.filters.groups.includes(grp)) {
                    state.filters.groups = state.filters.groups.filter(g => g !== grp);
                } else {
                    state.filters.groups.push(grp);
                }
                if (state.filters.groups.length === 0) {
                    state.filters.groups = ['all'];
                }
            }
            state.rotation.currentIndex = 0; // Reset rotation index
            manageRotation();
            render();
        };
    });
}

function animateValue(obj, end) {
    if (!obj) return;
    let start = parseInt(obj.textContent) || 0;
    if (start === end) return;
    obj.textContent = end; // Simplificado para evitar loop de erro
}

function showToast(msg, type) {
    const overlay = document.getElementById('notification-overlay');
    if (!overlay) return;
    const toast = document.createElement('div');
    toast.className = 'toast';

    // Customizar cor da borda baseado no tipo
    if (type === 'success') {
        toast.style.borderLeftColor = 'var(--green)';
    } else if (type === 'critical') {
        toast.style.borderLeftColor = 'var(--red)';
        toast.style.boxShadow = '0 10px 30px rgba(255, 95, 95, 0.3)';
    } else {
        toast.style.borderLeftColor = 'var(--accent)';
    }

    toast.innerHTML = `<div style="font-weight:700">${type === 'critical' ? 'ALERTA DE SISTEMA' : 'NOTIFICAÇÃO'}</div><div style="margin-top: 4px;">${msg}</div>`;
    overlay.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

init();
