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
    // Iniciar gravação do perímetro
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
    // Finalizar e calcular
    gravando = false;
    navigator.geolocation.clearWatch(watchID);
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

function calcularLinhasNoCerco() {
  if (pontosPerimetro.length < 3 || typeof json_Mesclado_0 === 'undefined') {
    alert('Pontos insuficientes para fechar o cerco ou camadas do mapa não carregadas.');
    return;
  }

  const coordsGeoJSON = pontosPerimetro.map(p => [p[1], p[0]]);
  coordsGeoJSON.push([pontosPerimetro[0][1], pontosPerimetro[0][0]]); // Fechar anel
  const poligonoTurf = turf.polygon([coordsGeoJSON]);
  
  let totalLinhas = 0;
  let totalPes = 0;

  // Limpar destaques anteriores
  linhasDestacadas.forEach(l => map.removeLayer(l));
  linhasDestacadas = [];

  json_Mesclado_0.features.forEach(feature => {
    try {
      const linhaTurf = turf.lineString(feature.geometry.coordinates);
      // Verifica se a linha cruza ou está dentro do cerco
      const dentro = turf.booleanIntersects(linhaTurf, poligonoTurf);
      
      if (dentro) {
        totalLinhas++;
        
        // Comprimento em metros * 2 fileiras / 0.8m
        const lenMeters = turf.length(linhaTurf, { units: 'meters' });
        const pesLinha = Math.round((lenMeters / 0.8) * 2);
        totalPes += pesLinha;

        // Destacar linha colhida no mapa com cor verde
        const camadaVerde = L.geoJSON(feature, {
          style: { color: '#27ae60', weight: 6, opacity: 0.8 }
        }).addTo(map);
        linhasDestacadas.push(camadaVerde);
      }
    } catch(e) {}
  });

  document.getElementById('resultado-colheita').style.display = 'block';
  document.getElementById('res-linhas').innerText = Math.round(totalLinhas / 2); // 2 traçados = 1 linha física
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
