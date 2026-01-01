// ============================================================
// 1. INISIALISASI MAP & BASEMAP
// ============================================================
var map = L.map('map').setView([-6.931899954351185, 106.92898164923656], 10);

var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap',
}).addTo(map);

var esriSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles © Esri',
});

// ============================================================
// 2. LAYER GROUPS
// ============================================================
var markersLayer = L.layerGroup().addTo(map);
var polylineLayer = L.layerGroup().addTo(map);
var polygonLayer = L.layerGroup().addTo(map);
var floodPointsLayer = L.layerGroup().addTo(map);
var bufferLayer = L.layerGroup().addTo(map);
var weatherLayer = L.layerGroup().addTo(map);
var geoAiHeatmapLayer = L.layerGroup();
var geoAiLayer = L.layerGroup().addTo(map);
var adminLayer = L.layerGroup().addTo(map);
var riskAnalysisLayer = L.layerGroup().addTo(map);

// ============================================================
// 3. KONFIGURASI GLOBAL & UTILS
// ============================================================
const latCisolok = -6.94634;
const lngCisolok = 106.448544;
let sungaiGeoJson = null;

// [BARU] Variabel untuk menyimpan data agar bisa dicari
let globalFloodData = [];

// ============================================================
// 4. FITUR GEO-AI & CUACA (Fungsi Helper)
// ============================================================

// Fungsi untuk mengambil Data Cuaca dari Open-Meteo
function getWeatherFromAPI(lat, lng, elementId) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,rain&timezone=Asia%2FJakarta`;

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      const current = data.current;
      const rain = current.rain;
      const temp = current.temperature_2m;

      let statusHujan = 'Cerah/Berawan ☁️';
      let colorText = '#27ae60';

      if (rain > 0.5) {
        statusHujan = 'Hujan Ringan 🌦️';
        colorText = '#d35400';
      }
      if (rain > 5.0) {
        statusHujan = 'HUJAN DERAS ⛈️';
        colorText = '#c0392b';
      }

      const el = document.getElementById(`weather-${elementId}`);
      if (el) {
        el.innerHTML = `
          <div style="font-size:11px; margin-bottom:4px;"><b>📡 Data Real-time (Open-Meteo):</b></div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <span>🌡️ ${temp}°C</span>
             <span>💧 ${rain} mm</span>
          </div>
          <div style="margin-top:5px; color:${colorText}; font-weight:bold; border-top:1px dashed #ccc; padding-top:2px;">
            ${statusHujan}
          </div>
        `;
      }
    })
    .catch((err) => {
      console.error('API Error:', err);
      const el = document.getElementById(`weather-${elementId}`);
      if (el) el.innerHTML = "<small style='color:red;'>Gagal memuat data cuaca</small>";
    });
}

function updateGeoAIPrediction(rainAmount) {
  geoAiLayer.clearLayers();
  if (!sungaiGeoJson) return;
  // (Logika GeoAI Anda tetap sama...)
  let radiusLuapan = 0;
  let colorPrediksi = '#8e44ad';
  if (rainAmount < 0.5) radiusLuapan = 0.05;
  else if (rainAmount >= 0.5 && rainAmount < 2.0) radiusLuapan = 0.3;
  else radiusLuapan = 0.6;

  var buffered = turf.buffer(sungaiGeoJson, radiusLuapan, { units: 'kilometers' });
  L.geoJSON(buffered, {
    style: function () {
      return { color: colorPrediksi, weight: 1, fillColor: colorPrediksi, fillOpacity: 0.2, dashArray: '10, 10' };
    },
  })
    .bindPopup(`[GeoAI] Prediksi Luapan: ${radiusLuapan * 1000} meter`)
    .addTo(geoAiLayer);
}

// ============================================================
// 5. LOAD DATA MAP UTAMA (map (3).geojson)
// ============================================================
fetch('map (3).geojson?t=' + new Date().getTime())
  .then((res) => {
    if (!res.ok) throw new Error('File map (3).geojson tidak ditemukan!');
    return res.json();
  })
  .then((data) => {
    L.geoJSON(data, {
      onEachFeature: function (feature, layer) {
        const props = feature.properties;
        const name = props.name || 'Lokasi Tanpa Nama';
        const image = props.image || 'https://via.placeholder.com/300x150';
        const status = props.status || 'Normal';

        const popupContent = `
            <div style="width: 200px;">
                <b>${name}</b><br>
                <img src="${image}" style="width:100%; margin-top:5px;"><br>
                Status: ${status}
            </div>`;
        layer.bindPopup(popupContent);
        layer.bindTooltip(name, { direction: 'top', offset: [0, -35] });

        if (feature.geometry.type === 'Point') {
          let selectedIcon = new L.Icon.Default();
          const lowerName = name.toLowerCase();
          if (lowerName.includes('banjir')) layer.addTo(floodPointsLayer);
          else layer.addTo(markersLayer);
        }
        if (feature.geometry.type === 'LineString') {
          if (name.toLowerCase().includes('sungai')) {
            layer.setStyle({ color: '#3498db', weight: 3 });
            sungaiGeoJson = feature;
          } else {
            layer.setStyle({ color: 'green', weight: 4 });
          }
          layer.addTo(polylineLayer);
        }
        if (feature.geometry.type === 'Polygon') {
          layer.setStyle({ color: '#e74c3c', fillOpacity: 0.3 });
          layer.addTo(polygonLayer);
        }
      },
    });
  })
  .catch((err) => console.error('Error main map:', err));

// ============================================================
// 6. LOAD DATA ADMINISTRASI (GADM)
// ============================================================
fetch('gadm41_IDN_3 (1).json')
  .then((res) => {
    if (!res.ok) throw new Error('File GADM tidak ditemukan!');
    return res.json();
  })
  .then((data) => {
    L.geoJSON(data, {
      style: function () {
        return { color: '#000', weight: 1.5, fillColor: 'blue', fillOpacity: 0, dashArray: '4, 4' };
      },
      onEachFeature: function (feature, layer) {
        if (feature.properties) {
          var namaKecamatan = feature.properties.NAME_3 || 'Tidak Diketahui';
          var namaKabupaten = feature.properties.NAME_2 || '-';
          layer.bindPopup(`<b>Kecamatan:</b> ${namaKecamatan}<br>Kabupaten: ${namaKabupaten}`);
          layer.bindTooltip(namaKecamatan, { sticky: true, direction: 'center' });
        }
      },
    }).addTo(adminLayer);
    console.log('Layer Administrasi berhasil dimuat.');
  })
  .catch((err) => console.error('Gagal load GADM:', err));

// ============================================================
// 7. LOAD DATA RISIKO BANJIR (ZONASI MERAH/KUNING/HIJAU)
// ============================================================
fetch('banjir_risk_point.json?t=' + new Date().getTime())
  .then((res) => {
    if (!res.ok) throw new Error('File banjir_risk_point.json tidak ditemukan!');
    return res.json();
  })
  .then((data) => {
    // [BARU] Simpan data ke variabel global agar bisa dicari
    globalFloodData = data.features;

    // ARRAY UNTUK MENAMPUNG TITIK HEATMAP
    var heatMapPoints = [];

    L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        var status = feature.properties.status || '';
        var colorCode = '#2ecc71';
        var animClass = '';
        var intensity = 0.2;

        if (status.includes('Merah')) {
          colorCode = '#e74c3c';
          animClass = 'animasi-alert';
          intensity = 1.0;
        } else if (status.includes('Kuning')) {
          colorCode = '#f39c12';
          animClass = 'animasi-alert';
          intensity = 0.6;
        }

        // Push data ke array Heatmap
        heatMapPoints.push([latlng.lat, latlng.lng, intensity]);

        return L.circleMarker(latlng, {
          radius: 10,
          fillColor: colorCode,
          color: colorCode,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
          className: animClass,
        });
      },
      onEachFeature: function (feature, layer) {
        var p = feature.properties;
        var coords = feature.geometry.coordinates;

        // [BARU] Tambahkan ID unik ke layer untuk pencarian
        layer._customId = p.kecamatan.toLowerCase();

        var imageSrc = p.gambar && p.gambar !== '' ? p.gambar : 'https://via.placeholder.com/300x150?text=No+Image';

        var kontenPopup = `
          <div style="font-family: Arial, sans-serif; min-width: 260px;">
            <div style="width: 100%; height: 150px; overflow: hidden; border-radius: 8px; margin-bottom: 10px; background: #eee;">
               <img src="${imageSrc}" alt="Foto Lokasi" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <h3 style="margin: 0; color: #2c3e50; font-size: 16px;">${p.kecamatan}</h3>
            <small style="color: #7f8c8d; display: block; margin-bottom: 5px;">${p.lokasi_spesifik}</small>
            
            <span style="background:${p.status.includes('Merah') ? '#e74c3c' : p.status.includes('Kuning') ? '#f39c12' : '#2ecc71'}; color:white; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:bold;">
              ${p.status}
            </span>

            <div id="weather-${p.kecamatan.replace(/\s/g, '')}" style="margin: 10px 0; padding: 10px; background: #f0f8ff; border-radius: 6px; border: 1px solid #dcdcdc; color: #555; font-size: 12px;">
              ⏳ Mengambil data cuaca...
            </div>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
            <div style="font-size: 12px; line-height: 1.5; color: #444;">
              <strong>🌊 Penyebab:</strong> ${p.penyebab}<br>
              <div style="background-color: #f0f3f4; padding: 8px; border-left: 3px solid #3498db; border-radius: 4px; margin-top: 8px; font-style: italic;">"${p.keterangan}"</div>
            </div>
          </div>
        `;

        layer.bindPopup(kontenPopup);
        layer.bindTooltip(p.kecamatan, { direction: 'top', offset: [0, -10] });

        layer.on('popupopen', function () {
          getWeatherFromAPI(coords[1], coords[0], p.kecamatan.replace(/\s/g, ''));
        });
      },
    }).addTo(riskAnalysisLayer);

    // --- INISIALISASI LAYER HEATMAP ---
    if (heatMapPoints.length > 0) {
      var heat = L.heatLayer(heatMapPoints, {
        radius: 35,
        blur: 20,
        maxZoom: 12,
        gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' },
      });
      geoAiHeatmapLayer.addLayer(heat);
      console.log('GeoAI Heatmap Generated:', heatMapPoints.length, 'points');
    }
  })
  .catch((err) => console.error('Gagal load banjir_risk_point:', err));

// ============================================================
// [BARU] 8. LOGIKA PENCARIAN (SIDEBAR)
// ============================================================

function searchLocation() {
  var input = document.getElementById('search-input').value.toLowerCase();
  var resultBox = document.getElementById('search-result');

  // Cari data di variabel global
  var foundData = globalFloodData.find((item) => item.properties.kecamatan.toLowerCase().includes(input));

  if (foundData) {
    var p = foundData.properties;
    var coords = foundData.geometry.coordinates; // [Lng, Lat]

    // 1. Zoom ke lokasi
    map.flyTo([coords[1], coords[0]], 14, { animate: true, duration: 1.5 });

    // 2. Tampilkan Info di Sidebar
    document.getElementById('res-nama').innerText = p.kecamatan;
    document.getElementById('res-lat').innerText = coords[1].toFixed(5);
    document.getElementById('res-lng').innerText = coords[0].toFixed(5);
    document.getElementById('res-desc').innerText = p.lokasi_spesifik;

    var statusBadge = document.getElementById('res-status');
    statusBadge.innerText = p.status;

    // Warna badge sesuai status
    if (p.status.includes('Merah')) statusBadge.style.background = '#e74c3c';
    else if (p.status.includes('Kuning')) statusBadge.style.background = '#f39c12';
    else statusBadge.style.background = '#2ecc71';

    resultBox.style.display = 'block';

    // 3. Buka Popup Marker secara otomatis
    riskAnalysisLayer.eachLayer(function (layer) {
      if (layer._customId && layer._customId.includes(input)) {
        layer.openPopup();
      }
    });
  } else {
    alert('Lokasi tidak ditemukan dalam database risiko banjir.');
    resultBox.style.display = 'none';
  }
}

function resetSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-result').style.display = 'none';
  map.setView([-6.931899954351185, 106.92898164923656], 10);
  map.closePopup();
}

// Listener Enter Key
document.getElementById('search-input').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') searchLocation();
});

// ============================================================
// 9. LAYER CONTROL
// ============================================================
var baseMaps = {
  'Peta Jalan (OSM)': osm,
  'Satelit (ESRI)': esriSatelite,
};

var overlayMaps = {
  '<span style="font-weight:bold; color:red;">🔴 Analisis Zonasi Rawan</span>': riskAnalysisLayer,
  '<span style="font-weight:bold;">Analisis Zona Buffer</span>': bufferLayer,
  '<span style="color:blue;">Info Curah Hujan (Live)</span>': weatherLayer,
  '<span style="color:purple; font-weight:bol d;">[GeoAI] Prediksi Luapan</span>': geoAiLayer,
  'Batas Administrasi (Kecamatan)': adminLayer,
  '<span style="color: #e74c3c; font-weight: bold;">🔥 GeoAI: Heatmap Kepadatan</span>': geoAiHeatmapLayer,
};

L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);
