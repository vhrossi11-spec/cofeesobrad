(function () {
  'use strict';

  if (typeof L === 'undefined' || typeof map === 'undefined') {
    console.warn('Ferramenta de percurso: mapa não encontrado.');
    return;
  }

  var TRACKS_KEY = 'cafeSobrado_tracks_v2';
  var ACTIVE_KEY = 'cafeSobrado_activeTrack_v2';
  var tracks = load(TRACKS_KEY, []);
  var activeTrack = load(ACTIVE_KEY, null);
  var watchId = null;
  var tracking = false;
  var lastAccepted = null;
  var trackLayer = L.layerGroup().addTo(map);

  var css = document.createElement('style');
  css.textContent = `
    .track-toolbar { position:fixed; right:10px; bottom:18px; z-index:11000; display:flex; flex-direction:column; gap:8px; }
    .track-btn { width:50px; height:50px; border:0; border-radius:50%; background:#fff; color:#222; box-shadow:0 2px 8px rgba(0,0,0,.30); font-size:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .track-btn.recording { background:#b00020; color:#fff; }
    .track-panel { position:fixed; right:10px; bottom:78px; z-index:11001; width:min(330px,calc(100vw - 20px)); background:#fff; border-radius:14px; box-shadow:0 4px 18px rgba(0,0,0,.30); padding:14px; font-family:Arial,sans-serif; display:none; }
    .track-panel.open { display:block; }
    .track-panel h3 { margin:0 0 10px; font-size:18px; }
    .track-stat { background:#f2f5f2; padding:9px 10px; border-radius:9px; font-size:13px; margin:7px 0; }
    .track-row { display:flex; gap:7px; margin:8px 0; }
    .track-action { flex:1; min-height:42px; border:1px solid #ccc; border-radius:9px; background:#f7f7f7; font-weight:600; cursor:pointer; }
    .track-action.primary { background:#2f6b3b; color:#fff; border-color:#2f6b3b; }
    .track-action.danger { background:#b00020; color:#fff; border-color:#b00020; }
    .track-close { float:right; border:0; background:transparent; font-size:20px; cursor:pointer; }
    .track-toast { position:fixed; z-index:12000; left:50%; bottom:85px; transform:translateX(-50%); background:rgba(0,0,0,.82); color:#fff; padding:9px 13px; border-radius:18px; font:13px Arial,sans-serif; display:none; white-space:nowrap; }
    .track-list { margin-top:10px; max-height:180px; overflow:auto; }
    .track-item { padding:8px 0; border-bottom:1px solid #eee; font-size:13px; }
  `;
  document.head.appendChild(css);

  var toolbar = document.createElement('div');
  toolbar.className = 'track-toolbar';
  toolbar.innerHTML = '<button class="track-btn" id="track-menu" title="Percurso">🚶</button>';
  document.body.appendChild(toolbar);

  var panel = document.createElement('div');
  panel.className = 'track-panel';
  panel.innerHTML = `
    <button class="track-close" id="track-close">×</button>
    <h3>🚶 Percurso da lavoura</h3>
    <div class="track-stat" id="track-status">GPS: aguardando posição…</div>
    <div class="track-row">
      <button class="track-action primary" id="track-start">🔴 Iniciar</button>
      <button class="track-action" id="track-stop">⏹ Parar</button>
    </div>
    <div class="track-stat" id="track-live">Nenhum percurso em gravação.</div>
    <div class="track-row">
      <button class="track-action" id="track-export">⬇ Exportar</button>
      <button class="track-action" id="track-clear">🗑 Limpar</button>
    </div>
    <div class="track-list" id="track-list"></div>
  `;
  document.body.appendChild(panel);

  var toast = document.createElement('div');
  toast.className = 'track-toast';
  document.body.appendChild(toast);

  renderSavedTracks();
  updatePanel();

  if (activeTrack && activeTrack.coords && activeTrack.coords.length) {
    drawTrack(activeTrack.coords, true);
    showToast('Percurso em andamento recuperado.');
  }

  document.getElementById('track-menu').onclick = function () { panel.classList.toggle('open'); updatePanel(); };
  document.getElementById('track-close').onclick = function () { panel.classList.remove('open'); };
  document.getElementById('track-start').onclick = startTracking;
  document.getElementById('track-stop').onclick = stopTracking;
  document.getElementById('track-export').onclick = exportGeoJSON;
  document.getElementById('track-clear').onclick = clearTracks;

  function load(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { showToast('Não foi possível salvar no celular.'); return false; }
  }
  function showToast(text) {
    toast.textContent = text;
    toast.style.display = 'block';
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.style.display = 'none'; }, 2600);
  }
  function haversine(a, b) {
    var R = 6371000, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    var dp = (b.lat - a.lat) * Math.PI / 180, dl = (b.lng - a.lng) * Math.PI / 180;
    var x = Math.sin(dp/2)*Math.sin(dp/2) + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)*Math.sin(dl/2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }
  function pathDistance(coords) {
    var total = 0;
    for (var i=1; i<coords.length; i++) total += haversine(coords[i-1], coords[i]);
    return total;
  }
  function formatDistance(m) { return m >= 1000 ? (m/1000).toFixed(2) + ' km' : Math.round(m) + ' m'; }
  function drawTrack(coords, active) {
    if (!coords || coords.length < 2) return;
    L.polyline(coords.map(function (p) { return [p.lat, p.lng]; }), {
      color: active ? '#ff9800' : '#d32f2f',
      weight: 5,
      opacity: .9,
      dashArray: active ? '8 7' : null
    }).addTo(trackLayer);
  }
  function renderSavedTracks() {
    trackLayer.clearLayers();
    tracks.forEach(function (t) { drawTrack(t.coords, false); });
    if (activeTrack && activeTrack.coords) drawTrack(activeTrack.coords, true);
  }
  function startTracking() {
    if (!navigator.geolocation) { showToast('Este celular não oferece GPS no navegador.'); return; }
    if (tracking) return;
    tracking = true;
    lastAccepted = null;
    activeTrack = { id:'track-' + Date.now(), startedAt:new Date().toISOString(), coords:[] };
    save(ACTIVE_KEY, activeTrack);
    document.getElementById('track-menu').classList.add('recording');
    document.getElementById('track-start').classList.add('danger');
    document.getElementById('track-start').textContent = '🔴 Gravando…';
    showToast('Gravação iniciada. Caminhe normalmente.');
    watchId = navigator.geolocation.watchPosition(onPosition, onGeoError, {
      enableHighAccuracy:true,
      maximumAge:2000,
      timeout:15000
    });
  }
  function stopTracking() {
    if (!tracking && !(activeTrack && activeTrack.coords && activeTrack.coords.length)) {
      showToast('Nenhum percurso em gravação.'); return;
    }
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    tracking = false;
    if (activeTrack && activeTrack.coords && activeTrack.coords.length >= 2) {
      activeTrack.endedAt = new Date().toISOString();
      activeTrack.distanceM = Math.round(pathDistance(activeTrack.coords));
      tracks.push(activeTrack);
      save(TRACKS_KEY, tracks);
      showToast('Percurso salvo: ' + formatDistance(activeTrack.distanceM));
    } else {
      showToast('Poucos pontos para salvar o percurso.');
    }
    activeTrack = null;
    localStorage.removeItem(ACTIVE_KEY);
    document.getElementById('track-menu').classList.remove('recording');
    document.getElementById('track-start').classList.remove('danger');
    document.getElementById('track-start').textContent = '🔴 Iniciar';
    renderSavedTracks();
    updatePanel();
  }
  function onPosition(pos) {
    var lat = pos.coords.latitude, lng = pos.coords.longitude, accuracy = pos.coords.accuracy || 9999;
    document.getElementById('track-status').textContent = 'GPS: ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + ' · precisão ~' + Math.round(accuracy) + ' m';
    if (!tracking) return;
    if (accuracy > 40) return;
    var p = {lat:lat, lng:lng, accuracy:accuracy, timestamp:pos.timestamp};
    if (lastAccepted) {
      var d = haversine(lastAccepted, p);
      if (d < 2.5) return;
      if (d > 150 && accuracy > 20) return;
    }
    activeTrack.coords.push(p);
    lastAccepted = p;
    save(ACTIVE_KEY, activeTrack);
    renderSavedTracks();
    updatePanel();
  }
  function onGeoError(err) {
    var msg = err.code === 1 ? 'Permita o acesso à localização.' : err.code === 2 ? 'GPS indisponível.' : 'Tempo esgotado procurando GPS.';
    showToast(msg);
  }
  function updatePanel() {
    var total = tracks.reduce(function (sum,t) { return sum + (t.distanceM || pathDistance(t.coords || [])); }, 0);
    var live = activeTrack && activeTrack.coords ? pathDistance(activeTrack.coords) : 0;
    document.getElementById('track-live').innerHTML = activeTrack
      ? '<b>Gravando:</b> ' + formatDistance(live) + ' · ' + activeTrack.coords.length + ' posições'
      : '<b>Total salvo:</b> ' + formatDistance(total);
    var list = document.getElementById('track-list');
    if (!tracks.length) { list.innerHTML = '<div style="color:#666;font-size:12px">Os percursos ficam salvos neste celular e continuam disponíveis sem internet.</div>'; return; }
    list.innerHTML = tracks.map(function(t,i){
      var start = new Date(t.startedAt).toLocaleString();
      return '<div class="track-item"><b>Percurso '+(i+1)+'</b><br>'+start+'<br>'+formatDistance(t.distanceM || pathDistance(t.coords || []))+' · '+(t.coords || []).length+' posições</div>';
    }).join('');
  }
  function clearTracks() {
    if (!tracks.length && !activeTrack) { showToast('Não há percursos salvos.'); return; }
    if (!confirm('Apagar todos os percursos salvos neste celular?')) return;
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    tracking = false;
    tracks = [];
    activeTrack = null;
    localStorage.removeItem(TRACKS_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    document.getElementById('track-menu').classList.remove('recording');
    document.getElementById('track-start').classList.remove('danger');
    document.getElementById('track-start').textContent = '🔴 Iniciar';
    renderSavedTracks();
    updatePanel();
    showToast('Percursos apagados.');
  }
  function exportGeoJSON() {
    if (!tracks.length) { showToast('Nenhum percurso salvo para exportar.'); return; }
    var fc = {
      type:'FeatureCollection',
      features:tracks.map(function(t,i){
        return {
          type:'Feature',
          properties:{
            nome:'Percurso '+(i+1),
            inicio:t.startedAt,
            fim:t.endedAt || null,
            distancia_m:t.distanceM || Math.round(pathDistance(t.coords || []))
          },
          geometry:{
            type:'LineString',
            coordinates:(t.coords || []).map(function(p){ return [p.lng,p.lat]; })
          }
        };
      })
    };
    var blob = new Blob([JSON.stringify(fc,null,2)], {type:'application/geo+json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'percursos-cafe-sobrado.geojson';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); },1000);
    showToast('GeoJSON exportado.');
  }
})();
