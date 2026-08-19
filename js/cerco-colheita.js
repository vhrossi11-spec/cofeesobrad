// Painel Flutuante da Colheita
const painelHTML = `
<div id="painel-colheita" style="position: fixed; top: 10px; right: 10px; z-index: 1000; background: rgba(255,255,255,0.95); padding: 12px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); font-family: sans-serif; max-width: 280px;">
  <h4 style="margin: 0 0 8px 0; color: #2c3e50; font-size: 14px;">🚜 Colheita por Cerco GPS</h4>
  <div id="status-cerco" style="font-size: 12px; margin-bottom: 8px; color: #7f8c8d;">Aguardando início...</div>
  <button id="btn-cerco" onclick="toggleCerco()" style="width: 100%; padding: 8px; background: #27ae60; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; margin-bottom: 5px;">🔴 Iniciar Cerco</button>
  <button id="btn-limpar" onclick="limparCerco()" style="width: 100%; padding: 6px; background: #e74c3c; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; display: none;">🔄 Limpar Área</button>
  <div id="resultado-colheita" style="margin-top: 8px; font-size: 13px; font-weight: bold; color: #2c3e50; display: none;">
    <div>Linhas no Cerco: <span id="res-linhas" style="color: #27ae60;">0</span></div>
    <div>Total de Pés: <span id="res-pes" style="color: #27ae60;">0</span></div>
  </div>
</div>
`;

document.body.insertAdjacentHTML('beforeend', painelHTML);

let gravando = false;
let pontosPerimetro = [];
let camadaPoligono = null;
let watchID = null;
let linhasDestacadas = [];

function toggleCerco() {
  if (!gravando) {
    gravando = true;
    pontosPerimetro = [];
    document.getElementById('btn-cerco').innerText = '⏹️ Fechar Cerco e Calcular';
    document.getElementById('btn-cerco').style.background = '#e67e22';
    document.getElementById('status-cerco').innerText = 'Caminhe pelo contorno da área...';
    document.getElementById('btn-limpar').style.display = 'none';
    
    if (navigator.geolocation) {
      watchID = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          pontosPerimetro.push([lat, lng]);
          atualizarPoligono();
        },
        (err) => alert('Erro no GPS: ' + err.message),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }
  } else {
    gravando = false;
    if (watchID) navigator.geolocation.clearWatch(watchID);
    document.getElementById('btn-cerco').innerText = '🔴 Novo Cerco';
    document.getElementById('btn-cerco').style.background = '#27ae60';
    document.getElementById('btn-limpar').style.display = 'block';
    document.getElementById('status-cerco').innerText = 'Cerco finalizado!';
    calcularLinhasNoCerco();
  }
}

function atualizarPoligono() {
  if (pontosPerimetro.length < 2) return;
  
  if (camadaPoligono) {
    map.removeLayer(camadaPoligono);
  }
  
  camadaPoligono = L.polygon(pontosPerimetro, {
    color: '#e67e22',
    fillColor: '#f39c12',
    fillOpacity: 0.3,
    weight: 3
  }).addTo(map);
}

function cruzouSegmento(p1, p2, p3, p4) {
  function ccw(A, B, C) {
    return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
  }
  return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
}

function pontoEmPoligono(pt, poly) {
  let x = pt[0], y = pt[1], dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    let xi = poly[i][0], yi = poly[i][1];
    let xj = poly[j][0], yj = poly[j][1];
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) dentro = !dentro;
  }
  return dentro;
}

function linhaInterseccionaPoligono(coords, poly) {
  for (let pt of coords) {
    if (pontoEmPoligono(pt, poly)) return true;
  }
  for (let k = 0; k < coords.length - 1; k++) {
    let p1 = coords[k], p2 = coords[k+1];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      let p3 = poly[j], p4 = poly[i];
      if (cruzouSegmento(p1, p2, p3, p4)) return true;
    }
  }
  return false;
}

function calcularMetros(feature) {
  let coordsList = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  let m = 0, R = 6371000;
  coordsList.forEach(line => {
    for (let i = 0; i < line.length - 1; i++) {
      let p1 = line[i], p2 = line[i+1];
      let lat1 = p1[1] * Math.PI / 180, lat2 = p2[1] * Math.PI / 180;
      let dLat = (p2[1] - p1[1]) * Math.PI / 180;
      let dLng = (p2[0] - p1[0]) * Math.PI / 180;
      let a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
      m += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
  });
  return m;
}

function calcularLinhasNoCerco() {
  if (pontosPerimetro.length < 3 || typeof json_Mesclado_0 === 'undefined') {
    alert('Pontos insuficientes para fechar o cerco ou camadas do mapa não carregadas.');
    return;
  }

  const polyGeoJSON = pontosPerimetro.map(p => [p[1], p[0]]);
  polyGeoJSON.push([polyGeoJSON[0][0], polyGeoJSON[0][1]]);
  
  let totalLinhas = 0;
  let totalPes = 0;

  linhasDestacadas.forEach(l => map.removeLayer(l));
  linhasDestacadas = [];

  json_Mesclado_0.features.forEach(feature => {
    try {
      let lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      let cruzou = lines.some(lineCoords => linhaInterseccionaPoligono(lineCoords, polyGeoJSON));

      if (cruzou) {
        totalLinhas++;
        let lenMeters = calcularMetros(feature);
        totalPes += Math.round((lenMeters / 0.8) * 2);

        let camadaVerde = L.geoJSON(feature, {
          style: { color: '#27ae60', weight: 6, opacity: 0.8 }
        }).addTo(map);
        linhasDestacadas.push(camadaVerde);
      }
    } catch(e) {}
  });

  document.getElementById('resultado-colheita').style.display = 'block';
  document.getElementById('res-linhas').innerText = Math.round(totalLinhas / 2);
  document.getElementById('res-pes').innerText = Math.round(totalPes / 2).toLocaleString('pt-BR');
}

function limparCerco() {
  if (camadaPoligono) map.removeLayer(camadaPoligono);
  linhasDestacadas.forEach(l => map.removeLayer(l));
  linhasDestacadas = [];
  pontosPerimetro = [];
  document.getElementById('resultado-colheita').style.display = 'none';
  document.getElementById('status-cerco').innerText = 'Aguardando início...';
  document.getElementById('btn-limpar').style.display = 'none';
}
