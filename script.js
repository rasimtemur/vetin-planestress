// --- AYARLAR VE GLOBAL DEĞİŞKENLER ---
const cvsMohr = document.getElementById('mohrCanvas');
const ctxMohr = cvsMohr.getContext('2d');
const cvsElem = document.getElementById('stressElementCanvas');
const ctxElem = cvsElem.getContext('2d');
const cvsPrinc = document.getElementById('principalElementCanvas');
const ctxPrinc = cvsPrinc.getContext('2d');
const cvsTrans = document.getElementById('transformedElementCanvas');
const ctxTrans = cvsTrans.getContext('2d');
const cvsShear = document.getElementById('shearElementCanvas');
const ctxShear = cvsShear.getContext('2d');

let isGridLayout = false;
let isCompactLayout = false;

// --- TEMA YÖNETİMİ BAŞLATMA ---
initializeTheme();
// -----------------------------

// Girdiler
const inputs = {
    Sx: document.getElementById('tbSx'), Sy: document.getElementById('tbSy'),
    Txy: document.getElementById('tbTxy'), Fi: document.getElementById('tbFi'),
    TrackFi: document.getElementById('trackBarFi'),
    // Aliases for compact layout compatibility
    tbSx: document.getElementById('tbSx'), tbSy: document.getElementById('tbSy'),
    tbTxy: document.getElementById('tbTxy'), tbFi: document.getElementById('tbFi'),
    trackBarFi: document.getElementById('trackBarFi')
};

// Çıktılar
const outputs = {
    Fia1: document.getElementById('valFia1'), Fia2: document.getElementById('valFia2'),
    S1: document.getElementById('valS1'), S2: document.getElementById('valS2'),
    Tmax: document.getElementById('valTmax'), Tmin: document.getElementById('valTmin'),
    Sxi: document.getElementById('valSxi'), Syi: document.getElementById('valSyi'),
    Toxiyi: document.getElementById('valToxiyi'), Toyixi: document.getElementById('valToyixi'),
    Tyx: document.getElementById('valTyx'),
    // Aliases for compact layout compatibility
    valTyx: document.getElementById('valTyx'),
    valS1: document.getElementById('valS1'), valS2: document.getElementById('valS2'),
    valTmax: document.getElementById('valTmax'), valTmin: document.getElementById('valTmin'),
    valFia1: document.getElementById('valFia1'), valFia2: document.getElementById('valFia2'),
    valSxi: document.getElementById('valSxi'), valSyi: document.getElementById('valSyi'),
    valToxiyi: document.getElementById('valToxiyi'), valToyixi: document.getElementById('valToyixi'),
    valFik1: document.getElementById('valFik1'), valFik2: document.getElementById('valFik2')
};

const controls = {
    chSigmaxitoxiyi: document.getElementById('chSigmaxitoxiyi'),
    selNotation: document.getElementById('selNotation') || { addEventListener: () => {} } // Safe fallback
};

// --- NOTATION LOGIC ---
/**
 * SignNotation - 3 farklı notasyon sistemini yönetir:
 * 
 * 1. STRUCTURAL (Mühendislik/Yapısal) - Varsayılan
 *    - Normal Gerilme: Çekme (+), Basınç (-)
 *    - Kayma Gerilmesi: CW (Saat Yönü) döndüren › Grafik YUKARI (+)
 *    - Eleman Okları: Pozitif değer › Dışa doğru ok (Çekme)
 * 
 * 2. MATHEMATICAL (Matematiksel/Teorik)
 *    - Normal Gerilme: Çekme (+), Basınç (-)
 *    - Kayma Gerilmesi: CCW (Saat Yönü Tersi) pozitif › Grafik YUKARI (+)
 *    - Eleman Okları: Pozitif değer › Dışa doğru ok (Çekme)
 *    - NOT: ? ekseni ters çizilir (Structural'ın tersi)
 * 
 * 3. GEOTECHNICAL (Zemin Mekaniği/Geoteknik)
 *    - Normal Gerilme: Basınç (+), Çekme (-) ‹ İşaret TERSİ
 *    - Kayma Gerilmesi: CW (Saat Yönü) döndüren › Grafik YUKARI (+)
 *    - Eleman Okları: Pozitif değer (Basınç) › İÇE doğru ok
 *    - Girdi Mantığı: "50" yazdığında "50 MPa Basınç" anlamına gelir
 */
class SignNotation {
    constructor(type = 'structural') {
        this.type = type;
        this.params = this.getDefaultParams();
        this.configure(type);
    }

    getDefaultParams() {
        return {
            // Normal gerilme işaret çarpanı: 1 = Çekme(+), -1 = Basınç(+)
            normalScale: 1,
            // Kayma gerilmesi işaret çarpanı (formül içi)
            shearScale: 1,
            // Mohr çemberinde ? ekseni ters mi? (Mathematical mod için)
            tauAxisInverted: false,
            // directionMult: CW=-1 (yukarı), CCW=1 (aşağı) - grafik çizim yönü
            directionMult: -1,
            // Eleman okları: pozitif değer › dışa mı (true) yoksa içe mi (false)?
            arrowsOutward: true
        };
    }

    configure(type) {
        this.type = type;

        switch (type) {
            case 'structural':
                // Mühendislik Notasyonu (Varsayılan)
                // ?: Çekme (+), Basınç (-)
                // ?: CW pozitif, grafik üzerinde YUKARI çizilir
                // Oklar: Pozitif (Çekme) › DIŞA
                this.params = {
                    normalScale: 1,
                    shearScale: 1,
                    tauAxisInverted: false,
                    directionMult: -1, // CW yukarı
                    arrowsOutward: true
                };
                break;

            case 'mathematical':
                // Matematiksel/Teorik Notasyon
                // ?: Çekme (+), Basınç (-)
                // ?: CCW pozitif, grafik üzerinde YUKARI çizilir
                // Oklar: Pozitif (Çekme) › DIŞA
                // NOT: ? ekseni ters çevrilir
                this.params = {
                    normalScale: 1,
                    shearScale: 1,
                    tauAxisInverted: true, // ? ekseni ters
                    directionMult: 1, // CCW yukarı (standart matematik koordinat sistemi)
                    arrowsOutward: true
                };
                break;

            case 'geotechnical':
                // Zemin Mekaniği/Geoteknik Notasyonu
                // ?: Basınç (+), Çekme (-) ‹ İŞARET TERSİ
                // ?: CW pozitif (Mühendislik ile aynı grafik)
                // Oklar: Pozitif (Basınç) › İÇE
                this.params = {
                    normalScale: -1, // Basınç (+)
                    shearScale: 1,
                    tauAxisInverted: false,
                    directionMult: -1, // CW yukarı
                    arrowsOutward: false // Oklar içe
                };
                break;

            case 'literature':
                // Literatür (Diğer) Notasyonu (VB.NET 'Diğer' / ShearOld)
                // Eksen: Yukarı (+), Aşağı (-) (Mühendislik gibi)
                // Çizim: Pozitif değer AŞAĞI doğru çizilir (Yani negatif bölgeye)
                // Bu, işaretin ters çevrildiği anlamına gelir.
                this.params = {
                    normalScale: 1,
                    shearScale: 1,
                    tauAxisInverted: false, // Eksen Yukarı (+)
                    directionMult: 1,       // Çizim Aşağı (+) -> Yani +50 girince -50 bölgesine (aşağı) çizer
                    arrowsOutward: true
                };
                break;

            default:
                this.params = this.getDefaultParams();
        }
    }

    /**
     * Kullanıcı girdisini (Notasyon değeri) Engineering (internal) değerine çevirir
     * INPUT › INTERNAL
     */
    toEng(val, type) {
        if (type === 'normal') return val * this.params.normalScale;
        if (type === 'shear') return val * this.params.shearScale;
        return val;
    }

    /**
     * Engineering (internal) değerini Kullanıcı çıktısına (Notasyon değeri) çevirir
     * INTERNAL › OUTPUT
     */
    fromEng(val, type) {
        if (type === 'normal') return val * this.params.normalScale;
        if (type === 'shear') return val * this.params.shearScale;
        return val;
    }

    /**
     * Eleman çiziminde okların yönünü belirler
     * @param {number} val - Gerilme değeri (internal/engineering)
     * @returns {boolean} - true: dışa doğru, false: içe doğru
     */
    isArrowOutward(val) {
        if (this.params.arrowsOutward) {
            // Structural/Mathematical: Pozitif (Çekme) › Dışa
            return val > 0;
        } else {
            // Geotechnical: Pozitif değer (ki internal'da negatif = basınç) › İçe
            // Internal val > 0 › Çekme (geotechnical'da negatif gösterim) › Dışa
            // Internal val < 0 › Basınç (geotechnical'da pozitif gösterim) › İçe
            return val > 0;
        }
    }

    /**
     * Notasyon tipini döndürür
     */
    getType() {
        return this.type;
    }

    /**
     * Notasyon açıklamasını döndürür
     */
    getDescription() {
        const descriptions = {
            structural: 'Mühendislik (Yapısal): Çekme (+), CW›Yukarı',
            mathematical: 'Matematiksel (Teorik): Çekme (+), CCW›Yukarı',
            geotechnical: 'Zemin Mekaniği: Basınç (+), Oklar içe',
            literature: 'Literatür (Diğer): Çekme (+), İşaret Tersi'
        };
        return descriptions[this.type] || descriptions.structural;
    }
}

let currentNotation = new SignNotation('structural');

let calc = {
    sigmax: 0, sigmay: 0, toxy: 0, fi: 0,
    sigmamax: 0, sigmamin: 0, tomax: 0, sigmaave: 0, tomin: 0,
    sigmaxi: 0, toxiyi: 0, fiahfz: 0
};

// Toggle States
let showMohrValues = true;
let showStressValues = false;
let showPrincipalValues = false;
let showTransformedValues = false;

const btnToggleMohr = document.getElementById('btnToggleValuesMohr');
const btnToggleStress = document.getElementById('btnToggleValuesStress');
const btnTogglePrincipal = document.getElementById('btnToggleValuesPrincipal');
const btnToggleTransformed = document.getElementById('btnToggleValuesTransformed');

if (btnToggleMohr) {
    btnToggleMohr.classList.add('active'); // Start active
    btnToggleMohr.addEventListener('click', () => {
        showMohrValues = !showMohrValues;
        btnToggleMohr.classList.toggle('active', showMohrValues);
        updateAll();
    });
}

if (btnToggleStress) {
    btnToggleStress.addEventListener('click', () => {
        showStressValues = !showStressValues;
        btnToggleStress.classList.toggle('active', showStressValues);
        updateAll();
    });
}

if (btnTogglePrincipal) {
    btnTogglePrincipal.addEventListener('click', () => {
        showPrincipalValues = !showPrincipalValues;
        btnTogglePrincipal.classList.toggle('active', showPrincipalValues);
        updateAll();
    });
}

if (btnToggleTransformed) {
    btnToggleTransformed.addEventListener('click', () => {
        showTransformedValues = !showTransformedValues;
        btnToggleTransformed.classList.toggle('active', showTransformedValues);
        updateAll();
    });
}

let showShearValues = false;
const btnToggleShear = document.getElementById('btnToggleValuesShear');

if (btnToggleShear) {
    btnToggleShear.addEventListener('click', () => {
        showShearValues = !showShearValues;
        btnToggleShear.classList.toggle('active', showShearValues);
        updateAll();
    });
}

let hitArea = { x: 0, y: 0, radius: 20 };
let hitArea2 = { x: 0, y: 0, radius: 20 };
let hitArea3 = { x: 0, y: 0, radius: 20 }; // Green line point 1
let hitArea4 = { x: 0, y: 0, radius: 20 }; // Green line point 2

// Yatay ve düşey eksenlerdeki gerilme noktaları için ek hit area'lar
let hitAreaSx = { x: 0, y: 0, radius: 20 };   // ?x yatay eksende (px, merkezy)
let hitAreaSy = { x: 0, y: 0, radius: 20 };   // ?y yatay eksende (qx, merkezy)
let hitAreaTxy = { x: 0, y: 0, radius: 20 };  // ?xy düşey eksende (originX, py)
let hitAreaTyx = { x: 0, y: 0, radius: 20 };  // ?yx düşey eksende (originX, qy)

let isDragging = false;
let isDragging2 = false;
let isDraggingPhi = false; // Dragging green line point 1
let isDraggingPhi2 = false; // Dragging green line point 2

// Yeni sürükleme durumları
let isDraggingSx = false;   // ?x sürükleniyor
let isDraggingSy = false;   // ?y sürükleniyor
let isDraggingTxy = false;  // ?xy sürükleniyor
let isDraggingTyx = false;  // ?yx sürükleniyor

let isHovering = false;
let isHovering2 = false;
let isHoveringPhi = false;
let isHoveringPhi2 = false;

// Yeni hover durumları
let isHoveringSx = false;
let isHoveringSy = false;
let isHoveringTxy = false;
let isHoveringTyx = false;
let screenCenter = { x: 0, y: 0 };
let scaleFactor = 1;
let directionMult = 1;
let screenRadius = 0;

// View Transform
let viewTransform = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    minZoom: 0.5,
    maxZoom: 5.0
};
let isPanning = false;
let panStart = { x: 0, y: 0 };

// Dil Değişikliğini Dinle
window.addEventListener('languageChanged', (e) => {
    updateAll();
});

// --- SVG İNDİRME ---
class SvgContext {
    constructor(width, height) {
        this.width = width; this.height = height; this.buffer = []; this.pathBuffer = ""; this.stack = [];
        this.strokeStyle = "#000"; this.fillStyle = "#000"; this.lineWidth = 1;
        this.font = "10px sans-serif"; this.textAlign = "start"; this.textBaseline = "alphabetic"; this.lineDash = [];
    }
    beginPath() { this.pathBuffer = ""; }
    moveTo(x, y) { this.pathBuffer += `M ${x.toFixed(2)} ${y.toFixed(2)} `; }
    lineTo(x, y) { if (this.pathBuffer === "") this.pathBuffer += `M ${x.toFixed(2)} ${y.toFixed(2)} `; else this.pathBuffer += `L ${x.toFixed(2)} ${y.toFixed(2)} `; }
    closePath() { this.pathBuffer += "Z "; }
    arc(x, y, radius, startAngle, endAngle, anticlockwise = false) {
        let start = startAngle % (2 * Math.PI); let end = endAngle % (2 * Math.PI);
        let diff = end - start;
        if (anticlockwise) { if (diff >= 0) diff -= 2 * Math.PI; } else { if (diff <= 0) diff += 2 * Math.PI; }
        if (Math.abs(Math.abs(diff) - 2 * Math.PI) < 0.0001) {
            const xStart = x + radius * Math.cos(start); const yStart = y + radius * Math.sin(start);
            const xMid = x + radius * Math.cos(start + Math.PI); const yMid = y + radius * Math.sin(start + Math.PI);
            if (this.pathBuffer === "") this.pathBuffer += `M ${xStart.toFixed(2)} ${yStart.toFixed(2)} `; else this.pathBuffer += `L ${xStart.toFixed(2)} ${yStart.toFixed(2)} `;
            this.pathBuffer += `A ${radius} ${radius} 0 1 1 ${xMid.toFixed(2)} ${yMid.toFixed(2)} `; this.pathBuffer += `A ${radius} ${radius} 0 1 1 ${xStart.toFixed(2)} ${yStart.toFixed(2)} `;
            return;
        }
        const x1 = x + radius * Math.cos(start); const y1 = y + radius * Math.sin(start);
        const x2 = x + radius * Math.cos(start + diff); const y2 = y + radius * Math.sin(start + diff);
        const largeArcFlag = Math.abs(diff) > Math.PI ? 1 : 0; const sweepFlag = anticlockwise ? 0 : 1;
        if (this.pathBuffer === "") this.pathBuffer += `M ${x1.toFixed(2)} ${y1.toFixed(2)} `; else this.pathBuffer += `L ${x1.toFixed(2)} ${y1.toFixed(2)} `;
        this.pathBuffer += `A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${x2.toFixed(2)} ${y2.toFixed(2)} `;
    }
    stroke() { if (this.pathBuffer.trim() === "") return; let dash = this.lineDash.length > 0 ? `stroke-dasharray="${this.lineDash.join(',')}"` : ""; this.buffer.push(`<path d="${this.pathBuffer}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}" ${dash} stroke-linecap="round" stroke-linejoin="round"/>`); }
    fill() { if (this.pathBuffer.trim() === "") return; this.buffer.push(`<path d="${this.pathBuffer}" fill="${this.fillStyle}" stroke="none" />`); }
    fillRect(x, y, w, h) { this.buffer.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${this.fillStyle}" stroke="none"/>`); }
    strokeRect(x, y, w, h) { this.buffer.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}"/>`); }
    fillText(text, x, y) {
        let anchor = "start"; if (this.textAlign === "center") anchor = "middle"; if (this.textAlign === "right") anchor = "end";
        let baseline = "alphabetic"; if (this.textBaseline === "middle") baseline = "middle";
        let fSize = 12; if (this.font.includes("px")) { const match = this.font.match(/(\d+)px/); if (match) fSize = parseInt(match[1]); }
        const safeText = text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        this.buffer.push(`<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" fill="${this.fillStyle}" font-family="sans-serif" font-size="${fSize}" text-anchor="${anchor}" dominant-baseline="${baseline}">${safeText}</text>`);
    }
    measureText(text) { return { width: text.toString().length * 7 }; }
    save() { this.stack.push('SAVE'); }
    restore() { while (this.stack.length > 0) { const item = this.stack.pop(); if (item === 'SAVE') break; if (item === 'G') this.buffer.push('</g>'); } }
    translate(x, y) { this.buffer.push(`<g transform="translate(${x.toFixed(2)},${y.toFixed(2)})">`); this.stack.push('G'); }
    rotate(angle) { const deg = angle * 180 / Math.PI; this.buffer.push(`<g transform="rotate(${deg.toFixed(2)})">`); this.stack.push('G'); }
    setLineDash(segments) { this.lineDash = segments; }
    clearRect() { this.buffer = []; this.pathBuffer = ""; this.stack = []; }
    getSVG() { return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">\n<rect width="100%" height="100%" fill="white"/>\n${this.buffer.join('\n')}\n</svg>`; }
}

async function downloadSVG(type) {
    let width, height, drawFn; let defaultName = "cizim.svg";
    if (type === 'mohr') { width = cvsMohr.width; height = cvsMohr.height; drawFn = (mock) => drawMohr(mock); defaultName = "mohr_cemberi.svg"; }
    else if (type === 'element') { width = cvsElem.width; height = cvsElem.height; drawFn = (mock) => drawStressElement(mock, width, height, 0, calc.sigmax, calc.sigmay, calc.toxy, "x", "y"); defaultName = "gerilme_hali.svg"; }
    else if (type === 'principal') { width = cvsPrinc.width; height = cvsPrinc.height; drawFn = (mock) => drawPrincipalElement(mock, width, height, calc.fiahfz, calc.sigmamax, calc.sigmamin); defaultName = "asal_gerilmeler.svg"; }
    else if (type === 'shear') { width = cvsShear.width; height = cvsShear.height; drawFn = (mock) => drawShearElement(mock, width, height, calc.fiahfz, calc.tomax, calc.tomin, calc.sigmaave); defaultName = "kayma_gerilmeleri.svg"; }
    else if (type === 'transformed') { width = cvsTrans.width; height = cvsTrans.height; drawFn = (mock) => drawStressElement(mock, width, height, -calc.fi, calc.sigmaxi, calc.sigmayi, calc.toxiyi, "x'", "y'", showTransformedValues); defaultName = "donusum_elementi.svg"; }
    const mock = new SvgContext(width, height); drawFn(mock);
    const svgString = mock.getSVG(); const blob = new Blob([svgString], { type: 'image/svg+xml' });
    if (window.showSaveFilePicker) { try { const handle = await window.showSaveFilePicker({ suggestedName: defaultName, types: [{ description: 'SVG File', accept: { 'image/svg+xml': ['.svg'] }, }], }); const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); return; } catch (err) { if (err.name !== 'AbortError') fallbackDownload(blob, defaultName); } } else { fallbackDownload(blob, defaultName); }
}
function fallbackDownload(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }

// --- RESIZE & EVENTS ---
function resizeAll() {
    const gridCont = document.getElementById('gridContainer');
    const centerPnl = document.getElementById('center-panel');

    if (isGridLayout && gridCont) {
        // In grid layout, resize using the grid panel dimensions
        const gridPanels = gridCont.querySelectorAll('.grid-panel');
        gridPanels.forEach(panel => {
            const canvas = panel.querySelector('canvas');
            if (canvas) {
                const rect = panel.getBoundingClientRect();
                // In grid layout, title is static (takes space) or absolute?
                // CSS says: body.grid-layout ... .panel-title { position: static }
                // So we subtract title height.
                // Siblings: title, controls...
                // Only subtract what consumes vertical flow space.
                let reserved = 0;
                Array.from(panel.children).forEach(child => {
                    if (child !== canvas && child.tagName !== 'CANVAS' && getComputedStyle(child).position === 'static') {
                        reserved += child.offsetHeight;
                    }
                });

                canvas.width = rect.width - 2;
                canvas.height = rect.height - reserved - 6;
            }
        });
    } else if (centerPnl) {
        const wrapper = document.getElementById('mohr-content-wrapper');
        if (wrapper) {
            const wrapRect = wrapper.getBoundingClientRect();
            // In default layout, title/controls are absolute?
            // Check CSS. .panel-title is absolute by default.
            // So reserved = 0.
            let reserved = 0;
            Array.from(wrapper.children).forEach(child => {
                if (child !== cvsMohr && child.tagName !== 'CANVAS' && getComputedStyle(child).position === 'static') {
                    reserved += child.offsetHeight;
                }
            });
            cvsMohr.width = wrapRect.width;
            cvsMohr.height = wrapRect.height - reserved;
        } else {
            // Fallback
            const centerRect = centerPnl.getBoundingClientRect();
            cvsMohr.width = centerRect.width;
            cvsMohr.height = centerRect.height;
        }

        // Element canvases fill their element-box containers
        // Note: .panel-title is position:absolute so doesn't affect layout
        [cvsElem, cvsPrinc, cvsShear, cvsTrans].forEach(c => {
            const parent = c.parentElement;
            if (parent) {
                const rect = parent.getBoundingClientRect();
                c.width = rect.width;
                c.height = rect.height;
            }
        });
    }
    updateAll();
}
window.addEventListener('resize', resizeAll);
[inputs.Sx, inputs.Sy, inputs.Txy].forEach(el => el.addEventListener('input', updateAll));
inputs.Fi.addEventListener('input', () => { inputs.TrackFi.value = inputs.Fi.value; updateAll(); });
inputs.TrackFi.addEventListener('input', () => { inputs.Fi.value = inputs.TrackFi.value; updateAll(); });
document.querySelectorAll('input[type=radio], input[type=checkbox]').forEach(el => el.addEventListener('change', updateAll));

// --- VIEW TRANSFORM FUNCTIONS ---
function applyViewTransform(ctx) {
    ctx.translate(viewTransform.panX, viewTransform.panY);
    ctx.scale(viewTransform.zoom, viewTransform.zoom);
}

function resetView() {
    viewTransform.zoom = 1.0;
    viewTransform.panX = 0;
    viewTransform.panY = 0;
    updateAll();
}

function zoomIn() {
    // Canvas merkezini al (Mohr çemberinin merkezi)
    const centerX = cvsMohr.width / 2;
    const centerY = cvsMohr.height / 2;

    // Zoom öncesi merkez noktasının dünya koordinatları
    const worldX = (centerX - viewTransform.panX) / viewTransform.zoom;
    const worldY = (centerY - viewTransform.panY) / viewTransform.zoom;

    // Yeni zoom seviyesi
    const newZoom = Math.min(viewTransform.zoom * 1.2, viewTransform.maxZoom);

    // Pan'i ayarla ki merkez sabit kalsın
    viewTransform.panX = centerX - worldX * newZoom;
    viewTransform.panY = centerY - worldY * newZoom;
    viewTransform.zoom = newZoom;

    updateAll();
}

function zoomOut() {
    // Canvas merkezini al (Mohr çemberinin merkezi)
    const centerX = cvsMohr.width / 2;
    const centerY = cvsMohr.height / 2;

    // Zoom öncesi merkez noktasının dünya koordinatları
    const worldX = (centerX - viewTransform.panX) / viewTransform.zoom;
    const worldY = (centerY - viewTransform.panY) / viewTransform.zoom;

    // Yeni zoom seviyesi
    const newZoom = Math.max(viewTransform.zoom / 1.2, viewTransform.minZoom);

    // Pan'i ayarla ki merkez sabit kalsın
    viewTransform.panX = centerX - worldX * newZoom;
    viewTransform.panY = centerY - worldY * newZoom;
    viewTransform.zoom = newZoom;

    updateAll();
}

// Canvas Control Button Event Listeners
document.getElementById('btnZoomIn').addEventListener('click', zoomIn);
document.getElementById('btnZoomOut').addEventListener('click', zoomOut);
document.getElementById('btnResetView').addEventListener('click', resetView);

// Mouse Wheel Zoom
cvsMohr.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = cvsMohr.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (cvsMohr.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (cvsMohr.height / rect.height);

    // Calculate mouse position in world coordinates before zoom
    const worldX = (mouseX - viewTransform.panX) / viewTransform.zoom;
    const worldY = (mouseY - viewTransform.panY) / viewTransform.zoom;

    // Apply zoom - Use 1.2 factor to match buttons
    const zoomFactor = e.deltaY < 0 ? 1.2 : (1 / 1.2);
    const newZoom = Math.max(viewTransform.minZoom, Math.min(viewTransform.maxZoom, viewTransform.zoom * zoomFactor));

    // Adjust pan to keep mouse position fixed
    viewTransform.panX = mouseX - worldX * newZoom;
    viewTransform.panY = mouseY - worldY * newZoom;
    viewTransform.zoom = newZoom;

    updateAll();
}, { passive: false });


// --- MOUSE ---
function getMousePos(evt, canvas) { const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height; return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY }; }
cvsMohr.addEventListener('mousemove', (e) => {
    const m = getMousePos(e, cvsMohr);

    // Handle panning
    if (isPanning) {
        viewTransform.panX += m.x - panStart.x;
        viewTransform.panY += m.y - panStart.y;
        panStart = { x: m.x, y: m.y };
        updateAll();
        return;
    }

    // Handle dragging stress point 1 (Normal)
    if (isDragging) { updateStressFromMouse(m.x, m.y); return; }

    // Handle dragging stress point 2 (Opposite)
    if (isDragging2) {
        const mx = 2 * screenCenter.x - m.x;
        const my = 2 * screenCenter.y - m.y;
        updateStressFromMouse(mx, my);
        return;
    }

    // Handle dragging green line point 1
    if (isDraggingPhi) { updateRotationFromMouse(m.x, m.y); return; }

    // Handle dragging green line point 2
    if (isDraggingPhi2) {
        const mx = 2 * screenCenter.x - m.x;
        const my = 2 * screenCenter.y - m.y;
        updateRotationFromMouse(mx, my);
        return;
    }

    // Handle dragging ?x on horizontal axis
    if (isDraggingSx) { updateSigmaXFromMouse(m.x); return; }

    // Handle dragging ?y on horizontal axis
    if (isDraggingSy) { updateSigmaYFromMouse(m.x); return; }

    // Handle dragging ?xy on vertical axis
    if (isDraggingTxy) { updateTauXYFromMouse(m.y); return; }

    // Handle dragging ?yx on vertical axis (opposite of ?xy)
    if (isDraggingTyx) { updateTauXYFromMouse(2 * screenCenter.y - m.y); return; }

    // Check hover - all hit areas
    const dist = Math.hypot(m.x - hitArea.x, m.y - hitArea.y);
    const dist2 = Math.hypot(m.x - hitArea2.x, m.y - hitArea2.y);
    const dist3 = Math.hypot(m.x - hitArea3.x, m.y - hitArea3.y);
    const dist4 = Math.hypot(m.x - hitArea4.x, m.y - hitArea4.y);
    const distSx = Math.hypot(m.x - hitAreaSx.x, m.y - hitAreaSx.y);
    const distSy = Math.hypot(m.x - hitAreaSy.x, m.y - hitAreaSy.y);
    const distTxy = Math.hypot(m.x - hitAreaTxy.x, m.y - hitAreaTxy.y);
    const distTyx = Math.hypot(m.x - hitAreaTyx.x, m.y - hitAreaTyx.y);

    // Reset all hover states first
    let anyHover = false;

    if (dist <= hitArea.radius) {
        if (!isHovering) { isHovering = true; anyHover = true; cvsMohr.style.cursor = 'pointer'; updateAll(); }
        else anyHover = true;
    } else if (dist2 <= hitArea2.radius) {
        if (!isHovering2) { isHovering2 = true; anyHover = true; cvsMohr.style.cursor = 'pointer'; updateAll(); }
        else anyHover = true;
    } else if (dist3 <= hitArea3.radius) {
        if (!isHoveringPhi) { isHoveringPhi = true; anyHover = true; cvsMohr.style.cursor = 'pointer'; updateAll(); }
        else anyHover = true;
    } else if (dist4 <= hitArea4.radius) {
        if (!isHoveringPhi2) { isHoveringPhi2 = true; anyHover = true; cvsMohr.style.cursor = 'pointer'; updateAll(); }
        else anyHover = true;
    } else if (distSx <= hitAreaSx.radius) {
        if (!isHoveringSx) { isHoveringSx = true; anyHover = true; cvsMohr.style.cursor = 'ew-resize'; updateAll(); }
        else anyHover = true;
    } else if (distSy <= hitAreaSy.radius) {
        if (!isHoveringSy) { isHoveringSy = true; anyHover = true; cvsMohr.style.cursor = 'ew-resize'; updateAll(); }
        else anyHover = true;
    } else if (distTxy <= hitAreaTxy.radius) {
        if (!isHoveringTxy) { isHoveringTxy = true; anyHover = true; cvsMohr.style.cursor = 'ns-resize'; updateAll(); }
        else anyHover = true;
    } else if (distTyx <= hitAreaTyx.radius) {
        if (!isHoveringTyx) { isHoveringTyx = true; anyHover = true; cvsMohr.style.cursor = 'ns-resize'; updateAll(); }
        else anyHover = true;
    }

    if (!anyHover) {
        if (isHovering || isHovering2 || isHoveringPhi || isHoveringPhi2 ||
            isHoveringSx || isHoveringSy || isHoveringTxy || isHoveringTyx) {
            isHovering = false; isHovering2 = false; isHoveringPhi = false; isHoveringPhi2 = false;
            isHoveringSx = false; isHoveringSy = false; isHoveringTxy = false; isHoveringTyx = false;
            cvsMohr.style.cursor = 'default';
            updateAll();
        }
    }
});
cvsMohr.addEventListener('mousedown', (e) => {
    const m = getMousePos(e, cvsMohr);

    // Right click or middle click for panning
    if (e.button === 2 || e.button === 1) {
        e.preventDefault();
        isPanning = true;
        panStart = { x: m.x, y: m.y };
        cvsMohr.style.cursor = 'grabbing';
        return;
    }

    // Left click for dragging stress points
    if (e.button === 0) {
        // Original hit areas (orange/green line endpoints)
        if (Math.hypot(m.x - hitArea.x, m.y - hitArea.y) <= hitArea.radius) { isDragging = true; isHovering = true; }
        else if (Math.hypot(m.x - hitArea2.x, m.y - hitArea2.y) <= hitArea2.radius) { isDragging2 = true; isHovering2 = true; }
        else if (Math.hypot(m.x - hitArea3.x, m.y - hitArea3.y) <= hitArea3.radius) { isDraggingPhi = true; isHoveringPhi = true; }
        else if (Math.hypot(m.x - hitArea4.x, m.y - hitArea4.y) <= hitArea4.radius) { isDraggingPhi2 = true; isHoveringPhi2 = true; }
        // New axis hit areas
        else if (Math.hypot(m.x - hitAreaSx.x, m.y - hitAreaSx.y) <= hitAreaSx.radius) { isDraggingSx = true; isHoveringSx = true; cvsMohr.style.cursor = 'ew-resize'; }
        else if (Math.hypot(m.x - hitAreaSy.x, m.y - hitAreaSy.y) <= hitAreaSy.radius) { isDraggingSy = true; isHoveringSy = true; cvsMohr.style.cursor = 'ew-resize'; }
        else if (Math.hypot(m.x - hitAreaTxy.x, m.y - hitAreaTxy.y) <= hitAreaTxy.radius) { isDraggingTxy = true; isHoveringTxy = true; cvsMohr.style.cursor = 'ns-resize'; }
        else if (Math.hypot(m.x - hitAreaTyx.x, m.y - hitAreaTyx.y) <= hitAreaTyx.radius) { isDraggingTyx = true; isHoveringTyx = true; cvsMohr.style.cursor = 'ns-resize'; }

        if (isDragging || isDragging2 || isDraggingPhi || isDraggingPhi2) cvsMohr.style.cursor = 'grabbing';
    }
});

cvsMohr.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

window.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        cvsMohr.style.cursor = 'default';
    }
    if (isDragging || isDragging2 || isDraggingPhi || isDraggingPhi2 ||
        isDraggingSx || isDraggingSy || isDraggingTxy || isDraggingTyx) {
        isDragging = false;
        isDragging2 = false;
        isDraggingPhi = false;
        isDraggingPhi2 = false;
        isDraggingSx = false;
        isDraggingSy = false;
        isDraggingTxy = false;
        isDraggingTyx = false;
        cvsMohr.style.cursor = (isHovering || isHovering2 || isHoveringPhi || isHoveringPhi2 ||
            isHoveringSx || isHoveringSy || isHoveringTxy || isHoveringTyx) ? 'pointer' : 'default';
        updateAll();
    }
});

function updateStressFromMouse(mx, my) {
    const dx = mx - screenCenter.x; const dy = my - screenCenter.y; const angle = Math.atan2(dy, dx);
    const R = calc.tomax; const C = calc.sigmaave;

    // Notation Multipliers - artık currentNotation'dan geliyor
    directionMult = currentNotation.params.directionMult;

    let newSx = C + R * Math.cos(angle);
    let newSy = C - R * Math.cos(angle);
    // Txy: Visual Y is val * scale * directionMult
    // So val = VisualY / directionMult = R * sin(angle) / directionMult
    let newTxy = R * Math.sin(angle) / directionMult;

    calc.sigmax = newSx; calc.sigmay = newSy; calc.toxy = newTxy;

    // Update Inputs with Notation Values
    inputs.Sx.value = currentNotation.fromEng(newSx, 'normal').toFixed(1);
    inputs.Sy.value = currentNotation.fromEng(newSy, 'normal').toFixed(1);
    inputs.Txy.value = currentNotation.fromEng(newTxy, 'shear').toFixed(1);

    updateCalculatedValues();
    updateAll();
}

function updateRotationFromMouse(mx, my) {
    // Notasyon parametrelerini al
    directionMult = currentNotation.params.directionMult;

    // Grafik koordinatlarını hesapla
    const originX = screenCenter.x - (calc.sigmaave * scaleFactor);
    const getX = (val) => originX + (val * scaleFactor);
    const getY = (val) => screenCenter.y + (val * scaleFactor * directionMult);

    // Orange point 1 coordinates in graph space
    const px = getX(calc.sigmax);
    const py = getY(calc.toxy);

    const angOrange = Math.atan2(py - screenCenter.y, px - screenCenter.x);
    const angMouse = Math.atan2(my - screenCenter.y, mx - screenCenter.x);

    // Rotation difference
    let rotRad = angMouse - angOrange;

    // Normalize to -PI..PI
    while (rotRad > Math.PI) rotRad -= 2 * Math.PI;
    while (rotRad <= -Math.PI) rotRad += 2 * Math.PI;

    // rotRad corresponds to 2*Phi (with sign depending on direction of drawing)
    let rad2Fi = rotRad * (directionMult === 1 ? -1 : 1);
    let degFi = (rad2Fi * 180 / Math.PI) / 2;

    // Normalize to 0-180 for better UX
    while (degFi < 0) degFi += 180;
    while (degFi >= 180) degFi -= 180;

    inputs.Fi.value = degFi.toFixed(1);
    inputs.TrackFi.value = degFi.toFixed(1);
    calc.fi = degFi;

    updateCalculatedValues();
    updateAll();
}

// ?x değerini yatay eksenden sürükleyerek güncellemek için
function updateSigmaXFromMouse(mx) {
    const originX = screenCenter.x - (calc.sigmaave * scaleFactor);

    // Ekran X koordinatından ?x değerini hesapla
    let newSx = (mx - originX) / scaleFactor;

    // ?y sabit kalırken ?x değişirse, çemberin merkezi ve yarıçapı değişir
    // Yeni ortalama: (newSx + ?y) / 2
    let newC = (newSx + calc.sigmay) / 2;

    // Yeni yarıçap: sqrt(((newSx - ?y)/2)^2 + ?xy^2)
    let newR = Math.sqrt(Math.pow((newSx - calc.sigmay) / 2, 2) + Math.pow(calc.toxy, 2));

    calc.sigmax = newSx;
    calc.sigmaave = newC;
    calc.tomax = newR;
    calc.tomin = -newR;
    calc.sigmamax = newC + newR;
    calc.sigmamin = newC - newR;

    // Update Inputs with Notation Values
    inputs.Sx.value = currentNotation.fromEng(newSx, 'normal').toFixed(1);

    updateCalculatedValues();
    updateAll();
}

// ?y değerini yatay eksenden sürükleyerek güncellemek için
function updateSigmaYFromMouse(mx) {
    const originX = screenCenter.x - (calc.sigmaave * scaleFactor);

    // Ekran X koordinatından ?y değerini hesapla
    let newSy = (mx - originX) / scaleFactor;

    // ?x sabit kalırken ?y değişirse, çemberin merkezi ve yarıçapı değişir
    // Yeni ortalama: (?x + newSy) / 2
    let newC = (calc.sigmax + newSy) / 2;

    // Yeni yarıçap: sqrt(((?x - newSy)/2)^2 + ?xy^2)
    let newR = Math.sqrt(Math.pow((calc.sigmax - newSy) / 2, 2) + Math.pow(calc.toxy, 2));

    calc.sigmay = newSy;
    calc.sigmaave = newC;
    calc.tomax = newR;
    calc.tomin = -newR;
    calc.sigmamax = newC + newR;
    calc.sigmamin = newC - newR;

    // Update Inputs with Notation Values
    inputs.Sy.value = currentNotation.fromEng(newSy, 'normal').toFixed(1);

    updateCalculatedValues();
    updateAll();
}

// ?xy değerini düşey eksenden sürükleyerek güncellemek için
function updateTauXYFromMouse(my) {
    directionMult = currentNotation.params.directionMult;

    // Ekran Y koordinatından ?xy değerini hesapla
    // getY = merkezy + (val * scaleFactor * directionMult)
    // val = (my - merkezy) / (scaleFactor * directionMult)
    let newTxy = (my - screenCenter.y) / (scaleFactor * directionMult);

    // ?x ve ?y sabit kalırken ?xy değişirse, yarıçap değişir
    let halfDiff = (calc.sigmax - calc.sigmay) / 2;
    let newR = Math.sqrt(Math.pow(halfDiff, 2) + Math.pow(newTxy, 2));

    calc.toxy = newTxy;
    calc.tomax = newR;
    calc.tomin = -newR;
    calc.sigmamax = calc.sigmaave + newR;
    calc.sigmamin = calc.sigmaave - newR;

    // Update Inputs with Notation Values
    inputs.Txy.value = currentNotation.fromEng(newTxy, 'shear').toFixed(1);

    updateCalculatedValues();
    updateAll();
}

function updateCalculatedValues() {
    const C = calc.sigmaave;
    let radFiahfz = Math.atan2(calc.toxy, (calc.sigmax - calc.sigmay) / 2.0) / 2.0;
    calc.fiahfz = radFiahfz * 180 / Math.PI;
    let radFi = calc.fi * Math.PI / 180.0;
    calc.sigmaxi = C + ((calc.sigmax - calc.sigmay) / 2.0) * Math.cos(2 * radFi) + calc.toxy * Math.sin(2 * radFi);
    calc.toxiyi = -((calc.sigmax - calc.sigmay) / 2.0) * Math.sin(2 * radFi) + calc.toxy * Math.cos(2 * radFi);
    calc.sigmayi = 2 * C - calc.sigmaxi;

    if (outputs.Fia1) outputs.Fia1.textContent = calc.fiahfz.toFixed(1);
    if (outputs.Fia2) outputs.Fia2.textContent = (calc.fiahfz + 90).toFixed(1);
    if (outputs.Sxi) outputs.Sxi.textContent = currentNotation.fromEng(calc.sigmaxi, 'normal').toFixed(2);
    if (outputs.Syi) outputs.Syi.textContent = currentNotation.fromEng(calc.sigmayi, 'normal').toFixed(2);
    if (outputs.Toxiyi) outputs.Toxiyi.textContent = currentNotation.fromEng(calc.toxiyi, 'shear').toFixed(2);
}

// --- DRAWING STEPS STATE ---
let stepState = { currentStep: 14 }; // Default full view
let stepFlags = {
    yatayEksen: true, sigmax: true, sigmay: true, duseyEksen: true,
    toxy: true, etoxy: true, duseyizdusum: true, yatayizdusum: true,
    capraz1: true, merkez: true, cember: true,
    sigmamax: true, sigmamin: true, tomax: true, tomin: true,
    fia: true, fi: true
};

function updateStepFlags(step) {
    // Reset all
    for (let key in stepFlags) stepFlags[key] = false;

    if (step >= 1) stepFlags.yatayEksen = true;
    if (step >= 2) stepFlags.sigmax = true;
    if (step >= 3) stepFlags.sigmay = true;
    if (step >= 4) stepFlags.duseyEksen = true;
    if (step >= 5) stepFlags.toxy = true;
    if (step >= 6) stepFlags.etoxy = true;
    if (step >= 7) { stepFlags.duseyizdusum = true; stepFlags.yatayizdusum = true; }
    if (step >= 8) { stepFlags.capraz1 = true; stepFlags.merkez = true; }
    if (step >= 9) stepFlags.cember = true;
    if (step >= 10) stepFlags.sigmamax = true;
    if (step >= 11) stepFlags.sigmamin = true;
    if (step >= 12) { stepFlags.tomax = true; stepFlags.tomin = true; }
    if (step >= 13) stepFlags.fia = true;
    if (step >= 14) stepFlags.fi = true;

    // Info Text Update
    const infoDiv = document.getElementById('stepInfo');
    if (!infoDiv) return;

    let title = "", desc = "";
    infoDiv.style.display = "block";

    const t = translations[currentLanguage];

    switch (step) {
        case 0:
            title = t.step0Title; desc = t.step0Desc;
            break;
        case 1:
            title = t.step1Title; desc = t.step1Desc;
            break;
        case 2:
            title = t.step2Title; desc = t.step2Desc;
            break;
        case 3:
            title = t.step3Title; desc = t.step3Desc;
            break;
        case 4:
            title = t.step4Title; desc = t.step4Desc;
            break;
        case 5:
            title = t.step5Title; desc = t.step5Desc;
            break;
        case 6:
            title = t.step6Title; desc = t.step6Desc;
            break;
        case 7:
            title = t.step7Title;
            // Mathematical modda CCW açıklaması göster
            if (currentNotation.type === 'mathematical') desc = t.step7DescCCW;
            else desc = t.step7Desc;
            break;
        case 8:
            title = t.step8Title; desc = t.step8Desc;
            break;
        case 9:
            title = t.step9Title; desc = t.step9Desc;
            break;
        case 10:
            title = t.step10Title; desc = t.step10Desc;
            break;
        case 11:
            title = t.step11Title; desc = t.step11Desc;
            break;
        case 12:
            title = t.step12Title; desc = t.step12Desc;
            break;
        case 13:
            title = t.step13Title; desc = t.step13Desc;
            break;
        case 14:
            infoDiv.style.display = "none";
            break;
        default:
            infoDiv.style.display = "none";
    }

    if (step < 14) {
        infoDiv.innerHTML = `<strong>${title}</strong><br>${desc}`;
    }

    // Toggle button visibility
    const btnStop = document.getElementById('btnStepStop');
    if (btnStop) {
        btnStop.classList.toggle('active', step >= 0 && step < 14);
    }
    const btnStopCompact = document.getElementById('btnStepStopCompact');
    if (btnStopCompact) {
        btnStopCompact.classList.toggle('active', step >= 0 && step < 14);
    }
}

const btnStepDraw = document.getElementById('btnStepDraw');
const btnStepStop = document.getElementById('btnStepStop');

if (btnStepDraw) {
    btnStepDraw.addEventListener('click', () => {
        if (stepState.currentStep >= 14) stepState.currentStep = 0;
        else stepState.currentStep++;
        updateAll();
    });
}

if (btnStepStop) {
    btnStepStop.addEventListener('click', () => {
        stepState.currentStep = 14;
        updateAll();
    });
}

// --- HESAPLAMA VE GÜNCELLEME ---
function calculate() {
    // Read Inputs (Notation) -> Convert to Eng (Internal)
    calc.sigmax = currentNotation.toEng(parseFloat(inputs.Sx.value), 'normal');
    calc.sigmay = currentNotation.toEng(parseFloat(inputs.Sy.value), 'normal');
    calc.toxy = currentNotation.toEng(parseFloat(inputs.Txy.value), 'shear');
    calc.fi = parseFloat(inputs.Fi.value);

    let a = (calc.sigmax + calc.sigmay) / 2.0;
    let b = Math.sqrt(Math.pow((calc.sigmax - calc.sigmay) / 2.0, 2) + Math.pow(calc.toxy, 2));
    calc.sigmamax = a + b; calc.sigmamin = a - b;
    calc.tomax = Math.abs(b); calc.tomin = -calc.tomax; calc.sigmaave = a;
    let radFiahfz = Math.atan2(calc.toxy, (calc.sigmax - calc.sigmay) / 2.0) / 2.0; calc.fiahfz = radFiahfz * 180 / Math.PI;
    let radFi = calc.fi * Math.PI / 180.0;
    calc.sigmaxi = a + ((calc.sigmax - calc.sigmay) / 2.0) * Math.cos(2 * radFi) + calc.toxy * Math.sin(2 * radFi);
    calc.toxiyi = -((calc.sigmax - calc.sigmay) / 2.0) * Math.sin(2 * radFi) + calc.toxy * Math.cos(2 * radFi);
    calc.sigmayi = 2 * calc.sigmaave - calc.sigmaxi;

    // Write Outputs (Converted from Eng to Notation)
    if (outputs.Fia1) outputs.Fia1.textContent = calc.fiahfz.toFixed(1);
    if (outputs.Fia2) outputs.Fia2.textContent = (calc.fiahfz + 90).toFixed(1);

    // Shear Angles (phi_k1, phi_k2)
    // Max shear occurs at 45 degrees from principal planes
    // Using simple geometric relation: phi_s1 = phi_p1 - 45
    let phiK1 = calc.fiahfz - 45;
    let phiK2 = calc.fiahfz + 45;

    // Normalize roughly to keep numbers nice? (Optional, but user didn't ask)
    // Just displaying what comes out
    if (outputs.Fik1) outputs.Fik1.textContent = phiK1.toFixed(1); // Aliases might be missing in outputs map, let's allow direct logic if aliases fail? No, I added them aliases in Step 1. Wait, I added them to `valFik1` in HTML, but `outputs` object has keys.
    // The keys in `outputs` variable in script.js are manual.
    // Re-check `outputs` definition in chunk 1. I added `valFik1`.

    // Actually, looking at `outputs` definition:
    // valFia1: document.getElementById('valFia1')
    // So I should access them via `outputs.valFik1` since that is the key I added in chunk 1??
    // No, earlier keys were `Fia1: ...`. I added `valFik1: ...` at the end (aliases section usually).
    // Let's use the explicit ID or the variable I just created.
    // In chunk 1: `valFik1: document.getElementById('valFik1')`

    if (outputs.valFik1) outputs.valFik1.textContent = phiK1.toFixed(1);
    if (outputs.valFik2) outputs.valFik2.textContent = phiK2.toFixed(1);

    // Principal Stresses
    if (outputs.S1) outputs.S1.textContent = currentNotation.fromEng(calc.sigmamax, 'normal').toFixed(2);
    if (outputs.S2) outputs.S2.textContent = currentNotation.fromEng(calc.sigmamin, 'normal').toFixed(2);

    // ?max ve ?min
    if (outputs.Tmax) outputs.Tmax.textContent = currentNotation.fromEng(calc.tomax, 'shear').toFixed(2);
    if (outputs.Tmin) outputs.Tmin.textContent = currentNotation.fromEng(calc.tomin, 'shear').toFixed(2);

    // ?yx = -?xy (equilibrium condition: ?xy = ?yx in magnitude, opposite in convention)
    if (outputs.Tyx) outputs.Tyx.textContent = currentNotation.fromEng(-calc.toxy, 'shear').toFixed(2);

    // Transformed stresses
    if (outputs.Sxi) outputs.Sxi.textContent = currentNotation.fromEng(calc.sigmaxi, 'normal').toFixed(2);
    if (outputs.Syi) outputs.Syi.textContent = currentNotation.fromEng(calc.sigmayi, 'normal').toFixed(2);
    if (outputs.Toxiyi) outputs.Toxiyi.textContent = currentNotation.fromEng(calc.toxiyi, 'shear').toFixed(2);
    // ?y'x' = ?x'y' (equilibrium)
    if (outputs.Toyixi) outputs.Toyixi.textContent = currentNotation.fromEng(-calc.toxiyi, 'shear').toFixed(2);
}

// Notation UI Handlers
function updateNotationUI(notationType) {
    const nVal = notationType || 'structural';

    // Butonların active durumunu güncelle
    const btnStructural = document.getElementById('btnNotationStructural');
    const btnMathematical = document.getElementById('btnNotationMathematical');
    const btnLiterature = document.getElementById('btnNotationLiterature');

    if (btnStructural) {
        btnStructural.classList.toggle('active', nVal === 'structural');
    }
    if (btnMathematical) {
        btnMathematical.classList.toggle('active', nVal === 'mathematical');
    }
    if (btnLiterature) {
        btnLiterature.classList.toggle('active', nVal === 'literature');
    }

    // SignNotation sınıfını konfigüre et
    currentNotation.configure(nVal);

    // directionMult global değişkenini güncelle
    directionMult = currentNotation.params.directionMult;

    // Tüm hesaplamaları ve çizimleri yenile
    updateAll();
}

// Notation button event listeners
const btnNotationStructural = document.getElementById('btnNotationStructural');
const btnNotationMathematical = document.getElementById('btnNotationMathematical');
const btnNotationLiterature = document.getElementById('btnNotationLiterature');

if (btnNotationStructural) {
    btnNotationStructural.addEventListener('click', () => {
        updateNotationUI('structural');
    });
}

if (btnNotationMathematical) {
    btnNotationMathematical.addEventListener('click', () => {
        updateNotationUI('mathematical');
    });
}

if (btnNotationLiterature) {
    btnNotationLiterature.addEventListener('click', () => {
        updateNotationUI('literature');
    });
}

// İlk yüklemede varsayılan notasyonu ayarla
updateNotationUI('structural');

function updateThemeTooltips() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    let nextTheme = 'light';
    if (currentTheme === 'light') nextTheme = 'dark';
    else if (currentTheme === 'dark') nextTheme = 'blueprint';
    else nextTheme = 'light';

    let key = '';
    if (nextTheme === 'light') key = 'switchToLight';
    else if (nextTheme === 'dark') key = 'switchToDark';
    else if (nextTheme === 'blueprint') key = 'switchToBlueprint';

    if (typeof translations !== 'undefined' && typeof currentLanguage !== 'undefined') {
        const t = translations[currentLanguage];
        if (t && t[key]) {
            const tooltipText = t[key];
            const buttons = [
                document.getElementById('dark-mode-toggle'),
                document.getElementById('dark-mode-toggle-left'),
                document.getElementById('dark-mode-toggle-mobile')
            ];
            buttons.forEach(btn => {
                if (btn) {
                    btn.setAttribute('data-i18n-title', key);
                    btn.title = tooltipText;
                }
            });
        }
    }
}

function updateAll() {
    updateThemeTooltips();
    calculate();
    updateStepFlags(stepState.currentStep);

    // Always update original canvases (used in default layout)
    drawMohr(ctxMohr);
    drawStressElement(ctxElem, cvsElem.width, cvsElem.height, 0, calc.sigmax, calc.sigmay, calc.toxy, "x", "y", showStressValues);
    drawPrincipalElement(ctxPrinc, cvsPrinc.width, cvsPrinc.height, calc.fiahfz, calc.sigmamax, calc.sigmamin);
    drawShearElement(ctxShear, cvsShear.width, cvsShear.height, calc.fiahfz, calc.tomax, calc.tomin, calc.sigmaave);
    drawStressElement(ctxTrans, cvsTrans.width, cvsTrans.height, calc.fi, calc.sigmaxi, calc.sigmayi, calc.toxiyi, "x'", "y'", showTransformedValues);

    // Also update grid canvases if in grid layout mode
    if (isGridLayout) {
        updateGridCanvases();
    }

    // Also update compact canvases if in compact layout mode
    if (isCompactLayout) {
        updateCompactCanvases();
    }
}

function updateGridCanvases() {
    const gridContainer = document.getElementById('gridContainer');
    if (!gridContainer) return;

    const gridPanels = gridContainer.querySelectorAll('.grid-panel');
    gridPanels.forEach(panel => {
        const canvas = panel.querySelector('canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dataI18n = panel.querySelector('[data-i18n]');
        const panelType = dataI18n ? dataI18n.getAttribute('data-i18n') : '';

        if (panelType === 'mohrCircle') {
            drawMohr(ctx);
        } else if (panelType === 'stressState') {
            drawStressElement(ctx, canvas.width, canvas.height, 0, calc.sigmax, calc.sigmay, calc.toxy, "x", "y", showStressValues);
        } else if (panelType === 'principalStresses') {
            drawPrincipalElement(ctx, canvas.width, canvas.height, calc.fiahfz, calc.sigmamax, calc.sigmamin);
        } else if (panelType === 'shearStresses') {
            drawShearElement(ctx, canvas.width, canvas.height, calc.fiahfz, calc.tomax, calc.tomin, calc.sigmaave);
        } else if (panelType === 'transformedStress') {
            drawStressElement(ctx, canvas.width, canvas.height, calc.fi, calc.sigmaxi, calc.sigmayi, calc.toxiyi, "x'", "y'", showTransformedValues);
        }
    });
}

// --- DRAW FUNCTIONS ---


// 2025-12-16: Added dark mode color override for drawMathText
// If numberVal is present and default color is used, we can also override it?
// The value " = 12.3" color is hardcoded to #333 in drawMathText line 1212.
// We should fix that too to respect dark mode or pass it in.
// Let's modify drawMathText slightly to use passed color for value or a default if not.
// Or just checking dark mode inside drawMathText is cleaner but breaks potential "custom" colors that are not dark/light aware.
// Let's rely on caller passing correct `color` for the text. But the value part is hardcoded!

/**
 * Overwritten/Patched drawMathText to handle Value Color
 */
function drawMathText(ctx, greek, sub, x, y, color = "#333", align = "left", numberVal = null, fontSize = 20) {
    ctx.save();
    ctx.fillStyle = color;

    // Font Tanımları - fontSize'a göre orantılı
    const fontGreek = `italic ${fontSize}px 'Times New Roman'`;
    const subSize = Math.round(fontSize * 0.55); // Alt indis boyutu orantılı
    const numSize = Math.round(fontSize * 0.6);  // Değer boyutu orantılı
    const fontSub = `${subSize}px 'Segoe UI'`;
    const fontNum = `${numSize}px Consolas`;

    // 1. Yunan Harfi Genişliği
    ctx.font = fontGreek;
    const wGreek = ctx.measureText(greek).width;

    // 2. Alt İndis Genişliği ve Boşluğu
    // Italic font sağa yattığı için indis ile arasına 2px, yoksa 0px
    const subPadding = sub ? 2 : 0;
    ctx.font = fontSub;
    const wSub = sub ? ctx.measureText(sub).width : 0;

    // 3. Değer Genişliği ve Boşluğu
    let wNum = 0;
    let numStr = "";
    // Değer varsa, indis ile eşittir işareti arasına 4px boşluk koy
    const valPadding = numberVal !== null ? 4 : 0;

    if (numberVal !== null) {
        ctx.font = fontNum;
        numStr = " = " + numberVal;
        wNum = ctx.measureText(numStr).width;
    }

    // Toplam Genişlik Hesabı
    const totalW = wGreek + subPadding + wSub + valPadding + wNum;

    // Başlangıç X Koordinatını Hizalamaya Göre Ayarla
    let startX = x;
    if (align === "center") startX = x - totalW / 2;
    else if (align === "right") startX = x - totalW;

    // --- ÇİZİM ---
    ctx.textBaseline = "middle";
    // KRİTİK: Koordinatları elle hesapladığımız için çizimi her zaman 'left' yapmalıyız.
    ctx.textAlign = "left";

    // A. Yunan Harfini Çiz
    ctx.font = fontGreek;
    ctx.fillText(greek, startX, y);

    // B. Alt İndisi Çiz
    let currentX = startX + wGreek + subPadding;
    const subOffset = fontSize * 0.25; // Alt indis dikey offset orantılı
    if (sub) {
        ctx.font = fontSub;
        ctx.fillText(sub, currentX, y + subOffset); // Hafif aşağıda
        currentX += wSub;
    }

    // C. Değeri Çiz (" = 12.3" gibi)
    if (numberVal !== null) {
        ctx.font = fontNum;
        // Use the same color as the text for the value! 
        // Previously hardcoded to #333.
        ctx.fillStyle = color; 
        // Sayıyı indisin bittiği yerden biraz öteye (valPadding kadar) çiz
        ctx.fillText(numStr, currentX + valPadding, y + 1);
    }

    ctx.restore();
    return totalW;
}

function drawMohr(ctx, distortion = { x: 1, y: 1 }) {
    const w = ctx.canvas ? ctx.canvas.width : ctx.width; const h = ctx.canvas ? ctx.canvas.height : ctx.height;
    if (ctx.clearRect) ctx.clearRect(0, 0, w, h);

    const suffixMax = translations[currentLanguage].suffixMax;
    const suffixMin = translations[currentLanguage].suffixMin;

    // Yazı boyutu ölçek faktörü - canvas boyutuna göre dinamik
    // Referans boyut 600px için fontScale = 1.0
    let fontScale = Math.min(w, h) / 600;
    fontScale = Math.max(0.7, Math.min(fontScale, 2.5)); // 0.7 ile 2.5 arasında sınırla

    if (ctx.canvas) {
        if (ctx.clearRect) ctx.clearRect(0, 0, w, h);

        // Fill background if dark mode or blueprint mode to match panel color exactly
        const isDark = document.body.classList.contains('dark-mode');
        const isBlueprint = document.body.classList.contains('blueprint-mode');
        
        if (isDark || isBlueprint) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for full fill
            ctx.fillStyle = isBlueprint ? "#112244" : "#101419";
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        ctx.save();
        if (distortion.x !== 1 || distortion.y !== 1) {
            const cx = w / 2; const cy = h / 2;
            ctx.translate(cx, cy); ctx.scale(1 / distortion.x, 1 / distortion.y); ctx.translate(-cx, -cy);
        }
        applyViewTransform(ctx);
    }
    let cap = Math.min(w, h) * 0.65;
    if (typeof isCompactLayout !== 'undefined' && isCompactLayout) { cap = cap * 0.95; }

    // Default layout adjustment: No offset needed since padding-bottom was removed
    let verticalOffset = 0;

    const merkezx = w / 2; const merkezy = h / 2 + verticalOffset; screenCenter = { x: merkezx, y: merkezy };
    let diff = Math.abs(calc.sigmamax - calc.sigmamin); if (diff === 0) diff = 20;
    scaleFactor = cap / diff;

    // Notation Logic for Axes
    // yMult sadece eksen ok yönü için kullanılıyor
    const yMult = currentNotation.params.tauAxisInverted ? -1 : 1;

    const R = calc.tomax * scaleFactor;
    const originX = merkezx - (calc.sigmaave * scaleFactor);
    screenRadius = R;
    directionMult = currentNotation.params.directionMult;

    const getX = (val) => originX + (val * scaleFactor);
    // VB.NET mantığı: Structural (CW) › pozitif ? yukarı (merkezy - val)
    //                 Mathematical (CCW) › pozitif ? aşağı (merkezy + val)
    // directionMult: Structural = -1, Mathematical = 1
    const getY = (val) => merkezy + (val * scaleFactor * directionMult);

    ctx.beginPath(); ctx.strokeStyle = "#888"; ctx.lineWidth = 2;
    // Limits depend on visual positions
    // We assume "Right" is always larger X on canvas.
    // originX can be anywhere.
    // We want line to cover the circle + margin.
    // Circle spans [merkezx - R, merkezx + R].
    // Origin is at originX.
    // So limits:
    const rightLimit = Math.max(originX + 40, merkezx + R + 60);
    const leftLimit = Math.min(originX - 80, merkezx - R - 80);

    let vExt = R + 80;
    if (typeof isGridLayout !== 'undefined' && isGridLayout) { vExt = vExt * 0.9; }
    if (typeof isCompactLayout !== 'undefined' && isCompactLayout) { vExt = vExt * 0.75; }
    const axisTop = merkezy - vExt;
    const axisBottom = merkezy + vExt;
    // ? ekseni ok yönü - structural ve geotechnical modda yukarı, mathematical modda aşağı
    const drawAxisArrowTop = !currentNotation.params.tauAxisInverted;

    // Theme Colors
    const isDark = document.body.classList.contains('dark-mode');
    const isBlueprint = document.body.classList.contains('blueprint-mode');
    
    const colorAxis = isBlueprint ? "#FFFFFF" : (isDark ? "#A0A0A0" : "#888"); // Axes lines
    const colorText = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#333"); // Labels and text
    const colorDashed = isBlueprint ? "rgba(255, 255, 255, 0.4)" : (isDark ? "#A1A1A1" : "#aaa"); // Dashed lines
    const colorRotationArrow = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#808080"); // Rotation arrows
    const colorArcStart = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#555"); // Small angle arc start
    const pointColor = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#fa4b5a");

    if (stepFlags.yatayEksen) {
        ctx.beginPath(); ctx.strokeStyle = colorAxis; ctx.lineWidth = 2;
        ctx.moveTo(leftLimit, merkezy); ctx.lineTo(rightLimit, merkezy); ctx.lineTo(rightLimit - 8, merkezy - 4); ctx.moveTo(rightLimit, merkezy); ctx.lineTo(rightLimit - 8, merkezy + 4);
        ctx.stroke();
    }
    if (stepFlags.duseyEksen) {
        ctx.beginPath(); ctx.strokeStyle = colorAxis; ctx.lineWidth = 2;
        ctx.moveTo(originX, axisTop); ctx.lineTo(originX, axisBottom);
        const yHead = drawAxisArrowTop ? axisTop : axisBottom; const yDir = drawAxisArrowTop ? 1 : -1;
        ctx.moveTo(originX, yHead); ctx.lineTo(originX - 4, yHead + 8 * yDir); ctx.moveTo(originX, yHead); ctx.lineTo(originX + 4, yHead + 8 * yDir); ctx.stroke();
    }
    if (stepFlags.yatayEksen) {
        drawMathText(ctx, "\u03C3", "", rightLimit + 5 * fontScale, merkezy - 15 * fontScale, colorText, "left", null, 20 * fontScale);
        // Add (MPa) unit - non-italic, 50% smaller
        ctx.font = `${10 * fontScale}px Consolas`;
        ctx.fillStyle = colorText;
        ctx.textAlign = "left";
        ctx.fillText("(MPa)", rightLimit + 20 * fontScale, merkezy - 15 * fontScale + 3 * fontScale);
    }
    if (stepFlags.duseyEksen) {
        const tauLabelY = drawAxisArrowTop ? axisTop - 5 * fontScale : axisBottom + 5 * fontScale;
        drawMathText(ctx, "\u03C4", "", originX + 8 * fontScale, tauLabelY, colorText, "left", null, 20 * fontScale);
        // Add (MPa) unit - non-italic, 50% smaller
        ctx.font = `${10 * fontScale}px Consolas`;
        ctx.fillStyle = colorText;
        ctx.textAlign = "left";
        ctx.fillText("(MPa)", originX + 23 * fontScale, tauLabelY + 3 * fontScale);
    }

    if (stepFlags.cember) {
        const isDark = document.body.classList.contains('dark-mode');
        ctx.beginPath(); 
        ctx.strokeStyle = isDark ? "#A1A1A1" : "#639bb5"; 
        ctx.lineWidth = 3;
        ctx.arc(merkezx, merkezy, R, 0, 2 * Math.PI);
        // Dark mode: Dolgu yok
        // Blueprint mode: Yarı şeffaf beyaz dolgu
        // Light mode: Açık mavi tonlu şeffaf dolgu
        if (isBlueprint) ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        else ctx.fillStyle = isDark ? "transparent" : "rgba(230, 245, 255, 0.4)";
        ctx.fill(); ctx.stroke();

        const rArrow = R * 0.7071;
        const tip1X = merkezx - rArrow; const tip1Y = merkezy - rArrow;
        const tip2X = merkezx + rArrow; const tip2Y = merkezy + rArrow;
        // Çember üzerindeki dönüş yönü okları - directionMult'a göre
        const isClockwiseRotation = (directionMult === -1);
        ctx.beginPath(); ctx.fillStyle = colorRotationArrow;
        if (isClockwiseRotation) {
            ctx.moveTo(tip1X, tip1Y); ctx.lineTo(tip1X - 20, tip1Y + 9); ctx.lineTo(tip1X - 10, tip1Y + 20);
            ctx.moveTo(tip2X, tip2Y); ctx.lineTo(tip2X + 20, tip2Y - 9); ctx.lineTo(tip2X + 10, tip2Y - 20);
        } else {
            ctx.moveTo(tip1X, tip1Y); ctx.lineTo(tip1X + 20, tip1Y - 9); ctx.lineTo(tip1X + 10, tip1Y - 20);
            ctx.moveTo(tip2X, tip2Y); ctx.lineTo(tip2X - 20, tip2Y + 9); ctx.lineTo(tip2X - 10, tip2Y + 20);
        }
        ctx.closePath(); ctx.fill();
    }

    let ptSx_Y = getY(calc.toxy); let ptSy_Y = getY(-calc.toxy);
    const px = getX(calc.sigmax); const py = ptSx_Y; const qx = getX(calc.sigmay); const qy = ptSy_Y;
    hitArea.x = px; hitArea.y = py;
    hitArea2.x = qx; hitArea2.y = qy;

    // Yatay ve düşey eksenlerdeki gerilme noktaları için hit area koordinatlarını güncelle
    hitAreaSx.x = px; hitAreaSx.y = merkezy;      // ?x yatay eksende
    hitAreaSy.x = qx; hitAreaSy.y = merkezy;      // ?y yatay eksende
    hitAreaTxy.x = originX; hitAreaTxy.y = py;    // ?xy düşey eksende
    hitAreaTyx.x = originX; hitAreaTyx.y = qy;    // ?yx düşey eksende

    if (stepFlags.capraz1) {
        const isDark = document.body.classList.contains('dark-mode');
        const isBlueprint = document.body.classList.contains('blueprint-mode');
        const diameterColor = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "orange");
        ctx.beginPath(); ctx.strokeStyle = diameterColor; ctx.lineWidth = 3; ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
    }
    const pmax = getX(calc.sigmamax); const pmin = getX(calc.sigmamin); const ptmax = getY(calc.tomax); const ptmin = getY(calc.tomin);

    if (stepFlags.duseyizdusum || stepFlags.yatayizdusum) {
        ctx.setLineDash([4, 4]); ctx.strokeStyle = colorDashed; ctx.lineWidth = 1;
        if (stepFlags.duseyizdusum) { line(ctx, px, py, px, merkezy); line(ctx, qx, qy, qx, merkezy); }
        if (stepFlags.yatayizdusum) { line(ctx, px, py, originX, py); line(ctx, qx, qy, originX, qy); }
        ctx.setLineDash([]);
    }

    if (stepFlags.tomax) {
        ctx.setLineDash([4, 4]); ctx.strokeStyle = colorDashed; ctx.lineWidth = 1;
        line(ctx, merkezx, ptmax, originX, ptmax); line(ctx, merkezx, ptmin, originX, ptmin);
        line(ctx, merkezx, ptmax, merkezx, merkezy); line(ctx, merkezx, ptmin, merkezx, merkezy);
        ctx.setLineDash([]);
    }

    if (stepFlags.merkez) drawPointOnly(ctx, merkezx, merkezy, pointColor);
    if (stepFlags.sigmax) drawPointOnly(ctx, px, merkezy, pointColor);
    if (stepFlags.sigmay) drawPointOnly(ctx, qx, merkezy, pointColor);
    if (stepFlags.toxy) { drawPointOnly(ctx, originX, py, pointColor); drawPointOnly(ctx, originX, qy, pointColor); }
    if (stepFlags.sigmamax) drawPointOnly(ctx, pmax, merkezy, pointColor);
    if (stepFlags.sigmamin) drawPointOnly(ctx, pmin, merkezy, pointColor);
    if (stepFlags.tomax) { drawPointOnly(ctx, merkezx, ptmax, pointColor); drawPointOnly(ctx, merkezx, ptmin, pointColor); }

    if (stepFlags.duseyizdusum && stepFlags.yatayizdusum) {
        // Turuncu çizgi uçlarındaki noktalar için hover efekti
        if ((isHovering || isDragging) && ctx.canvas) { ctx.beginPath(); ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"; ctx.lineWidth = 2; ctx.arc(px, py, hitArea.radius - 2, 0, Math.PI * 2); ctx.stroke(); cvsMohr.style.cursor = isDragging ? 'grabbing' : 'pointer'; }
        if ((isHovering2 || isDragging2) && ctx.canvas) { ctx.beginPath(); ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"; ctx.lineWidth = 2; ctx.arc(qx, qy, hitArea2.radius - 2, 0, Math.PI * 2); ctx.stroke(); cvsMohr.style.cursor = isDragging2 ? 'grabbing' : 'pointer'; }
        drawPointOnly(ctx, qx, qy, pointColor); drawPointOnly(ctx, px, py, pointColor);

        // Yatay eksendeki ?x noktası için hover efekti
        if ((isHoveringSx || isDraggingSx) && ctx.canvas) {
            ctx.beginPath(); ctx.strokeStyle = "rgba(0, 128, 255, 0.6)"; ctx.lineWidth = 2;
            ctx.arc(px, merkezy, hitAreaSx.radius - 2, 0, Math.PI * 2); ctx.stroke();
        }
        // Yatay eksendeki ?y noktası için hover efekti
        if ((isHoveringSy || isDraggingSy) && ctx.canvas) {
            ctx.beginPath(); ctx.strokeStyle = "rgba(0, 128, 255, 0.6)"; ctx.lineWidth = 2;
            ctx.arc(qx, merkezy, hitAreaSy.radius - 2, 0, Math.PI * 2); ctx.stroke();
        }
        // Düşey eksendeki ?xy noktası için hover efekti
        if ((isHoveringTxy || isDraggingTxy) && ctx.canvas) {
            ctx.beginPath(); ctx.strokeStyle = "rgba(128, 0, 255, 0.6)"; ctx.lineWidth = 2;
            ctx.arc(originX, py, hitAreaTxy.radius - 2, 0, Math.PI * 2); ctx.stroke();
        }
        // Düşey eksendeki ?yx noktası için hover efekti
        if ((isHoveringTyx || isDraggingTyx) && ctx.canvas) {
            ctx.beginPath(); ctx.strokeStyle = "rgba(128, 0, 255, 0.6)"; ctx.lineWidth = 2;
            ctx.arc(originX, qy, hitAreaTyx.radius - 2, 0, Math.PI * 2); ctx.stroke();
        }
    }

    let labelColor = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#fa4b5a");
    const baseFontSize = Math.round(20 * fontScale);
    const valueFontSize = Math.round(11 * fontScale);
    const labelOffset = 8 * fontScale;
    const labelOffsetY = 12 * fontScale;
    if (stepFlags.sigmax) {
        drawMathText(ctx, "\u03C3", "x", px + labelOffset, merkezy - labelOffsetY, labelColor, "left", null, baseFontSize);
        if (showMohrValues) { ctx.font = `${valueFontSize}px Consolas`; ctx.fillStyle = colorText; ctx.textAlign = "left"; ctx.fillText(currentNotation.fromEng(calc.sigmax, 'normal').toFixed(1), px + labelOffset, merkezy + labelOffsetY); }
    }
    if (stepFlags.sigmay) {
        drawMathText(ctx, "\u03C3", "y", qx + labelOffset, merkezy - labelOffsetY, labelColor, "left", null, baseFontSize);
        if (showMohrValues) { ctx.font = `${valueFontSize}px Consolas`; ctx.fillStyle = colorText; ctx.textAlign = "left"; ctx.fillText(currentNotation.fromEng(calc.sigmay, 'normal').toFixed(1), qx + labelOffset, merkezy + labelOffsetY); }
    }
    if (stepFlags.sigmamin) {
        drawMathText(ctx, "\u03C3", suffixMin, pmin - labelOffsetY, merkezy - labelOffsetY, labelColor, "right", null, baseFontSize);
        if (showMohrValues) { ctx.font = `${valueFontSize}px Consolas`; ctx.fillStyle = colorText; ctx.textAlign = "right"; ctx.fillText(currentNotation.fromEng(calc.sigmamin, 'normal').toFixed(1), pmin - labelOffsetY, merkezy + labelOffsetY); }
    }
    if (stepFlags.sigmamax) {
        drawMathText(ctx, "\u03C3", suffixMax, pmax + labelOffset, merkezy - labelOffsetY, labelColor, "left", null, baseFontSize);
        if (showMohrValues) { ctx.font = `${valueFontSize}px Consolas`; ctx.fillStyle = colorText; ctx.textAlign = "left"; ctx.fillText(currentNotation.fromEng(calc.sigmamax, 'normal').toFixed(1), pmax + 12 * fontScale, merkezy + labelOffsetY); }
    }
    if (stepFlags.tomax) {
        // VB.NET'teki gibi \u03C4max her zaman çemberin tepesinde (yukarıda), \u03C4min altında
        // Çemberin tepesi: merkezy - R, altı: merkezy + R
        let tMaxLabelY = merkezy - R - 15 * fontScale;  // Çemberin tepesi
        let tMinLabelY = merkezy + R + 15 * fontScale;  // Çemberin altı

        let wLblMax = drawMathText(ctx, "\u03C4", suffixMax, merkezx, tMaxLabelY, labelColor, "center", null, baseFontSize);
        if (showMohrValues) { ctx.font = `${valueFontSize}px Consolas`; ctx.fillStyle = colorText; ctx.textAlign = "left"; ctx.fillText(" = " + currentNotation.fromEng(calc.tomax, 'shear').toFixed(1), merkezx + wLblMax / 2 + 2 * fontScale, tMaxLabelY + 1); }

        let wLblMin = drawMathText(ctx, "\u03C4", suffixMin, merkezx, tMinLabelY, labelColor, "center", null, baseFontSize);
        if (showMohrValues) { ctx.font = `${valueFontSize}px Consolas`; ctx.fillStyle = colorText; ctx.textAlign = "left"; ctx.fillText(" = " + currentNotation.fromEng(calc.tomin, 'shear').toFixed(1), merkezx + wLblMin / 2 + 2 * fontScale, tMinLabelY + 1); }
    }
    if (stepFlags.etoxy) {
        let valTxy = showMohrValues ? currentNotation.fromEng(calc.toxy, 'shear').toFixed(1) : null;
        let valTyx = showMohrValues ? currentNotation.fromEng(-calc.toxy, 'shear').toFixed(1) : null;

        // For Literature notation, the positive shear value is plotted downwards (negative visual Y),
        // but the axis points upwards. This creates a mismatch where the "positive" input point (py)
        // lands in the "negative" visual zone.
        // Thus, we swap the labels so that the visually top point gets Tau_xy.
        let lblP = "xy", lblQ = "yx";
        let vP = valTxy, vQ = valTyx;

        if (currentNotation.type === 'literature') {
            lblP = "yx"; lblQ = "xy";
            vP = valTyx; vQ = valTxy;
        }

        drawMathText(ctx, "\u03C4", lblP, originX - labelOffset, py, labelColor, "right", vP, baseFontSize);
        drawMathText(ctx, "\u03C4", lblQ, originX - labelOffset, qy, labelColor, "right", vQ, baseFontSize);
    }

    if (stepFlags.fia && (calc.toxy !== 0 || calc.sigmax !== calc.sigmay)) {
        let angCurrent = Math.atan2(py - merkezy, px - merkezx);
        let angleRight = (px >= merkezx) ? angCurrent : (angCurrent + Math.PI);
        if (angleRight > Math.PI) angleRight -= 2 * Math.PI;

        let rArc = screenRadius * 0.125; if (rArc < 20) rArc = 20;

        ctx.beginPath(); ctx.strokeStyle = colorArcStart; ctx.lineWidth = 1;

        let isCCW = (angleRight > 0);
        ctx.arc(merkezx, merkezy, rArc, angleRight, 0, isCCW);
        ctx.stroke();

        const arrowTipXEnd = merkezx + rArc;
        const arrowTipYEnd = merkezy;
        let tangent = isCCW ? -Math.PI / 2 : Math.PI / 2;

        const headLen = 6;
        ctx.beginPath();
        ctx.moveTo(arrowTipXEnd, arrowTipYEnd);
        ctx.lineTo(arrowTipXEnd - headLen * Math.cos(tangent - Math.PI / 6), arrowTipYEnd - headLen * Math.sin(tangent - Math.PI / 6));
        ctx.moveTo(arrowTipXEnd, arrowTipYEnd);
        ctx.lineTo(arrowTipXEnd - headLen * Math.cos(tangent + Math.PI / 6), arrowTipYEnd - headLen * Math.sin(tangent + Math.PI / 6));
        ctx.stroke();

        const suffixA = translations[currentLanguage].suffixA || "a";
        let mid = angleRight / 2;
        drawMathText(ctx, "2\u03C6", suffixA, merkezx + (rArc + 20 * fontScale) * Math.cos(mid), merkezy + (rArc + 20 * fontScale) * Math.sin(mid), colorText, "center", null, 16 * fontScale);
    }
    if (stepFlags.fi && controls.chSigmaxitoxiyi.checked) {
        let rotRad = (directionMult === 1) ? (-2 * calc.fi * Math.PI / 180) : (2 * calc.fi * Math.PI / 180);

        let currentAngle = Math.atan2(py - merkezy, px - merkezx);
        let newAngle = currentAngle + rotRad;

        const pxi = merkezx + screenRadius * Math.cos(newAngle); const pyi = merkezy + screenRadius * Math.sin(newAngle);
        const qxi = merkezx - (pxi - merkezx); const qyi = merkezy - (pyi - merkezy);

        hitArea3.x = pxi; hitArea3.y = pyi;
        hitArea4.x = qxi; hitArea4.y = qyi;

        ctx.setLineDash([4, 4]); ctx.strokeStyle = colorDashed; ctx.lineWidth = 1;
        line(ctx, pxi, pyi, pxi, merkezy); line(ctx, qxi, qyi, qxi, merkezy);
        line(ctx, pxi, pyi, originX, pyi); line(ctx, qxi, qyi, originX, qyi);
        ctx.setLineDash([]);

        ctx.beginPath(); ctx.strokeStyle = "#9acd32"; ctx.lineWidth = 2; ctx.moveTo(pxi, pyi); ctx.lineTo(qxi, qyi); ctx.stroke();

        drawPointOnly(ctx, pxi, pyi, "#fa4b5a"); drawPointOnly(ctx, qxi, qyi, "#fa4b5a");

        if ((isHoveringPhi || isDraggingPhi) && ctx.canvas) { ctx.beginPath(); ctx.strokeStyle = "#9acd32"; ctx.lineWidth = 2; ctx.arc(pxi, pyi, hitArea3.radius - 2, 0, Math.PI * 2); ctx.stroke(); cvsMohr.style.cursor = isDraggingPhi ? 'grabbing' : 'pointer'; }
        if ((isHoveringPhi2 || isDraggingPhi2) && ctx.canvas) { ctx.beginPath(); ctx.strokeStyle = "#9acd32"; ctx.lineWidth = 2; ctx.arc(qxi, qyi, hitArea4.radius - 2, 0, Math.PI * 2); ctx.stroke(); cvsMohr.style.cursor = isDraggingPhi2 ? 'grabbing' : 'pointer'; }

        drawPointOnly(ctx, pxi, merkezy, "#fa4b5a"); drawPointOnly(ctx, qxi, merkezy, "#fa4b5a");
        drawPointOnly(ctx, originX, pyi, "#fa4b5a"); drawPointOnly(ctx, originX, qyi, "#fa4b5a");

        drawMathText(ctx, "\u03C3", "x'", pxi + labelOffset, merkezy - labelOffsetY, labelColor, "left", null, baseFontSize);
        if (showMohrValues) {
            ctx.font = `${valueFontSize}px Consolas`; ctx.fillStyle = colorText; ctx.textAlign = "left";
            ctx.fillText(currentNotation.fromEng(calc.sigmaxi, 'normal').toFixed(1), pxi + labelOffset, merkezy + labelOffsetY);
        }

        let valSyi = 2 * calc.sigmaave - calc.sigmaxi;
        drawMathText(ctx, "\u03C3", "y'", qxi + labelOffset, merkezy - labelOffsetY, labelColor, "left", null, baseFontSize);
        if (showMohrValues) {
            ctx.font = `${valueFontSize}px Consolas`; ctx.fillStyle = colorText; ctx.textAlign = "left";
            ctx.fillText(currentNotation.fromEng(valSyi, 'normal').toFixed(1), qxi + labelOffset, merkezy + labelOffsetY);
        }

        drawMathText(ctx, "\u03C4", "x'y'", originX - labelOffset, pyi, labelColor, "right", showMohrValues ? currentNotation.fromEng(calc.toxiyi, 'shear').toFixed(1) : null, baseFontSize);
        drawMathText(ctx, "\u03C4", "y'x'", originX - labelOffset, qyi, labelColor, "right", showMohrValues ? currentNotation.fromEng(-calc.toxiyi, 'shear').toFixed(1) : null, baseFontSize);

        let angCurrent = Math.atan2(py - merkezy, px - merkezx);
        let angleRight = (px >= merkezx) ? angCurrent : (angCurrent + Math.PI);
        if (angleRight > Math.PI) angleRight -= 2 * Math.PI;
        let angleLeft = angleRight + Math.PI;
        let angleLeftGreen = angleLeft + rotRad;

        const r2Phi = Math.max(screenRadius * 0.2, 25);
        ctx.beginPath(); ctx.strokeStyle = colorArcStart; ctx.lineWidth = 1;
        ctx.arc(merkezx, merkezy, r2Phi, angleLeft, angleLeftGreen, (rotRad < 0));
        ctx.stroke();

        // Ok başı için headLen tanımı
        const headLen2Phi = 6;
        const arrowTipX = merkezx + r2Phi * Math.cos(angleLeftGreen);
        const arrowTipY = merkezy + r2Phi * Math.sin(angleLeftGreen);
        const tangent = angleLeftGreen + (rotRad > 0 ? Math.PI / 2 : -Math.PI / 2);

        ctx.beginPath();
        ctx.moveTo(arrowTipX, arrowTipY);
        ctx.lineTo(arrowTipX - headLen2Phi * Math.cos(tangent - Math.PI / 6), arrowTipY - headLen2Phi * Math.sin(tangent - Math.PI / 6));
        ctx.moveTo(arrowTipX, arrowTipY);
        ctx.lineTo(arrowTipX - headLen2Phi * Math.cos(tangent + Math.PI / 6), arrowTipY - headLen2Phi * Math.sin(tangent + Math.PI / 6));
        ctx.stroke();

        const midAngle = angleLeft + rotRad / 2;
        const lblX = merkezx + (r2Phi + 25) * Math.cos(midAngle);
        const lblY = merkezy + (r2Phi + 15) * Math.sin(midAngle);
        drawMathText(ctx, "2\u03C6", "", lblX, lblY, colorText, "center", null, 16 * fontScale);
    }
    if (ctx.canvas) {
        ctx.restore();
    }
}

function drawStressElement(ctx, w, h, angleDeg, sX, sY, tXY, labelX, labelY, showValues, distortion = { x: 1, y: 1 }) {
    if (ctx.clearRect) ctx.clearRect(0, 0, w, h);
    const cx = w / 2; const cy = h / 2;

    // Calculate dynamic scale factor based on canvas size
    // Base size 350px for scale 1.0
    let s = Math.min(w, h) / 350;
    // Clamp scale to reasonable limits (e.g. 0.5 to 2.5)
    s = Math.max(0.5, Math.min(s, 2.5));

    const boxSize = Math.min(w, h) * 0.252; const half = boxSize / 2; const arrowLen = boxSize * 0.6;
    const shearGap = 22.5 * s;
    const labelOffset = 20 * s;
    const axisFontSize = Math.round(12 * s); // Eksen etiketleri için font boyutu
    const rotatedAxisFontSize = Math.round(14 * s); // Döndürülmüş eksen etiketleri için

    const axisBoxSize = Math.min(w, h) * 0.28; const axisLen = (axisBoxSize / 2 + axisBoxSize * 0.6 + 30) * ((isGridLayout || isCompactLayout || document.fullscreenElement) ? 1.10 : 1.0);

    // Theme for Element
    const isDark = document.body.classList.contains('dark-mode');
    const isBlueprint = document.body.classList.contains('blueprint-mode');
    
    const colorAxis = isBlueprint ? "rgba(255, 255, 255, 0.5)" : (isDark ? "#A0A0A0" : "#ccc"); // Static axes
    const colorRotatedAxis = isBlueprint ? "#FFFFFF" : (isDark ? "#A0A0A0" : "#999"); // Rotated axes
    const colorText = isBlueprint ? "rgba(255, 255, 255, 0.7)" : (isDark ? "#A1A1A1" : "#ccc"); // Axis labels
    const colorRotatedText = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#999"); // Rotated axis labels

    ctx.save(); ctx.translate(cx, cy);
    if (distortion.x !== 1 || distortion.y !== 1) {
        ctx.scale(1 / distortion.x, 1 / distortion.y);
    }

    // A. Draw Box Fill (Needs Rotation)
    ctx.save();
    ctx.rotate(-angleDeg * Math.PI / 180);
    ctx.fillStyle = isBlueprint ? "#0D2858" : (isDark ? "#2A3441" : "#eef6fa");
    ctx.fillRect(-half, -half, boxSize, boxSize);
    ctx.restore();

    // B. Draw Static Axes (No Rotation relative to screen)
    ctx.beginPath(); ctx.strokeStyle = colorAxis; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.moveTo(-axisLen, 0); ctx.lineTo(axisLen, 0); // x
    ctx.moveTo(0, -axisLen); ctx.lineTo(0, axisLen); // y
    ctx.stroke();
    drawMathText(ctx, "x", "", axisLen + 8 * s, 2, colorText, "left", null, axisFontSize);
    drawMathText(ctx, "y", "", 2, -axisLen - 8 * s, colorText, "center", null, axisFontSize);

    // C. Draw Rotated Axes (Needs Rotation)
    const isRotated = Math.abs(angleDeg) > 0.1;
    if (isRotated) {
        ctx.save();
        ctx.rotate(-angleDeg * Math.PI / 180);
        ctx.beginPath(); ctx.strokeStyle = colorRotatedAxis; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        ctx.moveTo(-axisLen, 0); ctx.lineTo(axisLen, 0);
        ctx.moveTo(0, -axisLen); ctx.lineTo(0, axisLen);
        ctx.stroke(); ctx.setLineDash([]);

        // Labels - counter-rotate to stay horizontal
        ctx.save();
        ctx.translate(axisLen + 5 * s, 5 * s);
        ctx.rotate(angleDeg * Math.PI / 180); // Counter-rotate
        drawMathText(ctx, labelX ? labelX : "x", "", 0, 0, colorRotatedText, "left", null, rotatedAxisFontSize);
        ctx.restore();
        ctx.save();
        ctx.translate(5 * s, -axisLen - 5 * s);
        ctx.rotate(angleDeg * Math.PI / 180); // Counter-rotate
        drawMathText(ctx, labelY ? labelY : "y", "", 0, 0, colorRotatedText, "center", null, rotatedAxisFontSize);
        ctx.restore();
        ctx.restore();
    }

    // D. Draw Box Stroke (Needs Rotation)
    ctx.save();
    ctx.rotate(-angleDeg * Math.PI / 180);
    const borderColor = document.body.classList.contains('dark-mode') ? "#A1A1A1" : "#639bb5";
    ctx.strokeStyle = borderColor; ctx.lineWidth = 2;
    ctx.strokeRect(-half, -half, boxSize, boxSize);
    ctx.restore();

    // E. Arrows
    ctx.save();
    const globalRotRad = -angleDeg * Math.PI / 180;
    ctx.rotate(globalRotRad);
    drawNormalArrow(ctx, sX, half, 0, 0, arrowLen, "\u03C3", labelX, showValues, globalRotRad, s); drawNormalArrow(ctx, sX, -half, 0, Math.PI, arrowLen, "\u03C3", labelX, showValues, globalRotRad, s);
    drawNormalArrow(ctx, sY, 0, -half, -Math.PI / 2, arrowLen, "\u03C3", labelY, showValues, globalRotRad, s); drawNormalArrow(ctx, sY, 0, half, Math.PI / 2, arrowLen, "\u03C3", labelY, showValues, globalRotRad, s);
    if (Math.abs(tXY) > 0.01) {
        const isPos = tXY > 0; const dirMult = isPos ? 1 : -1; const shearLen = boxSize;
        let r_ty = isPos ? -shearLen / 2 : shearLen / 2; drawShearArrowOnFace(ctx, half + shearGap, 0, -Math.PI / 2 * dirMult, shearLen, "\u03C4", labelX + labelY, labelOffset, r_ty, "left", showValues, Math.abs(tXY), globalRotRad, s);
        let l_ty = isPos ? shearLen / 2 : -shearLen / 2; drawShearArrowOnFace(ctx, -half - shearGap, 0, Math.PI / 2 * dirMult, shearLen, "\u03C4", labelX + labelY, -labelOffset, l_ty, "right", showValues, Math.abs(tXY), globalRotRad, s);
        let t_tx = isPos ? shearLen / 2 : -shearLen / 2; drawShearArrowOnFace(ctx, 0, -half - shearGap, (isPos ? 0 : Math.PI), shearLen, "\u03C4", labelY + labelX, t_tx, -labelOffset, "center", showValues, Math.abs(tXY), globalRotRad, s);
        let b_tx = isPos ? -shearLen / 2 : shearLen / 2; drawShearArrowOnFace(ctx, 0, half + shearGap, (isPos ? Math.PI : 0), shearLen, "\u03C4", labelY + labelX, b_tx, labelOffset, "center", showValues, Math.abs(tXY), globalRotRad, s);
    }
    ctx.restore();

    ctx.restore(); // Restore initial translate
}

function drawPrincipalElement(ctx, w, h, angleDeg, s1, s2, distortion = { x: 1, y: 1 }) {
    if (ctx.clearRect) ctx.clearRect(0, 0, w, h);

    // Apply Counter-Scale
    ctx.save();
    if (distortion.x !== 1 || distortion.y !== 1) {
        const cx = w / 2; const cy = h / 2;
        ctx.translate(cx, cy);
        ctx.scale(1 / distortion.x, 1 / distortion.y);
        ctx.translate(-cx, -cy);
    }

    // Get current language suffixes
    const suffixMax = translations[currentLanguage].suffixMax;
    const suffixMin = translations[currentLanguage].suffixMin;

    const cx = w / 2; const cy = h / 2; const boxSize = Math.min(w, h) * 0.252; const half = boxSize / 2; const arrowLen = boxSize * 0.6;
    const axisBoxSize = Math.min(w, h) * 0.28; const axisLen = (axisBoxSize / 2 + axisBoxSize * 0.6 + 30) * ((isGridLayout || isCompactLayout || document.fullscreenElement) ? 1.10 : 1.0);

    // Calculate dynamic scale factor based on canvas size - moved earlier
    let s = Math.min(w, h) / 350;
    s = Math.max(0.5, Math.min(s, 2.5));
    const axisFontSize = Math.round(12 * s);
    const rotatedAxisFontSize = Math.round(14 * s);

    // Theme for Principal Element
    const isDark = document.body.classList.contains('dark-mode');
    const isBlueprint = document.body.classList.contains('blueprint-mode');
    
    const colorAxis = isBlueprint ? "rgba(255, 255, 255, 0.5)" : (isDark ? "#A0A0A0" : "#ccc"); // Static axes
    const colorRotatedAxis = isBlueprint ? "#FFFFFF" : (isDark ? "#A0A0A0" : "#999"); // Rotated axes
    const colorText = isBlueprint ? "rgba(255, 255, 255, 0.7)" : (isDark ? "#A1A1A1" : "#ccc"); // Axis labels
    const colorRotatedText = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#999"); // Rotated axis labels

    // Draw Box Fill (Blue Square) - FIRST/BOTTOM LAYER
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-angleDeg * Math.PI / 180);
    ctx.fillStyle = isBlueprint ? "#0D2858" : (isDark ? "#333C4E" : "#eef6fa");
    ctx.fillRect(-half, -half, boxSize, boxSize);
    ctx.restore();

    // Draw Static Global Axes (x, y) - Center
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath(); ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.moveTo(-axisLen, 0); ctx.lineTo(axisLen, 0); // x
    ctx.moveTo(0, -axisLen); ctx.lineTo(0, axisLen); // y
    ctx.stroke();
    drawMathText(ctx, "x", "", axisLen + 8 * s, 2, "#ccc", "left", null, axisFontSize);
    drawMathText(ctx, "y", "", 2, -axisLen - 8 * s, "#ccc", "center", null, axisFontSize);
    ctx.restore();

    // Draw Rotated Principal Axes (1, 2) - Dashed
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-angleDeg * Math.PI / 180);
    ctx.beginPath(); ctx.strokeStyle = colorRotatedAxis; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.moveTo(-axisLen, 0); ctx.lineTo(axisLen, 0);
    ctx.moveTo(0, -axisLen); ctx.lineTo(0, axisLen);
    ctx.stroke(); ctx.setLineDash([]);
    // Labels for principal axes - counter-rotate to stay horizontal
    ctx.save();
    ctx.translate(axisLen + 5 * s, 5 * s);
    ctx.rotate(angleDeg * Math.PI / 180); // Counter-rotate
    drawMathText(ctx, "1", "", 0, 0, colorRotatedText, "left", null, rotatedAxisFontSize);
    ctx.restore();
    ctx.save();
    ctx.translate(5 * s, -axisLen - 5 * s);
    ctx.rotate(angleDeg * Math.PI / 180); // Counter-rotate
    drawMathText(ctx, "2", "", 0, 0, colorRotatedText, "center", null, rotatedAxisFontSize);
    ctx.restore();
    ctx.restore();

    // Draw Box Border and Arrows
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-angleDeg * Math.PI / 180);
    const borderColor = document.body.classList.contains('dark-mode') ? "#A1A1A1" : "#639bb5";
    ctx.strokeStyle = borderColor; ctx.lineWidth = 2; ctx.strokeRect(-half, -half, boxSize, boxSize);

    const globalRot = -angleDeg * Math.PI / 180;
    drawPrincipalArrow(ctx, s1, half, 0, 0, globalRot, arrowLen, "\u03C3", suffixMax, showPrincipalValues, s); drawPrincipalArrow(ctx, s1, -half, 0, Math.PI, globalRot, arrowLen, "\u03C3", suffixMax, showPrincipalValues, s);
    drawPrincipalArrow(ctx, s2, 0, -half, -Math.PI / 2, globalRot, arrowLen, "\u03C3", suffixMin, showPrincipalValues, s); drawPrincipalArrow(ctx, s2, 0, half, Math.PI / 2, globalRot, arrowLen, "\u03C3", suffixMin, showPrincipalValues, s);
    ctx.restore();

    ctx.restore(); // Restore Counter-Scale
}

function drawShearElement(ctx, w, h, principalAngleDeg, tauMax, tauMin, sigmaAve, distortion = { x: 1, y: 1 }) {
    if (ctx.clearRect) ctx.clearRect(0, 0, w, h);

    // Apply Counter-Scale
    ctx.save();
    if (distortion.x !== 1 || distortion.y !== 1) {
        const cx = w / 2; const cy = h / 2;
        ctx.translate(cx, cy);
        ctx.scale(1 / distortion.x, 1 / distortion.y);
        ctx.translate(-cx, -cy);
    }

    // Shear stress axis is 45 degrees offset from principal stress axis
    const angleDeg = principalAngleDeg + 45;

    // Get current language suffixes
    // Get current language suffixes
    const suffixMax = translations[currentLanguage].suffixMax;
    const suffixMin = translations[currentLanguage].suffixMin;
    const suffixAve = translations[currentLanguage].suffixAve || "ave";

    const cx = w / 2; const cy = h / 2; const boxSize = Math.min(w, h) * 0.252; const half = boxSize / 2; const arrowLen = boxSize * 0.6;
    const axisBoxSize = Math.min(w, h) * 0.28; const axisLen = (axisBoxSize / 2 + axisBoxSize * 0.6 + 30) * ((isGridLayout || isCompactLayout || document.fullscreenElement) ? 1.10 : 1.0);

    // Calculate dynamic scale factor based on canvas size
    let s = Math.min(w, h) / 350;
    s = Math.max(0.5, Math.min(s, 2.5));
    const axisFontSize = Math.round(12 * s);
    const rotatedAxisFontSize = Math.round(14 * s);

    // Theme for Shear Element
    const isDark = document.body.classList.contains('dark-mode');
    const isBlueprint = document.body.classList.contains('blueprint-mode');
    
    const colorAxis = isBlueprint ? "rgba(255, 255, 255, 0.5)" : (isDark ? "#A0A0A0" : "#ccc"); // Static axes
    const colorRotatedAxis = isBlueprint ? "#FFFFFF" : (isDark ? "#A0A0A0" : "#999"); // Rotated axes
    const colorText = isBlueprint ? "rgba(255, 255, 255, 0.7)" : (isDark ? "#A1A1A1" : "#ccc"); // Axis labels
    const colorRotatedText = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#999"); // Rotated axis labels

    // Draw Box Fill (Blue Square like others) - FIRST/BOTTOM LAYER
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-angleDeg * Math.PI / 180);
    ctx.fillStyle = isBlueprint ? "#0D2858" : (isDark ? "#1A2533" : "#eef6fa");
    ctx.fillRect(-half, -half, boxSize, boxSize);
    ctx.restore();

    // Draw Static Global Axes (x, y) - Center
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath(); ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.moveTo(-axisLen, 0); ctx.lineTo(axisLen, 0); // x
    ctx.moveTo(0, -axisLen); ctx.lineTo(0, axisLen); // y
    ctx.stroke();
    drawMathText(ctx, "x", "", axisLen + 8 * s, 2, "#ccc", "left", null, axisFontSize);
    drawMathText(ctx, "y", "", 2, -axisLen - 8 * s, "#ccc", "center", null, axisFontSize);
    ctx.restore();

    // Draw Rotated Shear Axes (s, n) - Dashed
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-angleDeg * Math.PI / 180);
    ctx.beginPath(); ctx.strokeStyle = colorRotatedAxis; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.moveTo(-axisLen, 0); ctx.lineTo(axisLen, 0);
    ctx.moveTo(0, -axisLen); ctx.lineTo(0, axisLen);
    ctx.stroke(); ctx.setLineDash([]);
    // Labels for shear axes - counter-rotate to stay horizontal
    ctx.save();
    ctx.translate(axisLen + 5 * s, 5 * s);
    ctx.rotate(angleDeg * Math.PI / 180); // Counter-rotate
    drawMathText(ctx, "s", "", 0, 0, colorRotatedText, "left", null, rotatedAxisFontSize);
    ctx.restore();
    ctx.save();
    ctx.translate(5 * s, -axisLen - 5 * s);
    ctx.rotate(angleDeg * Math.PI / 180); // Counter-rotate
    drawMathText(ctx, "n", "", 0, 0, colorRotatedText, "center", null, rotatedAxisFontSize);
    ctx.restore();
    ctx.restore();

    // Draw Box Border and Arrows
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-angleDeg * Math.PI / 180);
    const borderColor = document.body.classList.contains('dark-mode') ? "#A1A1A1" : "#639bb5";
    ctx.strokeStyle = borderColor; ctx.lineWidth = 2; ctx.strokeRect(-half, -half, boxSize, boxSize);

    const globalRot = -angleDeg * Math.PI / 180;
    const shearGap = 22.5 * s;
    const labelOffset = 20 * s;
    const shearLen = boxSize;

    // Draw normal stress arrows (σave) on all four sides
    drawPrincipalArrow(ctx, sigmaAve, half, 0, 0, globalRot, arrowLen, "\u03C3", suffixAve, showShearValues, s);
    drawPrincipalArrow(ctx, sigmaAve, -half, 0, Math.PI, globalRot, arrowLen, "\u03C3", suffixAve, showShearValues, s);
    drawPrincipalArrow(ctx, sigmaAve, 0, -half, -Math.PI / 2, globalRot, arrowLen, "\u03C3", suffixAve, showShearValues, s);
    drawPrincipalArrow(ctx, sigmaAve, 0, half, Math.PI / 2, globalRot, arrowLen, "\u03C3", suffixAve, showShearValues, s);

    // Draw shear stress arrows (τmax/τmin) on all four faces using same approach as drawStressElement
    // τmax is always positive, τmin is always negative
    // Right face: arrow pointing down (positive shear = CW rotation of element)
    let r_ty = -shearLen / 2;
    drawShearArrowOnFace(ctx, half + shearGap, 0, -Math.PI / 2, shearLen, "\u03C4", suffixMax, labelOffset, r_ty, "left", showShearValues, Math.abs(tauMax), globalRot, s);
    // Left face: arrow pointing up (balancing moment)
    let l_ty = shearLen / 2;
    drawShearArrowOnFace(ctx, -half - shearGap, 0, Math.PI / 2, shearLen, "\u03C4", suffixMax, -labelOffset, l_ty, "right", showShearValues, Math.abs(tauMax), globalRot, s);
    // Top face: arrow pointing right
    let t_tx = shearLen / 2;
    drawShearArrowOnFace(ctx, 0, -half - shearGap, 0, shearLen, "\u03C4", suffixMax, t_tx, -labelOffset, "center", showShearValues, Math.abs(tauMax), globalRot, s);
    // Bottom face: arrow pointing left
    let b_tx = -shearLen / 2;
    drawShearArrowOnFace(ctx, 0, half + shearGap, Math.PI, shearLen, "\u03C4", suffixMax, b_tx, labelOffset, "center", showShearValues, Math.abs(tauMax), globalRot, s);

    ctx.restore();

    ctx.restore(); // Restore Counter-Scale
}

function drawPrincipalArrow(ctx, val, x, y, localRot, globalRot, len, greek, sub, showValue = false, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(localRot);
    const isDark = document.body.classList.contains('dark-mode');
    const isBlueprint = document.body.classList.contains('blueprint-mode');
    const color = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#fa4b5a");
    // For arrow label text, use #A1A1A1 in dark mode, otherwise default red-ish
    const textColor = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#b00");
    const headLen = 18 * scale;
    const shorten = headLen / 2;
    const arrowW = 8 * scale;

    // Geotechnical modda: internal pozitif (çekme) › dışa, internal negatif (basınç) › içe
    // Diğer modlarda: internal pozitif (çekme) › dışa, internal negatif (basınç) › içe
    // Yani her zaman isTensile = val > 0 doğru, çizim dışa/içe kararı aynı kalır
    // AMA Geotechnical'da gösterilen değer ters işaretli, o yüzden outputValue'yu hesapla
    const isTensile = currentNotation.params.arrowsOutward ? (val > 0) : (val < 0);
    const displayVal = showValue ? currentNotation.fromEng(val, 'normal').toFixed(1) : null;

    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    if (isTensile) {
        ctx.moveTo(0, 0); ctx.lineTo(len - shorten, 0);
    } else {
        ctx.moveTo(len, 0); ctx.lineTo(shorten, 0);
    }
    ctx.stroke();

    ctx.beginPath();
    if (isTensile) {
        ctx.moveTo(len, 0); ctx.lineTo(len - headLen, -arrowW); ctx.lineTo(len - headLen, arrowW);
    } else {
        ctx.moveTo(0, 0); ctx.lineTo(headLen, -arrowW); ctx.lineTo(headLen, arrowW);
    }
    ctx.closePath(); ctx.fill();

    ctx.translate(len + 25 * scale, 0); ctx.rotate(-localRot); ctx.rotate(-globalRot);
    const arrowFontSize = Math.round(20 * scale);
    drawMathText(ctx, greek, sub, 0, 0, textColor, "center", displayVal, arrowFontSize);
    ctx.restore();
}

function drawNormalArrow(ctx, val, x, y, rot, len, greek, sub, showValue = false, globalRot = 0, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const isDark = document.body.classList.contains('dark-mode');
    const isBlueprint = document.body.classList.contains('blueprint-mode');
    const color = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#fa4b5a");
    // For arrow label text, use #A1A1A1 in dark mode, otherwise default red-ish
    const textColor = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#b00");
    const headLen = 18 * scale;
    const shorten = headLen / 2;
    const arrowW = 8 * scale;

    // Geotechnical modda oklar ters yöne çizilir (basınç için içe)
    const isTensile = currentNotation.params.arrowsOutward ? (val > 0) : (val < 0);
    const displayVal = showValue ? currentNotation.fromEng(val, 'normal').toFixed(1) : null;

    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    if (isTensile) {
        ctx.moveTo(0, 0); ctx.lineTo(len - shorten, 0);
    } else {
        ctx.moveTo(len, 0); ctx.lineTo(shorten, 0);
    }
    ctx.stroke();

    ctx.beginPath();
    if (isTensile) {
        ctx.moveTo(len, 0); ctx.lineTo(len - headLen, -arrowW); ctx.lineTo(len - headLen, arrowW);
    } else {
        ctx.moveTo(0, 0); ctx.lineTo(headLen, -arrowW); ctx.lineTo(headLen, arrowW);
    }
    ctx.closePath(); ctx.fill();

    ctx.translate(len + 25 * scale, 0); ctx.rotate(-rot); ctx.rotate(-globalRot);
    const arrowFontSize = Math.round(20 * scale);
    drawMathText(ctx, greek, sub, 0, 0, textColor, "center", displayVal, arrowFontSize);
    ctx.restore();
}

function drawShearArrowOnFace(ctx, x, y, angle, len, greek, sub, tx, ty, align, showValue = false, val = 0, globalRot = 0, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const isDark = document.body.classList.contains('dark-mode');
    const isBlueprint = document.body.classList.contains('blueprint-mode');
    const color = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#fa4b5a"); const headLen = 18 * scale; const shorten = headLen / 2;
    // For arrow label text, use #A1A1A1 in dark mode, otherwise default red-ish
    const textColor = isBlueprint ? "#FFFFFF" : (isDark ? "#A1A1A1" : "#b00");
    const arrowW = 8 * scale;

    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 4 * scale;
    ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2 - shorten, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(len / 2, 0); ctx.lineTo(len / 2 - headLen, -arrowW); ctx.lineTo(len / 2 - headLen, arrowW); ctx.closePath(); ctx.fill();
    ctx.rotate(-angle); ctx.rotate(-globalRot);

    // Rotate offsets to keep label attached to element
    const cosG = Math.cos(globalRot);
    const sinG = Math.sin(globalRot);

    // Scale text offsets if needed, though they are usually fixed to the box which scales.
    // The input tx, ty are actually offsets from element center to label pos in drawStressElement.
    // drawStressElement passes shearGap + 20 etc. boxSize scales with canvas, so these offsets should also implicitly scale if they were proportional. 
    // BUT looking at call site: "20" and "-20" are hardcoded. "shearGap" was 22.5 (fixed).
    // boxSize = min(w,h)*0.252.
    // Ideally tx and ty passed from caller would be scaled. 
    // For now we will just scale the rtx/rty by 1 (no extra scaling) because the caller (drawStressElement) 
    // uses mixed units (boxSize vs constant 20).
    // Let's check drawStressElement again.
    // shearGap = 22.5 is hardcoded in drawStressElement. 
    // boxSize is proportional.
    // If I want perfect scaling, 'shearGap' should also be proportional. 
    // I will modify drawStressElement to update shearGap too.

    const rtx = tx * cosG - ty * sinG;
    const rty = tx * sinG + ty * cosG;

    const arrowFontSize = Math.round(20 * scale);
    if (greek) drawMathText(ctx, greek, sub, rtx, rty, textColor, align, showValue ? val.toFixed(1) : null, arrowFontSize); ctx.restore();
}

function drawPointWithLabel(ctx, x, y, color, greek, sub) { 
    ctx.beginPath(); ctx.fillStyle = color; ctx.arc(x, y, 5.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.35; ctx.stroke(); 
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? "#A1A1A1" : color;
    if (greek) drawMathText(ctx, greek, sub, x + 8, y - 8, textColor); 
}
function drawPointOnly(ctx, x, y, color) { ctx.beginPath(); ctx.fillStyle = color; ctx.arc(x, y, 5.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.35; ctx.stroke(); }
function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

// --- LAYOUT SWITCHING ---
const layoutDefault = document.getElementById('btnLayoutDefault');
const layoutGrid = document.getElementById('btnLayoutGrid');
const gridContainer = document.getElementById('gridContainer');
const centerPanel = document.getElementById('center-panel');
const rightPanel = document.getElementById('right-panel');

// Store original parent references
let originalCenterParent = null;
let originalRightParent = null;
let originalCenterNextSibling = null;
let originalRightNextSibling = null;

function resizeCanvasToParent(canvas) {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    // Account for any title/controls area
    const controls = parent.querySelector('.element-controls, .mohr-controls');
    const title = parent.querySelector('.panel-title');
    let reservedHeight = 0;
    if (controls) reservedHeight += controls.offsetHeight || 0;
    if (title) reservedHeight += title.offsetHeight || 0;

    canvas.width = rect.width - 2; // Account for border
    canvas.height = rect.height - reservedHeight - 2;
}

function switchLayout(gridMode) {
    // Safety: Ensure compact layout class is removed
    document.body.classList.remove('compact-layout');

    isGridLayout = gridMode;
    const wrapper = document.getElementById('mohr-content-wrapper');

    if (gridMode) {
        gridContainer.innerHTML = '';
        if (wrapper) { wrapper.classList.add('grid-panel'); gridContainer.appendChild(wrapper); }

        const boxes = Array.from(rightPanel.querySelectorAll('.element-box'));
        boxes.forEach(box => { box.classList.add('grid-panel'); gridContainer.appendChild(box); });

        document.body.classList.add('grid-layout');
    } else {
        document.body.classList.remove('grid-layout');
        const footer = centerPanel.querySelector('footer');
        if (wrapper) { wrapper.classList.remove('grid-panel'); if (footer) centerPanel.insertBefore(wrapper, footer); else centerPanel.appendChild(wrapper); }

        const boxes = Array.from(gridContainer.querySelectorAll('.element-box'));
        boxes.forEach(box => { box.classList.remove('grid-panel'); rightPanel.appendChild(box); });

        gridContainer.innerHTML = ''; // Clean up
    }
}

function runLayoutTransition(toGrid) {
    if (isGridLayout === toGrid) return;

    // 1. Identify Elements
    const elements = [];
    const wrapper = document.getElementById('mohr-content-wrapper');
    if (wrapper) elements.push({ node: wrapper, id: 'mohr' });

    const boxes = document.querySelectorAll('.element-box');
    boxes.forEach((box, i) => elements.push({ node: box, id: 'box' + i }));

    // 2. Record First
    const firstRects = elements.map(el => el.node.getBoundingClientRect());

    // 3. Switch Layout
    switchLayout(toGrid);

    // 4. Force Resize explicitly to snap canvas to new parent size
    resizeAll();

    // 5. Record Last
    const lastRects = elements.map(el => el.node.getBoundingClientRect());

    // Animation Loop State
    let animating = true;

    // 6. Invert and Play
    elements.forEach((el, i) => {
        const first = firstRects[i];
        const last = lastRects[i];

        const dx = first.left - last.left;
        const dy = first.top - last.top;
        const sw = first.width / last.width;
        const sh = first.height / last.height;

        // Apply Transform Immediately
        el.node.style.transform = `translate(${dx}px, ${dy}px) scale(${sw}, ${sh})`;
        el.node.style.transformOrigin = 'top left';

        // Force Reflow
        el.node.getBoundingClientRect();

        // Add Class and Remove Transform
        requestAnimationFrame(() => {
            el.node.classList.add('animating-layout');
            el.node.style.transform = '';

            const onEnd = () => {
                // If this is the last element or we handle cleanup once
                // Check if still animation class
                // We just remove it. 'animating' flag handles global loop stop.
                if (el.node.classList.contains('animating-layout')) {
                    el.node.classList.remove('animating-layout');
                    el.node.style.transformOrigin = '';
                    el.node.removeEventListener('transitionend', onEnd);
                }

                // Only trigger end logic once for the group
                if (i === 0) {
                    animating = false;
                    resizeAll();
                    updateAll(); // Final clean draw without distortion
                }
            };
            el.node.addEventListener('transitionend', onEnd, { once: true });
        });
    });

    // 7. Counter-Distortion Loop
    const animateRedraw = () => {
        if (!animating) return;

        elements.forEach(el => {
            const style = window.getComputedStyle(el.node);
            const t = style.transform;
            let sx = 1, sy = 1;

            if (t && t !== 'none') {
                // matrix(a, b, c, d, tx, ty)
                try {
                    const values = t.split('(')[1].split(')')[0].split(',');
                    sx = parseFloat(values[0]);
                    sy = parseFloat(values[3]);
                } catch (e) { }
            }

            const canvas = (el.id === 'mohr') ? cvsMohr : el.node.querySelector('canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const dist = { x: sx, y: sy };
            const w = canvas.width; const h = canvas.height;

            if (el.id === 'mohr') {
                drawMohr(ctx, dist);
            } else if (el.id === 'box0') { // Stress
                drawStressElement(ctx, w, h, 0, calc.sigmax, calc.sigmay, calc.toxy, "x", "y", showStressValues, dist);
            } else if (el.id === 'box1') { // Principal
                drawPrincipalElement(ctx, w, h, calc.fiahfz, calc.sigmamax, calc.sigmamin, dist);
            } else if (el.id === 'box2') { // Transformed
                drawStressElement(ctx, w, h, calc.fi, calc.sigmaxi, calc.sigmayi, calc.toxiyi, "x'", "y'", showTransformedValues, dist);
            }
        });

        requestAnimationFrame(animateRedraw);
    };
    requestAnimationFrame(animateRedraw);
}

// --- COMPACT LAYOUT ---
const layoutCompact = document.getElementById('btnLayoutCompact');
const compactContainer = document.getElementById('compactContainer');

function switchToCompactLayout() {
    isCompactLayout = true;
    isGridLayout = false;

    // Clear any grid layout
    document.body.classList.remove('grid-layout');
    gridContainer.innerHTML = '';

    // Add compact layout class
    document.body.classList.add('compact-layout');
    compactContainer.innerHTML = '';

    // Create Mohr Panel FIRST (Sol üst köşe)
    const mohrPanel = document.createElement('div');
    mohrPanel.className = 'compact-panel mohr-compact-panel';
    mohrPanel.innerHTML = `
        <span class="panel-title" data-i18n="mohrCircle">MOHR ÇEMBERİ</span>
        <div class="mohr-all-controls">
            <div class="mohr-controls-row top-row">
                <button class="canvas-control-btn compact-zoom-in" data-i18n-title="zoomIn" title="Yakınlaştır">+</button>
                <button class="canvas-control-btn compact-zoom-out" data-i18n-title="zoomOut" title="Uzaklaştır">-</button>
                <button class="canvas-control-btn compact-reset-view" data-i18n-title="resetView" title="Ekrana Sığdır"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 15H3v4c0 1.1.9 2 2 2h4v-2H5v-4zM5 5h4V3H5c-1.1 0-2 .9-2 2v4h2V5zm14-2h-4v2h4v4h2V5c0-1.1-.9-2-2-2zm0 16h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zM12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" /></svg></button>
                <button class="element-control-btn compact-toggle-mohr" data-i18n-title="toggleValuesMohr" title="Değerleri Göster">#</button>
                <button class="element-control-btn compact-step-draw" data-i18n-title="stepDraw" title="Adım Adım Çiz">▶</button>
                <button class="element-control-btn" onclick="downloadSVG('mohr')" data-i18n-title="downloadSVG"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path></svg></button>
                <button class="element-control-btn" onclick="toggleFullscreen(this.closest('.compact-panel'))" data-i18n-title="fullscreen" title="Tam Ekran"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></button>
            </div>
            <div class="mohr-controls-row bottom-row">
                <button class="notation-btn ${currentNotation.getType() === 'structural' ? 'active' : ''}" data-notation="structural" data-i18n-title="notationStructural" title="Mühendislik (Yapısal)">
                    <span class="notation-number">1</span>
                </button>
                <button class="notation-btn ${currentNotation.getType() === 'mathematical' ? 'active' : ''}" data-notation="mathematical" data-i18n-title="notationMathematical" title="Matematiksel (Teorik)">
                    <span class="notation-number">2</span>
                </button>
                <button class="notation-btn ${currentNotation.getType() === 'literature' ? 'active' : ''}" data-notation="literature" data-i18n-title="notationLiterature" title="Literatür">
                    <span class="notation-number">3</span>
                </button>
                <button class="element-control-btn stop-btn" id="btnStepStopCompact" data-i18n-title="stopStepDraw" title="Çizimi Tamamla"><span class="stop-icon">■</span></button>
            </div>
        </div>
        <canvas id="mohrCanvasCompact"></canvas>
    `;
    // Double-click to toggle fullscreen
    mohrPanel.addEventListener('dblclick', () => toggleFullscreen(mohrPanel));
    compactContainer.appendChild(mohrPanel);

    // Create Stress Panel with inline controls (Sağ üst)
    const stressPanel = document.createElement('div');
    stressPanel.className = 'compact-panel stress-compact-panel';
    stressPanel.innerHTML = `
        <span class="panel-title" data-i18n="stressState">Gerilme Hali</span>
        <div class="inline-controls" id="stressInlineControls">
            <div class="input-group">
                <span class="math-label">&sigma;<span class="sub">x</span></span>
                <input type="number" id="tbSxCompact" value="${inputs.tbSx.value}">
                <span class="unit-input">MPa</span>
            </div>
            <div class="input-group">
                <span class="math-label">&sigma;<span class="sub">y</span></span>
                <input type="number" id="tbSyCompact" value="${inputs.tbSy.value}">
                <span class="unit-input">MPa</span>
            </div>
            <div class="input-group">
                <span class="math-label">&tau;<span class="sub">xy</span></span>
                <input type="number" id="tbTxyCompact" value="${inputs.tbTxy.value}">
                <span class="unit-input">MPa</span>
            </div>
            <div class="input-group readonly">
                <span class="math-label">&tau;<span class="sub">yx</span></span>
                <span class="value-readonly" id="valTyxCompact">${outputs.valTyx.textContent}</span>
                <span class="unit-input">MPa</span>
            </div>
        </div>
        <div class="element-controls">
            <button class="element-control-btn compact-toggle-stress" data-i18n-title="toggleValuesStress" title="Değerleri Göster">#</button>
            <button class="element-control-btn" onclick="downloadSVG('element')" data-i18n-title="downloadSVG"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path></svg></button>
            <button class="element-control-btn" onclick="toggleFullscreen(this.closest('.compact-panel'))" data-i18n-title="fullscreen" title="Tam Ekran"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></button>
        </div>
        <canvas id="stressCanvasCompact" class="element-canvas"></canvas>
    `;
    // Double-click to toggle fullscreen
    stressPanel.addEventListener('dblclick', () => toggleFullscreen(stressPanel));
    compactContainer.appendChild(stressPanel);

    // Create Principal Panel with inline controls (Sol alt)
    const principalPanel = document.createElement('div');
    principalPanel.className = 'compact-panel principal-compact-panel';
    principalPanel.innerHTML = `
        <span class="panel-title" data-i18n="principalStresses">Asal Gerilmeler</span>
        <div class="inline-controls" id="principalInlineControls">
            <div class="input-group readonly">
                <span class="math-label">&sigma;<span class="sub">max</span></span>
                <span class="value-readonly" id="valS1Compact">${outputs.valS1.textContent}</span>
                <span class="unit-input">MPa</span>
            </div>
            <div class="input-group readonly">
                <span class="math-label">&sigma;<span class="sub">min</span></span>
                <span class="value-readonly" id="valS2Compact">${outputs.valS2.textContent}</span>
                <span class="unit-input">MPa</span>
            </div>
            <div class="input-group readonly">
                <span class="math-label">&phi;<span class="sub">a1</span></span>
                <span class="value-readonly" id="valFia1Compact">${outputs.valFia1.textContent}</span>
                <span class="unit-input">°</span>
            </div>
        </div>
        <div class="element-controls">
            <button class="element-control-btn compact-toggle-principal" data-i18n-title="toggleValuesPrincipal" title="Değerleri Göster">#</button>
            <button class="element-control-btn" onclick="downloadSVG('principal')" data-i18n-title="downloadSVG"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path></svg></button>
            <button class="element-control-btn" onclick="toggleFullscreen(this.closest('.compact-panel'))" data-i18n-title="fullscreen" title="Tam Ekran"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></button>
        </div>
        <canvas id="principalCanvasCompact" class="element-canvas"></canvas>
    `;
    // Double-click to toggle fullscreen
    principalPanel.addEventListener('dblclick', () => toggleFullscreen(principalPanel));
    compactContainer.appendChild(principalPanel);

    // Create Shear Stresses Panel
    const shearPanel = document.createElement('div');
    shearPanel.className = 'compact-panel shear-compact-panel';
    shearPanel.innerHTML = `
        <span class="panel-title" data-i18n="shearStresses">Kayma Gerilmeleri</span>
        <div class="inline-controls" id="shearInlineControls">
            <div class="input-group readonly">
                <span class="math-label">&tau;<span class="sub">max</span></span>
                <span class="value-readonly" id="valTmaxShearCompact">${outputs.valTmax.textContent}</span>
                <span class="unit-input">MPa</span>
            </div>
            <div class="input-group readonly">
                <span class="math-label">&sigma;<span class="sub">ave</span></span>
                <span class="value-readonly" id="valSaveCompact">${currentNotation.fromEng(calc.sigmaave, 'normal').toFixed(2)}</span>
                <span class="unit-input">MPa</span>
            </div>
            <div class="input-group readonly">
                <span class="math-label" data-i18n="shearAngle1">&phi;<span class="sub">k1</span></span>
                <span class="value-readonly" id="valFik1Compact">${outputs.valFik1 ? outputs.valFik1.textContent : '0.0'}</span>
                <span class="unit-input">°</span>
            </div>
        </div>
        <div class="element-controls">
            <button class="element-control-btn compact-toggle-shear" data-i18n-title="toggleValuesShear" title="Değerleri Göster">#</button>
            <button class="element-control-btn" onclick="downloadSVG('shear')" data-i18n-title="downloadSVG"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path></svg></button>
            <button class="element-control-btn" onclick="toggleFullscreen(this.closest('.compact-panel'))" data-i18n-title="fullscreen" title="Tam Ekran"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></button>
        </div>
        <canvas id="shearCanvasCompact" class="element-canvas"></canvas>
    `;
    // Double-click to toggle fullscreen
    shearPanel.addEventListener('dblclick', () => toggleFullscreen(shearPanel));
    compactContainer.appendChild(shearPanel);

    // Create Transformed Panel with inline controls (Sağ alt)
    const transformedPanel = document.createElement('div');
    transformedPanel.className = 'compact-panel transformed-compact-panel';
    transformedPanel.innerHTML = `
        <span class="panel-title" data-i18n="transformedStress">Dönüşüm Gerilmeleri</span>
        <div class="inline-controls" id="transformInlineControls">
            <div class="input-group readonly">
                <span class="math-label">&sigma;<span class="sub">x'</span></span>
                <span class="value-readonly" id="valSxiCompact">${outputs.valSxi.textContent}</span>
                <span class="unit-input">MPa</span>
            </div>
            <div class="input-group readonly">
                <span class="math-label">&sigma;<span class="sub">y'</span></span>
                <span class="value-readonly" id="valSyiCompact">${outputs.valSyi.textContent}</span>
                <span class="unit-input">MPa</span>
            </div>
            <div class="input-group readonly">
                <span class="math-label">&tau;<span class="sub">x'y'</span></span>
                <span class="value-readonly" id="valToxiyiCompact">${outputs.valToxiyi.textContent}</span>
                <span class="unit-input">MPa</span>
            </div>
            <div class="compact-separator"></div>
            <div class="input-group">
                <span class="math-label">&phi;</span>
                <input type="number" id="tbFiCompact" value="${inputs.tbFi.value}">
                <span class="unit-input">°</span>
            </div>
            <div class="compact-slider-row">
                <input type="range" id="trackBarFiCompact" min="-90" max="90" value="${inputs.trackBarFi.value}">
            </div>
            <div class="compact-toggle-row">
                <span class="toggle-label-compact" data-i18n="showStressXiYi">&sigma;<sub>x'y'</sub> göster</span>
                <label class="toggle-switch-mini">
                    <input type="checkbox" id="chSigmaxitoxiyiCompact" ${controls.chSigmaxitoxiyi.checked ? 'checked' : ''}>
                    <span class="slider-mini"></span>
                </label>
            </div>
        </div>
        <div class="element-controls">
            <button class="element-control-btn compact-toggle-transformed" data-i18n-title="toggleValuesTransformed" title="Değerleri Göster">#</button>
            <button class="element-control-btn" onclick="downloadSVG('transformed')" data-i18n-title="downloadSVG"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path></svg></button>
            <button class="element-control-btn" onclick="toggleFullscreen(this.closest('.compact-panel'))" data-i18n-title="fullscreen" title="Tam Ekran"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></button>
        </div>
        <canvas id="transformedCanvasCompact" class="element-canvas"></canvas>
    `;
    // Double-click to toggle fullscreen
    transformedPanel.addEventListener('dblclick', () => toggleFullscreen(transformedPanel));
    compactContainer.appendChild(transformedPanel);

    // Setup compact layout event listeners
    setupCompactEventListeners();

    // Resize and redraw after DOM is ready
    requestAnimationFrame(() => {
        resizeCompactCanvases();
        updateCompactCanvases();
    });

    // Add ResizeObserver for robust responsiveness
    const resizeObserver = new ResizeObserver(() => {
        if (isCompactLayout) {
            resizeCompactCanvases();
            updateCompactCanvases();
        }
    });
    resizeObserver.observe(compactContainer);

    // Save observer to disconnect later if needed (optional, or just leave it)
    // For simplicity, we can clear it when switching away
    window.compactResizeObserver = resizeObserver;

    // Re-apply translations to newly created elements
    if (typeof setLanguage === 'function') {
        setLanguage(currentLanguage);
    }
}

function setupCompactEventListeners() {
    // Stress inputs
    const tbSxCompact = document.getElementById('tbSxCompact');
    const tbSyCompact = document.getElementById('tbSyCompact');
    const tbTxyCompact = document.getElementById('tbTxyCompact');

    if (tbSxCompact) {
        tbSxCompact.addEventListener('input', () => {
            inputs.tbSx.value = tbSxCompact.value;
            updateAll();
        });
    }
    if (tbSyCompact) {
        tbSyCompact.addEventListener('input', () => {
            inputs.tbSy.value = tbSyCompact.value;
            updateAll();
        });
    }
    if (tbTxyCompact) {
        tbTxyCompact.addEventListener('input', () => {
            inputs.tbTxy.value = tbTxyCompact.value;
            updateAll();
        });
    }

    // Transform controls
    const tbFiCompact = document.getElementById('tbFiCompact');
    const trackBarFiCompact = document.getElementById('trackBarFiCompact');
    const chSigmaxitoxiyiCompact = document.getElementById('chSigmaxitoxiyiCompact');

    if (tbFiCompact) {
        tbFiCompact.addEventListener('input', () => {
            inputs.tbFi.value = tbFiCompact.value;
            inputs.trackBarFi.value = tbFiCompact.value;
            if (trackBarFiCompact) trackBarFiCompact.value = tbFiCompact.value;
            updateAll();
        });
    }
    if (trackBarFiCompact) {
        trackBarFiCompact.addEventListener('input', () => {
            inputs.trackBarFi.value = trackBarFiCompact.value;
            inputs.tbFi.value = trackBarFiCompact.value;
            if (tbFiCompact) tbFiCompact.value = trackBarFiCompact.value;
            updateAll();
        });
    }
    if (chSigmaxitoxiyiCompact) {
        chSigmaxitoxiyiCompact.addEventListener('change', () => {
            controls.chSigmaxitoxiyi.checked = chSigmaxitoxiyiCompact.checked;
            updateAll();
        });
    }

    // Toggle buttons
    const toggleStress = compactContainer.querySelector('.compact-toggle-stress');
    const togglePrincipal = compactContainer.querySelector('.compact-toggle-principal');
    const toggleShear = compactContainer.querySelector('.compact-toggle-shear');
    const toggleTransformed = compactContainer.querySelector('.compact-toggle-transformed');
    const toggleMohr = compactContainer.querySelector('.compact-toggle-mohr');

    if (toggleStress) {
        toggleStress.addEventListener('click', () => {
            showStressValues = !showStressValues;
            toggleStress.classList.toggle('active', showStressValues);
            if (btnToggleStress) btnToggleStress.classList.toggle('active', showStressValues);
            updateAll();
        });
    }
    if (togglePrincipal) {
        togglePrincipal.addEventListener('click', () => {
            showPrincipalValues = !showPrincipalValues;
            togglePrincipal.classList.toggle('active', showPrincipalValues);
            if (btnTogglePrincipal) btnTogglePrincipal.classList.toggle('active', showPrincipalValues);
            updateAll();
        });
    }
    if (toggleShear) {
        toggleShear.addEventListener('click', () => {
            showShearValues = !showShearValues;
            toggleShear.classList.toggle('active', showShearValues);
            if (btnToggleShear) btnToggleShear.classList.toggle('active', showShearValues);
            updateAll();
        });
    }
    if (toggleTransformed) {
        toggleTransformed.addEventListener('click', () => {
            showTransformedValues = !showTransformedValues;
            toggleTransformed.classList.toggle('active', showTransformedValues);
            if (btnToggleTransformed) btnToggleTransformed.classList.toggle('active', showTransformedValues);
            updateAll();
        });
    }
    if (toggleMohr) {
        toggleMohr.addEventListener('click', () => {
            showMohrValues = !showMohrValues;
            toggleMohr.classList.toggle('active', showMohrValues);
            if (btnToggleMohr) btnToggleMohr.classList.toggle('active', showMohrValues);
            updateAll();
        });
    }

    // Step Draw Controls
    const compactStepDraw = compactContainer.querySelector('.compact-step-draw');
    if (compactStepDraw) {
        compactStepDraw.addEventListener('click', () => {
            if (stepState.currentStep >= 14) stepState.currentStep = 0;
            else stepState.currentStep++;
            updateAll();
        });
    }

    const btnStepStopCompact = document.getElementById('btnStepStopCompact');
    if (btnStepStopCompact) {
        btnStepStopCompact.addEventListener('click', () => {
            stepState.currentStep = 14;
            updateAll();
        });
    }

    // Zoom controls
    const zoomIn = compactContainer.querySelector('.compact-zoom-in');
    const zoomOut = compactContainer.querySelector('.compact-zoom-out');
    const resetView = compactContainer.querySelector('.compact-reset-view');

    if (zoomIn) {
        zoomIn.addEventListener('click', () => {
            viewTransform.zoom = Math.min(viewTransform.maxZoom, viewTransform.zoom * 1.1);
            updateAll();
        });
    }
    if (zoomOut) {
        zoomOut.addEventListener('click', () => {
            viewTransform.zoom = Math.max(viewTransform.minZoom, viewTransform.zoom / 1.1);
            updateAll();
        });
    }
    if (resetView) {
        resetView.addEventListener('click', () => {
            viewTransform.zoom = 1.0;
            viewTransform.panX = 0;
            viewTransform.panY = 0;
            updateAll();
        });
    }

    // Notation buttons in compact layout
    const notationBtns = compactContainer.querySelectorAll('.notation-btn');
    notationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const notation = btn.getAttribute('data-notation');
            currentNotation.configure(notation);

            // Update all notation buttons
            document.querySelectorAll('.notation-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-notation') === notation);
            });

            updateAll();
        });
    });

    // Mohr Canvas Mouse Events for Compact Layout
    const mohrCanvasCompact = document.getElementById('mohrCanvasCompact');
    if (mohrCanvasCompact) {
        // Helper function to recalculate global screenCenter and scaleFactor for compact canvas
        function updateCompactCanvasGlobals() {
            const w = mohrCanvasCompact.width;
            const h = mohrCanvasCompact.height;
            const cap = Math.min(w, h) * 0.85;
            let diff = Math.abs(calc.sigmamax - calc.sigmamin);
            if (diff === 0) diff = 20;
            scaleFactor = cap / diff;
            screenCenter = { x: w / 2, y: h / 2 };
            screenRadius = calc.tomax * scaleFactor;
            directionMult = currentNotation.params.directionMult;
        }

        // Mousemove
        mohrCanvasCompact.addEventListener('mousemove', (e) => {
            const m = getMousePos(e, mohrCanvasCompact);

            // Update globals for this canvas before any interaction
            updateCompactCanvasGlobals();

            // Handle panning
            if (isPanning) {
                viewTransform.panX += m.x - panStart.x;
                viewTransform.panY += m.y - panStart.y;
                panStart = { x: m.x, y: m.y };
                updateAll();
                return;
            }

            // Handle dragging stress point 1 (Normal)
            if (isDragging) { updateStressFromMouse(m.x, m.y); return; }

            // Handle dragging stress point 2 (Opposite)
            if (isDragging2) {
                const mx = 2 * screenCenter.x - m.x;
                const my = 2 * screenCenter.y - m.y;
                updateStressFromMouse(mx, my);
                return;
            }

            // Handle dragging green line point 1
            if (isDraggingPhi) { updateRotationFromMouse(m.x, m.y); return; }

            // Handle dragging green line point 2
            if (isDraggingPhi2) {
                const mx = 2 * screenCenter.x - m.x;
                const my = 2 * screenCenter.y - m.y;
                updateRotationFromMouse(mx, my);
                return;
            }

            // Handle dragging ?x on horizontal axis
            if (isDraggingSx) { updateSigmaXFromMouse(m.x); return; }

            // Handle dragging ?y on horizontal axis
            if (isDraggingSy) { updateSigmaYFromMouse(m.x); return; }

            // Handle dragging ?xy on vertical axis
            if (isDraggingTxy) { updateTauXYFromMouse(m.y); return; }

            // Handle dragging ?yx on vertical axis (opposite of ?xy)
            if (isDraggingTyx) { updateTauXYFromMouse(2 * screenCenter.y - m.y); return; }

            // Check hover - all hit areas
            const dist = Math.hypot(m.x - hitArea.x, m.y - hitArea.y);
            const dist2 = Math.hypot(m.x - hitArea2.x, m.y - hitArea2.y);
            const dist3 = Math.hypot(m.x - hitArea3.x, m.y - hitArea3.y);
            const dist4 = Math.hypot(m.x - hitArea4.x, m.y - hitArea4.y);
            const distSx = Math.hypot(m.x - hitAreaSx.x, m.y - hitAreaSx.y);
            const distSy = Math.hypot(m.x - hitAreaSy.x, m.y - hitAreaSy.y);
            const distTxy = Math.hypot(m.x - hitAreaTxy.x, m.y - hitAreaTxy.y);
            const distTyx = Math.hypot(m.x - hitAreaTyx.x, m.y - hitAreaTyx.y);

            let anyHover = false;

            if (dist <= hitArea.radius) {
                if (!isHovering) { isHovering = true; anyHover = true; mohrCanvasCompact.style.cursor = 'pointer'; updateAll(); }
                else anyHover = true;
            } else if (dist2 <= hitArea2.radius) {
                if (!isHovering2) { isHovering2 = true; anyHover = true; mohrCanvasCompact.style.cursor = 'pointer'; updateAll(); }
                else anyHover = true;
            } else if (dist3 <= hitArea3.radius) {
                if (!isHoveringPhi) { isHoveringPhi = true; anyHover = true; mohrCanvasCompact.style.cursor = 'pointer'; updateAll(); }
                else anyHover = true;
            } else if (dist4 <= hitArea4.radius) {
                if (!isHoveringPhi2) { isHoveringPhi2 = true; anyHover = true; mohrCanvasCompact.style.cursor = 'pointer'; updateAll(); }
                else anyHover = true;
            } else if (distSx <= hitAreaSx.radius) {
                if (!isHoveringSx) { isHoveringSx = true; anyHover = true; mohrCanvasCompact.style.cursor = 'ew-resize'; updateAll(); }
                else anyHover = true;
            } else if (distSy <= hitAreaSy.radius) {
                if (!isHoveringSy) { isHoveringSy = true; anyHover = true; mohrCanvasCompact.style.cursor = 'ew-resize'; updateAll(); }
                else anyHover = true;
            } else if (distTxy <= hitAreaTxy.radius) {
                if (!isHoveringTxy) { isHoveringTxy = true; anyHover = true; mohrCanvasCompact.style.cursor = 'ns-resize'; updateAll(); }
                else anyHover = true;
            } else if (distTyx <= hitAreaTyx.radius) {
                if (!isHoveringTyx) { isHoveringTyx = true; anyHover = true; mohrCanvasCompact.style.cursor = 'ns-resize'; updateAll(); }
                else anyHover = true;
            }

            if (!anyHover) {
                if (isHovering || isHovering2 || isHoveringPhi || isHoveringPhi2 ||
                    isHoveringSx || isHoveringSy || isHoveringTxy || isHoveringTyx) {
                    isHovering = false; isHovering2 = false; isHoveringPhi = false; isHoveringPhi2 = false;
                    isHoveringSx = false; isHoveringSy = false; isHoveringTxy = false; isHoveringTyx = false;
                    mohrCanvasCompact.style.cursor = 'default';
                    updateAll();
                }
            }
        });

        // Mousedown
        mohrCanvasCompact.addEventListener('mousedown', (e) => {
            const m = getMousePos(e, mohrCanvasCompact);

            // Update globals for this canvas before any interaction
            updateCompactCanvasGlobals();

            // Right click or middle click for panning
            if (e.button === 2 || e.button === 1) {
                e.preventDefault();
                isPanning = true;
                panStart = { x: m.x, y: m.y };
                mohrCanvasCompact.style.cursor = 'grabbing';
                return;
            }

            // Left click for dragging stress points
            if (e.button === 0) {
                if (Math.hypot(m.x - hitArea.x, m.y - hitArea.y) <= hitArea.radius) { isDragging = true; isHovering = true; }
                else if (Math.hypot(m.x - hitArea2.x, m.y - hitArea2.y) <= hitArea2.radius) { isDragging2 = true; isHovering2 = true; }
                else if (Math.hypot(m.x - hitArea3.x, m.y - hitArea3.y) <= hitArea3.radius) { isDraggingPhi = true; isHoveringPhi = true; }
                else if (Math.hypot(m.x - hitArea4.x, m.y - hitArea4.y) <= hitArea4.radius) { isDraggingPhi2 = true; isHoveringPhi2 = true; }
                else if (Math.hypot(m.x - hitAreaSx.x, m.y - hitAreaSx.y) <= hitAreaSx.radius) { isDraggingSx = true; isHoveringSx = true; mohrCanvasCompact.style.cursor = 'ew-resize'; }
                else if (Math.hypot(m.x - hitAreaSy.x, m.y - hitAreaSy.y) <= hitAreaSy.radius) { isDraggingSy = true; isHoveringSy = true; mohrCanvasCompact.style.cursor = 'ew-resize'; }
                else if (Math.hypot(m.x - hitAreaTxy.x, m.y - hitAreaTxy.y) <= hitAreaTxy.radius) { isDraggingTxy = true; isHoveringTxy = true; mohrCanvasCompact.style.cursor = 'ns-resize'; }
                else if (Math.hypot(m.x - hitAreaTyx.x, m.y - hitAreaTyx.y) <= hitAreaTyx.radius) { isDraggingTyx = true; isHoveringTyx = true; mohrCanvasCompact.style.cursor = 'ns-resize'; }

                if (isDragging || isDragging2 || isDraggingPhi || isDraggingPhi2) mohrCanvasCompact.style.cursor = 'grabbing';
            }
        });

        // Context menu (prevent right-click menu)
        mohrCanvasCompact.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Wheel for zoom
        mohrCanvasCompact.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = mohrCanvasCompact.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * (mohrCanvasCompact.width / rect.width);
            const mouseY = (e.clientY - rect.top) * (mohrCanvasCompact.height / rect.height);

            const worldX = (mouseX - viewTransform.panX) / viewTransform.zoom;
            const worldY = (mouseY - viewTransform.panY) / viewTransform.zoom;

            // Use 1.2 factor to match buttons
            const zoomFactor = e.deltaY > 0 ? (1 / 1.2) : 1.2;
            const newZoom = Math.max(viewTransform.minZoom, Math.min(viewTransform.maxZoom, viewTransform.zoom * zoomFactor));

            viewTransform.panX = mouseX - worldX * newZoom;
            viewTransform.panY = mouseY - worldY * newZoom;
            viewTransform.zoom = newZoom;

            updateAll();
        }, { passive: false });
    }
}

function resizeCompactCanvases() {
    const stressCanvas = document.getElementById('stressCanvasCompact');
    const principalCanvas = document.getElementById('principalCanvasCompact');
    const shearCanvas = document.getElementById('shearCanvasCompact');
    const transformedCanvas = document.getElementById('transformedCanvasCompact');
    const mohrCanvas = document.getElementById('mohrCanvasCompact');

    [stressCanvas, principalCanvas, shearCanvas, transformedCanvas, mohrCanvas].forEach(canvas => {
        if (canvas) {
            const parent = canvas.parentElement;
            if (parent) {
                const rect = parent.getBoundingClientRect();
                const title = parent.querySelector('.panel-title');
                // inline-controls artık absolute olduğu için reservedHeight'a dahil edilmiyor
                let reservedHeight = 0;
                if (title) reservedHeight += title.offsetHeight || 0;
                canvas.width = rect.width - 2;
                canvas.height = rect.height - reservedHeight - 2;
            }
        }
    });
}

function updateCompactCanvases() {
    if (!isCompactLayout) return;

    const stressCanvas = document.getElementById('stressCanvasCompact');
    const principalCanvas = document.getElementById('principalCanvasCompact');
    const transformedCanvas = document.getElementById('transformedCanvasCompact');
    const mohrCanvas = document.getElementById('mohrCanvasCompact');

    if (stressCanvas) {
        const ctx = stressCanvas.getContext('2d');
        drawStressElement(ctx, stressCanvas.width, stressCanvas.height, 0, calc.sigmax, calc.sigmay, calc.toxy, "x", "y", showStressValues);
    }
    if (principalCanvas) {
        const ctx = principalCanvas.getContext('2d');
        drawPrincipalElement(ctx, principalCanvas.width, principalCanvas.height, calc.fiahfz, calc.sigmamax, calc.sigmamin);
    }
    const shearCanvas = document.getElementById('shearCanvasCompact');
    if (shearCanvas) {
        const ctx = shearCanvas.getContext('2d');
        drawShearElement(ctx, shearCanvas.width, shearCanvas.height, calc.fiahfz, calc.tomax, calc.tomin, calc.sigmaave);
    }
    if (transformedCanvas) {
        const ctx = transformedCanvas.getContext('2d');
        drawStressElement(ctx, transformedCanvas.width, transformedCanvas.height, calc.fi, calc.sigmaxi, calc.sigmayi, calc.toxiyi, "x'", "y'", showTransformedValues);
    }
    if (mohrCanvas) {
        const ctx = mohrCanvas.getContext('2d');
        drawMohr(ctx);
    }

    // Update compact layout input values (sync from main inputs)
    const tbSxCompact = document.getElementById('tbSxCompact');
    const tbSyCompact = document.getElementById('tbSyCompact');
    const tbTxyCompact = document.getElementById('tbTxyCompact');
    const tbFiCompact = document.getElementById('tbFiCompact');
    const trackBarFiCompact = document.getElementById('trackBarFiCompact');

    if (tbSxCompact && tbSxCompact !== document.activeElement) tbSxCompact.value = inputs.tbSx.value;
    if (tbSyCompact && tbSyCompact !== document.activeElement) tbSyCompact.value = inputs.tbSy.value;
    if (tbTxyCompact && tbTxyCompact !== document.activeElement) tbTxyCompact.value = inputs.tbTxy.value;
    if (tbFiCompact && tbFiCompact !== document.activeElement) tbFiCompact.value = inputs.tbFi.value;
    if (trackBarFiCompact) trackBarFiCompact.value = inputs.trackBarFi.value;

    // Update compact layout output values
    const valTyxCompact = document.getElementById('valTyxCompact');
    const valS1Compact = document.getElementById('valS1Compact');
    const valS2Compact = document.getElementById('valS2Compact');
    const valTmaxCompact = document.getElementById('valTmaxCompact');
    const valFia1Compact = document.getElementById('valFia1Compact');
    const valSxiCompact = document.getElementById('valSxiCompact');
    const valSyiCompact = document.getElementById('valSyiCompact');
    const valToxiyiCompact = document.getElementById('valToxiyiCompact');
    const valFik1Compact = document.getElementById('valFik1Compact');

    if (valTyxCompact) valTyxCompact.textContent = outputs.valTyx.textContent;
    if (valS1Compact) valS1Compact.textContent = outputs.valS1.textContent;
    if (valS2Compact) valS2Compact.textContent = outputs.valS2.textContent;
    if (valTmaxCompact) valTmaxCompact.textContent = outputs.valTmax.textContent;
    if (valFia1Compact) valFia1Compact.textContent = outputs.valFia1.textContent;
    if (valSxiCompact) valSxiCompact.textContent = outputs.valSxi.textContent;
    if (valSyiCompact) valSyiCompact.textContent = outputs.valSyi.textContent;
    if (valToxiyiCompact) valToxiyiCompact.textContent = outputs.valToxiyi.textContent;
    if (valFik1Compact && outputs.valFik1) valFik1Compact.textContent = outputs.valFik1.textContent;
}

function switchFromCompactLayout() {
    isCompactLayout = false;
    document.body.classList.remove('compact-layout');
    compactContainer.innerHTML = '';
}

function runCompactLayoutTransition(targetLayout) {
    // targetLayout can be: 'default', 'grid', 'compact', or boolean (for backward compatibility)

    // Handle boolean for backward compatibility
    let target;
    if (typeof targetLayout === 'boolean') {
        target = targetLayout ? 'compact' : 'default';
    } else {
        target = targetLayout;
    }

    // Determine current and target states
    const fromCompact = isCompactLayout;
    const fromGrid = isGridLayout && !isCompactLayout;
    const toCompact = target === 'compact';
    const toGrid = target === 'grid';

    // Don't animate if already in target state
    if ((toCompact && fromCompact) || (toGrid && fromGrid) || (target === 'default' && !fromCompact && !fromGrid)) {
        return;
    }

    // 1. Identify Source Elements
    const elements = [];

    if (fromCompact) {
        // Get compact panels
        const compactPanels = compactContainer.querySelectorAll('.compact-panel');
        compactPanels.forEach((panel, i) => {
            if (panel.classList.contains('mohr-compact-panel')) {
                elements.push({ node: panel, id: 'mohr' });
            } else if (panel.classList.contains('stress-compact-panel')) {
                elements.push({ node: panel, id: 'box0' });
            } else if (panel.classList.contains('principal-compact-panel')) {
                elements.push({ node: panel, id: 'box1' });
            } else if (panel.classList.contains('shear-compact-panel')) {
                elements.push({ node: panel, id: 'box2' });
            } else if (panel.classList.contains('transformed-compact-panel')) {
                elements.push({ node: panel, id: 'box3' });
            }
        });
    } else {
        // Get default or grid elements
        const wrapper = document.getElementById('mohr-content-wrapper');
        if (wrapper) elements.push({ node: wrapper, id: 'mohr' });

        const boxes = document.querySelectorAll('.element-box');
        boxes.forEach((box, i) => elements.push({ node: box, id: 'box' + i }));
    }

    // 2. Record First
    const firstRects = elements.map(el => el.node.getBoundingClientRect());

    // 3. Switch Layout
    if (toCompact) {
        // Switching TO compact
        if (isGridLayout) {
            switchLayout(false);
        }
        switchToCompactLayout();
    } else if (toGrid) {
        // Switching TO grid
        if (isCompactLayout) {
            switchFromCompactLayout();
        }
        switchLayout(true);
    } else {
        // Switching TO default
        if (isCompactLayout) {
            switchFromCompactLayout();
        }
        if (isGridLayout) {
            switchLayout(false);
        }
        resizeAll();
    }

    // Wait for new panels to be created
    requestAnimationFrame(() => {
        // 4. Get new elements
        let newElements = [];

        if (toCompact) {
            const compactPanels = compactContainer.querySelectorAll('.compact-panel');
            compactPanels.forEach((panel, i) => {
                if (panel.classList.contains('mohr-compact-panel')) {
                    newElements.push({ node: panel, id: 'mohr' });
                } else if (panel.classList.contains('stress-compact-panel')) {
                    newElements.push({ node: panel, id: 'box0' });
                } else if (panel.classList.contains('principal-compact-panel')) {
                    newElements.push({ node: panel, id: 'box1' });
                } else if (panel.classList.contains('shear-compact-panel')) {
                    newElements.push({ node: panel, id: 'box2' });
                } else if (panel.classList.contains('transformed-compact-panel')) {
                    newElements.push({ node: panel, id: 'box3' });
                }
            });
        } else if (toGrid) {
            const wrapper = document.getElementById('mohr-content-wrapper');
            if (wrapper) newElements.push({ node: wrapper, id: 'mohr' });

            const boxes = gridContainer.querySelectorAll('.element-box');
            boxes.forEach((box, i) => newElements.push({ node: box, id: 'box' + i }));
        } else {
            // To default
            const wrapper = document.getElementById('mohr-content-wrapper');
            if (wrapper) newElements.push({ node: wrapper, id: 'mohr' });

            const boxes = document.querySelectorAll('.element-box');
            boxes.forEach((box, i) => newElements.push({ node: box, id: 'box' + i }));
        }

        // 5. Record Last
        const lastRects = newElements.map(el => el.node.getBoundingClientRect());

        // Animation Loop State
        let animating = true;

        // 6. Invert and Play
        newElements.forEach((el, i) => {
            // Match source and target by ID
            const sourceEl = elements.find(e => e.id === el.id);
            if (!sourceEl) return;

            const sourceIndex = elements.indexOf(sourceEl);
            const first = firstRects[sourceIndex];
            const last = lastRects[i];

            if (!first || !last) return;

            const dx = first.left - last.left;
            const dy = first.top - last.top;
            const sw = first.width / last.width;
            const sh = first.height / last.height;

            // Apply Transform Immediately
            el.node.style.transform = `translate(${dx}px, ${dy}px) scale(${sw}, ${sh})`;
            el.node.style.transformOrigin = 'top left';

            // Force Reflow
            el.node.getBoundingClientRect();

            // Add Class and Remove Transform
            requestAnimationFrame(() => {
                el.node.classList.add('animating-layout');
                el.node.style.transform = '';

                const onEnd = () => {
                    if (el.node.classList.contains('animating-layout')) {
                        el.node.classList.remove('animating-layout');
                        el.node.style.transformOrigin = '';
                        el.node.removeEventListener('transitionend', onEnd);
                    }

                    // Only trigger end logic once for the group
                    if (i === 0) {
                        animating = false;
                        if (toCompact) {
                            resizeCompactCanvases();
                            updateCompactCanvases();
                        } else if (toGrid) {
                            resizeAll();
                            updateGridCanvases();
                        } else {
                            resizeAll();
                            updateAll();
                        }
                    }
                };
                el.node.addEventListener('transitionend', onEnd, { once: true });
            });
        });

        // 7. Counter-Distortion Loop
        const animateRedraw = () => {
            if (!animating) return;

            newElements.forEach(el => {
                const style = window.getComputedStyle(el.node);
                const t = style.transform;
                let sx = 1, sy = 1;

                if (t && t !== 'none') {
                    try {
                        const values = t.split('(')[1].split(')')[0].split(',');
                        sx = parseFloat(values[0]);
                        sy = parseFloat(values[3]);
                    } catch (e) { }
                }

                const canvas = el.node.querySelector('canvas');
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                const dist = { x: sx, y: sy };
                const w = canvas.width; const h = canvas.height;

                // Determine which drawing function to use based on element ID
                if (el.id === 'mohr') {
                    drawMohr(ctx, dist);
                } else if (el.id === 'box0') {
                    drawStressElement(ctx, w, h, 0, calc.sigmax, calc.sigmay, calc.toxy, "x", "y", showStressValues, dist);
                } else if (el.id === 'box1') {
                    drawPrincipalElement(ctx, w, h, calc.fiahfz, calc.sigmamax, calc.sigmamin, dist);
                } else if (el.id === 'box2') {
                    drawShearElement(ctx, w, h, calc.fiahfz, calc.tomax, calc.tomin, calc.sigmaave, dist);
                } else if (el.id === 'box3') {
                    drawStressElement(ctx, w, h, calc.fi, calc.sigmaxi, calc.sigmayi, calc.toxiyi, "x'", "y'", showTransformedValues, dist);
                }
            });

            requestAnimationFrame(animateRedraw);
        };
        requestAnimationFrame(animateRedraw);
    });
}


if (layoutDefault) {
    layoutDefault.addEventListener('click', () => {
        if (!layoutDefault.classList.contains('active')) {
            if (isCompactLayout) {
                runCompactLayoutTransition(false);
            } else {
                switchFromCompactLayout();
                runLayoutTransition(false);
            }
            layoutDefault.classList.add('active');
            if (layoutGrid) layoutGrid.classList.remove('active');
            if (layoutCompact) layoutCompact.classList.remove('active');
        }
    });
}

if (layoutGrid) {
    layoutGrid.addEventListener('click', () => {
        if (!layoutGrid.classList.contains('active')) {
            if (isCompactLayout) {
                runCompactLayoutTransition('grid');
            } else {
                switchFromCompactLayout();
                runLayoutTransition(true);
            }
            layoutGrid.classList.add('active');
            if (layoutDefault) layoutDefault.classList.remove('active');
            if (layoutCompact) layoutCompact.classList.remove('active');
        }
    });
}

if (layoutCompact) {
    layoutCompact.addEventListener('click', () => {
        if (!layoutCompact.classList.contains('active')) {
            runCompactLayoutTransition(true);
            layoutCompact.classList.add('active');
            if (layoutDefault) layoutDefault.classList.remove('active');
            if (layoutGrid) layoutGrid.classList.remove('active');
        }
    });
}

// Resize grid canvases on window resize
window.addEventListener('resize', () => {
    resizeAll();
    if (isCompactLayout) {
        resizeCompactCanvases();
        updateCompactCanvases();
    }
    updateAll();
});

// initialization moved to top of file
resizeAll(); updateAll();

// --- FULLSCREEN FUNCTIONALITY ---
function toggleFullscreen(target) {
    let element;
    if (typeof target === 'string') {
        element = document.getElementById(target);
    } else {
        element = target;
    }

    if (!document.fullscreenElement) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// Expose to window for onclick handlers
window.toggleFullscreen = toggleFullscreen;

// Listen for fullscreen change to resize canvases
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function handleFullscreenChange() {
    // When entering/exiting fullscreen, give browser a moment to layout then resize
    setTimeout(() => {
        resizeAll();
        if (isCompactLayout) {
            resizeCompactCanvases();
            updateCompactCanvases();
        }
        updateAll();
    }, 100);
}

// Attach Double Click Listeners for Default/Grid Layout Panels
const mohrWrapper = document.getElementById('mohr-content-wrapper');
if (mohrWrapper) {
    mohrWrapper.addEventListener('dblclick', (e) => {
        // Prevent triggering if clicked on a button or input
        if (e.target.closest('button') || e.target.closest('input')) return;

        if (isGridLayout) {
            toggleFullscreen(mohrWrapper);
        } else {
            toggleFullscreen('center-panel');
        }
    });
}

document.querySelectorAll('.element-box').forEach(box => {
    box.addEventListener('dblclick', (e) => {
        // Prevent triggering if clicked on a button or input
        if (e.target.closest('button') || e.target.closest('input')) return;

        toggleFullscreen(box);
    });
});

// --- TEMA YÖNETİMİ (3 MOD: LIGHT, DARK, BLUEPRINT) ---
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme, false);

    // Ana footer dark mode toggle
    const toggleBtn = document.getElementById('dark-mode-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => cycleTheme());
    }

    // Sol panel ayarlar menüsü ve butonları
    const settingsMenuBtn = document.getElementById('settings-menu-toggle-left');
    const settingsMenu = document.getElementById('settingsMenuLeft');
    if (settingsMenuBtn && settingsMenu) {
        settingsMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsMenu.classList.toggle('show');
        });
        document.addEventListener('click', (e) => {
            if (!settingsMenu.contains(e.target) && e.target !== settingsMenuBtn) {
                settingsMenu.classList.remove('show');
            }
        });
    }

    // Görünüm alt menüsü butonları
    function updateThemeSubmenuActive() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        ['light', 'dark', 'blueprint'].forEach(t => {
            const btn = document.getElementById('submenu-theme-' + t);
            if (btn) btn.classList.toggle('active', t === currentTheme);
        });
    }
    document.getElementById('submenu-theme-light')?.addEventListener('click', () => {
        if (settingsMenu) settingsMenu.classList.remove('show');
        setTheme('light');
        updateThemeSubmenuActive();
    });
    document.getElementById('submenu-theme-dark')?.addEventListener('click', () => {
        if (settingsMenu) settingsMenu.classList.remove('show');
        setTheme('dark');
        updateThemeSubmenuActive();
    });
    document.getElementById('submenu-theme-blueprint')?.addEventListener('click', () => {
        if (settingsMenu) settingsMenu.classList.remove('show');
        setTheme('blueprint');
        updateThemeSubmenuActive();
    });

    // Sayfa düzeni alt menüsü butonları
    function updateLayoutSubmenuActive() {
        const btnDefault = document.getElementById('submenu-layout-default');
        const btnGrid    = document.getElementById('submenu-layout-grid');
        const btnCompact = document.getElementById('submenu-layout-compact');
        if (btnDefault) btnDefault.classList.toggle('active', !isGridLayout && !isCompactLayout);
        if (btnGrid)    btnGrid.classList.toggle('active', isGridLayout && !isCompactLayout);
        if (btnCompact) btnCompact.classList.toggle('active', isCompactLayout);
    }
    document.getElementById('submenu-layout-default')?.addEventListener('click', () => {
        if (settingsMenu) settingsMenu.classList.remove('show');
        if (isCompactLayout) runCompactLayoutTransition(false);
        if (isGridLayout) runLayoutTransition(false);
        document.getElementById('btnLayoutDefault')?.classList.add('active');
        document.getElementById('btnLayoutGrid')?.classList.remove('active');
        document.getElementById('btnLayoutCompact')?.classList.remove('active');
        setTimeout(updateLayoutSubmenuActive, 100);
    });
    document.getElementById('submenu-layout-grid')?.addEventListener('click', () => {
        if (settingsMenu) settingsMenu.classList.remove('show');
        if (isCompactLayout) { runCompactLayoutTransition(false); }
        if (!isGridLayout) runLayoutTransition(true);
        document.getElementById('btnLayoutGrid')?.classList.add('active');
        document.getElementById('btnLayoutDefault')?.classList.remove('active');
        document.getElementById('btnLayoutCompact')?.classList.remove('active');
        setTimeout(updateLayoutSubmenuActive, 100);
    });
    document.getElementById('submenu-layout-compact')?.addEventListener('click', () => {
        if (settingsMenu) settingsMenu.classList.remove('show');
        if (!isGridLayout) runLayoutTransition(true);
        runCompactLayoutTransition(true);
        document.getElementById('btnLayoutCompact')?.classList.add('active');
        document.getElementById('btnLayoutDefault')?.classList.remove('active');
        document.getElementById('btnLayoutGrid')?.classList.remove('active');
        setTimeout(updateLayoutSubmenuActive, 100);
    });

    // İlk yüklemede aktif durumları güncelle
    updateThemeSubmenuActive();
    updateLayoutSubmenuActive();

    const settingsAboutBtn = document.getElementById('settings-about-left');
    if (settingsAboutBtn) {
        settingsAboutBtn.addEventListener('click', () => {
            if (settingsMenu) settingsMenu.classList.remove('show');
            showAboutModal();
        });
    }

    // Kompakt ızgara modunda logoya tıklayınca varsayılan moda geçiş yap
    const logoLink = document.querySelector('.logo-container a');
    if (logoLink) {
        logoLink.addEventListener('click', (e) => {
            if (isCompactLayout) {
                e.preventDefault(); // Varsayılan ../ yönlendirmesini engelle
                
                // Kompakt moddan çık
                if (typeof runCompactLayoutTransition === 'function') {
                    runCompactLayoutTransition(false);
                }
                
                // Izgara modundaysa ondan da çık (varsayılan moda geçiş)
                if (isGridLayout && typeof runLayoutTransition === 'function') {
                    runLayoutTransition(false);
                }
                
                // Buton durumlarını güncelle
                const btnGrid = document.getElementById('btnLayoutGrid');
                const btnCompact = document.getElementById('btnLayoutCompact');
                const btnDefault = document.getElementById('btnLayoutDefault');
                
                if (btnDefault) btnDefault.classList.add('active');
                if (btnGrid) btnGrid.classList.remove('active');
                if (btnCompact) btnCompact.classList.remove('active');
            }
        });
    }
}

function cycleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    let nextTheme = 'light';
    
    if (currentTheme === 'light') nextTheme = 'dark';
    else if (currentTheme === 'dark') nextTheme = 'blueprint';
    else nextTheme = 'light';
    
    setTheme(nextTheme);
}

function cycleLayout() {
    if (!isGridLayout && !isCompactLayout) {
        // Varsayılan -> Izgara
        if (isCompactLayout) {
            runCompactLayoutTransition('grid');
        } else {
            switchFromCompactLayout();
            runLayoutTransition(true);
        }
        if (layoutGrid) layoutGrid.classList.add('active');
        if (layoutDefault) layoutDefault.classList.remove('active');
        if (layoutCompact) layoutCompact.classList.remove('active');
    } else if (isGridLayout && !isCompactLayout) {
        // Izgara -> Kompakt Izgara
        runCompactLayoutTransition(true);
        if (layoutCompact) layoutCompact.classList.add('active');
        if (layoutDefault) layoutDefault.classList.remove('active');
        if (layoutGrid) layoutGrid.classList.remove('active');
    } else {
        // Kompakt Izgara -> Varsayılan
        if (isCompactLayout) {
            runCompactLayoutTransition(false);
        } else {
            switchFromCompactLayout();
            runLayoutTransition(false);
        }
        if (layoutDefault) layoutDefault.classList.add('active');
        if (layoutGrid) layoutGrid.classList.remove('active');
        if (layoutCompact) layoutCompact.classList.remove('active');
    }
}

function setTheme(theme, shouldRedraw = true) {
    document.body.classList.remove('dark-mode', 'blueprint-mode');
    
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (theme === 'blueprint') {
        document.body.classList.add('blueprint-mode');
    }
    
    localStorage.setItem('theme', theme);
    updateThemeIcons(theme);
    
    if (shouldRedraw) {
        updateAll();
    }
}

function updateThemeIcons(theme) {
    // Visibility logic moved to CSS in style.css for better performance and consistency
    // body:not(.dark-mode):not(.blueprint-mode) .icon-sun { display: block; } etc.
}

// Multi-tab synchronization
window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
        setTheme(e.newValue, true);
    }
    if (e.key === 'selectedLanguage') {
        if (typeof setLanguage === 'function') setLanguage(e.newValue);
    }
});

// initializeTheme() moved to earlier position

function showAboutModal() {
    const lang = (typeof currentLanguage !== 'undefined' && currentLanguage) || document.documentElement.lang || 'en';
    const t = (typeof translations !== 'undefined' && translations[lang]) || (typeof translations !== 'undefined' && translations['en']) || {};
    const title = t.aboutTitle || 'About Vetin';
    const content = t.aboutContent || 'Vetin is an educational software developed for calculating plane stress. Released under the MIT License.';
    const closeText = t.aboutClose || 'Close';

    let backdrop = document.getElementById('about-modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'about-modal-backdrop';
        backdrop.className = 'ps-about-modal-backdrop';
        document.body.appendChild(backdrop);
    }
    const tagline = t.aboutTagline || 'PLANE STRESS ANALYSIS';
    const version = t.aboutVersion || 'v1.0 · MIT License';
    const content2 = t.aboutContent2 || 'You can access other academic solutions in the Vetin ecosystem at';
    backdrop.innerHTML = `
        <div class="ps-about-modal" role="dialog" aria-modal="true">
            <div class="ps-about-modal-grid">
                <div class="ps-about-modal-left">
                    <div class="ps-about-modal-left-content">
                        <img src="logo.svg" alt="Vetin" class="ps-about-logo">
                        <div class="ps-about-modal-tagline" data-i18n="aboutTagline">${tagline}</div>
                        <div class="ps-about-modal-version" data-i18n="aboutVersion">${version}</div>
                    </div>
                    <a href="http://www.iuc.edu.tr" target="_blank" rel="noopener noreferrer" class="ps-about-iuc-link">
                        <img src="IUC.svg" alt="IUC" class="ps-about-iuc-logo">
                    </a>
                </div>
                <div class="ps-about-modal-right">
                    <h2 data-i18n="aboutTitle">${title}</h2>
                    <div class="ps-about-modal-body">
                        <p data-i18n="aboutContent">${content}</p>
                        <p><span data-i18n="aboutContent2">${content2}</span> <a href="https://www.rasimtemur.com/vetin/" target="_blank" rel="noopener noreferrer">rasimtemur.com/vetin</a></p>
                    </div>
                    <div class="ps-about-modal-footer">
                        <button id="ps-about-modal-close" data-i18n="aboutClose">${closeText}</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    backdrop.classList.add('show');
    document.getElementById('ps-about-modal-close').addEventListener('click', () => backdrop.classList.remove('show'));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.classList.remove('show'); });
}
