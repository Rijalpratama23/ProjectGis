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
// 2. LAYER GROUPS (DEFINISI VARIABEL DI SINI AGAR TIDAK ERROR)
// ============================================================
var markersLayer = L.layerGroup().addTo(map);
var polylineLayer = L.layerGroup().addTo(map);
var polygonLayer = L.layerGroup().addTo(map);
var floodPointsLayer = L.layerGroup().addTo(map);
var bufferLayer = L.layerGroup().addTo(map);
var weatherLayer = L.layerGroup().addTo(map);
var geoAiLayer = L.layerGroup().addTo(map);
var adminLayer = L.layerGroup().addTo(map);
var riskAnalysisLayer = L.layerGroup().addTo(map); // <--- Didefinisikan di sini

// ============================================================
// 3. KONFIGURASI GLOBAL & UTILS
// ============================================================
const latCisolok = -6.94634;
const lngCisolok = 106.448544;
let sungaiGeoJson = null;

// Definisi Icon (Pastikan file ada di folder assets)
// ============================================================
// 4. FITUR GEO-AI & CUACA
// ============================================================
function updateGeoAIPrediction(rainAmount) {
  geoAiLayer.clearLayers();
  if (!sungaiGeoJson) return;

  let radiusLuapan = 0;
  let colorPrediksi = '#8e44ad';

  if (rainAmount < 0.5) {
    radiusLuapan = 0.05; // 50 meter
  } else if (rainAmount >= 0.5 && rainAmount < 2.0) {
    radiusLuapan = 0.3; // 300 meter
  } else {
    radiusLuapan = 0.6; // 600 meter
  }

  var buffered = turf.buffer(sungaiGeoJson, radiusLuapan, { units: 'kilometers' });
  L.geoJSON(buffered, {
    style: function () {
      return { color: colorPrediksi, weight: 1, fillColor: colorPrediksi, fillOpacity: 0.2, dashArray: '10, 10' };
    },
  })
    .bindPopup(`[GeoAI] Prediksi Luapan: ${radiusLuapan * 1000} meter`)
    .addTo(geoAiLayer);
}

function getRealtimeWeather() {
  const weatherAPIUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latCisolok}&longitude=${lngCisolok}&current=rain,showers,weather_code&timezone=Asia%2FJakarta&time=${new Date().getTime()}`;

  fetch(weatherAPIUrl)
    .then((response) => response.json())
    .then((data) => {
      // Logic cuaca di sini (bisa ditambahkan marker custom jika perlu)
    })
    .catch((error) => console.error('Gagal update cuaca:', error));
}
getRealtimeWeather();
setInterval(getRealtimeWeather, 300000);

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
          let selectedIcon = iconDefault;
          const lowerName = name.toLowerCase();
          if (lowerName.includes('banjir')) {
            selectedIcon = iconBanjir;
            layer.addTo(floodPointsLayer);
            // Buffer Logic
            if (name === 'Area Rawan Banjir') {
              var pt = turf.point(feature.geometry.coordinates);
              L.geoJSON(turf.buffer(pt, 1.0, { units: 'kilometers' }), { style: { color: 'green', fillOpacity: 0.1, weight: 0 } }).addTo(bufferLayer);
              L.geoJSON(turf.buffer(pt, 0.5, { units: 'kilometers' }), { style: { color: 'orange', fillOpacity: 0.2, weight: 0 } }).addTo(bufferLayer);
              L.geoJSON(turf.buffer(pt, 0.2, { units: 'kilometers' }), { style: { color: 'red', fillOpacity: 0.3, weight: 0 } }).addTo(bufferLayer);
            }
          } else if (lowerName.includes('batas')) {
            selectedIcon = iconBatas;
          }
          layer.setIcon(selectedIcon);
          if (!lowerName.includes('banjir')) layer.addTo(markersLayer);
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
// 7. LOAD DATA RISIKO BANJIR (ANIMASI + GAMBAR)
// ============================================================
fetch('banjir_risk_point.json?t=' + new Date().getTime())
  .then((res) => {
    if (!res.ok) throw new Error('File banjir_risk_point.json tidak ditemukan!');
    return res.json();
  })
  .then((data) => {
    L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        // --- LOGIKA WARNA & ANIMASI ---
        var status = feature.properties.status || '';
        var colorCode = '#2ecc71'; // Default Hijau
        var animClass = ''; // Default tanpa animasi

        if (status.includes('Merah')) {
          colorCode = '#e74c3c'; // Merah
          animClass = 'animasi-alert'; // Class animasi (Wajib ada di CSS)
        } else if (status.includes('Kuning')) {
          colorCode = '#f39c12'; // Kuning
          animClass = 'animasi-alert';
        }

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

        // --- LOGIKA GAMBAR ---
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
            <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
            <div style="font-size: 12px; line-height: 1.5; color: #444;">
              <strong>🌊 Penyebab:</strong> ${p.penyebab}<br>
              <div style="background-color: #f0f3f4; padding: 8px; border-left: 3px solid #3498db; border-radius: 4px; margin-top: 8px; font-style: italic;">"${p.keterangan}"</div>
            </div>
          </div>
        `;
        layer.bindPopup(kontenPopup);
        layer.bindTooltip(p.kecamatan, { direction: 'top', offset: [0, -10] });
      },
    }).addTo(riskAnalysisLayer);

    console.log('Data Zonasi Banjir (Lengkap) berhasil dimuat.');
  })
  .catch((err) => console.error('Gagal load banjir_risk_point:', err));

// ============================================================
// 8. LAYER CONTROL (DITARUH DI AKHIR AGAR SEMUA LAYER SIAP)
// ============================================================
var baseMaps = {
  'Peta Jalan (OSM)': osm,
  'Satelit (ESRI)': esriSatelite,
};

var overlayMaps = {
  'Lokasi Umum': markersLayer,
  'Jalur/Garis Sungai': polylineLayer,
  'Area Polygon': polygonLayer,
  'Titik Laporan Warga': floodPointsLayer,
  '<span style="font-weight:bold; color:red;">🔴 Analisis Zonasi Rawan</span>': riskAnalysisLayer,
  '<span style="font-weight:bold;">Analisis Zona Buffer</span>': bufferLayer,
  '<span style="color:blue;">Info Curah Hujan (Live)</span>': weatherLayer,
  '<span style="color:purple; font-weight:bold;">[GeoAI] Prediksi Luapan</span>': geoAiLayer,
  'Batas Administrasi (Kecamatan)': adminLayer,
};

L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);
