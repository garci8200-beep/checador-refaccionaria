/* =====================================================================
   app.js — UN SOLO ARCHIVO con todo el JS propio (opción elegida: 1 archivo)
   Carga en index.html como: <script type="module" src="./app.js"></script>
   (diferido: corre tras el parseo; los CDN con defer corren antes, en orden)

   ORDEN INTERNO (mejor orden):
     [1] imports Firebase (obligatorio: los módulos exigen imports al tope)
     [2] boot crítico (perf/modo ahorro, SW, __loadLib, __ensureChart, stubs)
     [3] tailwind.config (justo tras el CDN; requiere global `tailwind`)
     [4] tema/paleta (DEFAULT_PALETTE, applyPalette, setThemeMode, listeners)
     [5] utilidades ligeras (SW/offline, wheel-blur, anti-inspección)
     [6] app principal (Firebase setup → state → helpers → render → init)

   NOTA DE TRADEOFF (aceptado al elegir 1 archivo): al ser diferido, la primera
   pintura puede usar el tema claro antes de aplicar el guardado (FOUC leve en
   modo oscuro) y Tailwind regenera clases al llegar la config. Funciona igual;
   si molesta el parpadeo, la mejora es partir en boot.js+theme.js+app.js.
   ===================================================================== */

// [1] Imports Firebase — PRIMERO (los módulos ES lo exigen).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs, limit, waitForPendingWrites, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// [2] Boot crítico (venía inline en <head>).
  (function(){
    try{
      var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      var slow=c&&(c.saveData||/^(slow-2g|2g)$/.test(c.effectiveType||''));
      var lowMem=(navigator.deviceMemory&&navigator.deviceMemory<=2)||((screen.width||0)<380&&(c?1:0)&&slow);
      var saved=localStorage.getItem('perf_mode');
      if(slow||lowMem||saved==='1'){document.documentElement.classList.add('perf-early');}
      // Se replica a <body> en cuanto exista (mata animaciones pesadas en gama baja/datos débiles)
      var apply=function(){
        if(document.body&&(slow||lowMem||saved==='1'))document.body.classList.add('perf-mode');
      };
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
      else apply();
      window.__SLOW_NET=!!slow;
    }catch(e){}
    // Service Worker inmediato (no espera a window.load): el shell abre sin internet
    try{
      if('serviceWorker' in navigator){
        var reg=function(){navigator.serviceWorker.register('sw.js').catch(function(){});};
        if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',reg,{once:true});
        else reg();
      }
      if(navigator.storage&&navigator.storage.persist){navigator.storage.persist().catch(function(){});}
    }catch(e2){}
    // Cargador diferido con caché+timeout: librerías no críticas nunca bloquean la interfaz
    window.__libCache={};
    window.__loadLib=function(src,ms){
      ms=ms||8000;
      if(window.__libCache[src])return window.__libCache[src];
      var p=new Promise(function(res,rej){
        var s=document.createElement('script');s.src=src;s.async=true;s.defer=true;
        var done=false;
        var to=setTimeout(function(){if(!done){s.onload=null;s.onerror=null;rej(new Error('timeout:'+src));}},ms);
        s.onload=function(){if(done)return;done=true;clearTimeout(to);res(true);};
        s.onerror=function(){if(done)return;done=true;clearTimeout(to);rej(new Error('load:'+src));};
        document.head.appendChild(s);
      });
      p.catch(function(){});
      window.__libCache[src]=p;
      return p;
    };
    // Chart.js solo cuando se abra una gráfica (no en el arranque)
    window.__ensureChart=function(){
      if(window.Chart&&window.Chart!==(window.__NoChart))return Promise.resolve(true);
      return window.__loadLib('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',9000).catch(function(){});
    };
    // Stubs seguros: evitan que la interfaz se rompa si las librerías aún no llegan (datos débiles)
    window.lucide=window.lucide||{createIcons:function(){window.__iconsPending=true;}};
    window.__NoChart=function(){return{destroy:function(){},update:function(){},resize:function(){},data:{labels:[],datasets:[]}};};
    window.__safeIcons=function(){try{if(window.lucide&&window.lucide.createIcons)window.lucide.createIcons();}catch(e){}};
  })();
  

// [3] tailwind.config (venía inline justo tras el CDN).
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            bg: 'rgb(var(--c-bg) / <alpha-value>)',             // Fondo de la aplicación
            surface: 'rgb(var(--c-surface) / <alpha-value>)',    // Tarjetas / superficies
            card: 'rgb(var(--c-card) / <alpha-value>)',          // Bordes e inputs

            /* === COLOR PRINCIPAL (azul Bajaj) === */
            accent: 'rgb(var(--c-accent) / <alpha-value>)',      // Color principal (azul Bajaj)
            accent2: 'rgb(var(--c-accent2) / <alpha-value>)',    // Color secundario (azul marino)

            /* === COLORES FUNCIONALES (Mantenidos para UX) === */
            danger: 'rgb(var(--c-danger) / <alpha-value>)',      // Errores, borrar y mesa ocupada (rojo en modo claro)
            fin: 'rgb(var(--c-fin) / <alpha-value>)',            // Finanzas y egresos (siempre rojo)
            success: 'rgb(var(--c-success) / <alpha-value>)',    // Ingresos y éxito
            warn: 'rgb(var(--c-warn) / <alpha-value>)',          // Avisos de stock bajo

            txt: 'rgb(var(--c-txt) / <alpha-value>)',            // Texto principal
            muted: 'rgb(var(--c-muted) / <alpha-value>)'         // Texto secundario
          }
        }
      }
    }
  

// [4] Tema/paleta + carga diferida de pesadas (venía inline en <head>).
    // ========== PALETA DE COLORES PERSONALIZABLE ==========
    // Modo claro: azul Bajaj (logo).
    window.DEFAULT_PALETTE = {
      bg: '#F2F6FC', surface: '#FFFFFF', card: '#D8E5F5',
      accent: '#005EB8', accent2: '#003E7E',
      danger: '#DC2626', fin: '#DC2626', success: '#10B981', warn: '#F59E0B',
      txt: '#0A1F33', muted: '#5A799E'
    };
    window.THEME_KEYS = [
      ['bg', 'Fondo'], ['surface', 'Tarjetas'], ['card', 'Bordes / Inputs'],
      ['accent', 'Color Principal'], ['accent2', 'Color Secundario'],
      ['success', 'Éxitos'], ['warn', 'Avisos'], ['danger', 'Errores / Borrar'],
      ['fin', 'Finanzas / Egresos'],
      ['txt', 'Texto Principal'], ['muted', 'Texto Secundario']
    ];
    window.THEME_PRESETS = {
      recens:  { bg:'#FAF6EF', surface:'#FFFFFF', card:'#E9D9C3', accent:'#31461F', accent2:'#8E3E1D', danger:'#B3261E', fin:'#B3261E', success:'#3F6B21', warn:'#C06A15', txt:'#202416', muted:'#8A7C67' },
      sanse:   { bg:'#FDF6EE', surface:'#FFFFFF', card:'#EADCC8', accent:'#3E6B1F', accent2:'#C9401C', danger:'#B3261E', fin:'#B3261E', success:'#3E7D22', warn:'#D97A16', txt:'#1C1410', muted:'#8A7A68' },
      clasico: { bg:'#FFFFFF', surface:'#FFFFFF', card:'#E5E5E5', accent:'#000000', accent2:'#333333', danger:'#DC2626', fin:'#DC2626', success:'#10B981', warn:'#F59E0B', txt:'#000000', muted:'#666666' },
      bolovan: { bg:'#F7F3EA', surface:'#FFFFFF', card:'#E3D3B8', accent:'#C04527', accent2:'#1F5D8A', danger:'#8E2A1E', fin:'#8E2A1E', success:'#178A4C', warn:'#A97B00', txt:'#231B14', muted:'#8A7963' },
      azul:    { bg:'#F2F6FC', surface:'#FFFFFF', card:'#D8E5F5', accent:'#005EB8', accent2:'#003E7E', danger:'#DC2626', fin:'#DC2626', success:'#10B981', warn:'#F59E0B', txt:'#0A1F33', muted:'#5A799E' },
      esmeralda:{ bg:'#F3FAF7', surface:'#FFFFFF', card:'#D5EAE2', accent:'#047857', accent2:'#134E4A', danger:'#EF4444', fin:'#EF4444', success:'#059669', warn:'#D97706', txt:'#0F172A', muted:'#64748B' },
      cafe:    { bg:'#FBF7F0', surface:'#FFFFFF', card:'#EAE0D0', accent:'#7A5C3E', accent2:'#3E2F23', danger:'#B45309', fin:'#B45309', success:'#16703C', warn:'#C4640B', txt:'#2B2118', muted:'#8A7A66' },
      royal:   { bg:'#F8F7FF', surface:'#FFFFFF', card:'#E4E1F5', accent:'#6D28D9', accent2:'#2E1065', danger:'#DC2626', fin:'#DC2626', success:'#10B981', warn:'#F59E0B', txt:'#1E1B4B', muted:'#6D6A8C' }
    };

    window.hexToRgb = (hex) => {
      let h = (hex || '#000000').replace('#', '');
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      const n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(' ');
    };

    // ========== CARGA DIFERIDA DE LIBRERÍAS PESADAS (internet lento 1-5 Mbps) ==========
    // Excel (xlsx) y el escáner de cámara solo se descargan la primera vez que se usan:
    // la apertura del sistema baja ~1.5MB menos. El Service Worker las guarda para
    // que el segundo uso sea instantáneo, incluso sin internet.
    window.__libPromises = {};
    window.__loadLib = (url) => {
      if (!window.__libPromises[url]) {
        window.__libPromises[url] = new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = url;
          s.async = true;
          s.onload = () => resolve(true);
          s.onerror = () => { try { delete window.__libPromises[url]; } catch (e) {} reject(new Error('load')); };
          document.head.appendChild(s);
        });
      }
      return window.__libPromises[url];
    };
    window.XLSX_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    window.ensureXlsx = async () => {
      if (window.XLSX && window.XLSX.utils) return true;
      try {
        if (typeof window.showToast === 'function') window.showToast('Descargando módulo de Excel…', 'warn');
        await window.__loadLib(window.XLSX_CDN);
        return !!(window.XLSX && window.XLSX.utils);
      } catch (e) {
        if (typeof window.showToast === 'function') window.showToast('Sin conexión para descargar el módulo de Excel', 'error');
        return false;
      }
    };
    window.JSPDF_CDN = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    window.JSPDF_AUTOTABLE_CDN = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
    window.ensureJspdf = async () => {
      try { if (window.jspdf && window.jspdf.jsPDF) return true; } catch (e) {}
      try {
        if (typeof window.showToast === 'function') window.showToast('Descargando módulo de PDF…', 'warn');
        await window.__loadLib(window.JSPDF_CDN);
        await window.__loadLib(window.JSPDF_AUTOTABLE_CDN);
        return !!(window.jspdf && window.jspdf.jsPDF);
      } catch (e) {
        if (typeof window.showToast === 'function') window.showToast('Sin conexión para descargar el módulo de PDF', 'error');
        return false;
      }
    };
    window.SCANNER_CDN = 'https://unpkg.com/html5-qrcode';
        window.ensureScannerLib = async () => {
      if (window.Html5Qrcode || window.Html5QrcodeScanner) return true;
      try {
        if (typeof window.showToast === 'function') window.showToast('Descargando módulo de cámara…', 'warn');
        await window.__loadLib(window.SCANNER_CDN);
        return !!(window.Html5Qrcode || window.Html5QrcodeScanner);
      } catch (e) {
        if (typeof window.showToast === 'function') window.showToast('Sin conexión para descargar el módulo de cámara', 'error');
        return false;
      }
    };
    window.DEFAULT_DARK_PALETTE = {
      bg: '#050C18', surface: '#0B1526', card: '#1A2C48',
      accent: '#3B8DFF', accent2: '#8FC0FF',
      danger: '#E05252', fin: '#E05252', success: '#34C98A', warn: '#E0A93C',
      txt: '#EBF3FF', muted: '#8AA3C7'
    };

    window.themeMode = (() => { try { return localStorage.getItem('pos_theme') === 'dark' ? 'dark' : 'light'; } catch(e) { return 'light'; } })();

    window.getPaletteForMode = (mode) => {
      const defaults = mode === 'dark' ? window.DEFAULT_DARK_PALETTE : window.DEFAULT_PALETTE;
      const key = mode === 'dark' ? 'pos_palette_dark' : 'pos_palette';
      // Paletas oficiales: modo claro = azul Bajaj,
      // modo oscuro = azul marino. Cualquier paleta vieja guardada
      // (blanco y negro, verde oliva, etc.) se restablece a la oficial.
      const norm = (v) => {
        let s = String(v || '').trim().toUpperCase();
        const m3 = s.match(/^#([0-9A-F])([0-9A-F])([0-9A-F])$/);
        if (m3) s = '#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
        return s;
      };
      const coreKeys = ['bg', 'surface', 'accent', 'txt'];
      try {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { saved = {}; }
        const coreDiffers = coreKeys.some(k => norm(saved[k] || defaults[k]) !== norm(defaults[k]));
        let merged;
        if (coreDiffers) {
          // La base no es la oficial: restablecimiento total a azul Bajaj (claro) o azul marino (oscuro).
          merged = Object.assign({}, defaults);
        } else {
          merged = Object.assign({}, defaults, saved);
          // Finanzas (fin) siempre en rojo.
          if (!merged.fin) merged.fin = defaults.fin;
          // Peligro (danger) en rojo en modo claro: la mesa ocupada y los
          // errores deben verse rojos, no grises (migra el negro viejo #000/#111).
          if (mode === 'light' && ['#000000', '#111111'].includes(norm(merged.danger))) merged.danger = defaults.danger;
        }
        // Persiste la corrección para que no regrese la paleta vieja.
        try {
          const cur = JSON.stringify(merged);
          if (localStorage.getItem(key) !== cur) localStorage.setItem(key, cur);
        } catch (e) {}
        return merged;
      } catch (e) { return Object.assign({}, defaults); }
    };
    window.getSavedPalette = () => window.getPaletteForMode(window.themeMode);

    // === iOS SAFARI: las capas compuestas (sticky + backdrop-filter) no se repintan
    // cuando cambian las variables CSS en :root — el chip del reloj y la barra quedan
    // con los colores viejos hasta que algo fuerza un re-render (cambiar de pestaña).
    // Este helper fuerza un repintado invisible y barato (visibility → reflow → visible). ===
    window.__forceGlassRepaint = () => {
      document.querySelectorAll('#admin-root > header, #sidebar, #login-card, #admin-root').forEach(el => {
        if (!el) return;
        el.style.visibility = 'hidden';
        void el.offsetWidth;
        el.style.visibility = '';
      });
    };

    // Aplica la paleta al instante (CSS variables)
    window.applyPalette = (palette) => {
      const root = document.documentElement;
      if (window.themeMode === 'dark') root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      const map = {
        bg: '--c-bg', surface: '--c-surface', card: '--c-card', accent: '--c-accent',
        accent2: '--c-accent2', danger: '--c-danger', fin: '--c-fin', success: '--c-success',
        warn: '--c-warn', txt: '--c-txt', muted: '--c-muted'
      };
      for (const key in map) {
        const hex = palette[key] || (window.themeMode === 'dark' ? window.DEFAULT_DARK_PALETTE[key] : window.DEFAULT_PALETTE[key]);
        root.style.setProperty(map[key], window.hexToRgb(hex));
      }
      // Comprueba automáticamente si el color principal es claro u oscuro (texto legible en botones)
      const accentHex = palette.accent || (window.themeMode === 'dark' ? window.DEFAULT_DARK_PALETTE.accent : window.DEFAULT_PALETTE.accent);
      const rgb = window.hexToRgb(accentHex).split(' ');
      const lum = (0.299 * +rgb[0] + 0.587 * +rgb[1] + 0.114 * +rgb[2]) / 255;
      root.style.setProperty('--c-on-accent', lum > 0.55 ? '0 0 0' : '255 255 255');
      // Barra de estados del iPhone (reloj/batería): sigue el color-scheme del ROOT
      root.style.colorScheme = window.themeMode === 'dark' ? 'dark' : 'light';
      // Chrome del navegador (theme-color) con el color de superficie actual
      try {
        const surf = getComputedStyle(root).getPropertyValue('--c-surface').trim();
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta && surf) {
          const [r, g, b] = surf.split(' ').map(Number);
          meta.setAttribute('content', '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''));
        }
      } catch (e) {}
      // Fuerza el repintado de las capas con blur (no afecta si aún no existen elementos)
      window.__forceGlassRepaint && window.__forceGlassRepaint();
    };
    // Aplica y guarda la paleta del modo actual
        // Sincroniza el icono (luna/sol) de todos los botones de modo oscuro
    window.syncThemeIcon = () => {
      const iconName = window.themeMode === 'dark' ? 'moon' : 'sun';
      document.querySelectorAll('.theme-toggle').forEach(btn => {
        // lucide reemplaza el <i> por <svg>, así que buscamos el elemento [data-lucide]
        const icon = btn.querySelector('[data-lucide]') || btn.querySelector('i');
        if (icon) icon.setAttribute('data-lucide', iconName);
      });
      if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
    };
    window.setThemeMode = (mode) => {
      const apply = () => {
        window.themeMode = mode;
        try { localStorage.setItem('pos_theme', mode); } catch (e) {}
        if (mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
        window.applyPalette(window.getSavedPalette());
        window.syncThemeIcon();
        // Recargar el dashboard de asistencia para que sus gráficas tomen los colores del tema actual
        if (currentView === 'admin-attendance-dash') render();
        // El cambio de tema roba el foco; devuélveselo al lector/barra de búsqueda
        window.__restoreScanFocus?.();
      };
      // Giro premium del botón sol/luna
      document.querySelectorAll('.theme-toggle').forEach(b => {
        b.classList.remove('theme-spin'); void b.offsetWidth; b.classList.add('theme-spin');
        setTimeout(() => b.classList.remove('theme-spin'), 650);
      });
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Origen del revelado circular (lo captura el listener de clics; centro si no hay)
      const origin = window.__themeOrigin || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      window.__themeOrigin = null;
      if (!reduceMotion && typeof document.startViewTransition === 'function') {
        const root = document.documentElement;
        root.style.setProperty('--theme-x', origin.x + 'px');
        root.style.setProperty('--theme-y', origin.y + 'px');
        const t = document.startViewTransition(() => {
          // El respaldo de transición del body entorpecería la captura: se desactiva durante el revelado
          document.body.style.transition = 'none';
          apply();
          void document.body.offsetWidth; // Reflow para que el cambio quede aplicado
          document.body.style.transition = '';
        });
        // Al quitar los snapshots de la transición, iOS puede volver a mostrar la
        // pintura vieja de las capas compuestas: se fuerza otro repintado al terminar
        if (t && t.finished) t.finished.then(() => window.__forceGlassRepaint && window.__forceGlassRepaint()).catch(() => {});
      } else if (!reduceMotion) {
        // Respaldo premium (Safari/Firefox): onda circular manual con el color del tema nuevo.
        // La onda tapa la pantalla y el tema cambia debajo: al desvanecerse se revela el nuevo.
        try {
          const pal = window.getPaletteForMode ? window.getPaletteForMode(mode) : null;
          const newBg = (pal && pal.bg) || (mode === 'dark' ? '#0B0B0C' : '#FFFFFF');
          const r = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
          const wave = document.createElement('div');
          wave.className = 'theme-ripple-fallback';
          wave.style.left = origin.x + 'px'; wave.style.top = origin.y + 'px';
          wave.style.width = wave.style.height = '24px';
          wave.style.background = newBg;
          document.body.appendChild(wave);
          const cover = wave.animate(
            [{ clipPath: 'circle(0px at 50% 50%)' }, { clipPath: 'circle(' + Math.ceil(r) + 'px at 50% 50%)' }],
            { duration: 620, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }
          );
          const finish = () => {
            try {
              apply();
              const fade = wave.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' });
              if (fade && fade.onfinish !== undefined) fade.onfinish = () => wave.remove();
              setTimeout(() => wave.remove(), 550);
            } catch (e) { try { wave.remove(); } catch (_e) {} }
          };
          if (cover && cover.onfinish !== undefined) cover.onfinish = finish;
          setTimeout(() => { if (document.body.contains(wave)) finish(); }, 850);
        } catch (e) { apply(); }
      } else {
        apply();
      }
    };

    // Scrollbar estilo macOS + Liquid Glass reactivo al scroll
    let __scrollHideTimer;
    window.addEventListener('scroll', () => {
      document.documentElement.classList.add('scrolling');
      clearTimeout(__scrollHideTimer);
      __scrollHideTimer = setTimeout(() => document.documentElement.classList.remove('scrolling'), 600);
      const y = window.scrollY || window.pageYOffset || 0;
      document.documentElement.style.setProperty('--scroll-y', y);
      const ah = document.querySelector('#admin-root > header');
      if(ah) ah.style.setProperty('--scroll-y', y);
    }, { passive: true, capture: true });

    // === COMPARTIR TICKET NATIVO (definido aquí, en el script del <head>, para que SIEMPRE exista) ===
        // Delegación de clics: funciona aunque el botón se cree/recree después
    document.addEventListener('click', (e) => {
      // Captura el origen del clic para el revelado circular del tema (estilo iOS 18)
      const themeBtn = e.target && e.target.closest ? e.target.closest('.theme-toggle') : null;
      if (themeBtn) {
        const r = themeBtn.getBoundingClientRect();
        window.__themeOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      } else if (typeof e.clientX === 'number') {
        window.__themeOrigin = { x: e.clientX, y: e.clientY };
      }

    }, true); // Fase de captura: el origen se guarda ANTES de que el onclick del botón llame a setThemeMode

    // Cargar el tema guardado al iniciar el sistema
    window.applyPalette(window.getSavedPalette());
    window.syncThemeIcon();
  

// [5.1] Utilidades: modo offline-first / SW (venía al final del body).
    // [4.1] MODO OFFLINE-FIRST: el SW ya se registró en el <head> sin esperar a load.
    // Aquí solo se vigilan actualizaciones y se persiste el almacenamiento local.
    if ('serviceWorker' in navigator) {
      try {
        navigator.serviceWorker.getRegistration().then(function (reg) {
          if (reg && reg.waiting) { try { reg.waiting.postMessage('SKIP_WAITING'); } catch (e) {} }
          if (reg) { try { reg.update().catch(function () {}); } catch (e) {} }
        }).catch(function () {});
        // Al cambiar a v10 el shell se actualiza solo, sin recarga manual.
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (!window.__swReloaded) { window.__swReloaded = true; try { location.reload(); } catch (e) {} }
        });
      } catch (e) {}
    }
    // Precarga en segundo plano (no bloquea): iconos pendientes + Chart listo para el dashboard.
    try{
      const idle=(fn)=>{if('requestIdleCallback'in window)requestIdleCallback(fn,{timeout:9000});else setTimeout(fn,4000);};
      idle(()=>{try{window.__safeIcons&&window.__safeIcons();}catch(e){}});
      window.addEventListener('load',()=>{
        idle(()=>{try{if(window.__iconsPending)window.__safeIcons&&window.__safeIcons();}catch(e){}});
        // Chart se precarga SOLO con buena red y sin ahorro de datos (no gasta plan débil)
        try{
          const c=navigator.connection||{};
          const okNet=!c.saveData&&(!c.effectiveType||!/^(slow-2g|2g)$/.test(c.effectiveType));
          if(okNet&&navigator.onLine!==false&&window.__ensureChart)window.__ensureChart().then(()=>{try{window.__iconsPending&&window.__safeIcons&&window.__safeIcons();}catch(e){}}).catch(()=>{});
        }catch(e){}
      });
      // Cuando el dashboard pida gráficas, __ensureChart ya las tendrá (o las trae bajo demanda).
      document.addEventListener('click',(e)=>{
        try{
          const t=e.target&&e.target.closest?e.target.closest('[data-nav="dashboard"],[data-view="dashboard"],#nav-dashboard'):null;
          if(t&&window.__ensureChart)window.__ensureChart().catch(()=>{});
        }catch(err){}
      },true);
    }catch(e){}
    // Pide al navegador que jamás borre la base local (IndexedDB de Firestore + localStorage)
    // por presión de almacenamiento. En macOS el sistema puede ignorarlo si el disco está lleno.
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  

// [5.2] Utilidades: wheel-blur en inputs numéricos.
    // [4.2] La ruedita del ratón/trackpad NUNCA debe subir/bajar montos en inputs
    // numéricos (ej. monto recibido al cobrar): al rodar se quita el foco
    document.addEventListener('wheel', () => {
      const a = document.activeElement;
      if (a && a.tagName === 'INPUT' && a.type === 'number') a.blur();
    }, { passive: true });
  

// [5.3] Utilidades: anti-inspección.
    // [4.3] Anti-inspección: sin clic derecho ni atajos de DevTools (disuade curiosos;
    // no es blindaje total: el navegador siempre permite abrir DevTools desde su menú).
    document.addEventListener('contextmenu', (e) => { e.preventDefault(); }, { capture: true });
    document.addEventListener('keydown', (e) => {
      const k = (e.key || '').toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      // F12
      if (e.key === 'F12') { e.preventDefault(); return; }
      // Ctrl/Cmd + Shift + I/J/C/K (DevTools) o Ctrl/Cmd + U (ver código fuente)
      if (mod && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) { e.preventDefault(); return; }
      if (mod && !e.shiftKey && k === 'u') { e.preventDefault(); return; }
    }, { capture: true });
  

// [6] App principal (venía en <script type="module"> inline).
    // [5.1] Imports PRIMERO: los módulos ES exigen imports al tope (antes había código previo → confuso y frágil).



 // ========== FIREBASE SETUP ==========

 // Nueva conexión Firebase - Moto Refacciones El Cedro
 const firebaseConfig = {
   apiKey: "AIzaSyBjWqozIuKHvYUbEmIyhOAMtXoHeihMCYc",
   authDomain: "moto-refacciones-el-cedro.firebaseapp.com",
   projectId: "moto-refacciones-el-cedro",
   storageBucket: "moto-refacciones-el-cedro.firebasestorage.app",
   messagingSenderId: "31350357146",
   appId: "1:31350357146:web:64a3517f885fad52b0f323",
   measurementId: "G-JTQT07FY4Q"
 };

const firebaseApp = initializeApp(firebaseConfig);
// Analytics DIFERIDO: no bloquea el arranque ni gasta datos con internet débil.
// Solo se carga en idle, con red y sin ahorro de datos.
try {
  window.__analyticsReady = false;
  const startAnalytics = () => {
    if (window.__analyticsReady) return;
    try {
      const c = navigator.connection || {};
      if (c.saveData) return;
      if (!navigator.onLine) return;
      window.__analyticsReady = true;
      getAnalytics(firebaseApp);
    } catch (e) {}
  };
  if ('requestIdleCallback' in window) requestIdleCallback(startAnalytics, { timeout: 8000 });
  else setTimeout(startAnalytics, 6000);
  window.addEventListener('online', () => setTimeout(startAnalytics, 2500), { once: true });
} catch (e) {}

const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
// Fallback de caché: si Firestore con persistencia falla (modo privado), usa memoria.
try {
  if (!db) { /* getFirestore fallback se maneja abajo si initializeFirestore lanza */ }
} catch (e) {}
// Función para enrutar a las colecciones correctas en Firestore
function getColeccion(tipo) {
  const map = {
    'user': 'usuarios',
    'config': 'configuracion',
    'sys_file': 'archivos_sistema',
    'attendance': 'asistencias'
  };
  return map[tipo] || 'registros_generales';
}
// ===== ESCRITURAS A PRUEBA DE INTERNET DÉBIL =====
// El SDK de Firestore con caché persistente guarda cada escritura en IndexedDB y la
// reintenta solo hasta que la nube la confirma (aunque se cierre la app). Por eso el
// timeout aquí NUNCA significa "se perdió": significa "quedó en cola y se subirá sola".
// Se evita reintentar el mismo addDoc a mano: eso duplicaría tickets/ventas.
function __writeTimeoutMs() {
  try {
    const c = navigator.connection || {};
    if (c.saveData) return 25000;
    if (/^(slow-2g|2g)$/.test(c.effectiveType || '')) return 25000;
    return 18000;
  } catch (e) { return 18000; }
}
function __withWriteTimeout(promesa) {
  const ms = __writeTimeoutMs();
  return Promise.race([
    promesa,
    new Promise((_, rej) => setTimeout(() => rej(new Error('write-timeout')), ms))
  ]);
}
const dbSdk = {
  async create(data) {
    try { window.__syncPend && window.__syncPend(1); } catch (e) {}
    try {
      const promesa = addDoc(collection(db, getColeccion(data.type)), data);
      if (!navigator.onLine) {
        showToast('Guardado localmente — se subirá al volver la señal', 'warn');
        return { isOk: true, queued: true };
      }
      try {
        const savedDoc = await __withWriteTimeout(promesa);
        return { isOk: true, id: savedDoc.id };
      } catch (timeoutErr) {
        // La escritura sigue viva en la cola del SDK y se confirmará sola.
        try { window.__syncKick && window.__syncKick(); } catch (e) {}
        return { isOk: true, queued: true };
      }
    } catch (e) {
      console.error("Error creando doc: ", e);
      return { isOk: false };
    } finally {
      try { window.__syncPend && window.__syncPend(-1); } catch (e) {}
    }
  },
  async update(data) {
    try { window.__syncPend && window.__syncPend(1); } catch (e) {}
    try {
      const d = { ...data };
      const id = d.id;
      delete d.id;
      const promesa = updateDoc(doc(db, getColeccion(d.type), id), d);
      if (!navigator.onLine) return { isOk: true, queued: true };
      try { await __withWriteTimeout(promesa); return { isOk: true }; }
      catch (timeoutErr) { try { window.__syncKick && window.__syncKick(); } catch (e) {} return { isOk: true, queued: true }; }
    } catch (e) {
      console.error("Error actualizando doc: ", e);
      return { isOk: false };
    } finally {
      try { window.__syncPend && window.__syncPend(-1); } catch (e) {}
    }
  },
  async delete(data) {
    try { window.__syncPend && window.__syncPend(1); } catch (e) {}
    try {
      const promesa = deleteDoc(doc(db, getColeccion(data.type), data.id));
      if (!navigator.onLine) return { isOk: true, queued: true };
      try { await __withWriteTimeout(promesa); return { isOk: true }; }
      catch (timeoutErr) { try { window.__syncKick && window.__syncKick(); } catch (e) {} return { isOk: true, queued: true }; }
    } catch (e) {
      console.error("Error borrando doc: ", e);
      return { isOk: false };
    } finally {
      try { window.__syncPend && window.__syncPend(-1); } catch (e) {}
    }
  },
  // Parche atómico por campos (rutas con puntos): no pisa lo demás del documento.
  // Clave para estaciones: cada cocina marca la suya sin borrar la de las otras.
  async patch(type, id, fields) {
    try { window.__syncPend && window.__syncPend(1); } catch (e) {}
    try {
      const promesa = updateDoc(doc(db, getColeccion(type), id), { ...fields });
      if (!navigator.onLine) return { isOk: true, queued: true };
      try { await __withWriteTimeout(promesa); return { isOk: true }; }
      catch (timeoutErr) { try { window.__syncKick && window.__syncKick(); } catch (e) {} return { isOk: true, queued: true }; }
    } catch (e) {
      console.error("Error en parche: ", e);
      return { isOk: false };
    } finally {
      try { window.__syncPend && window.__syncPend(-1); } catch (e) {}
    }
  }
};

// ========== INDICADOR DE SINCRONIZACIÓN (estilo iOS: cloud / cloud-off) ==========
// Estados: 'online' | 'syncing' | 'offline' | 'error'
window.__syncState = 'online';

window.__setSyncState = (state) => {
  if (window.__syncState === state) return; // Sin cambios: no re-renderiza iconos
  window.__syncState = state;
  if (window.updateSyncIndicator) window.updateSyncIndicator();
};

window.updateSyncIndicator = () => {
  const el = document.getElementById('sync-indicator');
  if (!el) return;
  const icon = el.querySelector('i[data-lucide]');
  const map = {
    online:  { icon: 'cloud',     cls: 'text-success', title: 'Sincronizado con la nube' },
    syncing: { icon: 'cloud',     cls: 'text-success', title: 'Guardando en la nube...' },
    offline: { icon: 'cloud-off', cls: 'text-danger', title: 'Sin conexión — Modo Offline' },
    error:   { icon: 'cloud-off', cls: 'text-warn',   title: 'No se puede contactar la nube' }
  };
  const m = map[window.__syncState] || map.online;
  el.classList.remove('text-muted', 'text-accent', 'text-danger', 'text-warn', 'text-success');
  el.classList.add(m.cls);
  try {
    const n = (window.__syncEngine && window.__syncEngine.pendingOps) || 0;
    el.title = (window.__syncState === 'syncing' && n > 0)
      ? ('Subiendo ' + n + ' cambio(s) a la nube… no cierres la app')
      : (window.__syncState === 'error'
        ? 'Señal débil — todo guardado local, se subirá solo'
        : m.title);
  } catch (e) { el.title = m.title; }
  el.classList.toggle('animate-pulse', window.__syncState === 'syncing');
  if (icon) {
    icon.setAttribute('data-lucide', m.icon);
    if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
  }
};

// ===== MOTOR DE SINCRONIZACIÓN RESILIENTE (internet débil / datos móviles) =====
// - Contador de operaciones en curso + escrituras pendientes de la nube.
// - Ping adaptativo: con red lenta espacia los latidos y alarga el timeout para no
//   saturar los pocos KB disponibles ni marcar "error" por una red lenta pero viva.
// - Se exigen 2 fallos seguidos para mostrar error (un solo timeout con 2G es normal).
// - Aviso antes de cerrar si aún hay datos por subir.
window.__syncEngine = {
  pendingOps: 0,
  cloudPending: false,
  fails: 0,
  flushing: false,
  lastOk: Date.now()
};
window.__syncPend = (d) => {
  try {
    window.__syncEngine.pendingOps = Math.max(0, window.__syncEngine.pendingOps + d);
    if (d > 0) window.__setSyncState('syncing');
    if (window.updateSyncIndicator) window.updateSyncIndicator();
  } catch (e) {}
};
// Patada de sincronización: verifica la cola real del SDK sin saturar (debounce 4s).
window.__syncKick = (() => {
  let t = null;
  return () => {
    if (t) return;
    t = setTimeout(() => {
      t = null;
      try { window.__syncPing && window.__syncPing(); } catch (e) {}
      try { window.__syncFlush && window.__syncFlush(); } catch (e) {}
    }, 4000);
  };
})();
// Espera a que la nube confirme TODO lo encolado (ventas, tickets, inventario).
// Con datos débiles la cola puede tardar minutos: timeout amplio (60s) y sin bloquear.
window.__syncFlush = async () => {
  if (window.__syncEngine.flushing) return true;
  if (!navigator.onLine) return false;
  window.__syncEngine.flushing = true;
  try {
    await Promise.race([
      waitForPendingWrites(db),
      new Promise((res) => setTimeout(res, 60000))
    ]);
    window.__syncEngine.cloudPending = false;
    window.__syncEngine.lastOk = Date.now();
    window.__syncEngine.fails = 0;
    if (window.__syncEngine.pendingOps === 0) window.__setSyncState('online');
    if (window.updateSyncIndicator) window.updateSyncIndicator();
    return true;
  } catch (e) { return false; }
  finally { window.__syncEngine.flushing = false; }
};
// Verifica de verdad que Firebase responde (el evento online del navegador no basta)
window.__syncPing = async (manual) => {
  if (!navigator.onLine) { window.__setSyncState('offline'); return; }
  try {
    const c = navigator.connection || {};
    const slow = c.saveData || /^(slow-2g|2g)$/.test(c.effectiveType || '');
    const ref = query(collection(db, getColeccion('config')), limit(1));
    await Promise.race([
      getDocs(ref),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), slow ? 20000 : 12000))
    ]);
    window.__syncEngine.fails = 0;
    window.__syncEngine.lastOk = Date.now();
    // Solo marca online si no hay operaciones en curso (si las hay, sigue "syncing").
    if (window.__syncEngine.pendingOps === 0) window.__setSyncState('online');
    else window.__setSyncState('syncing');
    if (manual) {
      const ok = await window.__syncFlush();
      showToast(ok ? 'Sincronizado con la nube' : 'Guardado local — se subirá solo al mejorar la señal', ok ? 'success' : 'warn');
    }
  } catch (e) {
    window.__syncEngine.fails++;
    // Un solo fallo con red lenta NO es error: se requieren 2 seguidos.
    if (window.__syncEngine.fails >= 2) {
      window.__setSyncState('error');
      if (manual) showToast('Señal muy débil — tus datos están guardados y se subirán solos', 'warn');
    }
  }
};

// Latido adaptativo: 30s con buena red, 60s con red lenta/ahorro (cuida los datos).
window.__syncBeat = () => {
  try {
    const c = navigator.connection || {};
    const slow = c.saveData || /^(slow-2g|2g)$/.test(c.effectiveType || '');
    window.__syncPing();
    if (window.__syncEngine.fails > 0 || window.__syncEngine.pendingOps > 0) window.__syncFlush();
    clearInterval(window.__syncTimer);
    window.__syncTimer = setInterval(window.__syncBeat, slow ? 60000 : 30000);
  } catch (e) {}
};
window.__syncTimer = setInterval(window.__syncBeat, 30000);
window.__syncPing(); // Estado inicial al cargar
window.updateSyncIndicator?.(); // Pinta el indicador con el estado inicial sin esperar cambios
// Al volver la señal o la pantalla: reanuda y confirma la cola real (no solo el evento online).
window.addEventListener('online', () => {
  try { window.__syncEngine.fails = 0; window.__syncPing(); window.__syncFlush(); } catch (e) {}
  // Background Sync del SW (Android/Chrome): reintenta aunque la pestaña esté en segundo plano.
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        try { if (reg && reg.sync && reg.sync.register) reg.sync.register('posfn-flush').catch(() => {}); } catch (e) {}
      }).catch(() => {});
    }
  } catch (e) {}
});
document.addEventListener('visibilitychange', () => {
  try { if (!document.hidden && navigator.onLine) { window.__syncPing(); window.__syncFlush(); } } catch (e) {}
});
// Mensaje del Service Worker (Background Sync): la red volvió, vaciar la cola.
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (ev) => {
      try { if (ev && ev.data && ev.data.type === 'FLUSH_SYNC') { window.__syncPing(); window.__syncFlush(); } } catch (e) {}
    });
  }
} catch (e) {}
// No perder datos por cerrar la pestaña con cola pendiente: avisa al usuario.
window.addEventListener('beforeunload', (e) => {
  try {
    if (window.__syncEngine.pendingOps > 0 || window.__syncState === 'syncing') {
      e.preventDefault();
      e.returnValue = 'Aún se están subiendo datos a la nube. ¿Salir de todos modos? Se subirán solos al volver.';
      return e.returnValue;
    }
  } catch (err) {}
});

// Cada escritura local marca "syncing" mientras se envía y verifica al terminar
['create', 'update', 'delete', 'patch'].forEach(m => {
  const orig = dbSdk[m];
  dbSdk[m] = async function(...args) {
    window.__setSyncState('syncing');
    const res = await orig(...args);
    // Si quedó en cola (timeout/red débil), la confirmación llega vía __syncFlush.
    if (res && res.queued) window.__syncKick();
    else window.__syncPing();
    return res;
  };
});

// ========== STATE ==========
const defaultConfig = {
  business_name: localStorage.getItem('pos_biz_name') || 'Mi Negocio',
  currency_symbol: localStorage.getItem('pos_currency') || '$',
  whatsapp_number: localStorage.getItem('pos_wa_number') || '',
  admin_pin: localStorage.getItem('pos_admin_pin') || '790208',
  support_phone: localStorage.getItem('pos_support_phone') || '9619156443',
  attendance_tolerance: (() => { try { const v = parseInt(localStorage.getItem('pos_att_tolerance') || '10', 10); return isNaN(v) ? 10 : Math.min(120, Math.max(0, v)); } catch (e) { return 10; } })(),
  bg_color: '#050505',
  surface_color: '#1e293b',
  text_color: '#e2e8f0',
  accent_color: '#38bdf8',
  secondary_color: '#818cf8',
  font_family: 'DM Sans',
  font_size: 14
};

let allRecords = [];
let currentUser = JSON.parse(localStorage.getItem('pos_user')) || null;
let currentView = localStorage.getItem('pos_view') || 'login';
// === MODO RENDIMIENTO (por dispositivo, para gama baja) ===
// Solo vive en localStorage: cada equipo decide el suyo (no se sincroniza a la nube).
// SOLO aligera lo visual (animaciones, desenfoques, sombras, vuelo al carrito):
// jamás toca las actualizaciones en tiempo real (pedidos, cronómetros, snapshots).
window.isPerfMode = () => { try { return localStorage.getItem('pos_perf_mode') === '1'; } catch (e) { return false; } };
window.applyPerfMode = () => {
  let on = false;
  try { on = localStorage.getItem('pos_perf_mode') === '1'; } catch (e) {}
  try { document.body.classList.toggle('perf-mode', !!on); } catch (e) {}
  try {
    if (window.Chart && window.Chart.defaults) {
      if (on) {
        if (window.__chartAnimBak === undefined) window.__chartAnimBak = window.Chart.defaults.animation;
        window.Chart.defaults.animation = false;
      } else if (window.__chartAnimBak !== undefined) {
        window.Chart.defaults.animation = window.__chartAnimBak;
      }
    }
  } catch (e) {}
  return !!on;
};
window.setPerfMode = (on) => {
  try { localStorage.setItem('pos_perf_mode', on ? '1' : '0'); } catch (e) {}
  window.applyPerfMode();
  try { render(); } catch (e) {}
};
try {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.applyPerfMode());
  else window.applyPerfMode();
} catch (e) {}

// === PANTALLA ENCENDIDA EN COCINA (Wake Lock) + REGRESO DE 2º PLANO ===
// En cocina la pantalla no debe apagarse (pedidos visibles siempre). Al volver de
// segundo plano o de pantalla apagada se re-sincroniza y se repinta lo vivo: con
// wifi/datos lentos (1 Mbps) la app responde igual gracias a la caché local.
window.__wakeLock = null;
window.__wakeLockWanted = false;
window.__hiddenAt = 0;
window.__ensureWakeLock = async () => {
  if (!window.__wakeLockWanted) return;
  try {
    if (!('wakeLock' in navigator)) return;
    if (document.hidden) return;
    if (window.__wakeLock) return;
    window.__wakeLock = await navigator.wakeLock.request('screen');
    try { window.__wakeLock.addEventListener('release', () => { window.__wakeLock = null; }); } catch (e) {}
  } catch (e) { window.__wakeLock = null; }
};
window.__releaseWakeLock = async () => {
  window.__wakeLockWanted = false;
  try { if (window.__wakeLock) await window.__wakeLock.release(); } catch (e) {}
  window.__wakeLock = null;
};

// === LECTOR DE CÓDIGOS: ESTADO PERSISTENTE (switch estilo Apple) ===
// Se define aquí (global) para usarse al construir el HTML del carrito.

// === AYUDA DE ATAJOS DE TECLADO (F1-F12) ===

// ========== MOTOR DE BÚSQUEDA DIFUSA (FUZZY SEARCH / FUSE.JS) ==========
// Tolera errores ortográficos rápidos: "coca cloa" -> "Coca Cola", "sabirtas" -> "Sabritas"

let toastTimeout = null;

// === CARRITOS GUARDADOS (ventas pendientes de otros clientes) ===

const DEFAULT_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrador' }
];

// ========== HELPERS ==========
// [5.3] Compresión de imágenes: helpers puros, van aquí (antes estaban antes de los imports → rompía el orden del módulo).
// Función de COMPRESIÓN EXTREMA para Firebase / BALANCEADA para Productos / Mejor Calidad para Logos.
async function compressLogo(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');

        var __saverL = false;
        try {
          var __cL = navigator.connection || {};
          __saverL = !!(__cL.saveData || /^(slow-2g|2g)$/.test(__cL.effectiveType || '') || window.__SLOW_NET);
        } catch (e) {}
        const MAX_WIDTH = __saverL ? 280 : 400; // Mayor tamaño para logos
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        // WebP con transparencia: igual que PNG pero mucho más ligero (ideal con internet lento)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/webp', __saverL ? 0.65 : 0.8); // 80% de calidad
        resolve(dataUrl);
      };
    };
  });
}

function currency(n) {
  // Convierte el número a formato: $1,234.56
  const number = Number(n || 0);
  return defaultConfig.currency_symbol + number.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// === ANIMACIÓN COUNT-UP: sube un número de 0 al valor final con formato de moneda (curva Apple: deceleración fuerte al final) ===

// === TOOLTIP DE CRISTAL PARA TODAS LAS GRÁFICAS: burbuja con blur, borde translúcido y sombra suave ===
if (window.Chart) {
  Chart.defaults.plugins.tooltip.enabled = false; // El interno de canvas se desactiva: solo dibuja la burbuja de cristal
  Chart.defaults.plugins.tooltip.external = function (context) {
    let tipEl = document.getElementById('chart-glass-tooltip');
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.id = 'chart-glass-tooltip';
      tipEl.className = 'pointer-events-none fixed z-[10060] px-3 py-1.5 text-xs rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] backdrop-blur-xl bg-surface/75 border border-card/60 transition-opacity duration-150';
      document.body.appendChild(tipEl);
    }
    const tooltip = context.tooltip;
    if (!tooltip.opacity || !tooltip.body) { tipEl.style.opacity = '0'; return; }
    const title = tooltip.title ? (tooltip.title[0] || '') : '';
    const body = tooltip.body[0] ? (tooltip.body[0].lines[0] || '') : '';
    tipEl.innerHTML = title
      ? `<div class="text-muted font-semibold pb-0.5">${title}</div><div class="font-bold text-txt">${body}</div>`
      : `<span class="font-bold text-txt">${body}</span>`;
    tipEl.style.opacity = '1';
    const canvasRect = context.chart.canvas.getBoundingClientRect();
    let x = canvasRect.left + tooltip.caretX + 10;
    let y = canvasRect.top + tooltip.caretY + 10;
    const r = tipEl.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = window.innerWidth - r.width - 8;
    if (x < 8) x = 8;
    if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
  };
}

function bizName() {
  return defaultConfig.business_name;
}
// Teléfono de soporte del administrador (Configuración): se usa en el
// "¿Olvidaste tu contraseña?" del login y en el modal Acerca de.
function supportPhone() {
  try {
    const cfg = (typeof records === 'function' && records('config')[0]) || {};
    const p = String(cfg.support_phone || defaultConfig.support_phone || '9619156443').trim();
    return p || '9619156443';
  } catch (e) { return '9619156443'; }
}
function supportWaLink(msg) {
  let digits = String(supportPhone()).replace(/\D/g, '');
  if (digits.length === 10) digits = '52' + digits;
  const text = msg || 'Hola, olvidé mi contraseña del sistema y necesito ayuda';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
function supportTelHref() {
  return 'tel:' + String(supportPhone()).replace(/\D/g, '');
}

function getSystemLogo() {
  // 1. Intentar sacarlo de la memoria rápida (Caché)
  const cachedLogo = localStorage.getItem('pos_system_logo');
  if (cachedLogo) return cachedLogo;

  // 2. Si no hay caché, buscarlo en los registros descargados
  const logoRec = allRecords.find(r => r.type === 'sys_file' && r.name === 'main_logo');
  return logoRec ? logoRec.image : null;
}
function records(type) { return allRecords.filter(r => r.type === type); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function today() { return new Date().toISOString().slice(0,10); }
function now() { return new Date().toISOString(); }

// ========== RELOJ EN TIEMPO REAL ==========
// Variable global para evitar que el reloj se duplique al cambiar de pantalla
window.globalClockInterval = window.globalClockInterval || null;

function updateGlobalClock() {
  const clockEl = document.getElementById('global-clock');
  if (clockEl) {
    const now = new Date();

    // 1. Calcular la fecha (Ej: 30 jul 2026)
    const opcionesFecha = { day: 'numeric', month: 'short', year: 'numeric' };
    const fechaStr = now.toLocaleDateString('es-MX', opcionesFecha);

    // 2. Calcular la hora
    let h = now.getHours();
    let m = now.getMinutes().toString().padStart(2, '0');
    let s = now.getSeconds().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12; // Convierte el 0 a 12 y usa formato 12 horas

    // 3. Unir fecha y hora en el contenedor
    clockEl.textContent = `${fechaStr}  |  ${h}:${m}:${s} ${ampm}`;
  }
}

window.openAboutModal = () => {
  const modal = document.getElementById('about-modal');
  const container = document.getElementById('about-logo-container');
  const sysLogo = getSystemLogo();
  if(container){
    if(sysLogo){
      container.innerHTML = `<img src="${sysLogo}" class="w-24 h-24 object-contain rounded-2xl bg-white/5 p-2 drop-shadow-lg">`;
    } else {
      container.innerHTML = `<i data-lucide="shopping-bag" class="w-[80px] h-[80px] text-white/80"></i>`;
    }
  }
  try {
    const sp = supportPhone();
    const digits = String(sp).replace(/\D/g, '');
    const link = document.getElementById('about-support-link');
    if (link) {
      link.href = 'tel:' + digits;
      link.textContent = sp;
    }
  } catch (e) {}
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
};

// Panel "Más información": datos vivos del sistema (se calculan al abrir)
window.toggleAboutMore = () => {
  const panel = document.getElementById('about-more');
  if (!panel) return;
  const opening = !panel.classList.contains('open');
  if (opening) {
    try {
      const count = (t) => { try { return records(t).length; } catch (e) { return 0; } };
      document.getElementById('about-stat-products').textContent = count('product');
      document.getElementById('about-stat-sales').textContent = count('sale');
      document.getElementById('about-stat-clients').textContent = count('client');
      const net = document.getElementById('about-stat-net');
      net.textContent = navigator.onLine ? 'En línea' : 'Local / sin internet';
      net.className = 'font-medium ' + (navigator.onLine ? 'text-success' : 'text-warn');
    } catch (e) {}
  }
  panel.classList.toggle('open', opening);
  const btn = document.getElementById('about-more-btn');
  if (btn) btn.textContent = opening ? 'Menos información...' : 'Más información...';
};

// Cierre suave del modal "Acerca de" (ya no se cierra de golpe)
window.closeAboutSmooth = () => {
  const modal = document.getElementById('about-modal');
  if (!modal || modal.classList.contains('hidden') || modal.classList.contains('about-closing')) return;
  const card = modal.querySelector('.about-in, .about-out');
  modal.classList.add('about-closing');
  if (card) { card.classList.remove('about-in'); card.classList.add('about-out'); }
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex', 'about-closing');
    if (card) { card.classList.remove('about-out'); card.classList.add('about-in'); }
  }, 200);
};

// Iniciar el "motor" del reloj para que avance cada 1 segundo (1000 milisegundos)
if (window.globalClockInterval) clearInterval(window.globalClockInterval);
window.globalClockInterval = setInterval(updateGlobalClock, 1000);

function showToast(msg, type='success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const meta = {
    success: { icon: 'check-circle', color: 'success' },
    error:   { icon: 'alert-circle', color: 'danger' },
    warn:    { icon: 'alert-triangle', color: 'warn' },
    info:    { icon: 'info', color: 'accent' }
  }[type] || { icon: 'info', color: 'accent' };
  const d = document.createElement('div');
  d.className = 'toast-glass toast-in font-medium text-sm';
  const icon = document.createElement('span');
  icon.className = `toast-icon bg-${meta.color}/15 text-${meta.color}`;
  icon.innerHTML = `<i data-lucide="${meta.icon}" class="w-4 h-4 pointer-events-none"></i>`;
  const text = document.createElement('span');
  text.className = 'text-txt flex-1 min-w-0';
  text.textContent = msg;
  d.appendChild(icon);
  d.appendChild(text);
  c.prepend(d); // La nueva llega arriba y la pila se desplaza hacia abajo (como iOS)
  if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
  setTimeout(() => {
    d.classList.remove('toast-in');
    d.classList.add('toast-out');
    setTimeout(() => d.remove(), 320);
  }, 3000);
}
window.showToast = showToast; // Expuesta globalmente para los botones inline y utilidades del sistema

let confirmCb = null;
function showConfirm(msg, cb, okLabel) {
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-ok').textContent = okLabel || 'Confirmar';
  document.getElementById('confirm-modal').style.display = 'flex';
  confirmCb = cb;
}
document.getElementById('confirm-cancel').onclick = () => { document.getElementById('confirm-modal').style.display='none'; confirmCb=null; };
document.getElementById('confirm-ok').onclick = () => { document.getElementById('confirm-modal').style.display='none'; if(confirmCb) confirmCb(); confirmCb=null; };

function getUsers() {
  const sdkUsers = records('user');
  let merged = DEFAULT_USERS.map(u => ({...u, isDefault: true}));

  sdkUsers.forEach(u => {
    // Marcador de renombrado: oculta el usuario anterior (p. ej. el cajero
    // por defecto renombrado) para que no se duplique en la lista.
    if (u.hidden === true) {
      const hx = merged.findIndex(m => m.username === u.name);
      if (hx > -1) merged.splice(hx, 1);
      return;
    }
    const idx = merged.findIndex(m => m.username === u.name);
    const mappedUser = {
      id: u.id, username: u.name, password: u.code, role: u.status || 'cashier', name: u.description || u.name, raw: u, isDefault: idx !== -1,
      disabled: u.disabled === true,
      sched_enabled: u.sched_enabled === true, sched_start: u.sched_start || '', sched_end: u.sched_end || '',
      leave_days: Array.isArray(u.leave_days) ? u.leave_days.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d))) : (Array.isArray(u.permiso_fechas) ? u.permiso_fechas.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d))) : []),
      kitchen_id: u.kitchen_id || ''
    };
    if (idx === -1) merged.push(mappedUser);
    else merged[idx] = { ...merged[idx], ...mappedUser };
  });
  // Restaurante retirado: ocultar meseros/cocina siempre.
  try {
    merged = merged.filter(u => u.role !== 'waiter' && u.role !== 'kitchen');
  } catch (e) {}
  try { merged.forEach(u => { if (!Array.isArray(u.leave_days)) u.leave_days = []; }); } catch (_e) {}
  return merged;
}

function authenticate(username, password) {
  const users = getUsers();
  const found = users.find(u => u.username === username && u.password === password);
  if (found && found.disabled) return { ...found, disabledLogin: true };
  if (found && !userInSchedule(found)) return { ...found, scheduleBlock: true };
  return found || null;
}

// Horario laboral: ¿puede entrar a esta hora? Soporta turno nocturno (ej. 22:00–06:00).
// El admin principal siempre entra.
function userInSchedule(u, at) {
  if (!u || u.username === 'admin') return true;
  if (!u.sched_enabled) return true;
  const p = (s) => { const m = String(s || '').match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const s = p(u.sched_start), e = p(u.sched_end);
  if (s === null || e === null || s === e) return true;
  const d = at || new Date();
  const nowMins = d.getHours() * 60 + d.getMinutes();
  if (e > s) return nowMins >= s && nowMins < e;
  return nowMins >= s || nowMins < e;
}

// ========== RENDERING ==========
const app = document.getElementById('app');

function render() {
  // Si salimos del checador (kiosco o vista admin), apagamos su cámara siempre-activa para no dejarla prendida.
  // Se hace sin await (fire-and-forget) para no frenar el render.
  try {
    if (typeof currentView !== 'undefined' && currentView !== 'checker-view' && currentView !== 'admin-attendance' && window.__attLive && window.__attLive.running) {
      try { window.attendanceLiveStop && window.attendanceLiveStop(); } catch (_e) {}
    }
  } catch (e) {}
  // Limpia los restos del carrito móvil montados en <body>: si el usuario cerró
  // sesión con el sheet abierto, el FAB/panel quedaban flotando sobre login/admin
  // Fuera del POS los elementos del carrito no se muestran (interruptor CSS)
  // Modo rendimiento (gama baja): se aplica en cada render por si cambió en otro lado
  try { window.applyPerfMode && window.applyPerfMode(); } catch (e) {}

  if (!currentUser && currentView !== 'login') {
    currentView = 'login';
  }

  // Checador: solo kiosco pared (sin acceso a reportes/datos de empleados)
  if (currentUser && currentUser.role === 'attendance' && currentView !== 'checker-view') {
    currentView = 'checker-view';
    try { localStorage.setItem('pos_view', currentView); } catch (e) {}
  }
  // Roles sin interfaz (caja/restaurante retirados, empleado solo-fichaje): cualquier sesión vieja se cierra
  if (currentUser && (currentUser.role === 'cashier' || currentUser.role === 'employee' || currentUser.role === 'waiter' || currentUser.role === 'kitchen')) {
    currentUser = null;
    try { localStorage.removeItem('pos_user'); } catch (e) {}
    currentView = 'login';
    try { localStorage.setItem('pos_view', currentView); } catch (e) {}
  }
  // Anti-brinco del menú: el render reconstruye todo el HTML y los scrolls se
  // pierden (al elegir una opción de abajo, la lista "se sube" sola). Se capturan
  // antes y se restauran después: la lista del menú siempre conserva su posición
  // y el contenido conserva la suya al re-renderizar la misma vista en vivo.
  const prevView = window.__lastView;
  const prevRootScroll = document.getElementById('admin-root')?.scrollTop || 0;
  const prevNavScroll = document.querySelector('#sidebar .nav-list')?.scrollTop || 0;

  // Si se está arrastrando una mesa, no reconstruir a mitad del gesto (rompería
  // el arrastre y flashea); al soltar se guarda y la vista se actualiza sola.
  if (window.__draggingTables && prevView === currentView) return;

  switch(currentView) {
    case 'login':
      renderLogin();
      break;
    case 'checker-view':
      renderCheckerView();
      break;
    case 'admin-attendance':
      renderAdminShell(renderAttendanceAdmin);
      break;
    case 'admin-attendance-dash':
      renderAdminShell(renderAttendanceDash);
      break;
    case 'admin-users':
      renderAdminShell(renderUsersAdmin);
      break;
    case 'admin-settings':
      renderAdminShell(renderSettings);
      break;
    default:
      if (currentUser && (currentUser.role === 'cashier' || currentUser.role === 'employee' || currentUser.role === 'waiter' || currentUser.role === 'kitchen')) {
        // Roles sin interfaz (caja/restaurante retirados, empleado solo-fichaje): se cierra la sesión
        currentUser = null;
        try { localStorage.removeItem('pos_user'); } catch (e) {}
        currentView = 'login';
        try { localStorage.setItem('pos_view', currentView); } catch (e) {}
        renderLogin();
      } else if (currentUser && currentUser.role === 'admin') {
        // Vista retirada (módulo eliminado) o ruta vieja de caja: cae al Checador
        currentView = 'admin-attendance';
        try { localStorage.setItem('pos_view', currentView); } catch (e) {}
        renderAdminShell(renderAttendanceAdmin);
      } else renderLogin();
  }
  window.updateSyncIndicator?.(); // Repinta la nube según el estado actual (el botón se crea al renderizar el header)

  // Restaura los scrolls capturados antes del render
  window.__lastView = currentView;
  // Misma vista re-renderizada en vivo: sin animaciones de entrada (sin flash).
  // Vista distinta (navegación): con animación normal.
  document.body.classList.toggle('live-view', prevView === currentView);
  // Cocina con pantalla siempre encendida (solo roles cocina/admin en vista cocina);
  // en cualquier otra vista se libera para no gastar batería.
  try {
    const __wantLock = false; // Cocina retirada: sin pantalla siempre encendida
    if (__wantLock && currentUser && (currentUser.role === 'kitchen' || currentUser.role === 'admin')) {
      window.__wakeLockWanted = true;
      window.__ensureWakeLock && window.__ensureWakeLock();
    } else if (window.__wakeLockWanted || window.__wakeLock) {
      window.__releaseWakeLock && window.__releaseWakeLock();
    }
  } catch (e) {}
  const navList = document.querySelector('#sidebar .nav-list');
  if (navList) navList.scrollTop = prevNavScroll;
  if (prevView === currentView) {
    // Misma vista (actualización en vivo): no brincar el contenido
    const root = document.getElementById('admin-root');
    if (root) root.scrollTop = prevRootScroll;
  }
  // Vista distinta: se empieza arriba (comportamiento normal, sin brinco extra)
}

// ========== LOGIN ==========
function renderLogin() {
  const sysLogo = getSystemLogo();
  const waLink = supportWaLink();
  // Agregamos 'rounded-2xl' para bordes redondeados, o puedes usar 'rounded-full' para un círculo perfecto
  const logoHtml = sysLogo
    ? `<img src="${sysLogo}" class="w-24 h-24 object-contain mx-auto mb-4 drop-shadow-lg rounded-2xl bg-white/5 p-2">`
    : `<div class="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4"><i data-lucide="shopping-bag" class="w-8 h-8 text-accent"></i></div>`;
    app.innerHTML = `
   <div class="h-full w-full flex items-center justify-center p-4 relative overflow-hidden login-vignette" style="perspective: 1000px;">
    <div class="login-vignette-bg"></div>
    <div class="login-mesh" aria-hidden="true">
      <div class="mesh-orb mesh-orb-1"></div>
      <div class="mesh-orb mesh-orb-2"></div>
      <div class="mesh-orb mesh-orb-3"></div>
      <div class="mesh-orb mesh-orb-4"></div>
    </div>
    <div class="absolute inset-0 pointer-events-none login-accent-glow" style="background: radial-gradient(ellipse 85% 70% at 50% -15%, rgb(var(--c-accent) / 0.06), transparent 62%), radial-gradient(ellipse 75% 55% at 85% 95%, rgb(var(--c-accent) / 0.04), transparent 60%)"></div>
    <div id="login-card" class="bg-surface/80 backdrop-blur-2xl rounded-[2rem] p-8 w-full max-w-md mac-window-in border border-white/40 shadow-[0_30px_90px_rgba(0,0,0,0.12)] relative overflow-hidden z-10">
      <div class="text-center mb-8">
        ${logoHtml}
        <h1 class="text-2xl font-bold">${bizName()}</h1>
        <p class="text-muted mt-1">Control de Asistencia de Personal</p>
      </div>
      <div id="login-error" class="hidden bg-fin/20 text-fin rounded-xl p-3 mb-4 text-sm"></div>
      <div class="space-y-5">
        <div class="login-field">
          <label class="block text-xs text-muted mb-1.5 font-medium tracking-wide">Usuario</label>
          <div class="relative">
            <i data-lucide="user" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"></i>
            <input id="login-user" type="text" onfocus="this.select()" onclick="this.select()" class="w-full bg-card border border-card/70 rounded-2xl pl-11 pr-4 py-3.5 text-txt focus:border-accent focus:outline-none transition shadow-sm" placeholder="usuario">
          </div>
        </div>
        <div class="login-field">
          <label class="block text-xs text-muted mb-1.5 font-medium tracking-wide">Contraseña</label>
          <div class="relative">
            <span id="login-lock-icon" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
            <input id="login-pass" type="password" onfocus="this.select()" onclick="this.select()" class="w-full bg-card border border-card/70 rounded-2xl pl-11 pr-10 py-3.5 text-txt focus:border-accent focus:outline-none transition shadow-sm" placeholder="••••••">
            <button type="button" id="toggle-pass" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition p-1"><i data-lucide="eye" class="w-4 h-4"></i></button>
          </div>
        </div>
        <p id="caps-warn" class="hidden items-center justify-center gap-1.5 text-[11px] font-semibold text-warn !-mt-2"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i>Bloq Mayús activado</p>
        <button id="login-btn" class="w-full bg-accent text-bg font-semibold py-3.5 rounded-2xl transition-all duration-300 ease-out hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] mt-2 shadow-md">Iniciar Sesión</button>
        <p class="text-center text-sm mt-4">
          <a href="${waLink}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-muted hover:text-accent transition font-medium"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>¿Olvidaste tu contraseña? Contacta con soporte</a>
        </p>
        <p class="text-center text-[10px] text-muted/60 font-medium tracking-wide mt-6 leading-relaxed">
          Sistema desarrollado por<br>la empresa DY Code Studio
        </p>
      </div>
    </div>
  </div>`;
  lucide.createIcons();

  // Tilt 3D suave (sin glare, menos brusco)
  (() => {
    const card = document.getElementById('login-card');
    if (!card) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;
    card.classList.add('tilt-active');
    let rect = null;
    let raf = null;
    let targetX = 0, targetY = 0, curX = 0, curY = 0;
    const onEnter = () => { rect = card.getBoundingClientRect(); };
    const onMove = (e) => {
      if (!rect) rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      targetY = ((x - cx) / cx) * 2;
      targetX = ((cy - y) / cy) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      curX += (targetX - curX) * 0.08;
      curY += (targetY - curY) * 0.08;
      card.style.transform = `rotateX(${curX}deg) rotateY(${curY}deg)`;
      if (Math.abs(targetX - curX) > 0.01 || Math.abs(targetY - curY) > 0.01) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
      }
    };
    const onLeave = () => {
      targetX = 0; targetY = 0;
      if (!raf) raf = requestAnimationFrame(tick);
      rect = null;
    };
    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
  })();
  document.getElementById('toggle-pass').onclick = () => {
    const passInput = document.getElementById('login-pass');
    const toggleBtn = document.getElementById('toggle-pass');
    if (passInput.type === 'password') { passInput.type = 'text'; toggleBtn.innerHTML = '<i data-lucide="eye-off" class="w-4 h-4"></i>'; }
    else { passInput.type = 'password'; toggleBtn.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i>'; }
    // El candado acompaña al ojo: cerrado cuando oculta, abierto cuando revela.
    // SVG inline — no depende del re-render de lucide (que reemplaza los <i>)
    const lockIcon = document.getElementById('login-lock-icon');
    if (lockIcon) {
      lockIcon.innerHTML = passInput.type === 'text'
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    }
    lucide.createIcons();
    passInput.focus();
  };

  document.getElementById('login-btn').onclick = () => {
    const btn = document.getElementById('login-btn');
    if (btn.disabled) return; // Evita doble envío
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value;

    // Validación rápida: solo spinner, SIN blur todavía
    btn.disabled = true;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2"><i data-lucide="loader" class="w-4 h-4 animate-spin pointer-events-none"></i>Iniciando sesión...</span>';
    lucide.createIcons();

    setTimeout(() => {
      const user = authenticate(u, p);
      const retiredCashier = !!(user && user.role === 'cashier');
      const isEmployee = !!(user && user.role === 'employee');
      if (!user || user.disabledLogin || user.scheduleBlock || retiredCashier || isEmployee) {
        // Error: se restaura el botón, nunca hubo blur
        btn.disabled = true;
        btn.innerHTML = 'Iniciar Sesión';
        lucide.createIcons();
        const errorEl = document.getElementById('login-error');
        const userInput = document.getElementById('login-user');
        const passInput = document.getElementById('login-pass');
        errorEl.classList.remove('hidden');
        errorEl.textContent = (user && user.disabledLogin) ? 'Usuario deshabilitado. Contacta al administrador.' : ((user && user.scheduleBlock) ? `Fuera de tu horario laboral (${user.sched_start || '--:--'}–${user.sched_end || '--:--'}).` : (retiredCashier ? 'Rol Cajero retirado: el punto de venta ya no existe. Pide a tu administrador que te reasigne un rol.' : (isEmployee ? 'Usuario de empleado: registra tu asistencia con tu QR en el checador.' : 'Usuario o contraseña incorrectos')));
        const card = document.getElementById('login-card');
        // El tilt escribe transform inline y puede pelear con la vibración: se
        // congela durante el error (el tilt retoma solo con el próximo mousemove)
        if (card) card.style.transform = '';
        card.classList.remove('shake');
        void card.offsetWidth; // Reinicia la animación si ya estaba vibrando
        card.classList.add('shake');
        // Respaldo con Web Animations API: vibra aunque la clase CSS quedara
        // bloqueada; usa los mismos cuadros y tiempos que shakeX
        try {
          if (card.animate) {
            card.animate([
              { transform: 'translateX(0) rotateY(0deg)' },
              { transform: 'translateX(-8px) rotateY(-4deg)', offset: 0.15 },
              { transform: 'translateX(7px) rotateY(3.4deg)', offset: 0.3 },
              { transform: 'translateX(-6px) rotateY(-2.6deg)', offset: 0.45 },
              { transform: 'translateX(5px) rotateY(1.8deg)', offset: 0.6 },
              { transform: 'translateX(-3px) rotateY(-1deg)', offset: 0.75 },
              { transform: 'translateX(2px) rotateY(0.5deg)', offset: 0.9 },
              { transform: 'translateX(0) rotateY(0deg)' }
            ], { duration: 500, easing: 'cubic-bezier(.36, .07, .19, .97)' });
          }
        } catch (e) {}
        // Limpia la clase al terminar para que el próximo intento reinicie limpio
        clearTimeout(card._shakeH);
        card._shakeH = setTimeout(() => card.classList.remove('shake'), 550);
        // Tinte rojo en ambos campos + sus etiquetas durante 1s (sale suave)
        userInput.classList.add('login-field-error');
        passInput.classList.add('login-field-error');
        const userField = userInput.closest('.login-field');
        const passField = passInput.closest('.login-field');
        if (userField) userField.classList.add('field-error');
        if (passField) passField.classList.add('field-error');
        setTimeout(() => {
          userInput.classList.remove('login-field-error');
          passInput.classList.remove('login-field-error');
          if (userField) userField.classList.remove('field-error');
          if (passField) passField.classList.remove('field-error');
        }, 1000);
        // El mensaje dura ~0.9s, luego se desvanece y los campos se limpian (solo si el usuario no volvió a escribir)
        setTimeout(() => {
          if (userInput.value === u && passInput.value === p) {
            errorEl.classList.add('login-error-exit');
            setTimeout(() => {
              errorEl.classList.add('hidden');
              errorEl.classList.remove('login-error-exit');
              // Las letras desaparecen una a una con ritmo natural pero ágil (aunque el login sea largo)
              const clearField = (input, startDelay = 24) => {
                input.classList.add('login-field-clearing');
                let delay = startDelay;
                const step = () => {
                  if (input.value.length === 0) {
                    input.classList.remove('login-field-clearing');
                    return;
                  }
                  input.value = input.value.slice(0, -1);
                  delay = Math.min(delay + 5, 70); // Decelera suave pero con tope para no alargarse
                  setTimeout(step, delay);
                };
                setTimeout(step, delay);
              };
              clearField(userInput);
              setTimeout(() => clearField(passInput, 24), 40); // La contraseña empieza un instante después
            }, 260);
          } else {
            errorEl.classList.add('hidden');
          }
        }, 800);
        return;
      }

      currentUser = user; localStorage.setItem('pos_user', JSON.stringify(user));

      if (user.role === 'admin') {
          const perms = user.raw && user.raw.permissions ? user.raw.permissions : null;
          if (perms && perms.length > 0) {
              currentView = perms[0]; // Lo manda a la primera pestaña que tiene permitida (si era un módulo eliminado, el fallback de render() lo lleva al Checador)
          } else {
              currentView = 'admin-attendance';
          }
      } else if (user.role === 'attendance') {
          currentView = 'checker-view'; // Checador: registra entradas/salidas + reportes
      } else {
          currentView = 'checker-view'; // Rol no reconocido: kiosco por defecto
      }
      localStorage.setItem('pos_view', currentView);

      // ÉXITO: congelamos el login en un overlay y el blur aparece sobre él
      const appRoot = document.getElementById('app');
      let overlay = null;
      try {
        overlay = document.createElement('div');
        overlay.className = 'login-overlay';
        overlay.innerHTML = appRoot.innerHTML;
        document.body.appendChild(overlay);
      } catch (e) { overlay = null; }

      // REVELADO SIEMPRE programado: aunque algo falle después, el overlay NUNCA queda congelado
      requestAnimationFrame(requestAnimationFrame(() => {
        try { render(); } catch (e) {}
        if (overlay) {
          overlay.classList.add('login-exit');
          setTimeout(() => overlay.remove(), 900);
        }
      }));

      // Blur + spinner "Entrando..." (si falla algo aquí, el revelado ya está asegurado)
      try {
        const ovCard = overlay && overlay.querySelector('#login-card');
        if (ovCard) ovCard.classList.add('login-loading');
        const ovBtn = overlay && overlay.querySelector('#login-btn');
        if (ovBtn) {
          ovBtn.disabled = true;
          ovBtn.innerHTML = '<span class="flex items-center justify-center gap-2"><i data-lucide="loader" class="w-4 h-4 animate-spin pointer-events-none"></i>Entrando...</span>';
        }
        lucide.createIcons();
      } catch (e) {}
    }, 250);
  };

  // Tecla Enter inicia sesión (como Apple: Return responde en el formulario)
  ['login-user', 'login-pass'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('login-btn').click();
      }
    });
  });

  // Aviso de Bloq Mayús en la contraseña: aparece solo mientras está activo
  const passEl = document.getElementById('login-pass');
  const capsEl = document.getElementById('caps-warn');
  if (passEl && capsEl) {
    const checkCaps = (e) => {
      let on = false;
      try { on = !!(e.getModifierState && e.getModifierState('CapsLock')); } catch (_) {}
      capsEl.classList.toggle('hidden', !on);
      capsEl.classList.toggle('flex', on);
    };
    passEl.addEventListener('keydown', checkCaps);
    passEl.addEventListener('keyup', checkCaps);
    passEl.addEventListener('blur', () => { capsEl.classList.add('hidden'); capsEl.classList.remove('flex'); });
  }

}

// Barras superiores con scroll SOLO lateral: la ruedita vertical del mouse
// mueve la barra a izquierda/derecha (solo si hay contenido desbordado;
// si no hay desborde, el scroll de la página sigue normal).
window.__hScrollBar = (el) => {
  if (!el || el.__hWired) return el;
  try { el.__hWired = true; } catch (e) {}
  el.addEventListener('wheel', (e) => {
    try {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const dy = e.deltaY || 0, dx = e.deltaX || 0;
      if (e.shiftKey) return; // Shift+rueda ya es lateral nativo
      if (Math.abs(dy) <= Math.abs(dx)) return; // gesto ya lateral: no interferir
      const step = (e.deltaMode === 1 ? dy * 16 : dy);
      const max = el.scrollWidth - el.clientWidth;
      if ((step > 0 && el.scrollLeft < max - 1) || (step < 0 && el.scrollLeft > 1)) {
        e.preventDefault();
        el.scrollLeft += step;
      }
    } catch (err) {}
  }, { passive: false });
  return el;
};
// ========== ADMIN SHELL ==========
function renderAdminShell(contentFn) {
  const allNavItems = [
    { id:'admin-attendance', icon:'fingerprint', label:'Checador Empleados', sec:'Personal' },
    { id:'admin-attendance-dash', icon:'layout-dashboard', label:'Dashboard Asistencia', sec:'Personal' },
    { id:'admin-users', icon:'users', label:'Usuarios', sec:'Sistema' },
    { id:'admin-settings', icon:'settings', label:'Config', sec:'Sistema' },
  ];
  // Orden personalizado del cliente (Config → Orden del Menú)
  try{
    const savedOrder = JSON.parse(localStorage.getItem('pos_admin_nav_order') || 'null');
    const cloudOrder = (records('config')[0] && records('config')[0].admin_nav_order) || null;
    const order = Array.isArray(savedOrder) && savedOrder.length ? savedOrder : (Array.isArray(cloudOrder) && cloudOrder.length ? cloudOrder : null);
    if(order){
      allNavItems.sort((a,b)=> {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);
        return (ai===-1? 999:ai) - (bi===-1? 999:bi);
      });
    }
  }catch(e){}
  // Secciones personalizadas por pestaña (Config → Orden del Menú): p.ej. mover algo a Restaurante
  try{
    const savedSecs = JSON.parse(localStorage.getItem('pos_admin_nav_sections') || 'null');
    const cloudSecs = (records('config')[0] && records('config')[0].admin_nav_sections) || null;
    const secs = (savedSecs && typeof savedSecs === 'object' && !Array.isArray(savedSecs)) ? savedSecs : (cloudSecs || null);
    const validSecs = ['', 'Personal', 'Restaurante', 'Sistema'];
    if(secs) allNavItems.forEach(n => {
      if (typeof secs[n.id] === 'string' && validSecs.includes(secs[n.id])) n.sec = secs[n.id];
    });
  }catch(e){}

  // Leemos los permisos del usuario de la base de datos (o le damos acceso total por default al admin principal)
  let userPerms = (currentUser && currentUser.raw && currentUser.raw.permissions)
      ? currentUser.raw.permissions
      : allNavItems.map(n => n.id);

  // PARCHE: Si el usuario es el "admin" principal, forzamos a que siempre vea todas las pestañas
  if (currentUser && currentUser.username === 'admin') {
      userPerms = allNavItems.map(n => n.id);
  }
  // MIGRACIÓN: sub-admins que tenían TODAS las pestañas del menú anterior también ven las nuevas
  if (currentUser && currentUser.role === 'admin' && Array.isArray(userPerms) && userPerms.length >= 14) {
      if (!userPerms.includes('admin-attendance')) userPerms = [...userPerms, 'admin-attendance'];
      if (!userPerms.includes('admin-attendance-dash')) userPerms = [...userPerms, 'admin-attendance-dash'];
  }
  // Checador: sin acceso a vistas admin ni reportes (solo su kiosco checker-view)
  if (currentUser && currentUser.role === 'attendance') {
    userPerms = [];
  }

  // Filtramos las pestañas que puede ver (+ sin modo restaurante se ocultan mesas/cocina/propinas/pedidos)
  let navItems = allNavItems.filter(n => userPerms.includes(n.id));

  // Si trata de entrar a un link prohibido guardado en memoria, lo sacamos de ahí
  if (navItems.length > 0 && !navItems.find(n => n.id === currentView)) {
      currentView = navItems[0].id;
      localStorage.setItem('pos_view', currentView);
      setTimeout(render, 0); // Recargamos para evitar errores
      return;
  }

  // Estado colapsado del menú aplicado desde la plantilla (sin parpadeos al navegar)
  // Se guarda en memoria global + localStorage para que NUNCA se reabra al navegar
  if (window.posSidebarCollapsed === undefined) {
    window.posSidebarCollapsed = localStorage.getItem('pos_sidebar_collapsed') === '1';
  }
  const sbCollapsed = window.posSidebarCollapsed;

  app.innerHTML = `
  <div id="admin-root" class="h-full w-full flex flex-col overflow-y-auto overscroll-none fade-in interface-blur-in ${sbCollapsed ? 'sidebar-collapsed' : ''}" style="min-height:100%;">

    <header class="sticky top-0 z-30 bg-surface/70 backdrop-blur-xl border-b border-card/60 px-3 py-3 lg:h-14 flex items-center justify-between shrink-0 w-full gap-2">
      <div class="flex items-center gap-1 sm:gap-3 min-w-0">
        <button id="menu-toggle" class="lg:hidden p-1 shrink-0"><i data-lucide="menu" class="w-5 h-5"></i></button>

        <!-- Contenedor Clicable -->
        <div onclick="window.openAboutModal()" class="flex items-center gap-1 sm:gap-2 cursor-pointer hover:opacity-60 transition ml-1 sm:ml-2.5 min-w-0 flex-1" title="Acerca del sistema">
          <i data-lucide="shopping-bag" class="w-5 h-5 text-accent hidden sm:block shrink-0 biz-logo"></i>
          <span class="font-bold text-base sm:text-lg truncate min-w-0 biz-name">${bizName()}</span>
        </div>

        <span class="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full shrink-0 ml-1 admin-badge">${currentUser && currentUser.role === 'attendance' ? 'Checador' : 'Admin'}</span>
      </div>
      <div class="flex items-center gap-1 sm:gap-2 shrink-0">
        <!-- INDICADOR DE SINCRONIZACIÓN (cloud / cloud-off, estilo iOS) -->
        <button type="button" id="sync-indicator" onclick="window.__syncPing(true)" class="shrink-0 text-muted bg-surface/50 p-1.5 rounded-lg shadow-sm sm:mr-2 border border-card" title="Sincronizado con la nube">
          <i data-lucide="cloud" class="w-4 h-4 pointer-events-none"></i>
        </button>

        <button type="button" class="theme-toggle text-muted hover:text-accent transition bg-surface/50 p-1.5 rounded-lg shadow-sm sm:mr-2 border border-card" onclick="window.setThemeMode(window.themeMode==='dark'?'light':'dark')" title="Modo oscuro / claro">
          <i class="w-4 h-4 pointer-events-none" data-lucide="${window.themeMode==='dark'?'moon':'sun'}"></i>
        </button>

        <div class="hidden sm:flex items-center gap-1.5 text-sm font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-lg border border-accent/20 shadow-sm">
          <i data-lucide="clock" class="w-4 h-4"></i>
          <span id="global-clock" class="w-[13.5rem] text-center whitespace-nowrap font-mono">--:--:-- --</span>
        </div>

        <button id="logout-btn" class="text-muted hover:text-danger transition flex items-center gap-1 text-sm shrink-0"><i data-lucide="log-out" class="w-4 h-4"></i><span class="hidden sm:inline">Salir</span></button>
      </div>
    </header>

    <div class="flex flex-1 w-full">
     <!-- Fondo oscuro del menú (solo móvil) -->
     <div id="sidebar-backdrop" class="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[10045] opacity-0 pointer-events-none"></div>
     <nav id="sidebar" class="fixed top-0 bottom-0 left-0 z-[10050] bg-surface/70 backdrop-blur-xl border-r border-card/60 w-56 flex flex-col -translate-x-full lg:sticky lg:top-14 lg:translate-x-0 lg:self-start lg:h-[calc(100dvh-3.5rem)] lg:shrink-0 ${sbCollapsed ? 'sidebar-collapsed' : ''}">
        <!-- Lista de botones (con scroll si hay muchos) -->
        <div class="p-3 space-y-1 flex-1 overflow-y-auto no-scrollbar nav-list">
          ${(() => { let __lastSec = null; return navItems.map(n => {
            const __sec = n.sec || '';
            let __head = '';
            if (__sec && __sec !== __lastSec) { __lastSec = __sec; __head = `<div class="nav-section"><span>${__sec}</span></div>`; }
            return __head + `
            <button data-nav="${n.id}" title="${n.label}" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${currentView===n.id ? 'bg-accent/20 text-accent font-semibold active-nav' : 'text-muted hover:text-txt hover:bg-card'}">
              <i data-lucide="${n.icon}" class="w-4 h-4 shrink-0"></i><span class="nav-label">${n.label}</span><span class="nav-dot"></span>
            </button>`; }).join(''); })()}
        </div>

        <!-- USUARIO EN SESIÓN + INSIGNIA DE VERSIÓN (Ancladas al fondo) -->
        <div class="p-3 mt-auto shrink-0 border-t border-card/60 space-y-2">
          <!-- INDICADOR DE SESIÓN ACTIVA -->
          <div class="flex items-center gap-2.5 bg-card/40 border border-card/80 rounded-xl py-2 px-3 shadow-sm session-chip" title="En sesión: ${currentUser.name || currentUser.username}">
            <div class="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center font-black text-base uppercase shrink-0 shadow avatar">${(currentUser.name || currentUser.username || '?').charAt(0).toUpperCase()}</div>
            <div class="leading-tight min-w-0 flex-1 side-text">
              <div class="text-xs font-bold text-txt truncate">${currentUser.name || currentUser.username}</div>
              <div class="text-[10px] text-muted">${currentUser.role === 'admin' ? 'Administrador' : (currentUser.role === 'attendance' ? 'Checador' : (currentUser.role === 'employee' ? 'Empleado' : 'Administrador'))}</div>
            </div>
            <div class="w-2 h-2 rounded-full bg-success animate-pulse shrink-0 side-dot" title="En línea"></div>
          </div>

          <!-- INSIGNIA DE VERSIÓN -->
          <div class="flex items-center justify-center gap-2 bg-card/30 border border-card/80 rounded-xl py-2 px-3 text-muted/80 hover:text-accent transition cursor-default shadow-sm version-chip" title="CHECK DY V 0.27">
            <i data-lucide="fingerprint" class="w-3.5 h-3.5"></i>
            <span class="text-[10px] font-black tracking-[0.2em] uppercase nav-label">CHECK DY V 0.27</span>
          </div>
        </div>
      </nav>

      <!-- BOTÓN FLOTANTE: COLAPSAR / EXPANDIR MENÚ (solo PC). Vive debajo del header,
         en el borde superior del sidebar: NUNCA se superpone al nombre del negocio. -->
      <button id="sidebar-collapse-btn" class="hidden lg:flex fixed z-[10049] w-7 h-7 bg-surface border border-card rounded-full shadow-md items-center justify-center text-muted hover:text-accent hover:bg-card transition-colors duration-200 ${sbCollapsed ? 'sb-collapsed' : ''}" title="${sbCollapsed ? 'Expandir menú' : 'Colapsar menú'}">
        <i data-lucide="${sbCollapsed ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4 pointer-events-none"></i>
      </button>

      <main id="admin-content" class="flex-1 overflow-x-hidden p-4 md:p-6 w-full max-w-full"></main>

    </div>

  </div>`;

  try { window.__hScrollBar(document.querySelector('#admin-root > header')); } catch (e) {}

  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => {
      currentView = btn.dataset.nav;
      localStorage.setItem('pos_view', currentView);
      // Cerramos el menú móvil si estaba abierto
      document.getElementById('sidebar')?.classList.remove('sidebar-open');
      document.getElementById('sidebar-backdrop')?.classList.remove('sidebar-open');
      render();
    };
  });

  document.getElementById('logout-btn').onclick = () => {
    currentUser = null; currentView = 'login';
    localStorage.removeItem('pos_user'); localStorage.setItem('pos_view', 'login');
    render();
  };

  document.getElementById('menu-toggle').onclick = () => {
    const sb = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const isOpen = sb.classList.toggle('sidebar-open');
    backdrop.classList.toggle('sidebar-open', isOpen);
    const icon = document.querySelector('#menu-toggle i');
    icon.dataset.lucide = isOpen ? 'x' : 'menu';
    lucide.createIcons();
  };
  document.getElementById('sidebar-backdrop').onclick = () => {
    const sb = document.getElementById('sidebar');
    if (sb.classList.contains('sidebar-open')) {
      sb.classList.remove('sidebar-open');
      document.getElementById('sidebar-backdrop').classList.remove('sidebar-open');
      const icon = document.querySelector('#menu-toggle i');
      icon.dataset.lucide = 'menu';
      lucide.createIcons();
    }
  };

  // === COLAPSAR / EXPANDIR MENÚ LATERAL (solo PC) ===
  const sbCollapseBtn = document.getElementById('sidebar-collapse-btn');
  const applyCollapsedIcon = (collapsed) => {
    const icon = sbCollapseBtn.querySelector('i');
    icon.dataset.lucide = collapsed ? 'chevron-right' : 'chevron-left';
    lucide.createIcons();
  };
  sbCollapseBtn.onclick = () => {
    const sb = document.getElementById('sidebar');
    const collapsed = sb.classList.toggle('sidebar-collapsed');
    window.posSidebarCollapsed = collapsed;
    document.getElementById('admin-root').classList.toggle('sidebar-collapsed', collapsed);
    sbCollapseBtn.classList.toggle('sb-collapsed', collapsed);
    sbCollapseBtn.title = collapsed ? 'Expandir menú' : 'Colapsar menú';
    applyCollapsedIcon(collapsed);
    localStorage.setItem('pos_sidebar_collapsed', collapsed ? '1' : '0');
  };

  contentFn(document.getElementById('admin-content'));
  lucide.createIcons();

  // ---> AQUÍ LLAMAS AL RELOJ <---
  updateGlobalClock();
}

// Escapa texto libre (notas de artículos) para pintarlo en HTML sin romper nada
window.escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ========== CHECADOR DE EMPLEADOS (entradas/salidas + QR + reportes) ==========
// Payload del QR por empleado: POS-ATT:<username>
function attendancePayload(username) { return 'POS-ATT:' + String(username || '').trim(); }
function parseAttendanceQr(txt) {
  try {
    const s = String(txt || '').trim();
    if (!s) return null;
    if (s.indexOf('POS-ATT:') === 0) return s.slice(8).trim() || null;
    // Compat: si escanearon el puro username también vale
    const us = (typeof getUsers === 'function' ? getUsers() : []);
    if (us.some(u => u.username === s)) return s;
    return null;
  } catch (e) { return null; }
}
function attLocalDateStr(d) {
  try {
    const x = d ? new Date(d) : new Date();
    const y = x.getFullYear(), m = String(x.getMonth() + 1).padStart(2, '0'), dd = String(x.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  } catch (e) {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  }
}
function attTimeHM(iso) {
  try {
    if (!iso) return '--:--';
    const d = new Date(iso);
    let h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'p.m.' : 'a.m.';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ap;
  } catch (e) { return '--:--'; }
}
function attTime24(iso) {
  try {
    if (!iso) return '';
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  } catch (e) { return ''; }
}
function getAttendanceRecords() {
  try { return records('attendance').slice(); } catch (e) { return []; }
}
function attendanceOpenFor(username) {
  try {
    const rs = getAttendanceRecords().filter(r => String(r.employee_username) === String(username) && !r.check_out);
    rs.sort((a, b) => new Date(b.check_in || b.date) - new Date(a.check_in || a.date));
    return rs[0] || null;
  } catch (e) { return null; }
}
function attendanceHours(check_in, check_out) {
  try {
    if (!check_in || !check_out) return 0;
    const ms = new Date(check_out) - new Date(check_in);
    if (isNaN(ms) || ms < 0) return 0;
    return ms / 3600000;
  } catch (e) { return 0; }
}
function attendanceFmtHours(h) {
  try {
    h = Number(h) || 0;
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    if (hh === 0) return mm + ' min';
    if (mm === 0) return hh + ' h';
    return hh + ' h ' + mm + ' min';
  } catch (e) { return '—'; }
}
// Conteo animado premium para los números del Dashboard (respeta reduced-motion)
window.animateCountUp = (el, target, fmt) => {
  try {
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const format = (v) => fmt === 'hours' ? attendanceFmtHours(v) : String(Math.round(v));
    if (reduce) { el.textContent = format(target); return; }
    const dur = 950, t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = format(target * e);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch (e) { try { el.textContent = fmt === 'hours' ? attendanceFmtHours(target) : target; } catch (_e) {} }
};
window.animateCountUpAll = (root) => {
  try {
    const els = (root || document).querySelectorAll('[data-count]');
    els.forEach((el, i) => {
      const target = parseFloat(el.dataset.count) || 0;
      setTimeout(() => window.animateCountUp(el, target, el.dataset.fmt || 'int'), i * 70);
    });
  } catch (e) {}
};
function attendanceSchedFor(username) {
  try {
    const u = getUsers().find(x => x.username === username);
    if (u && u.sched_enabled && u.sched_start) return u.sched_start;
    return '09:00';
  } catch (e) { return '09:00'; }
}
function attendanceTolerance() {
  try {
    const cfg = (typeof records === 'function' && records('config')[0]) || {};
    let v = cfg.attendance_tolerance;
    if (v === undefined || v === null || v === '') v = (typeof defaultConfig !== 'undefined' && defaultConfig.attendance_tolerance !== undefined) ? defaultConfig.attendance_tolerance : 10;
    v = parseInt(v, 10);
    if (isNaN(v)) v = 10;
    return Math.min(120, Math.max(0, v));
  } catch (e) { return 10; }
}
function attendanceLeaveDaysFor(username) {
  try {
    const u = getUsers().find(x => String(x.username) === String(username));
    const arr = (u && u.leave_days) || [];
    return Array.isArray(arr) ? arr.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d))) : [];
  } catch (e) { return []; }
}
function attendanceIsExcused(username, dateStr) {
  try {
    if (!username || !dateStr) return false;
    const ds = String(dateStr).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return false;
    return attendanceLeaveDaysFor(username).includes(ds);
  } catch (e) { return false; }
}
function attendanceIsLate(check_inISO, username) {
  try {
    if (!check_inISO) return false;
    const d = new Date(check_inISO);
    if (isNaN(d)) return false;
    // Día con permiso: nunca cuenta como retardo
    try { const ds = attLocalDateStr(d); if (attendanceIsExcused(username, ds)) return false; } catch (_e) {}
    const sched = attendanceSchedFor(username);
    const m = String(sched || '').match(/^(\d{1,2}):(\d{2})/);
    if (!m) return false;
    const mins = d.getHours() * 60 + d.getMinutes();
    const base = (+m[1]) * 60 + (+m[2]);
    return mins > base + attendanceTolerance();
  } catch (e) { return false; }
}
function attendanceRoleLabel(r) {
  return r === 'admin' ? 'Admin' : (r === 'attendance' ? 'Checador' : (r === 'employee' ? 'Empleado' : 'Admin'));
}
function attendanceFichables() {
  try {
    // Solo empleados fichables: fuera admin y fuera cuentas operadoras de checador (rol attendance).
    return getUsers().filter(u => !u.disabled && u.username !== 'admin' && u.role !== 'attendance');
  } catch (e) { return []; }
}
// Rol que no se cuenta en asistencia (el operador del kiosco no es empleado a trackear).
// Fichaje central (usado por admin y por vista checador). method: manual|qr|pin
window.attendanceToggle = async (username, method) => {
  const uname = String(username || '').trim();
  if (!uname) return;
  // Las cuentas operadoras de checador (rol attendance) no fichan: no se cuentan como empleados.
  try {
    const uu = (typeof getUsers === 'function' ? getUsers().find(x => String(x.username) === uname) : null);
    if (uu && uu.role === 'attendance') { showToast('Esa cuenta es operadora del checador, no fichaje de empleado', 'warn'); return; }
  } catch (e) {}
  const open = attendanceOpenFor(uname);
  if (open) await window.attendanceClockOut(uname, method || 'manual');
  else await window.attendanceClockIn(uname, method || 'manual');
};
window.attendanceClockIn = async (username, method) => {
  const uname = String(username || '').trim();
  if (!uname) return;
  if (attendanceOpenFor(uname)) { showToast('Ya tiene entrada abierta', 'warn'); return; }
  const us = attendanceFichables();
  const emp = us.find(u => u.username === uname) || (typeof getUsers === 'function' ? getUsers().find(u => u.username === uname) : null);
  const iso = new Date().toISOString();
  const rec = {
    type: 'attendance',
    employee_username: uname,
    employee_name: (emp && (emp.name || emp.username)) || uname,
    employee_role: (emp && emp.role) || 'cashier',
    date: attLocalDateStr(new Date()),
    check_in: iso,
    check_out: null,
    check_in_by: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) || 'sistema',
    check_out_by: '',
    method_in: method || 'manual',
    method_out: '',
    note_in: '',
    note_out: '',
    sched_ref: attendanceSchedFor(uname),
    status: 'open',
    date_created: iso
  };
  // Optimista en memoria para respuesta inmediata (en kiosco se omite el render
  // intermedio para no reiniciar la cámara dos veces por cada escaneo).
  const tmpId = 'tmp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  try { allRecords.push({ id: tmpId, ...rec }); } catch (e) {}
  if (typeof attKioskViews !== 'function' || !attKioskViews()) { try { render(); } catch (e) {} }
  const res = await dbSdk.create(rec);
  try {
    const idx = allRecords.findIndex(r => r.id === tmpId);
    if (idx > -1) allRecords.splice(idx, 1);
  } catch (e) {}
  if (res && res.isOk) {
    showToast('Entrada registrada: ' + (rec.employee_name || uname) + ' · ' + attTimeHM(iso), 'success');
    render();
  } else {
    showToast('No se pudo guardar la entrada', 'error');
    render();
  }
};
window.attendanceClockOut = async (username, method) => {
  const uname = String(username || '').trim();
  const open = attendanceOpenFor(uname);
  if (!open || !open.id || String(open.id).startsWith('tmp_')) { showToast('Sin entrada abierta', 'warn'); return; }
  const iso = new Date().toISOString();
  const hrs = attendanceHours(open.check_in, iso);
  // Optimista (en kiosco se omite el render intermedio para no reiniciar la cámara dos veces por cada escaneo).
  try {
    const i = allRecords.findIndex(r => r.id === open.id);
    if (i > -1) allRecords[i] = { ...allRecords[i], check_out: iso, status: 'closed', check_out_by: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) || 'sistema', method_out: method || 'manual', hours: hrs };
  } catch (e) {}
  if (typeof attKioskViews !== 'function' || !attKioskViews()) { try { render(); } catch (e) {} }
  const res = await dbSdk.update({ ...open, check_out: iso, check_out_by: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) || 'sistema', method_out: method || 'manual', status: 'closed', hours: hrs });
  if (res && res.isOk) {
    showToast('Salida registrada: ' + (open.employee_name || uname) + ' · ' + attendanceFmtHours(hrs), 'success');
    render();
  } else {
    showToast('No se pudo guardar la salida', 'error');
    render();
  }
};
window.attendanceShowQr = (username) => {
  const uname = String(username || '');
  const emp = (typeof getUsers === 'function' ? getUsers().find(u => u.username === uname) : null);
  const payload = attendancePayload(uname);
  let img = '';
  try { img = (typeof qrMenuDataUrl === 'function') ? qrMenuDataUrl(payload, 6) : ''; } catch (e) {}
  document.getElementById('attendance-qr-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'attendance-qr-modal';
  modal.className = 'fixed inset-0 z-[10070] flex items-center justify-center p-4';
  modal.style.background = 'rgba(0,0,0,.6)';
  const esc = (window.escHtml ? window.escHtml : (s => String(s || '')));
  modal.innerHTML =
    '<div class="bg-surface border border-card rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden fade-in">' +
      '<div class="px-4 py-3 border-b border-card text-center">' +
        '<div class="font-black text-lg">' + esc((emp && emp.name) || uname) + '</div>' +
        '<div class="text-[11px] text-muted">@' + esc(uname) + ' · ' + esc(attendanceRoleLabel((emp && emp.role) || '')) + '</div>' +
        '<div class="text-[11px] text-muted mt-0.5">Escanea para fichar entrada / salida</div>' +
      '</div>' +
      '<div class="p-4 flex justify-center bg-white">' +
        (img ? '<img src="' + img + '" class="w-52 h-52 object-contain">' : '<div class="text-xs text-muted">QR no disponible</div>') +
      '</div>' +
      '<div class="px-4 py-2 text-center font-mono text-[11px] bg-card/40 border-t border-card break-all select-all">' + esc(payload) + '</div>' +
      '<div class="p-3 flex gap-2">' +
        '<button id="att-qr-copy" class="flex-1 bg-accent/10 border border-accent/20 text-accent px-3 py-2 rounded-lg text-xs font-bold hover:bg-accent/20 transition">Copiar</button>' +
        '<button id="att-qr-down" class="flex-1 bg-accent text-white px-3 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition">Descargar PNG</button>' +
        '<button id="att-qr-close" class="flex-1 bg-card border border-card text-muted px-3 py-2 rounded-lg text-xs font-bold hover:text-txt transition">Cerrar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
  const close = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.querySelector('#att-qr-close').onclick = close;
  modal.querySelector('#att-qr-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(payload); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = payload; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_e) {}
      ta.remove();
    }
    showToast('Código copiado', 'success');
  };
  modal.querySelector('#att-qr-down').onclick = () => {
    try {
      const url = (typeof qrMenuDataUrl === 'function') ? qrMenuDataUrl(payload, 8) : img;
      if (!url) return showToast('No se pudo generar el QR', 'error');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'QR-EMPLEADO-' + String(uname).replace(/[^a-zA-Z0-9_-]/g, '') + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      showToast('QR descargado', 'success');
    } catch (e) { showToast('No se pudo descargar', 'error'); }
  };
};
// Scanner QR para fichaje (reutiliza html5-qrcode como el verificador de precio)
window.attendanceScanQr = async (onDetect) => {
  if (!(await window.ensureScannerLib())) return null;
  document.getElementById('attendance-scan-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'attendance-scan-modal';
  modal.className = 'fixed inset-0 z-[10070] flex items-center justify-center p-4';
  modal.style.background = 'rgba(0,0,0,.75)';
  modal.innerHTML =
    '<div class="bg-surface border border-card rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-card flex items-center justify-between">' +
        '<div class="font-bold text-sm flex items-center gap-2"><i data-lucide="qr-code" class="w-4 h-4 text-accent"></i> Escanear QR de empleado</div>' +
        '<button id="att-scan-close" class="p-1.5 rounded-lg hover:bg-card text-muted"><i data-lucide="x" class="w-4 h-4 pointer-events-none"></i></button>' +
      '</div>' +
      '<div class="p-3"><div id="att-reader" class="w-full rounded-xl overflow-hidden bg-black min-h-[240px]"></div>' +
      '<p class="text-[11px] text-muted text-center mt-2">Apunta al QR del gafete del empleado.<br>También puedes escribir el usuario abajo.</p>' +
      '<div class="flex gap-2 mt-2"><input id="att-scan-manual" placeholder="usuario (ej. cajero2)" class="flex-1 bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"><button id="att-scan-go" class="bg-accent text-white text-sm font-bold px-4 py-2 rounded-lg">Fichar</button></div></div>' +
    '</div>';
  document.body.appendChild(modal);
  if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
  let html5 = null, closed = false;
  const cleanup = async () => {
    if (closed) return; closed = true;
    try { if (html5) await html5.stop(); } catch (e) {}
    try { if (html5) html5.clear(); } catch (e) {}
    modal.remove();
  };
  modal.querySelector('#att-scan-close').onclick = cleanup;
  modal.onclick = (e) => { if (e.target === modal) cleanup(); };
  const manualGo = async () => {
    const v = modal.querySelector('#att-scan-manual').value.trim();
    const u = parseAttendanceQr(v) || v;
    if (!u) return showToast('Escribe un usuario válido', 'warn');
    const exists = (typeof getUsers === 'function' ? getUsers().some(x => x.username === u) : false);
    if (!exists) return showToast('Empleado no encontrado: ' + u, 'error');
    await cleanup();
    if (onDetect) onDetect(u); else window.attendanceToggle(u, 'qr');
  };
  modal.querySelector('#att-scan-go').onclick = manualGo;
  modal.querySelector('#att-scan-manual').onkeydown = (e) => { if (e.key === 'Enter') manualGo(); };
  try {
    const perm = window.__ensureCameraPermission ? await window.__ensureCameraPermission() : 'granted';
    if (perm !== 'granted' && perm !== undefined) {
      if (window.scanFromNativeCamera) {
        window.scanFromNativeCamera(async (text) => {
          const u = parseAttendanceQr(text);
          if (!u) return showToast('QR no válido de empleado', 'error');
          await cleanup();
          if (onDetect) onDetect(u); else window.attendanceToggle(u, 'qr');
        }, () => {}, 'att-reader');
        return;
      }
    }
    html5 = new Html5Qrcode('att-reader');
    const cfg = { fps: 10, qrbox: { width: 230, height: 230 } };
    const startWith = (constraints) => {
      html5.start(constraints, cfg, async (decoded) => {
        const u = parseAttendanceQr(decoded);
        if (!u) { showToast('QR no válido de empleado', 'warn'); return; }
        try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) {}
        await cleanup();
        if (onDetect) onDetect(u); else window.attendanceToggle(u, 'qr');
      }, () => {}).catch(() => {
        if (constraints) { startWith(undefined); return; }
        if (window.scanFromNativeCamera) window.scanFromNativeCamera(async (text) => {
          const u = parseAttendanceQr(text);
          if (u) { await cleanup(); if (onDetect) onDetect(u); else window.attendanceToggle(u, 'qr'); }
        }, () => {}, 'att-reader');
      });
    };
    startWith({ facingMode: 'environment' });
  } catch (e) {}
};
// Escáner SIEMPRE ACTIVO para el checador (panel lateral fijo, sin botón ni modal).
// Pensado para equipo sin touch/mouse: cámara continua + lector USB (teclado) + entrada manual.
window.__attLive = window.__attLive || { html5: null, running: false, lastCode: '', lastAt: 0, keyBuf: '', keyTimer: null, recent: [], starting: false };
window.attendanceLiveStop = async (full) => {
  const L = window.__attLive;
  L.gen = (L.gen || 0) + 1; // invalida arranques en curso atados al DOM anterior
  L.starting = false;
  try { if (L.clearTimer) { clearTimeout(L.clearTimer); L.clearTimer = null; } } catch (e) {}
  try { delete L.lastHtml; delete L.lastCls; } catch (e) {}
  try {
    if (L.html5) { try { await L.html5.stop(); } catch (e) {} try { L.html5.clear(); } catch (e) {} }
  } catch (e) {}
  L.html5 = null; L.running = false;
  try { if (window.__attFocusTimer) { clearInterval(window.__attFocusTimer); window.__attFocusTimer = null; } } catch (e) {}
  try { if (L.focusBlur) { L.focusBlur = null; } } catch (e) {}
  // Al salir de la vista sí quitamos el lector USB; en re-renders del mismo checador se conserva.
  if (full !== false) {
    try { if (L.keyTimer) clearTimeout(L.keyTimer); } catch (e) {}
    if (L.onKey) { try { document.removeEventListener('keydown', L.onKey); } catch (e) {} L.onKey = null; }
  }
};
// Foco pesado: el campo del lector USB / escribir usuario siempre con foco en el kiosco.
window.attendanceLiveFocus = (select) => {
  try {
    if (typeof currentView !== 'undefined' && currentView !== 'checker-view' && currentView !== 'admin-attendance') return;
    const inp = document.getElementById('ck-live-manual');
    if (!inp) return;
    if (document.activeElement === inp && !select) return;
    try { inp.focus({ preventScroll: true }); } catch (e) { try { inp.focus(); } catch (_e) {} }
    if (select) { try { inp.select(); } catch (e) {} }
  } catch (e) {}
};
window.attendanceLiveLog = (username, ok) => {
  try {
    const box = document.getElementById('ck-live-log');
    if (!box) return;
    const emp = (typeof getUsers === 'function' ? getUsers().find(u => u.username === username) : null);
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg border ' + (ok ? 'bg-success/10 border-success/25 text-success' : 'bg-danger/10 border-danger/25 text-danger');
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
    div.textContent = hh + ' · ' + (ok ? ((emp && (emp.name || username)) || username) : ('No válido: ' + username));
    box.prepend(div);
    while (box.children.length > 6) box.lastChild.remove();
    const empty = box.querySelector('[data-live-empty]');
    if (empty) empty.remove();
  } catch (e) {}
};
window.attendanceLiveHandle = async (raw) => {
  const L = window.__attLive;
  const nowMs = Date.now();
  const u = parseAttendanceQr(raw);
  if (!u) { window.attendanceLiveLog(String(raw || '').slice(0, 24), false); showToast('QR no válido de empleado', 'warn'); return; }
  if (u === L.lastCode && (nowMs - L.lastAt) < 3000) return; // anti-doble lectura del mismo gafete
  L.lastCode = u; L.lastAt = nowMs;
  const exists = (typeof getUsers === 'function' ? getUsers().some(x => x.username === u) : false);
  if (!exists) { window.attendanceLiveLog(u, false); showToast('Empleado no encontrado: ' + u, 'error'); return; }
  try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) {}
  // 1er escaneo = ENTRADA (no hay turno abierto), 2do escaneo = SALIDA (ya hay turno abierto)
  const wasOpen = !!attendanceOpenFor(u);
  try {
    const last = document.getElementById('ck-live-last');
    if (last) {
      const emp = getUsers().find(x => x.username === u);
      const nm = String((emp && (emp.name || u)) || u);
      const hr = new Date().toLocaleTimeString('es-MX');
      if (wasOpen) {
        const op = attendanceOpenFor(u);
        let extra = '';
        try { if (op && op.check_in) extra = ' · ' + attendanceFmtHours(attendanceHours(op.check_in, new Date().toISOString())); } catch (e) {}
        last.innerHTML = '<div class="text-3xl font-black tracking-wide">SALIDA</div><div class="font-bold text-base mt-1">' + nm + '</div><div class="text-[12px] opacity-80">' + hr + extra + '</div><div class="text-[11px] opacity-70 mt-1">2do escaneo = salida ✓</div>';
        last.className = 'rounded-2xl px-4 py-4 text-center font-bold bg-orange-500/15 text-orange-400 border-2 border-orange-500/40';
      } else {
        last.innerHTML = '<div class="text-3xl font-black tracking-wide">ENTRADA</div><div class="font-bold text-base mt-1">' + nm + '</div><div class="text-[12px] opacity-80">' + hr + '</div><div class="text-[11px] opacity-70 mt-1">1er escaneo = entrada ✓</div>';
        last.className = 'rounded-2xl px-4 py-4 text-center font-bold bg-success/15 text-success border-2 border-success/40';
      }
    }
  } catch (e) {}
  try {
    L.recent = L.recent || [];
    L.recent.unshift({ u, t: Date.now(), ok: true });
    L.recent = L.recent.slice(0, 6);
    const lastBox = document.getElementById('ck-live-last');
    if (lastBox) { L.lastHtml = lastBox.innerHTML; L.lastCls = lastBox.className; }
    // El resultado se limpia solo a los 8 s para dejar el kiosco listo al siguiente empleado.
    try { if (L.clearTimer) clearTimeout(L.clearTimer); } catch (e) {}
    L.clearTimer = setTimeout(() => {
      try {
        delete L.lastHtml; delete L.lastCls;
        try { L.recent = []; } catch (e) {}
        const box = document.getElementById('ck-live-last');
        if (box) {
          box.className = 'mt-2 w-full max-w-md rounded-2xl px-4 py-5 text-center bg-card/40 border-2 border-dashed border-card';
          box.innerHTML = '<div class="text-2xl font-black">ACERCA TU QR</div><div class="text-xs text-muted mt-1">Pasa tu gafete frente al escáner · sin tocar nada</div>';
        }
        const log = document.getElementById('ck-live-log');
        if (log) log.innerHTML = '<div data-live-empty class="text-[11px] text-muted text-center py-2">Sin fichajes aún.</div>';
      } catch (e) {}
    }, 8000);
  } catch (e) {}
  window.attendanceLiveLog(u, true);
  await window.attendanceToggle(u, 'qr');
};
window.attendanceLiveStart = async () => {
  const L = window.__attLive;
  // Generación: cada arranque invalida al anterior. Así, si un fichaje dispara 2 renders
  // seguidos (optimista + confirmado), el arranque viejo atado a un DOM ya destruido
  // nunca pisa al nuevo: solo la última generación toca UI/cámara.
  const myGen = (L.gen = (L.gen || 0) + 1);
  const alive = () => L.gen === myGen && !!document.getElementById('ck-live-reader');
  // Cerramos instancia previa (puede estar atada a un DOM destruido por un render) sin quitar el lector USB.
  try { if (L.html5) { const h = L.html5; L.html5 = null; try { await h.stop(); } catch (_e) {} try { h.clear(); } catch (_e) {} } } catch (e) {}
  if (!alive()) return;
  L.starting = true; L.running = true;
  // No reseteamos lastCode/lastAt aquí para mantener el anti-doble entre re-renders.
  const setStatus = (txt, ok) => {
    if (L.gen !== myGen) return;
    const el = document.getElementById('ck-live-status');
    if (!el) return;
    el.innerHTML = '<span class="w-2 h-2 rounded-full inline-block ' + (ok === false ? 'bg-danger' : 'bg-success animate-pulse') + '"></span> ' + txt;
  };
  setStatus('Iniciando cámara…');
  // Lector USB / pistola: escribe rapidísimo y termina con Enter. Lo capturamos a nivel documento
  // para que funcione sin touch ni mouse y sin tener foco en un campo.
  if (!L.onKey) {
    L.onKey = (e) => {
      try {
        if (currentView !== 'checker-view' && currentView !== 'admin-attendance') return;
        if (e.key === 'Enter') {
          const buf = String(L.keyBuf || '').trim();
          L.keyBuf = '';
          if (buf.length >= 3) {
            const u = parseAttendanceQr(buf) || buf;
            const exists = (typeof getUsers === 'function' ? getUsers().some(x => x.username === u) : false);
            if (exists || String(buf).indexOf('POS-ATT:') === 0) {
              e.preventDefault();
              window.attendanceLiveHandle(buf);
            }
          }
          return;
        }
        if (e.key && e.key.length === 1) {
          L.keyBuf = String(L.keyBuf || '') + e.key;
          if (String(L.keyBuf).length > 64) L.keyBuf = String(L.keyBuf).slice(-64);
          try { if (L.keyTimer) clearTimeout(L.keyTimer); } catch (_e) {}
          L.keyTimer = setTimeout(() => { L.keyBuf = ''; }, 600);
        }
      } catch (_e) {}
    };
    try { document.addEventListener('keydown', L.onKey); } catch (e) {}
  }
  try {
    if (!(await window.ensureScannerLib())) { if (L.gen === myGen) { setStatus('Sin cámara — usa lector USB o escribe usuario', false); L.starting = false; } return; }
    const readerId = 'ck-live-reader';
    if (!alive()) { if (L.gen === myGen) { L.running = false; L.starting = false; } return; }
    let perm = 'granted';
    try { perm = window.__ensureCameraPermission ? await window.__ensureCameraPermission() : 'granted'; } catch (e) {}
    if (!alive()) return;
    if (perm !== 'granted' && perm !== undefined) {
      setStatus('Permiso denegado — usa lector USB o escribe usuario', false);
      if (window.scanFromNativeCamera) {
        try { window.scanFromNativeCamera((text) => window.attendanceLiveHandle(text), () => {}, readerId); setStatus('Cámara nativa lista'); } catch (e) {}
      }
      if (L.gen === myGen) L.starting = false;
      return;
    }
    const html5 = new Html5Qrcode(readerId);
    if (!alive()) return;
    L.html5 = html5;
    const cfg = { fps: 12, qrbox: { width: 250, height: 250 } };
    await html5.start({ facingMode: 'environment' }, cfg, (decoded) => { window.attendanceLiveHandle(decoded); }, () => {});
    if (!alive()) return;
    setStatus('Escáner activo — acerca el QR del gafete');
  } catch (e) {
    if (L.gen === myGen) setStatus('Sin cámara — usa lector USB o escribe usuario', false);
  } finally { if (L.gen === myGen) L.starting = false; }
};

// ========== ADMIN: CHECADOR EMPLEADOS (reporte completo) ==========
// Vistas con kiosco de pared (escáner siempre activo + foco pesado USB).
function attKioskViews() {
  try { return currentView === 'checker-view' || currentView === 'admin-attendance'; } catch (e) { return false; }
}
// Rejilla kiosco compartida: reloj gigante + recuadro escáner. Idéntica en vista checador y admin.
function attKioskGridHTML(esc, todayStr, inside, fichCount) {
  return '' +
  '<div class="grid lg:grid-cols-2 gap-3 flex-1 min-h-0">' +
  '<section class="bg-surface border border-card rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center text-center gap-2">' +
    '<div class="text-xs font-black tracking-[0.25em] uppercase text-muted">Hora actual · ' + esc(todayStr) + '</div>' +
    '<div id="checker-clock" class="font-black font-mono leading-none tracking-tight" style="font-size:clamp(3.2rem,9vw,6.5rem)">--:--:--</div>' +
    '<div id="checker-date" class="text-lg md:text-xl font-bold text-muted"></div>' +
    '<div class="text-sm text-muted"><b class="text-success">' + inside + ' dentro</b> · ' + fichCount + ' empleados · <b class="text-txt">1er escaneo = ENTRADA · 2do = SALIDA</b></div>' +
    '<div id="ck-live-last" class="mt-2 w-full max-w-md rounded-2xl px-4 py-5 text-center bg-card/40 border-2 border-dashed border-card"><div class="text-2xl font-black">ACERCA TU QR</div><div class="text-xs text-muted mt-1">Pasa tu gafete frente al escáner · sin tocar nada</div></div>' +
    '<div class="w-full max-w-md mt-2"><h4 class="font-bold text-[11px] uppercase text-muted flex items-center gap-1.5 mb-1.5 justify-center"><i data-lucide="list-checks" class="w-3.5 h-3.5 text-accent"></i> Últimos fichajes</h4>' +
    '<div id="ck-live-log" class="space-y-1.5 max-h-40 overflow-y-auto"><div data-live-empty class="text-[11px] text-muted text-center py-2">Sin fichajes aún.</div></div></div>' +
  '</section>' +
  '<section class="bg-surface text-txt border border-card rounded-3xl overflow-hidden shadow-xl flex flex-col">' +
    '<div class="px-4 py-3 border-b border-card flex items-center justify-between">' +
      '<div class="font-black text-base flex items-center gap-2 text-txt"><i data-lucide="scan-line" class="w-5 h-5 text-success"></i> ESCÁNER QR · siempre activo</div>' +
      '<div id="ck-live-status" class="text-[11px] font-bold text-success flex items-center gap-1.5"><span class="w-2 h-2 rounded-full inline-block bg-success animate-pulse"></span> Iniciando…</div>' +
    '</div>' +
    '<div class="p-3 md:p-4 flex-1 flex flex-col">' +
      '<div id="ck-live-reader" class="w-full flex-1 rounded-2xl overflow-hidden bg-black border border-card" style="min-height:380px"></div>' +
      '<div class="flex gap-2 mt-3"><input id="ck-live-manual" placeholder="lector USB o usuario… (siempre con foco)" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" autofocus class="flex-1 min-w-0 bg-card border-2 border-accent text-txt rounded-xl px-3 py-2.5 text-sm focus:outline-none"><button id="ck-live-go" class="bg-accent text-white text-sm font-bold px-4 py-2 rounded-xl shrink-0">Fichar</button></div>' +
      '<p class="text-[10px] text-muted text-center mt-1.5">Lector tipo pared · cámara + pistola USB · no se cierra nunca</p>' +
    '</div>' +
  '</section>' +
  '</div>';
}
// Cableado común del kiosco: reloj, fichaje manual/USB, foco pesado, historial mini y arranque de cámara.
function wireAttKiosk() {
  const tick = () => {
    const el = document.getElementById('checker-clock');
    if (!el) return;
    try {
      const n = new Date();
      let h = n.getHours(), m = String(n.getMinutes()).padStart(2, '0'), s = String(n.getSeconds()).padStart(2, '0');
      const ap = h >= 12 ? 'p.m.' : 'a.m.';
      h = h % 12 || 12;
      el.textContent = h + ':' + m + ':' + s + ' ' + ap;
      const dEl = document.getElementById('checker-date');
      if (dEl) {
        try { dEl.textContent = n.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'long' }); }
        catch (e) { dEl.textContent = ''; }
      }
    } catch (e) {}
  };
  tick();
  if (window.__checkerClock) { try { clearInterval(window.__checkerClock); } catch (e) {} }
  window.__checkerClock = setInterval(() => {
    if (!document.getElementById('checker-clock')) { try { clearInterval(window.__checkerClock); } catch (e) {} return; }
    tick();
  }, 1000);
  const liveGo = async () => {
    const inp = document.getElementById('ck-live-manual');
    if (!inp) return;
    const v = String(inp.value || '').trim();
    if (!v) { window.attendanceLiveFocus(); return; }
    inp.value = '';
    await window.attendanceLiveHandle(v);
    window.attendanceLiveFocus();
  };
  const liveBtn = document.getElementById('ck-live-go');
  if (liveBtn) {
    try { liveBtn.onmousedown = (e) => { try { e.preventDefault(); } catch (_e) {} }; } catch (e) {}
    liveBtn.onclick = liveGo;
  }
  const liveInp = document.getElementById('ck-live-manual');
  if (liveInp) {
    liveInp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); liveGo(); } };
    try {
      const L = window.__attLive;
      if (L.focusBlur) { try { liveInp.removeEventListener('blur', L.focusBlur); } catch (e) {} }
      L.focusBlur = () => {
        setTimeout(() => {
          try { if (attKioskViews() && document.getElementById('ck-live-manual')) window.attendanceLiveFocus(); } catch (e) {}
        }, 250);
      };
      liveInp.addEventListener('blur', L.focusBlur);
    } catch (e) {}
  }
  try { setTimeout(() => window.attendanceLiveFocus(), 100); } catch (e) {}
  try {
    if (window.__attFocusTimer) clearInterval(window.__attFocusTimer);
    window.__attFocusTimer = setInterval(() => {
      try {
        if (!attKioskViews()) return;
        const inp = document.getElementById('ck-live-manual');
        if (!inp) return;
        if (document.activeElement !== inp) window.attendanceLiveFocus();
      } catch (e) {}
    }, 1500);
  } catch (e) {}
  window.updateSyncIndicator?.();
  try {
    const L = window.__attLive;
    if (L && L.lastHtml) {
      const last = document.getElementById('ck-live-last');
      if (last) { last.innerHTML = L.lastHtml; if (L.lastCls) last.className = L.lastCls; }
    }
    if (L && Array.isArray(L.recent) && L.recent.length) {
      const box = document.getElementById('ck-live-log');
      if (box) {
        box.innerHTML = '';
        L.recent.slice(0, 6).forEach(it => {
          const emp = (typeof getUsers === 'function' ? getUsers().find(u => u.username === it.u) : null);
          const div = document.createElement('div');
          const d = new Date(it.t || Date.now());
          const hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
          div.className = 'flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg border ' + (it.ok ? 'bg-success/10 border-success/25 text-success' : 'bg-danger/10 border-danger/25 text-danger');
          div.textContent = hh + ' · ' + ((emp && (emp.name || it.u)) || it.u);
          box.appendChild(div);
        });
      }
    }
  } catch (e) {}
  try { window.attendanceLiveStart && window.attendanceLiveStart(); } catch (e) {}
}
function renderAttendanceAdmin(container) {
  // Kiosco de pared, igual que la vista del usuario checador: reloj gigante + escáner siempre activo.
  // Historial, resumen y reportes Excel/PDF viven en Dashboard Asistencia. El QR se genera en Usuarios.
  const fichables = attendanceFichables();
  const esc = (window.escHtml ? window.escHtml : (s => String(s == null ? '' : s)));
  const todayStr = attLocalDateStr(new Date());
  let inside = 0;
  try {
    inside = getAttendanceRecords().filter(r => {
      if (!r || r.check_out) return false;
      if (String(r.employee_role || '') === 'attendance') return false;
      const uu = (typeof getUsers === 'function' ? getUsers().find(x => String(x.username) === String(r.employee_username)) : null);
      return !(uu && uu.role === 'attendance');
    }).length;
  } catch (e) { inside = 0; }

  container.innerHTML =
  '<div class="fade-in space-y-4 pb-10 w-full">' +
    '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<div><h2 class="text-xl font-bold flex items-center gap-2"><i data-lucide="fingerprint" class="w-6 h-6 text-accent"></i> Checador de Empleados</h2>' +
      '<p class="text-xs text-muted mt-0.5">Kiosco de pared · 1er escaneo = ENTRADA · 2do = SALIDA · historial y Excel en <b class="text-txt">Dashboard Asistencia</b> · QR en <b class="text-txt">Usuarios</b>.</p></div>' +
      '<div class="flex flex-wrap gap-2">' +
        '<button id="att-manual-btn" class="bg-card border border-card text-muted text-xs font-bold px-3 py-2 rounded-lg hover:text-txt transition flex items-center gap-1.5"><i data-lucide="plus" class="w-4 h-4"></i> Registro manual</button>' +
        '<button id="att-goto-dash" class="bg-accent text-white text-xs font-bold px-4 py-2 rounded-lg hover:opacity-90 transition flex items-center gap-1.5"><i data-lucide="layout-dashboard" class="w-4 h-4"></i> Abrir Dashboard Asistencia</button>' +
      '</div>' +
    '</div>' +
    '<div class="flex-1 w-full min-h-0 flex flex-col">' +
    attKioskGridHTML(esc, todayStr, inside, fichables.length) +
    '</div>' +
  '</div>';
  if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
  wireAttKiosk();
  const manBtn = container.querySelector('#att-manual-btn');
  if (manBtn) manBtn.onclick = () => window.attendanceManualModal();
  const gotoDash = container.querySelector('#att-goto-dash');
  if (gotoDash) gotoDash.onclick = () => { currentView = 'admin-attendance-dash'; try { localStorage.setItem('pos_view', currentView); } catch (e) {} render(); };
}
// ========== DASHBOARD ASISTENCIA (segundo Dashboard: historial + resumen + reportes Excel/PDF) ==========
// El QR de cada empleado se genera en Usuarios (columna Gafete QR). Aquí no hay QR para mantener el operativo limpio.
function renderAttendanceDash(container) {
  const F = (window.__attAdminF = window.__attAdminF || { q: '', emp: 'all', date: attLocalDateStr(new Date()), month: (attLocalDateStr(new Date()).slice(0, 7)) });
  if (!F.rFrom) F.rFrom = (String(F.month || '').slice(0, 7) || attLocalDateStr(new Date()).slice(0, 7)) + '-01';
  if (!F.rTo) F.rTo = attLocalDateStr(new Date());
  // Excluye registros de cuentas operadoras de checador (rol attendance): no son empleados a trackear.
  const __isSkippedAttRec = (r) => {
    try {
      if (String((r && r.employee_role) || '') === 'attendance') return true;
      const uu = (typeof getUsers === 'function' ? getUsers().find(x => String(x.username) === String(r && r.employee_username)) : null);
      if (uu && uu.role === 'attendance') return true;
    } catch (e) {}
    return false;
  };
  const allRec = getAttendanceRecords().sort((a, b) => new Date(b.check_in || b.date_created || 0) - new Date(a.check_in || a.date_created || 0)).filter(r => !__isSkippedAttRec(r));
  const fichables = attendanceFichables();
  const esc = (window.escHtml ? window.escHtml : (s => String(s == null ? '' : s)));
  const todayStr = attLocalDateStr(new Date());
  const todayRec = allRec.filter(r => r.date === todayStr || (!r.check_out && r.check_in && attLocalDateStr(r.check_in) === todayStr));
  const insideNow = allRec.filter(r => !r.check_out);
  const lateToday = todayRec.filter(r => attendanceIsLate(r.check_in, r.employee_username));
  const hrsToday = todayRec.reduce((a, r) => a + attendanceHours(r.check_in, r.check_out || new Date().toISOString()), 0);
  const monthRec = allRec.filter(r => String(r.date || '').slice(0, 7) === F.month || (r.check_in && attLocalDateStr(r.check_in).slice(0, 7) === F.month));
  const hrsMonth = monthRec.reduce((a, r) => a + attendanceHours(r.check_in, r.check_out || (r.date === todayStr ? new Date().toISOString() : null)), 0);
  const tolMins = (typeof attendanceTolerance === 'function' ? attendanceTolerance() : 10);
  const excusedToday = fichables.filter(u => { try { return attendanceIsExcused(u.username, todayStr); } catch (_e) { return false; } });
  const absentToday = fichables.filter(u => !todayRec.some(r => String(r.employee_username) === String(u.username)) && !excusedToday.some(x => String(x.username) === String(u.username)));
  let hist = allRec.slice();
  if (F.emp !== 'all') hist = hist.filter(r => String(r.employee_username) === String(F.emp));
  if (F.date) hist = hist.filter(r => String(r.date) === String(F.date) || (r.check_in && attLocalDateStr(r.check_in) === String(F.date)));
  if (F.q) {
    const q = F.q.toLowerCase();
    hist = hist.filter(r => String(r.employee_name || '').toLowerCase().includes(q) || String(r.employee_username || '').toLowerCase().includes(q));
  }
  hist = hist.slice(0, 300);
  const byEmp = {};
  fichables.forEach(u => {
    let permCount = 0;
    try { (u.leave_days || []).forEach(k => { if (String(k).slice(0, 7) === String(F.month || '').slice(0, 7)) permCount++; }); } catch (_e) {}
    byEmp[u.username] = { user: u, days: new Set(), hrs: 0, lates: 0, opens: 0, perms: permCount };
  });
  monthRec.forEach(r => {
    const k = String(r.employee_username);
    if (!byEmp[k]) {
      const u = (typeof getUsers === 'function' ? getUsers().find(x => x.username === k) : null);
      let pc = 0;
      try { ((u && u.leave_days) || []).forEach(kk => { if (String(kk).slice(0, 7) === String(F.month || '').slice(0, 7)) pc++; }); } catch (_e) {}
      byEmp[k] = { user: u || { username: k, name: r.employee_name || k, role: r.employee_role || 'cashier' }, days: new Set(), hrs: 0, lates: 0, opens: 0, perms: pc };
    }
    byEmp[k].days.add(String(r.date || attLocalDateStr(r.check_in)));
    byEmp[k].hrs += attendanceHours(r.check_in, r.check_out);
    if (!r.check_out) byEmp[k].opens += 1;
    if (attendanceIsLate(r.check_in, k)) byEmp[k].lates += 1;
  });
  const summaryRows = Object.values(byEmp).sort((a, b) => b.hrs - a.hrs);
  container.innerHTML =
  '<div class="fade-in space-y-4 pb-10 w-full">' +
    '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<div><h2 class="text-xl font-bold flex items-center gap-2"><i data-lucide="layout-dashboard" class="w-6 h-6 text-accent"></i> Dashboard Asistencia</h2>' +
      '<p class="text-xs text-muted mt-0.5">Segundo Dashboard · historial y resumen por empleado · QR se genera en <b>Usuarios → Gafete QR</b>.</p></div>' +
      '<div class="flex flex-wrap gap-2">' +
        '<button id="dash-pdf-btn" class="bg-accent text-white text-xs font-bold px-3 py-2 rounded-lg hover:opacity-90 transition flex items-center gap-1.5"><i data-lucide="file-text" class="w-4 h-4"></i> PDF</button>' +
        '<button id="dash-xlsx-btn" class="bg-card border border-card text-muted text-xs font-bold px-3 py-2 rounded-lg hover:text-txt transition flex items-center gap-1.5"><i data-lucide="download" class="w-4 h-4"></i> Excel</button>' +
        '<button id="dash-goto-op" class="bg-card border border-card text-muted text-xs font-bold px-3 py-2 rounded-lg hover:text-txt transition flex items-center gap-1.5"><i data-lucide="fingerprint" class="w-4 h-4"></i> Ir al Checador</button>' +
      '</div>' +
    '</div>' +
    '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">' +
      '<div class="bg-surface border border-card rounded-xl p-3 card-in transition hover:-translate-y-0.5 hover:shadow-lg" style="animation-delay:0ms"><div class="text-[11px] text-muted font-bold uppercase">Presentes hoy</div><div class="text-2xl font-black"><span data-count="' + new Set(todayRec.map(r => r.employee_username)).size + '">0</span></div><div class="text-[11px] text-muted">de ' + fichables.length + '</div></div>' +
      '<div class="bg-surface border border-card rounded-xl p-3 card-in transition hover:-translate-y-0.5 hover:shadow-lg" style="animation-delay:70ms"><div class="text-[11px] text-muted font-bold uppercase">Dentro ahora</div><div class="text-2xl font-black text-success"><span data-count="' + insideNow.length + '">0</span></div><div class="text-[11px] text-muted">turno abierto</div></div>' +
      '<div class="bg-surface border border-card rounded-xl p-3 card-in transition hover:-translate-y-0.5 hover:shadow-lg" style="animation-delay:140ms"><div class="text-[11px] text-muted font-bold uppercase">Retardos hoy</div><div class="text-2xl font-black text-warn"><span data-count="' + lateToday.length + '">0</span></div><div class="text-[11px] text-muted">+' + tolMins + ' min tolerancia</div></div>' +
      '<div class="bg-surface border border-card rounded-xl p-3 card-in transition hover:-translate-y-0.5 hover:shadow-lg" style="animation-delay:210ms"><div class="text-[11px] text-muted font-bold uppercase">Horas hoy</div><div class="text-2xl font-black text-accent"><span data-count="' + hrsToday + '" data-fmt="hours">0 min</span></div><div class="text-[11px] text-muted">acumulado</div></div>' +
      '<div class="bg-surface border border-card rounded-xl p-3 card-in transition hover:-translate-y-0.5 hover:shadow-lg" style="animation-delay:280ms"><div class="text-[11px] text-muted font-bold uppercase">Ausentes hoy</div><div class="text-2xl font-black text-danger"><span data-count="' + absentToday.length + '">0</span></div><div class="text-[11px] text-muted">sin registro' + (excusedToday.length ? ' · <b class="text-success">' + excusedToday.length + ' permiso</b>' : '') + '</div></div>' +
      '<div class="bg-surface border border-card rounded-xl p-3 card-in transition hover:-translate-y-0.5 hover:shadow-lg" style="animation-delay:350ms"><div class="text-[11px] text-muted font-bold uppercase">Permisos hoy</div><div class="text-2xl font-black text-success"><span data-count="' + excusedToday.length + '">0</span></div><div class="text-[11px] text-muted">no cuentan falta</div></div>' +
      '<div class="bg-surface border border-card rounded-xl p-3 card-in transition hover:-translate-y-0.5 hover:shadow-lg" style="animation-delay:420ms"><div class="text-[11px] text-muted font-bold uppercase">Horas mes</div><div class="text-2xl font-black"><span data-count="' + hrsMonth + '" data-fmt="hours">0 min</span></div><div class="text-[11px] text-muted">' + esc(F.month) + '</div></div>' +
    '</div>' +
    '<div class="bg-surface rounded-xl p-4 border border-card space-y-3">' +
      '<h3 class="font-semibold text-accent flex items-center gap-2 text-sm"><i data-lucide="bar-chart-2" class="w-4 h-4"></i> Gráficas de asistencia</h3>' +
      '<div class="grid md:grid-cols-2 gap-3">' +
        '<div class="bg-card/40 border border-card rounded-xl p-3 card-in transition hover:shadow-lg" style="animation-delay:420ms"><div class="flex items-baseline justify-between gap-2 mb-1"><h4 class="font-bold text-xs">Entradas por día · ' + esc(F.month) + '</h4><span class="text-[10px] text-muted" id="att-stat-month"></span></div><div class="h-52"><canvas id="att-chart-month"></canvas></div></div>' +
        '<div class="bg-card/40 border border-card rounded-xl p-3 card-in transition hover:shadow-lg" style="animation-delay:500ms"><div class="flex items-baseline justify-between gap-2 mb-1"><h4 class="font-bold text-xs">Fichajes por hora · hoy</h4><span class="text-[10px] text-muted" id="att-stat-hours"></span></div><div class="h-52"><canvas id="att-chart-hours"></canvas></div></div>' +
        '<div class="bg-card/40 border border-card rounded-xl p-3 card-in transition hover:shadow-lg" style="animation-delay:580ms"><div class="flex items-baseline justify-between gap-2 mb-1"><h4 class="font-bold text-xs">Asistencia diaria · % presente</h4><span class="text-[10px] text-muted" id="att-stat-assist"></span></div><div class="h-52"><canvas id="att-chart-assist"></canvas></div></div>' +
        '<div class="bg-card/40 border border-card rounded-xl p-3 card-in transition hover:shadow-lg" style="animation-delay:660ms"><div class="flex items-baseline justify-between gap-2 mb-1"><h4 class="font-bold text-xs">Puntualidad del mes</h4><span class="text-[10px] text-muted" id="att-stat-late"></span></div><div class="h-52"><canvas id="att-chart-late"></canvas></div></div>' +
      '</div>' +
    '</div>' +
    '<div class="bg-surface rounded-xl p-4 border border-card space-y-3">' +
      '<div class="flex flex-wrap items-center gap-2">' +
        '<h3 class="font-semibold text-accent flex items-center gap-2 text-sm mr-auto"><i data-lucide="history" class="w-4 h-4"></i> Historial (' + hist.length + (allRec.length > 300 ? ' de ' + allRec.length : '') + ')</h3>' +
        '<input id="dash-q" value="' + esc(F.q) + '" placeholder="Buscar empleado..." class="bg-card border border-card rounded-lg px-3 py-1.5 text-xs w-40 focus:border-accent focus:outline-none">' +
        '<select id="dash-emp" class="bg-card border border-card rounded-lg px-2 py-1.5 text-xs focus:border-accent focus:outline-none"><option value="all">Todos</option>' + fichables.map(u => '<option value="' + esc(u.username) + '" ' + (F.emp === u.username ? 'selected' : '') + '>' + esc(u.name || u.username) + '</option>').join('') + '</select>' +
        '<input id="dash-date" type="date" value="' + esc(F.date) + '" class="bg-card border border-card rounded-lg px-2 py-1.5 text-xs focus:border-accent focus:outline-none" title="Filtrar historial por día">' +
        '<label class="text-[11px] text-muted font-bold ml-1">Desde</label><input id="dash-rfrom" type="date" value="' + esc(F.rFrom || '') + '" class="bg-card border border-card rounded-lg px-2 py-1.5 text-xs focus:border-accent focus:outline-none" title="Reporte desde">' +
        '<label class="text-[11px] text-muted font-bold">Hasta</label><input id="dash-rto" type="date" value="' + esc(F.rTo || '') + '" class="bg-card border border-card rounded-lg px-2 py-1.5 text-xs focus:border-accent focus:outline-none" title="Reporte hasta">' +
        '<button id="dash-clear" class="text-[11px] font-bold text-muted hover:text-txt px-2 py-1.5">Limpiar</button>' +
      '</div>' +
      '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-muted text-left text-[11px] uppercase border-b border-card"><th class="p-2">Empleado</th><th class="p-2">Fecha</th><th class="p-2">Entrada</th><th class="p-2">Salida</th><th class="p-2">Horas</th><th class="p-2">Estado</th><th class="p-2 text-right">Acciones</th></tr></thead><tbody>' +
      (hist.length ? hist.map(r => {
        const hrs = attendanceHours(r.check_in, r.check_out);
        const late = attendanceIsLate(r.check_in, r.employee_username);
        const open = !r.check_out;
        let excused = false;
        try { const __ds = String(r.date || (r.check_in ? attLocalDateStr(r.check_in) : '')); excused = attendanceIsExcused(r.employee_username, __ds); } catch (_e) {}
        return '<tr class="border-b border-card/50 hover:bg-card/30">' +
          '<td class="p-2"><div class="font-bold text-[13px]">' + esc(r.employee_name || r.employee_username) + '</div><div class="text-[11px] text-muted">@' + esc(r.employee_username) + '</div></td>' +
          '<td class="p-2 text-xs whitespace-nowrap">' + esc(r.date || attLocalDateStr(r.check_in)) + '</td>' +
          '<td class="p-2 text-xs whitespace-nowrap">' + esc(attTimeHM(r.check_in)) + '<div class="text-[10px] text-muted">' + esc(r.method_in || '') + ' · ' + esc(r.check_in_by || '') + '</div></td>' +
          '<td class="p-2 text-xs whitespace-nowrap">' + (r.check_out ? esc(attTimeHM(r.check_out)) + '<div class="text-[10px] text-muted">' + esc(r.method_out || '') + ' · ' + esc(r.check_out_by || '') + '</div>' : '<span class="text-success font-bold">Dentro</span>') + '</td>' +
          '<td class="p-2 text-xs font-bold whitespace-nowrap">' + (r.check_out ? esc(attendanceFmtHours(hrs)) : esc(attendanceFmtHours(attendanceHours(r.check_in, new Date().toISOString()))) + '…') + '</td>' +
          '<td class="p-2">' + (open ? '<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-success/15 text-success">ABIERTO</span>' : (excused ? '<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-success/15 text-success" title="Día con permiso: no cuenta retardo">PERMISO</span>' : (late ? '<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-warn/15 text-warn">RETARDO</span>' : '<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-accent/15 text-accent">A TIEMPO</span>'))) + '</td>' +
          '<td class="p-2 text-right whitespace-nowrap"><div class="inline-flex gap-1">' +
            (open ? '<button data-dash-close="' + esc(r.id) + '" class="p-1.5 bg-danger/10 text-danger rounded-lg hover:bg-danger hover:text-white transition" title="Marcar salida ahora"><i data-lucide="log-out" class="w-3.5 h-3.5 pointer-events-none"></i></button>' : '') +
            '<button data-dash-edit="' + esc(r.id) + '" class="p-1.5 bg-warn/10 text-warn rounded-lg hover:bg-warn hover:text-white transition" title="Corregir"><i data-lucide="pencil" class="w-3.5 h-3.5 pointer-events-none"></i></button>' +
            '<button data-dash-del="' + esc(r.id) + '" class="p-1.5 bg-danger/10 text-danger rounded-lg hover:bg-danger hover:text-white transition" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i></button>' +
          '</div></td></tr>';
      }).join('') : '<tr><td colspan="7" class="p-6 text-center text-xs text-muted">Sin registros para este filtro.</td></tr>') +
      '</tbody></table></div>' +
    '</div>' +
    '<div class="bg-surface rounded-xl p-4 border border-card space-y-3">' +
      '<div class="flex flex-wrap items-center gap-2"><h3 class="font-semibold text-accent flex items-center gap-2 text-sm mr-auto"><i data-lucide="bar-chart-3" class="w-4 h-4"></i> Resumen por empleado</h3>' +
      '<input id="dash-month" type="month" value="' + esc(F.month) + '" class="bg-card border border-card rounded-lg px-2 py-1.5 text-xs focus:border-accent focus:outline-none"></div>' +
      '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-muted text-left text-[11px] uppercase border-b border-card"><th class="p-2">Empleado</th><th class="p-2">Días</th><th class="p-2">Horas</th><th class="p-2">Prom/día</th><th class="p-2">Retardos</th><th class="p-2">Permisos</th><th class="p-2">Abiertos</th></tr></thead><tbody>' +
      summaryRows.map(s => {
        const days = s.days.size, avg = days ? s.hrs / days : 0;
        return '<tr class="border-b border-card/50 hover:bg-card/30"><td class="p-2"><div class="font-bold text-[13px]">' + esc((s.user && (s.user.name || s.user.username)) || '') + '</div><div class="text-[11px] text-muted">@' + esc((s.user && s.user.username) || '') + ' · ' + esc(attendanceRoleLabel((s.user && s.user.role) || '')) + '</div></td>' +
        '<td class="p-2 font-black">' + days + '</td><td class="p-2 font-bold">' + esc(attendanceFmtHours(s.hrs)) + '</td><td class="p-2 text-xs">' + esc(attendanceFmtHours(avg)) + '</td>' +
        '<td class="p-2">' + (s.lates ? '<span class="text-[11px] font-black px-2 py-0.5 rounded-full bg-warn/15 text-warn">' + s.lates + '</span>' : '<span class="text-[11px] text-muted">0</span>') + '</td>' +
        '<td class="p-2">' + ((s.perms || 0) ? '<span class="text-[11px] font-black px-2 py-0.5 rounded-full bg-success/15 text-success">' + s.perms + '</span>' : '<span class="text-[11px] text-muted">0</span>') + '</td>' +
        '<td class="p-2">' + (s.opens ? '<span class="text-[11px] font-black px-2 py-0.5 rounded-full bg-success/15 text-success">' + s.opens + ' dentro</span>' : '<span class="text-[11px] text-muted">—</span>') + '</td></tr>';
      }).join('') +
      '</tbody></table></div>' +
      (absentToday.length ? '<div class="text-[11px] text-muted">Ausentes hoy (' + absentToday.length + '): <b class="text-txt">' + esc(absentToday.map(u => u.name || u.username).join(', ')) + '</b>' + (excusedToday.length ? ' · Permisos hoy (' + excusedToday.length + '): <b class="text-success">' + esc(excusedToday.map(u => u.name || u.username).join(', ')) + '</b>' : '') + '</div>' : (excusedToday.length ? '<div class="text-[11px] text-muted">Sin ausentes · Permisos hoy (' + excusedToday.length + '): <b class="text-success">' + esc(excusedToday.map(u => u.name || u.username).join(', ')) + '</b> · QR de gafetes: <b class="text-txt">Usuarios → columna Gafete QR</b>.</div>' : '<div class="text-[11px] text-muted">QR de gafetes: <b class="text-txt">Usuarios → columna Gafete QR</b>.</div>')) +
    '</div>' +
  '</div>';
  if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
  try { window.animateCountUpAll && window.animateCountUpAll(container); } catch (e) {}
  const qEl = container.querySelector('#dash-q');
  if (qEl) qEl.oninput = () => { F.q = qEl.value; };
  if (qEl) qEl.onchange = () => render();
  const empEl = container.querySelector('#dash-emp');
  if (empEl) empEl.onchange = () => { F.emp = empEl.value; render(); };
  const dEl = container.querySelector('#dash-date');
  if (dEl) dEl.onchange = () => { F.date = dEl.value; render(); };
  const mEl = container.querySelector('#dash-month');
  if (mEl) mEl.onchange = () => { F.month = mEl.value || attLocalDateStr(new Date()).slice(0, 7); render(); };
  const cEl = container.querySelector('#dash-clear');
  if (cEl) cEl.onclick = () => { F.q = ''; F.emp = 'all'; F.date = attLocalDateStr(new Date()); render(); };
  const rfEl = container.querySelector('#dash-rfrom');
  if (rfEl) rfEl.onchange = (e) => { F.rFrom = e.target.value; };
  const rtEl = container.querySelector('#dash-rto');
  if (rtEl) rtEl.onchange = (e) => { F.rTo = e.target.value; };
  const gotoOp = container.querySelector('#dash-goto-op');
  if (gotoOp) gotoOp.onclick = () => { currentView = 'admin-attendance'; try { localStorage.setItem('pos_view', currentView); } catch (e) {} render(); };
  // ===== Gráficas de asistencia (Chart.js bajo demanda, mismo patrón del sistema) =====
  try {
    const __paintAttCharts = () => {
      try {
        if (!window.Chart || window.Chart === window.__NoChart) return;
        const isDark = (window.themeMode === 'dark');
        const tickC = isDark ? '#cbd5e1' : '#64748b';
        const gridC = isDark ? 'rgba(148,163,184,.12)' : 'rgba(100,116,139,.14)';
        const fontF = "'DM Sans', sans-serif";
        try { (window.__attCharts || []).forEach(ch => { try { ch.destroy(); } catch (e) {} }); } catch (e) {}
        window.__attCharts = [];
        const mk = (id, cfg) => {
          const cv = document.getElementById(id);
          if (!cv) return;
          try {
            const prev = (window.Chart.getChart ? window.Chart.getChart(cv) : null);
            if (prev) { try { prev.destroy(); } catch (e) {} }
            window.__attCharts.push(new window.Chart(cv.getContext('2d'), cfg));
          } catch (e) {}
        };
        const scaleDef = (extra) => Object.assign({ ticks: { color: tickC, font: { family: fontF, size: 10 } }, grid: { color: gridC } }, extra || {});
        // 1) Entradas por día del mes
        try {
          const ym = String(F.month || '').split('-'), yy = +ym[0], mm = +ym[1];
          const dim = (yy && mm) ? new Date(yy, mm, 0).getDate() : 30;
          const perDay = new Array(dim).fill(0);
          monthRec.forEach(r => {
            const d = r.check_in ? Number(attLocalDateStr(r.check_in).slice(8, 10)) : NaN;
            if (d >= 1 && d <= dim) perDay[d - 1]++;
          });
          const totM = perDay.reduce((a, b) => a + b, 0);
          const elS = document.getElementById('att-stat-month');
          if (elS) elS.textContent = 'Total ' + totM + ' · prom ' + (dim ? (totM / dim).toFixed(1) : '0') + '/día';
          mk('att-chart-month', {
            type: 'bar',
            data: { labels: perDay.map((_, i) => String(i + 1)), datasets: [{ data: perDay, backgroundColor: 'rgba(56,189,248,.75)', borderRadius: 4, borderSkipped: false }] },
            options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1000, easing: 'easeOutQuart', delay: (c) => (c.dataIndex || 0) * 22 }, plugins: { legend: { display: false } }, scales: { x: scaleDef({ grid: { display: false } }), y: scaleDef({ beginAtZero: true, ticks: { color: tickC, font: { family: fontF, size: 10 }, precision: 0 } }) } }
          });
        } catch (e) {}
        // 2) Fichajes por hora de hoy (entradas)
        try {
          const perHour = new Array(24).fill(0);
          todayRec.forEach(r => { try { const h = new Date(r.check_in).getHours(); if (h >= 0 && h < 24) perHour[h]++; } catch (e) {} });
          let peakH = 0, peakV = 0;
          perHour.forEach((v, h) => { if (v > peakV) { peakV = v; peakH = h; } });
          const elH = document.getElementById('att-stat-hours');
          if (elH) elH.textContent = todayRec.length ? ('Pico ' + String(peakH).padStart(2, '0') + ':00 (' + peakV + ')') : 'Sin fichajes hoy';
          mk('att-chart-hours', {
            type: 'bar',
            data: { labels: perHour.map((_, h) => String(h).padStart(2, '0')), datasets: [{ data: perHour, backgroundColor: 'rgba(16,185,129,.75)', borderRadius: 3, borderSkipped: false }] },
            options: { responsive: true, maintainAspectRatio: false, animation: { duration: 900, easing: 'easeOutQuart', delay: (c) => (c.dataIndex || 0) * 12 }, plugins: { legend: { display: false } }, scales: { x: scaleDef({ grid: { display: false }, ticks: { color: tickC, font: { family: fontF, size: 9 }, maxTicksLimit: 9 } }), y: scaleDef({ beginAtZero: true, ticks: { color: tickC, font: { family: fontF, size: 10 }, precision: 0 } }) } }
          });
        } catch (e) {}
        // 3) Asistencia diaria del mes (% del personal presente) — escala a plantillas de cualquier tamaño
        // Los días con permiso no bajan el %: se cuentan como presente justificado.
        try {
          const ym3 = String(F.month || '').split('-'), yy3 = +ym3[0], mm3 = +ym3[1];
          const dim3 = (yy3 && mm3) ? new Date(yy3, mm3, 0).getDate() : 30;
          const pres = Array.from({ length: dim3 }, () => new Set());
          monthRec.forEach(r => {
            const d = r.check_in ? Number(attLocalDateStr(r.check_in).slice(8, 10)) : NaN;
            if (d >= 1 && d <= dim3) pres[d - 1].add(String(r.employee_username));
          });
          try {
            fichables.forEach(u => {
              (u.leave_days || []).forEach(k => {
                if (String(k).slice(0, 7) === String(F.month || '').slice(0, 7)) {
                  const dd = Number(String(k).slice(8, 10));
                  if (dd >= 1 && dd <= dim3) pres[dd - 1].add(String(u.username));
                }
              });
            });
          } catch (_e) {}
          const denom = Math.max(fichables.length, 1);
          const pct = pres.map(s => Math.round(s.size / denom * 100));
          const avgP = pct.length ? (pct.reduce((a, b) => a + b, 0) / pct.length) : 0;
          let pkD = 0, pkV = -1;
          pct.forEach((v, i) => { if (v > pkV) { pkV = v; pkD = i + 1; } });
          const elT = document.getElementById('att-stat-assist');
          if (elT) elT.textContent = 'Prom ' + avgP.toFixed(0) + '% · pico día ' + pkD + ' (' + pkV + '%)';
          mk('att-chart-assist', {
            type: 'line',
            data: { labels: pct.map((_, i) => String(i + 1)), datasets: [{ data: pct, borderColor: '#818cf8', borderWidth: 2, backgroundColor: 'rgba(129,140,248,.18)', fill: true, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: '#818cf8', tension: 0.35 }] },
            options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1100, easing: 'easeOutQuart' }, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ' ' + (ctx.parsed.y != null ? ctx.parsed.y : 0) + '% presente (' + pres[ctx.dataIndex].size + '/' + fichables.length + ')' } } }, scales: { x: scaleDef({ grid: { display: false } }), y: scaleDef({ beginAtZero: true, max: 100, ticks: { color: tickC, font: { family: fontF, size: 10 }, callback: (v) => v + '%' } }) } }
          });
        } catch (e) {}
        // 4) Puntualidad del mes (a tiempo vs retardos)
        try {
          let ok = 0, late = 0;
          monthRec.forEach(r => { if (attendanceIsLate(r.check_in, r.employee_username)) late++; else ok++; });
          const tot = ok + late;
          const elL = document.getElementById('att-stat-late');
          if (elL) elL.textContent = tot ? (Math.round(ok / tot * 100) + '% a tiempo') : 'Sin datos';
          mk('att-chart-late', {
            type: 'doughnut',
            data: { labels: ['A tiempo', 'Retardos'], datasets: [{ data: [ok, late], backgroundColor: ['#10B981', '#F59E0B'], borderWidth: 2, borderColor: isDark ? '#1e293b' : '#FFFFFF', hoverOffset: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '62%', animation: { animateRotate: true, duration: 1100, easing: 'easeOutQuart' }, plugins: { legend: { position: 'right', labels: { color: tickC, font: { family: fontF, size: 11 }, usePointStyle: true, boxWidth: 8 } } } }
          });
        } catch (e) {}
        if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
      } catch (e) {}
    };
    if (window.Chart && window.Chart !== window.__NoChart) { try { __paintAttCharts(); } catch (e) {} }
    else if (window.__ensureChart) { window.__ensureChart().then(() => { try { __paintAttCharts(); } catch (e) {} }).catch(() => {}); }
  } catch (e) {}
  // Registros del rango seleccionado (filtros de empleado/búsqueda incluidos, sin tope)
  const __rangeRecs = () => {
    let from = String(F.rFrom || (String(F.month || '').slice(0, 7) + '-01') || todayStr);
    let to = String(F.rTo || todayStr);
    if (from > to) { const t = from; from = to; to = t; }
    let recs = allRec.filter(r => {
      const d = String(r.date || (r.check_in ? attLocalDateStr(r.check_in) : ''));
      return d >= from && d <= to;
    });
    if (F.emp !== 'all') recs = recs.filter(r => String(r.employee_username) === String(F.emp));
    if (F.q) { const q = String(F.q).toLowerCase(); recs = recs.filter(r => String(r.employee_name || '').toLowerCase().includes(q) || String(r.employee_username || '').toLowerCase().includes(q)); }
    recs = recs.slice().sort((a, b) => String(a.date || a.check_in || '') < String(b.date || b.check_in || '') ? -1 : 1);
    return { recs, from, to };
  };
  // Resumen por empleado sobre el rango (misma lógica que el resumen mensual)
  const __rangeSummary = (recs) => {
    const byEmp = {};
    fichables.forEach(u => { byEmp[u.username] = { user: u, days: new Set(), hrs: 0, lates: 0, opens: 0 }; });
    recs.forEach(r => {
      const k = String(r.employee_username);
      if (!byEmp[k]) {
        const u = (typeof getUsers === 'function' ? getUsers().find(x => x.username === k) : null);
        byEmp[k] = { user: u || { username: k, name: r.employee_name || k }, days: new Set(), hrs: 0, lates: 0, opens: 0 };
      }
      byEmp[k].days.add(String(r.date || (r.check_in ? attLocalDateStr(r.check_in) : '')));
      byEmp[k].hrs += attendanceHours(r.check_in, r.check_out);
      if (!r.check_out) byEmp[k].opens++;
      if (attendanceIsLate(r.check_in, k)) byEmp[k].lates++;
    });
    return Object.values(byEmp).sort((a, b) => b.hrs - a.hrs);
  };
  const __fmtHM = (iso) => { try { if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return '—'; return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } catch (e) { return '—'; } };
  // Faltas del rango: por cada día, fichables sin registro (igual criterio que "Ausentes hoy")
  const __rangeAbsences = (from, to) => {
    const out = [];
    try {
      let list = fichables.slice();
      if (F.emp !== 'all') list = list.filter(u => String(u.username) === String(F.emp));
      if (!list.length) return out;
      const d0 = new Date(from + 'T12:00:00'), d1 = new Date(to + 'T12:00:00');
      if (isNaN(d0) || isNaN(d1) || d1 < d0) return out;
      let totalDays = Math.round((d1 - d0) / 86400000) + 1;
      if (totalDays > 732) { try { showToast('Rango limitado a 24 meses para el reporte', 'warn'); } catch (e) {} }
      totalDays = Math.min(totalDays, 732);
      const present = new Set();
      allRec.forEach(r => {
        const un = String(r.employee_username);
        [String(r.date || ''), (r.check_in ? attLocalDateStr(r.check_in) : '')].forEach(d => { if (d) present.add(un + '|' + d); });
      });
      // Alta de cada usuario: no contar faltas antes de que existiera en el sistema
      const createdOf = (u) => {
        try {
          const raw = (u && u.raw) || {};
          const c = raw.date_created || raw.date || raw.created_at || raw.createdAt || null;
          if (!c) return null;
          const d = new Date(c);
          if (isNaN(d)) return null;
          return attLocalDateStr(d);
        } catch (e) { return null; }
      };
      for (let d = new Date(d0), n = 0; d <= d1 && n < totalDays; d.setDate(d.getDate() + 1), n++) {
        const key = attLocalDateStr(d);
        list.forEach(u => {
          const alta = createdOf(u);
          if (alta && key < alta) return;
          // Día con permiso: no cuenta como falta
          try { if (attendanceIsExcused(u.username, key)) return; } catch (_e) {}
          if (!present.has(String(u.username) + '|' + key)) out.push({ date: key, username: u.username, name: u.name || u.username });
        });
      }
    } catch (e) {}
    return out;
  };
  const __rangeFileTag = (from, to) => from + '_a_' + to;
  const pdfBtn = container.querySelector('#dash-pdf-btn');
  if (pdfBtn) pdfBtn.onclick = async () => {
    try {
      const { recs, from, to } = __rangeRecs();
      const sumRows = __rangeSummary(recs);
      const absList = __rangeAbsences(from, to);
      if (!(await window.ensureJspdf())) return;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const ACC = [0, 94, 184];
      const W = doc.internal.pageSize.getWidth();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(ACC[0], ACC[1], ACC[2]);
      doc.text(String(bizName()), 40, 50);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(60);
      doc.text('Reporte de asistencia de personal', 40, 66);
      doc.setFontSize(9); doc.setTextColor(100);
      doc.text('Periodo: ' + from + ' al ' + to + '   ·   Generado: ' + new Date().toLocaleString('es-MX'), 40, 80);
      const uniq = new Set(recs.map(r => String(r.employee_username)));
      const totHrs = recs.reduce((a, r) => a + attendanceHours(r.check_in, r.check_out), 0);
      const lateN = recs.filter(r => attendanceIsLate(r.check_in, r.employee_username)).length;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30);
      doc.text('Resumen', 40, 102);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60);
      doc.text(['Registros: ' + recs.length + '   ·   Empleados con registro: ' + uniq.size + '   ·   Faltas: ' + absList.length,
        'Horas totales: ' + attendanceFmtHours(totHrs) + '   ·   Retardos: ' + lateN], 40, 114);
      doc.autoTable({
        startY: 132,
        head: [['Fecha', 'Empleado', 'Usuario', 'Entrada', 'Salida', 'Horas', 'Retardo', 'Método']],
        body: recs.map(r => [String(r.date || (r.check_in ? attLocalDateStr(r.check_in) : '')), r.employee_name || '', r.employee_username || '', __fmtHM(r.check_in), r.check_out ? __fmtHM(r.check_out) : '—', Number(attendanceHours(r.check_in, r.check_out).toFixed(2)), attendanceIsLate(r.check_in, r.employee_username) ? 'Sí' : 'No', [r.method_in, r.method_out].filter(Boolean).join('/') || '—']),
        styles: { fontSize: 7.5, cellPadding: 4 },
        headStyles: { fillColor: ACC, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [242, 246, 252] }
      });
      const yAfter = doc.lastAutoTable.finalY + 24;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30);
      doc.text('Faltas (' + absList.length + ')', 40, yAfter);
      doc.autoTable({
        startY: yAfter + 8,
        head: [['Fecha', 'Empleado', 'Usuario']],
        body: absList.map(a => [a.date, a.name, a.username]),
        styles: { fontSize: 7.5, cellPadding: 4 },
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [253, 242, 242] }
      });
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(140);
        doc.text('Página ' + i + ' de ' + pages, W - 90, doc.internal.pageSize.getHeight() - 20);
      }
      doc.save('asistencia_' + __rangeFileTag(from, to) + '.pdf');
      showToast('PDF descargado (' + recs.length + ' registros)', 'success');
    } catch (e) { showToast('No se pudo generar el PDF', 'error'); }
  };
  const xlsxBtn = container.querySelector('#dash-xlsx-btn');
  if (xlsxBtn) xlsxBtn.onclick = async () => {
    try {
      if (!(await window.ensureXlsx())) return;
      const { recs, from, to } = __rangeRecs();
      const rows = [['empleado_usuario', 'empleado_nombre', 'fecha', 'entrada', 'salida', 'horas', 'retardo', 'metodo_in', 'metodo_out', 'registrado_por_in', 'registrado_por_out']];
      recs.forEach(r => { rows.push([r.employee_username || '', (r.employee_name || '').replace(/;/g, ','), r.date || '', r.check_in || '', r.check_out || '', attendanceHours(r.check_in, r.check_out).toFixed(2), attendanceIsLate(r.check_in, r.employee_username) ? 'SI' : 'NO', r.method_in || '', r.method_out || '', r.check_in_by || '', r.check_out_by || '']); });
      const ws = window.XLSX.utils.aoa_to_sheet(rows);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
      try {
        const sumHead = [['empleado_usuario', 'empleado_nombre', 'dias', 'horas', 'promedio_dia', 'retardos', 'abiertos']];
        __rangeSummary(recs).forEach(s => {
          const days = s.days.size;
          sumHead.push([(s.user && s.user.username) || '', ((s.user && (s.user.name || s.user.username)) || ''), days, Number(s.hrs.toFixed(2)), Number((days ? s.hrs / days : 0).toFixed(2)), s.lates, s.opens]);
        });
        const ws2 = window.XLSX.utils.aoa_to_sheet(sumHead);
        window.XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');
        const absList = __rangeAbsences(from, to);
        const ws3 = window.XLSX.utils.aoa_to_sheet([['fecha', 'empleado_nombre', 'empleado_usuario']].concat(absList.map(a => [a.date, a.name, a.username])));
        window.XLSX.utils.book_append_sheet(wb, ws3, 'Faltas');
      } catch (e2) {}
      window.XLSX.writeFile(wb, 'asistencia_' + __rangeFileTag(from, to) + '.xlsx');
      showToast('Excel descargado (' + recs.length + ' registros)', 'success');
    } catch (e) { showToast('No se pudo exportar Excel', 'error'); }
  };
  container.querySelectorAll('[data-dash-close]').forEach(b => {
    b.onclick = async () => {
      const r = allRec.find(x => String(x.id) === String(b.dataset.dashClose));
      if (!r) return;
      await window.attendanceClockOut(r.employee_username, 'manual');
    };
  });
  container.querySelectorAll('[data-dash-del]').forEach(b => {
    b.onclick = () => {
      const r = allRec.find(x => String(x.id) === String(b.dataset.dashDel));
      if (!r || !r.id || String(r.id).startsWith('tmp_')) return;
      showConfirm('¿Eliminar registro de ' + (r.employee_name || r.employee_username) + ' (' + (r.date || '') + ')?', async () => {
        await dbSdk.delete({ type: 'attendance', id: r.id });
        showToast('Registro eliminado', 'success');
        render();
      }, 'Eliminar');
    };
  });
  container.querySelectorAll('[data-dash-edit]').forEach(b => {
    b.onclick = () => window.attendanceManualModal(b.dataset.dashEdit);
  });
}
window.attendanceManualModal = (editId) => {
  const allRec = getAttendanceRecords();
  const rec = editId ? allRec.find(r => String(r.id) === String(editId)) : null;
  const fichables = attendanceFichables();
  const esc = (window.escHtml ? window.escHtml : (s => String(s == null ? '' : s)));
  document.getElementById('attendance-manual-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'attendance-manual-modal';
  modal.className = 'fixed inset-0 z-[10070] flex items-center justify-center p-4';
  modal.style.background = 'rgba(0,0,0,.6)';
  const dfltDate = rec ? (rec.date || attLocalDateStr(rec.check_in)) : attLocalDateStr(new Date());
  const dfltIn = rec && rec.check_in ? attTime24(rec.check_in) : '';
  const dfltOut = rec && rec.check_out ? attTime24(rec.check_out) : '';
  modal.innerHTML =
    '<div class="bg-surface border border-card rounded-2xl w-full max-w-md shadow-2xl overflow-hidden fade-in">' +
      '<div class="px-4 py-3 border-b border-card font-bold text-sm">' + (rec ? 'Corregir registro' : 'Registro manual de asistencia') + '</div>' +
      '<div class="p-4 space-y-3">' +
        '<div><label class="block text-xs text-muted mb-1">Empleado</label>' +
        '<select id="attm-emp" class="w-full bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" ' + (rec ? 'disabled' : '') + '>' +
          fichables.map(u => '<option value="' + esc(u.username) + '" ' + ((rec && rec.employee_username === u.username) ? 'selected' : '') + '>' + esc(u.name || u.username) + ' (@' + esc(u.username) + ')</option>').join('') +
        '</select></div>' +
        '<div><label class="block text-xs text-muted mb-1">Fecha</label><input id="attm-date" type="date" value="' + esc(dfltDate) + '" class="w-full bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"></div>' +
        '<div class="grid grid-cols-2 gap-2"><div><label class="block text-xs text-muted mb-1">Entrada (24h)</label><input id="attm-in" type="time" value="' + esc(dfltIn) + '" class="w-full bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"></div>' +
        '<div><label class="block text-xs text-muted mb-1">Salida (24h, vacío = sigue dentro)</label><input id="attm-out" type="time" value="' + esc(dfltOut) + '" class="w-full bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"></div></div>' +
        '<div><label class="block text-xs text-muted mb-1">Nota (opcional)</label><input id="attm-note" value="' + esc((rec && (rec.note_in || rec.note_out)) || '') + '" placeholder="Ej. olvidó fichar" class="w-full bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"></div>' +
        '<div class="flex gap-2 pt-1"><button id="attm-save" class="flex-1 bg-accent text-white font-bold py-2.5 rounded-lg text-sm hover:opacity-90 transition">Guardar</button>' +
        '<button id="attm-cancel" class="px-4 py-2.5 bg-card border border-card text-muted rounded-lg text-sm font-bold hover:text-txt transition">Cancelar</button></div>' +
      '</div></div>';
  document.body.appendChild(modal);
  if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
  const close = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.querySelector('#attm-cancel').onclick = close;
  modal.querySelector('#attm-save').onclick = async () => {
    const empSel = modal.querySelector('#attm-emp').value;
    const dateV = modal.querySelector('#attm-date').value || attLocalDateStr(new Date());
    const inV = modal.querySelector('#attm-in').value;
    const outV = modal.querySelector('#attm-out').value;
    const noteV = modal.querySelector('#attm-note').value.trim();
    if (!empSel) return showToast('Elige empleado', 'warn');
    if (!inV) return showToast('Pon la hora de entrada', 'warn');
    const mkISO = (dateStr, hm) => {
      try {
        const p = String(dateStr).split('-'), t = String(hm).split(':');
        const d = new Date(+p[0], (+p[1]) - 1, +p[2], +t[0], +(t[1] || 0), 0, 0);
        return d.toISOString();
      } catch (e) { return new Date().toISOString(); }
    };
    const check_in = mkISO(dateV, inV);
    const check_out = outV ? mkISO(dateV, outV) : null;
    if (check_out && new Date(check_out) < new Date(check_in)) return showToast('La salida no puede ser antes que la entrada', 'error');
    const btn = modal.querySelector('#attm-save');
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      if (rec) {
        const hrs = check_out ? attendanceHours(check_in, check_out) : 0;
        await dbSdk.update({ ...rec, date: dateV, check_in, check_out: check_out, status: check_out ? 'closed' : 'open', hours: hrs, note_in: noteV, method_in: rec.method_in || 'manual', method_out: check_out ? (rec.method_out || 'manual') : '' });
        showToast('Registro actualizado', 'success');
      } else {
        // Si ya tiene abierto, no duplicar: avisar
        const open = attendanceOpenFor(empSel);
        if (open && !check_out) { showToast('Ese empleado ya está dentro (cierra su turno primero)', 'warn'); btn.disabled = false; btn.textContent = 'Guardar'; return; }
        const emp = fichables.find(u => u.username === empSel) || { name: empSel };
        const hrs = check_out ? attendanceHours(check_in, check_out) : 0;
        await dbSdk.create({
          type: 'attendance', employee_username: empSel, employee_name: emp.name || empSel, employee_role: emp.role || 'cashier',
          date: dateV, check_in, check_out: check_out, check_in_by: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) || 'sistema',
          check_out_by: check_out ? ((typeof currentUser !== 'undefined' && currentUser && currentUser.username) || 'sistema') : '',
          method_in: 'manual', method_out: check_out ? 'manual' : '', note_in: noteV, status: check_out ? 'closed' : 'open', hours: hrs, date_created: new Date().toISOString()
        });
        showToast('Registro guardado', 'success');
      }
      close(); render();
    } catch (e) {
      showToast('No se pudo guardar', 'error');
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  };
};

// ========== VISTA CHECADOR (rol attendance: fichaje + reportes) ==========
function renderCheckerView() {
  // Kiosco de pared a pantalla completa: reloj gigante + recuadro escáner siempre activo.
  // 1er escaneo = ENTRADA, 2do = SALIDA. Sin listas ni reportes (solo en administración).
  const fichables = attendanceFichables();
  const esc = (window.escHtml ? window.escHtml : (s => String(s == null ? '' : s)));
  const todayStr = attLocalDateStr(new Date());
  let inside = 0;
  try {
    inside = getAttendanceRecords().filter(r => {
      if (!r || r.check_out) return false;
      if (String(r.employee_role || '') === 'attendance') return false;
      const uu = (typeof getUsers === 'function' ? getUsers().find(x => String(x.username) === String(r.employee_username)) : null);
      return !(uu && uu.role === 'attendance');
    }).length;
  } catch (e) { inside = 0; }

  app.innerHTML =
  '<div class="h-full w-full flex flex-col overflow-y-auto overscroll-none fade-in" style="min-height:100%;">' +
    '<header class="sticky top-0 z-30 bg-surface/70 backdrop-blur-xl border-b border-card/60 px-3 py-3 flex items-center justify-between shrink-0 w-full gap-2">' +
      '<div class="flex items-center gap-2 min-w-0 ml-1"><i data-lucide="fingerprint" class="w-5 h-5 text-accent shrink-0"></i>' +
      '<span class="font-bold text-base sm:text-lg truncate">' + esc(typeof bizName === 'function' ? bizName() : 'Checador') + '</span>' +
      '<span class="text-[10px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full shrink-0 ml-1">Checador</span></div>' +
      '<div class="flex items-center gap-2 shrink-0">' +
        '<button type="button" id="sync-indicator" onclick="window.__syncPing(true)" class="shrink-0 text-muted bg-surface/50 p-1.5 rounded-lg shadow-sm border border-card"><i data-lucide="cloud" class="w-4 h-4 pointer-events-none"></i></button>' +
        '<button type="button" class="theme-toggle text-muted hover:text-accent transition bg-surface/50 p-1.5 rounded-lg shadow-sm border border-card" onclick="window.setThemeMode(window.themeMode===\'dark\'?\'light\':\'dark\')" title="Modo oscuro / claro"><i class="w-4 h-4 pointer-events-none" data-lucide="' + (window.themeMode === 'dark' ? 'moon' : 'sun') + '"></i></button>' +
        '<div class="hidden sm:flex items-center gap-2 text-xs font-bold text-txt bg-card/40 border border-card/80 rounded-xl py-2 px-3"><div class="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center font-black text-sm uppercase shrink-0">' + esc(String((currentUser && (currentUser.name || currentUser.username)) || '?').charAt(0).toUpperCase()) + '</div><span class="truncate max-w-[10rem]">' + esc((currentUser && (currentUser.name || currentUser.username)) || 'Checador') + '</span></div>' +
        '<button id="checker-logout" class="text-muted hover:text-danger transition flex items-center gap-1 text-sm shrink-0"><i data-lucide="log-out" class="w-4 h-4"></i><span class="hidden sm:inline">Salir</span></button>' +
      '</div></header>' +
    '<main class="flex-1 w-full min-h-0 p-2 md:p-4 flex flex-col">' +
    attKioskGridHTML(esc, todayStr, inside, fichables.length) +
    '</main></div>';
  if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
  wireAttKiosk();
  document.getElementById('checker-logout').onclick = async () => {
    try { if (window.__checkerClock) clearInterval(window.__checkerClock); } catch (e) {}
    try { await window.attendanceLiveStop(); } catch (e) {}
    currentUser = null; currentView = 'login';
    localStorage.removeItem('pos_user'); localStorage.setItem('pos_view', 'login');
    render();
  };
}
// ========== USERS ADMIN ==========
function renderUsersAdmin(container) {
  const allUsers = getUsers();
  let editingUser = null;
  let editingLeaveDays = [];
  let leaveCalCursor = new Date();
  leaveCalCursor.setDate(1);

  container.innerHTML = `
  <div class="fade-in space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-bold">Usuarios</h2>
    </div>
    <div class="bg-surface rounded-xl p-5 border border-card">
      <h3 id="u-form-title" class="font-semibold mb-3">Agregar Usuario</h3>
     <form id="user-form" class="flex flex-wrap gap-3 items-end">
        <div>
          <label class="block text-xs text-muted mb-1">Nombre Real</label>
          <input id="u-name" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Nombre completo" required>
        </div>
        <div>
          <label class="block text-xs text-muted mb-1">Usuario (Para iniciar sesión)</label>
          <input id="u-user" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Ej: cajero2" required>
        </div>
        <div id="pass-wrapper" class="relative">
          <label class="block text-xs text-muted mb-1">Contraseña</label>
          <button type="button" id="btn-show-pass-change" class="hidden w-full bg-card border border-dashed border-card rounded-lg px-3 py-2 text-sm text-muted hover:text-accent hover:border-accent/30 transition flex items-center gap-2 justify-center">
            <i data-lucide="key" class="w-4 h-4"></i> Cambiar contraseña
          </button>
          <input id="u-pass" type="text" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none w-full" placeholder="Contraseña *" required>
          <div id="pass-strength" class="hidden absolute left-0 right-0 top-full mt-2 bg-surface border border-card rounded-xl p-3 shadow-xl z-20">
            <div class="absolute -top-1.5 left-6 w-3 h-3 bg-surface border-l border-t border-card rotate-45"></div>
            <div class="flex gap-1 mb-2">
              <div class="h-1.5 flex-1 rounded-full bg-card border border-card pass-seg" data-seg="0"></div>
              <div class="h-1.5 flex-1 rounded-full bg-card border border-card pass-seg" data-seg="1"></div>
              <div class="h-1.5 flex-1 rounded-full bg-card border border-card pass-seg" data-seg="2"></div>
              <div class="h-1.5 flex-1 rounded-full bg-card border border-card pass-seg" data-seg="3"></div>
            </div>
            <div id="pass-strength-label" class="text-xs font-bold mb-2 text-muted">Débil</div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <div class="flex items-center gap-1" data-check="length"><i data-lucide="check" class="w-3 h-3 text-success hidden"></i><i data-lucide="square" class="w-3 h-3 text-muted"></i><span class="text-muted">12+ caracteres</span></div>
              <div class="flex items-center gap-1" data-check="case"><i data-lucide="check" class="w-3 h-3 text-success hidden"></i><i data-lucide="square" class="w-3 h-3 text-muted"></i><span class="text-muted">Mayús/minús</span></div>
              <div class="flex items-center gap-1" data-check="number"><i data-lucide="check" class="w-3 h-3 text-success hidden"></i><i data-lucide="square" class="w-3 h-3 text-muted"></i><span class="text-muted">Un número</span></div>
              <div class="flex items-center gap-1" data-check="symbol"><i data-lucide="check" class="w-3 h-3 text-success hidden"></i><i data-lucide="square" class="w-3 h-3 text-muted"></i><span class="text-muted">Un símbolo</span></div>
            </div>
          </div>
        </div>
       <div>
          <label class="block text-xs text-muted mb-1">Rol</label>
          <select id="u-role" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none">
            <option value="">Selecciona el rol...</option>
            <option value="attendance">Checador (entradas/salidas)</option>
            <option value="employee">Empleado (fichaje por QR)</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button type="submit" id="u-btn" class="bg-accent text-bg font-bold px-6 py-2.5 rounded-xl hover:opacity-90 transition text-sm shadow-md">Agregar</button>
          <button type="button" id="u-cancel" class="bg-card text-muted px-4 py-2.5 rounded-xl hover:bg-bg transition text-sm hidden">Cancelar</button>
        </div>

        <!-- NUEVO BLOQUE DE PERMISOS -->
       <div class="w-full mt-2 hidden border-t border-card pt-3" id="permissions-container">
          <label class="block text-xs text-muted mb-2 font-bold uppercase">Permisos de Administrador (Pestañas Visibles)</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-card/30 p-3 rounded-xl border border-card">

            <!-- ... -->
           <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-attendance" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Checador Empleados</span></label>
           <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-attendance-dash" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Dashboard Asistencia</span></label>
<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-users" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Usuarios</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-settings" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Configuración</span></label>
          </div>
        </div>

<div id="attendance-perms-hint" class="w-full mt-4 border-t border-card pt-3 hidden">
  <p class="text-xs text-muted bg-card/30 p-3 rounded-xl border border-card">Los <b class="text-txt">checadores</b> registran entradas/salidas (fichaje + QR) y consultan el reporte de asistencia. No necesitan más permisos.</p>
</div>
<div id="employee-perms-hint" class="w-full mt-4 border-t border-card pt-3 hidden">
  <p class="text-xs text-muted bg-card/30 p-3 rounded-xl border border-card">Los <b class="text-txt">empleados</b> fichan con su QR en el checador. Activa su horario y pon su <b class="text-txt">hora de entrada y salida</b> abajo: se usa para retardos y horas.</p>
</div>
<div class="w-full mt-4 border-t border-card pt-3" id="schedule-container">
  <label class="flex items-center gap-2 cursor-pointer text-sm font-medium"><input type="checkbox" id="u-sched-enabled" class="w-4 h-4 text-accent"> <span id="u-sched-title">Horario laboral (limitar acceso por hora)</span></label>
  <div id="u-sched-times" class="hidden gap-3 mt-2 flex">
    <div>
      <label class="block text-xs text-muted mb-1" id="u-sched-from-label">Desde</label>
      <input id="u-sched-start" type="time" value="09:00" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none">
    </div>
    <div>
      <label class="block text-xs text-muted mb-1" id="u-sched-to-label">Hasta</label>
      <input id="u-sched-end" type="time" value="18:00" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none">
    </div>
  </div>
  <p class="text-[11px] text-muted mt-1" id="u-sched-note">Fuera de ese horario no podrá iniciar sesión (acepta turno nocturno, ej. 22:00–06:00). El admin principal siempre entra.</p>
</div>
<div class="w-full mt-4 border-t border-card pt-3" id="leave-container">
  <div class="flex flex-wrap items-center gap-2 mb-1">
    <label class="text-sm font-medium flex items-center gap-1.5"><i data-lucide="calendar-check" class="w-4 h-4 text-accent"></i> Días de permiso (no cuentan falta ni retardo)</label>
    <span id="u-leave-count" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-success/15 text-success">0 días</span>
  </div>
  <p class="text-[11px] text-muted mb-2">Toca los días en el calendario para marcarlos como <b class="text-txt">permiso</b>: si el empleado falta ese día, <b class="text-txt">no se cuenta como ausente ni como retardo</b>.</p>
  <div class="flex flex-col sm:flex-row gap-3">
    <div class="bg-card/30 border border-card rounded-xl p-3 w-full sm:w-64 shrink-0">
      <div class="flex items-center justify-between mb-2">
        <button type="button" id="u-leave-prev" class="p-1.5 rounded-lg bg-card border border-card text-muted hover:text-txt transition" title="Mes anterior"><i data-lucide="chevron-left" class="w-4 h-4 pointer-events-none"></i></button>
        <div id="u-leave-title" class="text-xs font-black capitalize">—</div>
        <button type="button" id="u-leave-next" class="p-1.5 rounded-lg bg-card border border-card text-muted hover:text-txt transition" title="Mes siguiente"><i data-lucide="chevron-right" class="w-4 h-4 pointer-events-none"></i></button>
      </div>
      <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted mb-1"><span>Lu</span><span>Ma</span><span>Mi</span><span>Ju</span><span>Vi</span><span>Sá</span><span>Do</span></div>
      <div id="u-leave-grid" class="grid grid-cols-7 gap-1"></div>
      <div class="flex gap-2 mt-2">
        <button type="button" id="u-leave-today" class="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-card border border-card text-muted hover:text-txt transition">Hoy</button>
        <button type="button" id="u-leave-clear" class="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition">Limpiar</button>
      </div>
    </div>
    <div class="flex-1 min-w-0">
      <label class="block text-xs text-muted mb-1">Días seleccionados (<span id="u-leave-count2" class="font-black text-txt">0</span>)</label>
      <div id="u-leave-list" class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto bg-card/20 border border-card rounded-xl p-2 min-h-[3rem]"></div>
      <input type="hidden" id="u-leave-days" value="[]">
    </div>
  </div>
</div>
      </form>
    </div>
    <div class="bg-surface rounded-xl border border-card overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-muted text-left border-b border-card"><th class="p-3">Nombre</th><th class="p-3">Usuario</th><th class="p-3">Contraseña</th><th class="p-3">Rol</th><th class="p-3">Estado</th><th class="p-3">Horario</th><th class="p-3">Permisos</th><th class="p-3 text-center">Gafete QR</th><th class="p-3 text-center">Acciones</th></tr></thead>
        <tbody>
          ${allUsers.map(u => `
            <tr class="border-b border-card/50 hover:bg-card/30 transition ${u.disabled ? 'opacity-55' : ''}">
              <td class="p-3 font-medium">${u.name}</td>
              <td class="p-3 text-muted">${u.username}</td>
              <td class="p-3">${u.role === 'employee'
                ? '<span class="text-muted">—</span>'
                : `<span class="inline-flex items-center gap-2">
                <span id="pwd-${u.username}" data-hidden="1" class="text-muted font-mono">••••••••</span>
                <button type="button" data-toggle-pwd="${u.username}" data-pwd="${String(u.password || '').replace(/"/g, '&quot;')}" class="p-1 rounded-lg hover:bg-card text-muted hover:text-accent transition" title="Mostrar contraseña">
                  <i data-lucide="eye" class="w-4 h-4 pointer-events-none"></i>
                </button>
              `}</span></td>
              <td class="p-3"><span class="text-xs px-2 py-0.5 rounded-full ${u.role==='admin'?'bg-accent/20 text-accent':(u.role==='waiter'?'bg-success/15 text-success':(u.role==='kitchen'?'bg-warn/15 text-warn':(u.role==='attendance'?'bg-violet-500/15 text-violet-400':(u.role==='employee'?'bg-emerald-500/15 text-emerald-400':'bg-accent2/20 text-accent2'))))}">${u.role==='admin'?'Admin':(u.role==='attendance'?'Checador':(u.role==='employee'?'Empleado':'Admin'))}</span></td>
              <td class="p-3"><span class="text-xs px-2 py-0.5 rounded-full font-bold ${u.disabled ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'}">${u.disabled ? 'Deshabilitado' : 'Activo'}</span></td>
              <td class="p-3 whitespace-nowrap">${u.sched_enabled ? `<span class="inline-flex items-center gap-1 text-xs font-bold text-accent2"><i data-lucide="clock" class="w-3.5 h-3.5"></i>${u.sched_start || '--:--'}–${u.sched_end || '--:--'}</span>` : '<span class="text-xs text-muted">—</span>'}</td>
              <td class="p-3 whitespace-nowrap">${(u.leave_days && u.leave_days.length) ? `<span class="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-success/15 text-success" title="${u.leave_days.slice().sort().join(', ')}"><i data-lucide="calendar-check" class="w-3.5 h-3.5"></i>${u.leave_days.length} día${u.leave_days.length === 1 ? '' : 's'}</span>` : '<span class="text-xs text-muted">—</span>'}</td>
              <td class="p-3 text-center">${(u.username === 'admin' || u.role === 'attendance') ? '<span class="text-[11px] text-muted">—</span>' : `<button type="button" data-user-qr="${u.username}" class="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent hover:bg-accent hover:text-white transition" title="Ver / imprimir QR gafete de ${u.username}"><i data-lucide="qr-code" class="w-3.5 h-3.5 pointer-events-none"></i> QR</button>`}</td>
             <td class="p-3 flex justify-center gap-2">
  <button type="button" onclick="window.editUser('${u.username}')" class="p-2 bg-accent/10 hover:bg-accent/20 rounded-lg transition text-accent" title="Editar">
    <!-- SVG directo del lápiz para evitar fallos de renderizado -->
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 pointer-events-none">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
  </button>
  ${u.username === 'admin'
    ? '<span class="text-xs text-muted font-bold p-2">Fijo</span>'
    : `<button type="button" onclick="window.toggleUser('${u.username}')" class="p-2 ${u.disabled ? 'bg-success/10 hover:bg-success/20 text-success' : 'bg-warn/10 hover:bg-warn/20 text-warn'} rounded-lg transition" title="${u.disabled ? 'Habilitar usuario' : 'Deshabilitar usuario'}">
        <i data-lucide="${u.disabled ? 'check' : 'ban'}" class="w-4 h-4 pointer-events-none"></i>
      </button>`}
  ${u.isDefault && !u.raw ? '' :
                `<button type="button" onclick="window.deleteUser('${u.username}')" class="p-2 bg-danger/10 hover:bg-danger/20 rounded-lg transition text-danger" title="Eliminar">
                  <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                </button>`}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  // Medidor de seguridad de contraseña
  const passInput = document.getElementById('u-pass');
  const passStrength = document.getElementById('pass-strength');
  const passLabel = document.getElementById('pass-strength-label');
  const passSegs = passStrength ? passStrength.querySelectorAll('.pass-seg') : [];
  function updatePassStrength(){
    // Si el campo está oculto (modo edición sin cambiar), no mostrar nada
    if(passInput && passInput.classList.contains('hidden')) return;
    const v = passInput ? passInput.value : '';
    const checks = {
      length: v.length >= 12,
      case: /[a-z]/.test(v) && /[A-Z]/.test(v),
      number: /[0-9]/.test(v),
      symbol: /[^A-Za-z0-9]/.test(v)
    };
    const score = Object.values(checks).filter(Boolean).length;
    if(passStrength) passStrength.classList.toggle('hidden', !v);
    if(passLabel){
      const labels = ['Muy débil','Débil','Aceptable','Fuerte','Muy fuerte'];
      const colors = ['text-danger','text-warn','text-warn','text-success','text-success'];
      passLabel.textContent = v ? labels[score] : 'Débil';
      passLabel.className = 'text-xs font-bold mb-2 ' + (v ? colors[score] : 'text-muted');
    }
    const segColors = ['bg-danger','bg-warn','bg-warn','bg-success'];
    passSegs.forEach((el,i)=>{
      el.className = 'h-1.5 flex-1 rounded-full border pass-seg transition-all ' + (i < score ? segColors[score-1] + ' border-transparent' : 'bg-card border-card');
    });
    ['length','case','number','symbol'].forEach(k=>{
      const row = passStrength ? passStrength.querySelector(`[data-check="${k}"]`) : null;
      if(!row) return;
      const ok = checks[k];
      row.querySelector('[data-lucide="check"]')?.classList.toggle('hidden', !ok);
      row.querySelector('[data-lucide="square"]')?.classList.toggle('hidden', ok);
      row.querySelector('span').className = ok ? 'text-success font-medium' : 'text-muted';
    });
    if(passStrength) lucide.createIcons();
  }
  if(passInput){
    passInput.addEventListener('input', updatePassStrength);
    // Mostrar al enfocar si ya hay texto
    passInput.addEventListener('focus', updatePassStrength);
    // Ocultar al quitar foco / cambiar de campo
    passInput.addEventListener('blur', ()=>{
      setTimeout(()=>{
        const ps = document.getElementById('pass-strength');
        if(ps) ps.classList.add('hidden');
      }, 150);
    });
  }

  // Cambia la lógica del evento onchange así:
  document.getElementById('u-role').onchange = (e) => {
    const permContainer = document.getElementById('permissions-container');
    const attHint = document.getElementById('attendance-perms-hint');
    const empHint = document.getElementById('employee-perms-hint');

    const rol = e.target.value;
    if (attHint) attHint.classList.toggle('hidden', rol !== 'attendance');
    if (empHint) empHint.classList.toggle('hidden', rol !== 'employee');
    // Empleado: sin contraseña (solo ficha + QR, no inicia sesión)
    const passWrap = document.getElementById('pass-wrapper');
    if (passWrap) passWrap.classList.toggle('hidden', rol === 'employee');
    const passReq = document.getElementById('u-pass');
    if (passReq) passReq.required = rol !== 'employee';
    // Entrada/salida del empleado: el horario también alimenta retardos y horas del checador
    const schedTitle = document.getElementById('u-sched-title');
    const schedNote = document.getElementById('u-sched-note');
    const schedFrom = document.getElementById('u-sched-from-label');
    const schedTo = document.getElementById('u-sched-to-label');
    if (rol === 'employee') {
      if (schedTitle) schedTitle.textContent = 'Horario de trabajo (entrada y salida)';
      if (schedFrom) schedFrom.textContent = 'Entrada';
      if (schedTo) schedTo.textContent = 'Salida';
      try { const __tol = (typeof attendanceTolerance === 'function' ? attendanceTolerance() : 10); if (schedNote) schedNote.innerHTML = 'Hora de <b class="text-txt">ENTRADA</b> y <b class="text-txt">SALIDA</b> del empleado: el checador lo usa para retardos (+' + __tol + ' min de tolerancia, configurable en Config) y horas. Actívalo para registrar su jornada.'; } catch (_e) { if (schedNote) schedNote.innerHTML = 'Hora de <b class="text-txt">ENTRADA</b> y <b class="text-txt">SALIDA</b> del empleado: el checador lo usa para retardos y horas. Actívalo para registrar su jornada.'; }
    } else {
      if (schedTitle) schedTitle.textContent = 'Horario laboral (limitar acceso por hora)';
      if (schedFrom) schedFrom.textContent = 'Desde';
      if (schedTo) schedTo.textContent = 'Hasta';
      if (schedNote) schedNote.textContent = 'Fuera de ese horario no podrá iniciar sesión (acepta turno nocturno, ej. 22:00–06:00). El admin principal siempre entra.';
    }
    if (rol === 'admin') {
        permContainer.classList.remove('hidden');
    } else {
        // Checador / empleado (o sin rol): vista única, no necesitan pestañas
        permContainer.classList.add('hidden');
    }
  };

  // Muestra/oculta las horas del horario laboral
  document.getElementById('u-sched-enabled').onchange = (e) => {
    const box = document.getElementById('u-sched-times');
    box.classList.toggle('hidden', !e.target.checked);
    box.classList.toggle('flex', e.target.checked);
  };

  // ===== MINI CALENDARIO DE PERMISOS (días que no cuentan falta ni retardo) =====
  const leaveGrid = () => document.getElementById('u-leave-grid');
  const leaveTitle = () => document.getElementById('u-leave-title');
  const leaveList = () => document.getElementById('u-leave-list');
  const leaveHidden = () => document.getElementById('u-leave-days');
  const pad2 = (n) => String(n).padStart(2, '0');
  const toKey = (y, m, d) => y + '-' + pad2(m + 1) + '-' + pad2(d);
  const fmtShort = (key) => { try { const p = String(key).split('-'); const d = new Date(+p[0], +p[1] - 1, +p[2]); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2); } catch (_e) { return key; } };
  function paintLeaveList() {
    try {
      editingLeaveDays = Array.from(new Set(editingLeaveDays.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d))))).sort();
      const c1 = document.getElementById('u-leave-count');
      const c2 = document.getElementById('u-leave-count2');
      if (c1) c1.textContent = editingLeaveDays.length + (editingLeaveDays.length === 1 ? ' día' : ' días');
      if (c2) c2.textContent = editingLeaveDays.length;
      const hid = leaveHidden();
      if (hid) hid.value = JSON.stringify(editingLeaveDays);
      const box = leaveList();
      if (box) {
        if (!editingLeaveDays.length) box.innerHTML = '<span class="text-[11px] text-muted">Sin permisos: todos los días cuentan para asistencia.</span>';
        else box.innerHTML = editingLeaveDays.map(k => '<span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-success/15 text-success border border-success/20">' + fmtShort(k) + '<button type="button" data-leave-rm="' + k + '" class="hover:text-danger font-black leading-none" title="Quitar">×</button></span>').join('');
        box.querySelectorAll('[data-leave-rm]').forEach(b => { b.onclick = () => { editingLeaveDays = editingLeaveDays.filter(d => d !== b.dataset.leaveRm); paintLeaveList(); paintLeaveCal(); }; });
      }
    } catch (_e) {}
  }
  function paintLeaveCal() {
    try {
      const g = leaveGrid(), t = leaveTitle();
      if (!g || !t) return;
      const y = leaveCalCursor.getFullYear(), m = leaveCalCursor.getMonth();
      try { t.textContent = leaveCalCursor.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); } catch (_e) { t.textContent = pad2(m + 1) + '/' + y; }
      const first = new Date(y, m, 1);
      let startCol = (first.getDay() + 6) % 7; // lunes=0
      const dim = new Date(y, m + 1, 0).getDate();
      const todayKey = attLocalDateStr(new Date());
      let html = '';
      for (let i = 0; i < startCol; i++) html += '<span></span>';
      for (let d = 1; d <= dim; d++) {
        const key = toKey(y, m, d);
        const sel = editingLeaveDays.includes(key);
        const isToday = key === todayKey;
        html += '<button type="button" data-leave-day="' + key + '" title="' + key + '" class="aspect-square rounded-lg text-[11px] font-bold transition border ' + (sel ? 'bg-success text-white border-success shadow' : 'bg-card border-card text-txt hover:border-success/50') + (isToday && !sel ? ' ring-2 ring-accent/40' : '') + '">' + d + '</button>';
      }
      g.innerHTML = html;
      g.querySelectorAll('[data-leave-day]').forEach(b => {
        b.onclick = () => {
          const k = b.dataset.leaveDay;
          if (editingLeaveDays.includes(k)) editingLeaveDays = editingLeaveDays.filter(d => d !== k);
          else editingLeaveDays = editingLeaveDays.concat([k]);
          paintLeaveList(); paintLeaveCal();
        };
      });
      if (window.lucide) { try { window.lucide.createIcons(); } catch (_e) {} }
    } catch (_e) {}
  }
  try {
    document.getElementById('u-leave-prev').onclick = () => { leaveCalCursor = new Date(leaveCalCursor.getFullYear(), leaveCalCursor.getMonth() - 1, 1); paintLeaveCal(); };
    document.getElementById('u-leave-next').onclick = () => { leaveCalCursor = new Date(leaveCalCursor.getFullYear(), leaveCalCursor.getMonth() + 1, 1); paintLeaveCal(); };
    document.getElementById('u-leave-today').onclick = () => { leaveCalCursor = new Date(); leaveCalCursor.setDate(1); paintLeaveCal(); };
    document.getElementById('u-leave-clear').onclick = () => { editingLeaveDays = []; paintLeaveList(); paintLeaveCal(); };
  } catch (_e) {}
  paintLeaveList(); paintLeaveCal();

  // Restaurante retirado: no se pueden crear meseros ni cocineros
  try {
    document.querySelectorAll('#u-role option[value="waiter"], #u-role option[value="kitchen"], #u-role option[value="cashier"]').forEach(o => o.remove());
  } catch (e) {}

  window.editUser = (username) => {
    editingUser = getUsers().find(u => u.username === username);
    if (editingUser) {
      document.getElementById('u-name').value = editingUser.name;
      document.getElementById('u-user').value = editingUser.username;
      // En edición, mostrar contraseña anterior y ocultar medidor hasta foco
      const passInput = document.getElementById('u-pass');
      const showBtn = document.getElementById('btn-show-pass-change');
      if (editingUser.role === 'employee') {
        passInput.value = '';
        passInput.required = false;
      } else {
        passInput.value = editingUser.password;
        passInput.classList.remove('hidden');
        passInput.required = true;
      }
      document.getElementById('pass-strength')?.classList.add('hidden');
      if(showBtn) showBtn.classList.add('hidden');
      // El administrador principal (admin) es fijo: rol siempre Administrador, no se puede cambiar
      const isLockedAdmin = editingUser.username === 'admin';
      document.getElementById('u-role').value = isLockedAdmin ? 'admin' : editingUser.role;
      document.getElementById('u-role').disabled = isLockedAdmin;
      document.getElementById('u-role').dispatchEvent(new Event('change'));

      // Marcar permisos de pestañas
      const allPerms = ['admin-attendance', 'admin-attendance-dash', 'admin-users', 'admin-settings'];
      const userPerms = editingUser.raw && editingUser.raw.permissions ? editingUser.raw.permissions : allPerms;
      document.querySelectorAll('input[name="u-perm"]').forEach(cb => {
          cb.checked = userPerms.includes(cb.value);
      });

      // Horario guardado del usuario
      document.getElementById('u-sched-enabled').checked = !!editingUser.sched_enabled;
      document.getElementById('u-sched-start').value = editingUser.sched_start || '09:00';
      document.getElementById('u-sched-end').value = editingUser.sched_end || '18:00';
      document.getElementById('u-sched-times').classList.toggle('hidden', !editingUser.sched_enabled);
      document.getElementById('u-sched-times').classList.toggle('flex', !!editingUser.sched_enabled);

      // Permisos guardados: mini calendario
      try {
        editingLeaveDays = Array.isArray(editingUser.leave_days) ? editingUser.leave_days.slice() : [];
        leaveCalCursor = new Date(); leaveCalCursor.setDate(1);
        paintLeaveList(); paintLeaveCal();
      } catch (_e) {}

      document.getElementById('u-form-title').textContent = 'Editar Usuario';
      // El nombre de usuario SIEMPRE es editable (incluido el cajero): por defecto
      // se puede cambiar. Al guardar, el sistema valida duplicados y migra la ficha.
      const uUserInput = document.getElementById('u-user');
      uUserInput.readOnly = false;
      uUserInput.classList.remove('opacity-50', 'cursor-not-allowed');
      uUserInput.title = 'Puedes cambiar el nombre de usuario (con el que inicia sesión)';
      document.getElementById('u-btn').textContent = 'Guardar cambios';
      document.getElementById('u-cancel').classList.remove('hidden');
      try {
        document.getElementById('user-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {}
    }
  };

  window.deleteUser = (username) => {
    const uToDel = getUsers().find(r => r.username === username);
    if (uToDel && uToDel.raw) {
      showConfirm(`¿Eliminar al usuario ${uToDel.name}?`, async () => {
        const renamedFrom = uToDel.raw.renamed_from || null;
        await dbSdk.delete(uToDel.raw);
        // Si era un renombrado, se quita el marcador del nombre anterior para
        // que el usuario original (p. ej. cajero1) vuelva a aparecer en la lista.
        if (renamedFrom) {
          try {
            const marker = records('user').find(r => String(r.name || '') === String(renamedFrom) && r.hidden === true);
            if (marker) await dbSdk.delete({ type: 'user', id: marker.id });
          } catch (e) {}
        }
        showToast('Usuario eliminado');
        render(); // Refleja el cambio sin tener que reabrir la pestaña
      });
    }
  };

  // Deshabilita (o habilita) sin eliminar: el usuario deshabilitado no puede entrar
  window.toggleUser = (username) => {
    if (username === 'admin') return showToast('El administrador principal no se puede deshabilitar', 'warn');
    const u = getUsers().find(r => r.username === username);
    if (!u) return;
    const enable = !!u.disabled;
    showConfirm(`${enable ? '¿Habilitar' : '¿Deshabilitar'} al usuario ${u.name}?${enable ? '' : ' Ya no podrá iniciar sesión.'}`, async () => {
      if (u.raw) {
        await dbSdk.update({ ...u.raw, disabled: !enable ? true : null, updatedAt: now() });
      } else {
        // Usuario por defecto aún no guardado en la nube: se crea su ficha con el estado
        await dbSdk.create({
          type: 'user', name: u.username, code: u.password, description: u.name,
          status: u.role, permissions: (u.raw && u.raw.permissions) || [],
          disabled: !enable ? true : null, date: now()
        });
      }
      showToast(enable ? 'Usuario habilitado' : 'Usuario deshabilitado', 'success');
      render(); // Refleja el cambio sin tener que reabrir la pestaña
    }, enable ? 'Habilitar' : 'Deshabilitar');
  };

  // QR gafete por empleado (aquí se genera: 1er escaneo = entrada, 2do = salida)
  container.querySelectorAll('[data-user-qr]').forEach(btn => {
    btn.onclick = () => window.attendanceShowQr(btn.dataset.userQr);
  });

  // Ojito mostrar/ocultar contraseña en la tabla (protegida por defecto)
  container.querySelectorAll('[data-toggle-pwd]').forEach(btn => {
    btn.onclick = () => {
      const span = document.getElementById(`pwd-${btn.dataset.togglePwd}`);
      if (!span) return;
      const hidden = span.dataset.hidden !== '0';
      if (hidden) {
        span.textContent = btn.dataset.pwd;
        span.dataset.hidden = '0';
        btn.querySelector('i').dataset.lucide = 'eye-off';
        btn.title = 'Ocultar contraseña';
      } else {
        span.textContent = '••••••••';
        span.dataset.hidden = '1';
        btn.querySelector('i').dataset.lucide = 'eye';
        btn.title = 'Mostrar contraseña';
      }
      lucide.createIcons();
    };
  });

  document.getElementById('u-cancel').onclick = () => {
    editingUser = null;
    editingLeaveDays = [];
    try { leaveCalCursor = new Date(); leaveCalCursor.setDate(1); paintLeaveList(); paintLeaveCal(); } catch (_e) {}
    document.getElementById('user-form').reset();
    document.getElementById('u-role').disabled = false;
    document.getElementById('u-role').dispatchEvent(new Event('change'));
    document.querySelectorAll('input[name="u-perm"]').forEach(cb => cb.checked = true);
    // Reset de horario
    document.getElementById('u-sched-times').classList.add('hidden');
    document.getElementById('u-sched-times').classList.remove('flex');

    document.getElementById('u-form-title').textContent = 'Agregar Usuario';
    document.getElementById('u-btn').textContent = 'Agregar';
    document.getElementById('u-cancel').classList.add('hidden');
    document.getElementById('u-user').readOnly = false;
    document.getElementById('u-user').classList.remove('opacity-50', 'cursor-not-allowed');
    const ps = document.getElementById('pass-strength');
    if(ps) ps.classList.add('hidden');
    // Restaurar campo contraseña para modo agregar
    const passInput2 = document.getElementById('u-pass');
    const showBtn2 = document.getElementById('btn-show-pass-change');
    if(passInput2){ passInput2.classList.remove('hidden'); passInput2.required = true; }
    if(showBtn2) showBtn2.classList.add('hidden');
    document.getElementById('u-role').dispatchEvent(new Event('change'));
  };

  document.getElementById('user-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('u-name').value.trim();
    const username = document.getElementById('u-user').value.trim();
    const passInputEl = document.getElementById('u-pass');
    const isPassHidden = passInputEl.classList.contains('hidden');
    let pass = passInputEl.value;
    // Si está en edición y el campo está oculto (no quiere cambiar contraseña), conservar la anterior
    if(editingUser && isPassHidden){
      pass = editingUser.password;
    }
    // El administrador principal es fijo: nunca puede dejar de ser Administrador
    const role = (editingUser && editingUser.username === 'admin') ? 'admin' : document.getElementById('u-role').value;

    if (role === 'employee') {
      // El empleado solo existe para generar su QR: sin acceso al sistema
      pass = (editingUser && editingUser.password) ? editingUser.password : ('SINACCESO-' + Math.random().toString(36).slice(2, 10).toUpperCase());
    }
    if (!name || !username || (role !== 'employee' && !pass)) { showToast('Completa todos los campos', 'warn'); return; }
    if (!role) { showToast('Selecciona el rol del usuario', 'warn'); return; }

    const freshUsers = getUsers();
    const oldUsername = editingUser ? editingUser.username : '';
    const renamed = !!editingUser && username !== oldUsername;
    // Nombres reservados en la nube (incluye marcadores ocultos de renombrados)
    let cloudNames = [];
    try { cloudNames = records('user').map(r => String(r.name || '')); } catch (e) {}
    if (!editingUser) {
      if (freshUsers.find(u => u.username === username) || cloudNames.includes(username)) {
        showToast('Ese ID de Usuario ya existe', 'warn');
        return;
      }
    } else if (renamed) {
      // Al renombrar no puede quedar el nombre de OTRO usuario (ni visible ni oculto)
      if (freshUsers.find(u => u.username === username) || cloudNames.includes(username)) {
        showToast('Ese nombre de usuario ya está en uso', 'warn');
        return;
      }
    }

    const btn = document.getElementById('u-btn');
    btn.disabled = true; btn.textContent = 'Guardando...';

    // Jalar permisos solo si es admin
    // ... dentro de la función onsubmit
  // Jalar permisos solo si es admin
  const permissions = role === 'admin'
      ? Array.from(document.querySelectorAll('input[name="u-perm"]:checked')).map(cb => cb.value)
      : [];

  // Horario laboral (si está apagado se guarda desactivado para limpiar el anterior)
  const schedOn = document.getElementById('u-sched-enabled').checked;
  let leaveDaysToSave = [];
  try {
    const rawLeave = document.getElementById('u-leave-days').value;
    leaveDaysToSave = rawLeave ? JSON.parse(rawLeave) : editingLeaveDays.slice();
    if (!Array.isArray(leaveDaysToSave)) leaveDaysToSave = [];
    leaveDaysToSave = Array.from(new Set(leaveDaysToSave.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d))))).sort();
  } catch (_e) { try { leaveDaysToSave = editingLeaveDays.slice(); } catch (__e) { leaveDaysToSave = []; } }

  const data = {
    type: 'user',
    name: username,
    code: pass,
    category: '',
    buy_price: 0,
    sell_price: 0,
    stock: 0,
    min_stock: 0,
    quantity: 0,
    total: 0,
    payment_method: '',
    cashier: '',
    date: now(),
    amount: 0,
    description: name,
    status: role,
    initial_cash: 0,
    final_cash: 0,
    sales_total: 0,
    permissions: permissions,
    sched_enabled: schedOn,
    sched_start: schedOn ? (document.getElementById('u-sched-start').value || '09:00') : '',
    sched_end: schedOn ? (document.getElementById('u-sched-end').value || '18:00') : '',
    leave_days: leaveDaysToSave,
    kitchen_id: ''
  };

    if (editingUser) {
      if (editingUser.raw) {
        // Renombrar = actualizar la misma ficha con el nuevo nombre de usuario
        await dbSdk.update({ ...editingUser.raw, ...data, ...(renamed ? { renamed_from: oldUsername } : {}) });
      } else if (renamed) {
        // El usuario era por defecto (cajero1, etc.) y se le cambió el nombre:
        // se crea su ficha con el nombre nuevo y se oculta el anterior con un
        // marcador para que no aparezca duplicado en la lista.
        await dbSdk.create({ ...data, renamed_from: oldUsername });
        await dbSdk.create({
          type: 'user', name: oldUsername, code: '••••', description: 'Renombrado a ' + username,
          status: editingUser.role, hidden: true, disabled: true, date: now()
        });
      } else {
        await dbSdk.create(data);
      }
      // Si el usuario renombrado tiene sesión/caja abierta en ESTE equipo, se migra
      // para que no se le cierre ni pierda su turno.
      if (renamed) {
        try {
          const stored = JSON.parse(localStorage.getItem('pos_user') || 'null');
          if (stored && stored.username === oldUsername) {
            stored.username = username;
            if (stored.name === oldUsername || !stored.name) stored.name = name;
            localStorage.setItem('pos_user', JSON.stringify(stored));
            if (currentUser && currentUser.username === oldUsername) {
              currentUser.username = username;
              if (currentUser.name === oldUsername) currentUser.name = name;
            }
          }
        } catch (e) {}
      }
      showToast(renamed ? `Usuario renombrado a "${username}"` : 'Usuario actualizado correctamente');
    } else {
      await dbSdk.create(data);
      showToast('Usuario creado exitosamente');
    }

    const ps2 = document.getElementById('pass-strength'); if(ps2) ps2.classList.add('hidden');
    // Restaurar campo contraseña
    const passInput4 = document.getElementById('u-pass');
    const showBtn4 = document.getElementById('btn-show-pass-change');
    if(passInput4){ passInput4.classList.remove('hidden'); passInput4.required = true; }
    if(showBtn4) showBtn4.classList.add('hidden');
    document.getElementById('u-cancel').click(); // Resetea y oculta todo de forma limpia
    btn.disabled = false;
    render(); // Refleja el cambio sin tener que reabrir la pestaña
  };
}

// ========== QR GENÉRICO (gafetes de asistencia y enlaces) ==========
function qrMenuDataUrl(text, cell) {
  try {
    if (typeof window.qrcode !== 'function') return '';
    const qr = window.qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    return qr.createDataURL(cell || 4, 4);
  } catch (e) { return ''; }
}
// Modal con el QR del menú de una mesa (usado en Croquis de Mesas).

// Saludo/recordatorio a clientes por WhatsApp (Cartera de Clientes POS y admin).
// Global para que el botón funcione en ambas vistas sin depender del render.

function renderSettings(container) {
  const cloudConfig = records('config')[0] || {};
  const currentName = cloudConfig.business_name || defaultConfig.business_name;
  const currentSupport = cloudConfig.support_phone || defaultConfig.support_phone || '9619156443';
  const currentTolerance = (() => { try { const v = parseInt(cloudConfig.attendance_tolerance, 10); if (!isNaN(v)) return Math.min(120, Math.max(0, v)); } catch (e) {} try { const d = parseInt(defaultConfig.attendance_tolerance, 10); if (!isNaN(d)) return Math.min(120, Math.max(0, d)); } catch (_e) {} return 10; })();
  // Modo rendimiento: preferencia local de ESTE equipo (no va a la nube)
  const isPerf = (window.isPerfMode && window.isPerfMode());

  // Buscamos si ya hay un logo guardado en la colección independiente
  const savedLogoRecord = records('sys_file').find(f => f.name === 'main_logo');
  const currentLogo = savedLogoRecord ? savedLogoRecord.image : '';

  container.innerHTML = `
  <div class="fade-in space-y-4 pb-10">
    <h2 class="text-xl font-bold">Configuración Global (Nube)</h2>

    <div class="grid lg:grid-cols-2 gap-4">
      <div class="bg-surface rounded-xl p-5 border border-card space-y-4 shadow-sm">
        <h3 class="font-semibold text-accent flex items-center gap-2"><i data-lucide="settings" class="w-4 h-4"></i> Datos del Negocio</h3>
        <div>
          <label class="block text-sm text-muted mb-1">Nombre del Negocio</label>
          <input id="set-name" class="bg-card border border-card rounded-lg px-3 py-2 text-sm w-full focus:border-accent focus:outline-none" value="${currentName}">
        </div>
        <div>
          <label class="block text-sm text-muted mb-1">Teléfono de soporte (administrador)</label>
          <input id="set-support-phone" inputmode="tel" class="bg-card border border-card rounded-lg px-3 py-2 text-sm w-full focus:border-accent focus:outline-none" value="${currentSupport}" placeholder="Ej. 9619156443">
          <p class="text-[11px] text-muted mt-1">Se usa en el "¿Olvidaste tu contraseña?" del inicio de sesión.</p>
        </div>
        <div class="pt-3 mt-1 border-t border-card">
          <label class="block text-sm font-bold text-accent mb-1"><i data-lucide="gauge" class="w-4 h-4 inline-block mr-1"></i>Modo Rendimiento</label>
          <p class="text-xs text-muted mb-2">Para equipos de gama baja: quita animaciones, desenfoques y sombras para que todo fluya. Solo afecta a lo visual de este dispositivo y se aplica al instante (no necesita Guardar). Los pedidos, cronómetros y sincronización siguen en tiempo real.</p>
          <label class="scan-switch" title="Activar modo rendimiento en este equipo">
            <input type="checkbox" id="set-perf-mode" ${isPerf ? 'checked' : ''}>
            <span class="track"></span>
            <span class="text-xs font-bold text-txt">Rendimiento</span>
          </label>
        </div>
      </div>

      <div class="bg-surface rounded-xl p-5 border border-card space-y-4 shadow-sm">
        <h3 class="font-semibold text-accent2 flex items-center gap-2"><i data-lucide="image" class="w-4 h-4"></i> Logotipo del Sistema</h3>
        <p class="text-xs text-muted mb-3">Este logo aparecerá en el sistema y en los tickets impresos.</p>

        <div class="flex items-center gap-4">
          <div class="w-24 h-24 bg-card border border-dashed border-muted rounded-xl flex items-center justify-center overflow-hidden shrink-0">
            ${currentLogo ? `<img id="preview-logo" src="${currentLogo}" class="w-full h-full object-contain">` : `<i id="preview-icon" data-lucide="image" class="w-8 h-8 text-muted"></i><img id="preview-logo" class="hidden w-full h-full object-contain">`}
          </div>
          <div class="flex-1 space-y-2">
            <input id="logo-file" type="file" accept="image/*" class="text-xs text-muted bg-card p-2 rounded border border-card w-full cursor-pointer">
            <input id="logo-base64" type="hidden" value="${currentLogo}">
            <button type="button" id="upload-logo-btn" class="bg-accent2 text-white text-xs font-bold px-3 py-2 rounded shadow hover:opacity-90 transition disabled:opacity-50">Guardar Logo Independiente</button>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-surface rounded-xl p-5 border border-card space-y-3 shadow-sm">
      <h3 class="font-semibold text-accent flex items-center gap-2"><i data-lucide="timer" class="w-4 h-4"></i> Checador · Tolerancia de entrada</h3>
      <p class="text-xs text-muted">Minutos de gracia después de la <b class="text-txt">hora de entrada</b> de cada usuario antes de marcar <b class="text-txt">RETARDO</b>. Se aplica a todo el personal y se sincroniza en la nube.</p>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs text-muted mb-1">Tolerancia (minutos)</label>
          <div class="flex items-center gap-2">
            <input id="set-tolerance" type="number" min="0" max="120" step="1" value="${currentTolerance}" class="bg-card border border-card rounded-lg px-3 py-2 text-sm w-28 focus:border-accent focus:outline-none font-bold">
            <span class="text-xs text-muted font-bold">min</span>
          </div>
        </div>
        <div class="flex gap-1.5">
          <button type="button" data-tol="0" class="tol-preset text-[11px] font-bold px-3 py-1.5 rounded-lg bg-card border border-card text-muted hover:text-txt transition">0</button>
          <button type="button" data-tol="5" class="tol-preset text-[11px] font-bold px-3 py-1.5 rounded-lg bg-card border border-card text-muted hover:text-txt transition">5</button>
          <button type="button" data-tol="10" class="tol-preset text-[11px] font-bold px-3 py-1.5 rounded-lg bg-card border border-card text-muted hover:text-txt transition">10</button>
          <button type="button" data-tol="15" class="tol-preset text-[11px] font-bold px-3 py-1.5 rounded-lg bg-card border border-card text-muted hover:text-txt transition">15</button>
          <button type="button" data-tol="30" class="tol-preset text-[11px] font-bold px-3 py-1.5 rounded-lg bg-card border border-card text-muted hover:text-txt transition">30</button>
        </div>
        <p class="text-[11px] text-muted w-full" id="set-tolerance-preview">Ej. entrada 09:00 + ${currentTolerance} min → a tiempo hasta las <b class="text-txt" id="set-tolerance-preview-hm">--:--</b>.</p>
      </div>
    </div>

    <button id="set-save" class="bg-accent text-bg font-bold px-6 py-3 rounded-lg hover:opacity-90 transition text-sm flex items-center gap-2 shadow-lg mt-4">
      <i data-lucide="cloud-upload" class="w-5 h-5"></i> Guardar Configuración Principal
    </button>
  </div>`;

  // Lógica para previsualizar y comprimir el logo
  document.getElementById('logo-file').onchange = async (e) => {
    if (e.target.files[0]) {
      showToast('Procesando imagen...', 'info');
      const base64Logo = await compressLogo(e.target.files[0]);
      document.getElementById('logo-base64').value = base64Logo;

      const previewImg = document.getElementById('preview-logo');
      const previewIcon = document.getElementById('preview-icon');

      previewImg.src = base64Logo;
      previewImg.classList.remove('hidden');
      if(previewIcon) previewIcon.classList.add('hidden');

      showToast('Logo listo para guardar', 'success');
    }
  };

  // Lógica para guardar SOLO el logo en la colección 'archivos_sistema'
  document.getElementById('upload-logo-btn').onclick = async () => {
    const base64 = document.getElementById('logo-base64').value;
    if(!base64) return showToast('Selecciona una imagen primero', 'warn');

    const btn = document.getElementById('upload-logo-btn');
    btn.disabled = true; btn.textContent = 'Subiendo...';

    const existingLogo = records('sys_file').find(f => f.name === 'main_logo');

    const logoData = { type: 'sys_file', name: 'main_logo', image: base64, date: now() };

    if (existingLogo) {
      await dbSdk.update({ ...existingLogo, ...logoData });
    } else {
      await dbSdk.create(logoData);
    }

    showToast('Logo actualizado en la nube', 'success');
    btn.disabled = false; btn.textContent = 'Guardar Logo Independiente';
  };

  // Switch Modo Rendimiento: preferencia local, se aplica al instante sin PIN ni Guardar
  const perfModeSw = document.getElementById('set-perf-mode');
  if (perfModeSw) perfModeSw.onchange = () => {
    window.setPerfMode(perfModeSw.checked);
    showToast(perfModeSw.checked ? 'Modo rendimiento activado en este equipo' : 'Modo rendimiento desactivado', 'success');
  };

  // Tolerancia: presets + vista previa (09:00 + N min)
  try {
    const tolInput = document.getElementById('set-tolerance');
    const paintTolPrev = () => {
      try {
        let v = parseInt((tolInput && tolInput.value) || '0', 10);
        if (isNaN(v)) v = 0;
        v = Math.min(120, Math.max(0, v));
        const base = 9 * 60 + v;
        const hh = String(Math.floor(base / 60) % 24).padStart(2, '0');
        const mm = String(base % 60).padStart(2, '0');
        const prev = document.getElementById('set-tolerance-preview');
        if (prev) prev.innerHTML = 'Ej. entrada 09:00 + ' + v + ' min → a tiempo hasta las <b class="text-txt" id="set-tolerance-preview-hm">' + hh + ':' + mm + '</b>.';
      } catch (_e) {}
    };
    if (tolInput) tolInput.oninput = paintTolPrev;
    if (tolInput) tolInput.onchange = () => { try { let v = parseInt(tolInput.value || '0', 10); if (isNaN(v)) v = 0; tolInput.value = Math.min(120, Math.max(0, v)); } catch (_e) {} paintTolPrev(); };
    container.querySelectorAll('.tol-preset').forEach(b => { b.onclick = () => { if (tolInput) { tolInput.value = b.dataset.tol; paintTolPrev(); } }; });
    paintTolPrev();
  } catch (_e) {}

  // Lógica para guardar la configuración principal
  document.getElementById('set-save').onclick = async () => {
    const btn = document.getElementById('set-save');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Sincronizando...';
    let tolVal = 10;
    try { const raw = document.getElementById('set-tolerance').value; tolVal = parseInt(raw, 10); if (isNaN(tolVal)) tolVal = 10; tolVal = Math.min(120, Math.max(0, tolVal)); } catch (_e) { tolVal = 10; }

    const configData = {
      type: 'config',
      business_name: document.getElementById('set-name').value.trim() || 'Mi Negocio',
      support_phone: document.getElementById('set-support-phone').value.trim() || '9619156443',
      attendance_tolerance: tolVal,
      // Paletas sincronizadas: también van a la nube para replicarse en todos los dispositivos
      palette_light: window.getPaletteForMode('light'),
      palette_dark: window.getPaletteForMode('dark')
    };

    const existingConfig = records('config')[0];

    if (existingConfig) await dbSdk.update({ ...existingConfig, ...configData });
    else await dbSdk.create(configData);
    try { defaultConfig.attendance_tolerance = tolVal; try { localStorage.setItem('pos_att_tolerance', String(tolVal)); } catch (_e) {} } catch (_e) {}

    showToast('Configuración sincronizada en todos los dispositivos', 'success');

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="cloud-upload" class="w-5 h-5"></i> Guardar Configuración Principal';
      render();
    }, 500);
  };

  lucide.createIcons();
}

// Tabla de historial de ventas COMPARTIDA por caja y administración (mismo componente).
// opts: { cashier: username o null (null = todos), since: iso o null, title, empty, limit }
// Visor de copias de ticket del historial (Ventas/Historial de caja y admin).
// Vive a nivel global: antes estaba anidado dentro del POS y en "Pedidos y
// Ventas" fallaba en silencio si la caja nunca se había abierto en la sesión.
// Global para que caja y admin usen el mismo visor de tickets

// Tarjeta de pedido COMPARTIDA por caja y administración (mismo componente).
// opts: { showBill: bool (palomita a caja, solo cajero), allOrders: array (insignia Extra), onBill: fn }

// (Punto de venta / caja eliminado: solo checador y asistencia)
// ========== ESCUCHA MULTICAJA EN TIEMPO REAL (OPTIMIZADA) ==========

const coleccionesCatalogos = ['usuarios', 'configuracion', 'archivos_sistema', 'asistencias'];

coleccionesCatalogos.forEach(colName => {
  onSnapshot(collection(db, colName), procesarSnapshot);
});

// Asistencia: solo tiempo real de catálogos (sin históricos de ventas).

let snapshotTimer = null;

function procesarSnapshot(snapshot) {
// ... el resto de tu código continúa igual ...
    let hasChanges = false;

    snapshot.docChanges().forEach((change) => {
      hasChanges = true;
      const docData = { id: change.doc.id, ...change.doc.data() };

      const index = allRecords.findIndex(r => r.id === change.doc.id);
      if (change.type === "added" || change.type === "modified") {
        if (index !== -1) allRecords[index] = docData;
        else allRecords.push(docData);
      }
      if (change.type === "removed") {
        if (index !== -1) allRecords.splice(index, 1);
      }
    });
    // ... el resto de la función sigue igual
    // ... el resto de la función sigue igual

    if (hasChanges) {
    try {
      const cloudLogo = allRecords.find(r => r.type === 'sys_file' && r.name === 'main_logo');
      try { if (cloudLogo && cloudLogo.image) localStorage.setItem('pos_system_logo', cloudLogo.image); } catch (e) {}

      const cloudConfig = allRecords.find(r => r.type === 'config');
      if (cloudConfig) {
        defaultConfig.business_name = cloudConfig.business_name || 'Mi Negocio';
        defaultConfig.support_phone = cloudConfig.support_phone || '9619156443';
        defaultConfig.currency_symbol = cloudConfig.currency_symbol || '$';
        defaultConfig.whatsapp_number = cloudConfig.whatsapp_number || '';
        defaultConfig.admin_pin = cloudConfig.admin_pin || '790208';
        try {
          const tv = parseInt(cloudConfig.attendance_tolerance, 10);
          defaultConfig.attendance_tolerance = isNaN(tv) ? 10 : Math.min(120, Math.max(0, tv));
          try { localStorage.setItem('pos_att_tolerance', String(defaultConfig.attendance_tolerance)); } catch (_e) {}
        } catch (_e) {}

        localStorage.setItem('pos_biz_name', defaultConfig.business_name);
        try { localStorage.setItem('pos_support_phone', defaultConfig.support_phone); } catch (e) {}
        localStorage.setItem('pos_currency', defaultConfig.currency_symbol);
        localStorage.setItem('pos_wa_number', defaultConfig.whatsapp_number);
        localStorage.setItem('pos_admin_pin', defaultConfig.admin_pin);

        // Sincronizar paleta de colores en tiempo real desde la nube.
        // Solo se acepta la oficial (claro = azul Bajaj,
        // oscuro = azul marino): cualquier paleta vieja de la nube
        // (blanco y negro, verde oliva, etc.) se migra antes
        // de guardarla para que no regrese el error.
        const sanitizeCloudPalette = (p, m) => {
          const defs = m === 'dark' ? window.DEFAULT_DARK_PALETTE : window.DEFAULT_PALETTE;
          const n = (v) => String(v || '').trim().toUpperCase();
          if (!p || typeof p !== 'object') return Object.assign({}, defs);
          const mg = Object.assign({}, defs, p);
          const coreOk = ['bg', 'surface', 'accent', 'txt'].every(k => n(mg[k]) === n(defs[k]));
          if (!coreOk) return Object.assign({}, defs);
          if (!mg.fin) mg.fin = defs.fin;
          if (m === 'light' && ['#000000', '#111111'].includes(n(mg.danger))) mg.danger = defs.danger;
          return mg;
        };
        try { localStorage.setItem('pos_palette', JSON.stringify(sanitizeCloudPalette(cloudConfig.palette_light, 'light'))); } catch(e) {}
        try { localStorage.setItem('pos_palette_dark', JSON.stringify(sanitizeCloudPalette(cloudConfig.palette_dark, 'dark'))); } catch(e) {}
        // Aplica la paleta del modo actual al instante
        try { if (window.applyPalette) window.applyPalette(window.getSavedPalette()); } catch (e) {}

        try {
          const headers = document.querySelectorAll('header span.font-bold, h1.text-2xl.font-bold');
          headers.forEach(h => h.textContent = defaultConfig.business_name);
        } catch (e) {}
      }
    } catch (e) { try { console.warn('snapshot-config', e); } catch (_e) {} }

    // --- ACTUALIZACIÓN DE VISTAS EN VIVO ---
    clearTimeout(snapshotTimer);
      snapshotTimer = setTimeout(() => {
        try {
          if (currentView.startsWith('cashier-')) {
            const posSearch = document.getElementById('pos-search');
            if (!posSearch) {
              render();
            } else {
              try { if (typeof renderPosCategories === 'function') renderPosCategories(); } catch (e) {}
              if (posSearch) posSearch.dispatchEvent(new Event('input'));
              if (window.updateCashBadge) window.updateCashBadge();
            }
          } else if (currentView === 'admin-inventory') {
            // Redibujamos de forma fluida y sin parpadeos
            if (window.refreshInventoryViews) window.refreshInventoryViews();
          } else if (['login', 'checker-view', 'admin-attendance', 'admin-attendance-dash', 'admin-users', 'admin-settings'].includes(currentView)) {
            render();
          }
        } catch (e) {}

      }, 100);
    }
  }

  window.updateNetworkStatus = () => {
    const isOnline = navigator.onLine;
    if (!isOnline) {
      window.__setSyncState('offline');
      showToast('Se perdió la conexión. Entrando en Modo Offline.', 'warn');
    } else if (isOnline && currentUser) {
      window.__setSyncState('syncing');
      try { window.__syncEngine.fails = 0; } catch (e) {}
      showToast('Conexión restaurada. Subiendo pendientes…', 'success');
      // Verificación REAL: espera a que las escrituras pendientes terminen de subir a la nube.
      // Con datos débiles la cola (fotos, tickets) tarda minutos: 60s sin bloquear la interfaz.
      Promise.race([
        waitForPendingWrites(db),
        new Promise((res) => setTimeout(res, 60000))
      ]).then(() => {
        try { window.__syncFlush && window.__syncFlush(); } catch (e) {}
        window.__syncPing();
        showToast('Sincronización completa — todo está en la nube', 'success');
      }).catch(() => window.__syncPing());
    }
  };

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  // Regreso de segundo plano / pantalla apagada (Android, iOS, PC): re-activa todo
  // al instante desde caché local — no espera a la red lenta para responder.
  document.addEventListener('visibilitychange', () => {
    try {
      if (document.hidden) { window.__hiddenAt = Date.now(); return; }
      window.__ensureWakeLock && window.__ensureWakeLock();
      window.__syncPing && window.__syncPing();
      try { tickKitchenTimers(); } catch (e) {}
      const away = Date.now() - (window.__hiddenAt || Date.now());
      window.__hiddenAt = 0;
      // Más de 1 min fuera: repinta la vista viva por si entró algo mientras tanto
      if (away > 60000) { try { render(); } catch (e) {} }
    } catch (e) {}
  });

  render();

// ========== LÓGICA DEL ESCÁNER DE CÁMARA (IPAD) ==========
let html5QrcodeScanner = null;
let scannerLoadingTimer = null;

// Muestra un estado de carga legible hasta que la cámara emita video

// === PREFILTRO DE PERMISO DE CÁMARA (APK/WebView como Median) ===
// En Android el diálogo "¿Permitir cámara?" aparece con esta llamada; así sabemos
// de inmediato si quedó denegado para guiar al usuario o usar la cámara nativa.
window.__ensureCameraPermission = async () => {
  try {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return 'unsupported';
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach(t => t.stop());
    return 'granted';
  } catch (e) {
    return 'denied';
  }
};

// === FALLBACK PARA ANDROID APK / WEBVIEW (ej. Median): dentro de un WebView no hay
// getUserMedia, así que abrimos la CÁMARA NATIVA del teléfono con un <input capture>
// y decodificamos la foto con html5-qrcode (scanFile). ===
let __nativeCamInput = null;

// Aplicar descuento desde código escaneado
