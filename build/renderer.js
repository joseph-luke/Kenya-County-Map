document.addEventListener('DOMContentLoaded', async () => {
  let currentPalette = 'red';
  let currentMetric = 'Population';
  let isDragging = false;
  let deckgl;

  // Get deck.gl components from the global scope
  const {DeckGL, GeoJsonLayer} = deck;

  // Updated hardcoded legend offsets for each metric.
  const legendOffsets = {
    // Population
    "Population": "0px",
    
    // Marital Status
    "Married Monogamous": "1px",
    "Married Polygamous": "8px",
    "Living Together": "10px",
    "Separated": "8px",
    "Divorced": "10px",
    "Widow or Widowed": "10px",
    "Never Married": "4px",
    
    // Education
    "No Education": "6px",
    "Lower Primary": "8px",
    "Upper Primary": "8px",
    "Secondary": "3px",
    "Middle-Level College": "8px",
    "University Undergraduate": "7px",
    "University Masters/PhD": "8px",
    "Adult Basic Education": "10px",
    "Vocational Training": "15px",
    "Madrasa/Duksi": "10px",
    
    // Housing Type
    "Bungalow": "6px",
    "Flat": "6px",
    "Maisonnette": "10px",
    "Swahili": "7px",
    "Shanty": "8px",
    "Manyatta/Traditional House": "8px",
    "Landhie": "8px",
    
    // Housing Tenure
    "Owns": "7px",
    "Pays Rent/Lease": "2px",
    "No Rent, with Consent of Owner": "12px",
    "No Rent, Squatting": "15px",
    
    // Cooking Energy Source
    "Electricity": "12px",
    "Paraffin": "8px",
    "LPG (Gas)": "3px",
    "Biogas": "13px",
    "Firewood": "8px",
    "Charcoal": "8px"
  };

  document.addEventListener('pointerdown', () => {
    isDragging = true;
    document.getElementById('tooltip').style.display = 'none';
  });
  document.addEventListener('pointerup', () => {
    isDragging = false;
  });

  const palettes = {
    red: chroma
      .scale([
        "#F2F2F2", "#F29580", "#F22E2E", "#BF1725", "#730318", "#5A0000"
      ])
      .mode('lch')
      .colors(256),
    blue: chroma
      .scale([
        "#F5FBFF", "#8CB4F0", "#2E5FCE", "#1A3D8C", "#0A124D"
      ])
      .mode('lch')
      .colors(256),
    greyscale: chroma
      .scale([
        "#FAFAFA", "#C7C7C7", "#909090", "#606060", "#333333", "#1A1A1A"
      ])
      .mode('lch')
      .colors(256)
  };

  try {
    console.log('Fetching map data...');
    const response = await fetch('county_map_data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    console.log('Map data fetched successfully');
    const data = await response.json();
    console.log('Map data parsed successfully');
    const geojson = data.geojson;

    if (!geojson) {
      throw new Error('Invalid data format: missing geojson data');
    }

    // Compute min and max values for a given metric
    function computeMetricRange(metric) {
      const values = geojson.features.map(f => f.properties[metric] || 0);
      return [Math.min(...values), Math.max(...values)];
    }
    let [minValue, maxValue] = computeMetricRange(currentMetric);
    
    function normalizeValue(value) {
      if (maxValue === minValue) return 0;
      return (value - minValue) / (maxValue - minValue);
    }
    
    function getFillColor(feature) {
      const value = feature.properties[currentMetric] || 0;
      const normalizedValue = normalizeValue(value);
      const color = chroma.scale(palettes[currentPalette])(normalizedValue).rgb();
      return [...color, 255];
    }

    function formatValue(value) {
      if (value === 0) return '0';
      const rounded = Number(value.toPrecision(2));
      return rounded.toLocaleString();
    }

    // Initialize deck.gl
    const INITIAL_VIEW_STATE = {
      latitude: 0.5,
      longitude: 37.5,
      zoom: 5.2,
      maxZoom: 16,
      pitch: 0,
      bearing: 0
    };

    deckgl = new DeckGL({
      container: 'map-container',
      initialViewState: INITIAL_VIEW_STATE,
      controller: true,
      onViewStateChange: ({viewState}) => {
        deckgl.setProps({viewState});
      },
      getTooltip: ({object}) => {
        if (!object || isDragging) return null;
        
        return {
          html: `
            <div style="background: rgba(255,255,255,0.8); padding: 5px; border-radius: 5px;">
              <strong>County:</strong> ${object.properties.county}<br/>
              <strong>${currentMetric}:</strong> ${formatValue(object.properties[currentMetric] || 0)}
            </div>
          `,
          style: {
            backgroundColor: 'transparent',
            boxShadow: 'none'
          }
        };
      },
      layers: [
        new GeoJsonLayer({
          id: 'geojson',
          data: geojson,
          pickable: true,
          stroked: true,
          filled: true,
          extruded: false,
          lineWidthScale: 1,
          lineWidthMinPixels: 1,
          getFillColor: getFillColor,
          getLineColor: [80, 80, 80, 255],
          getLineWidth: 1
        })
      ]
    });

    function updateMap() {
      [minValue, maxValue] = computeMetricRange(currentMetric);
      deckgl.setProps({
        layers: [
          new GeoJsonLayer({
            id: 'geojson',
            data: geojson,
            pickable: true,
            stroked: true,
            filled: true,
            extruded: false,
            lineWidthScale: 1,
            lineWidthMinPixels: 1,
            getFillColor: getFillColor,
            getLineColor: [80, 80, 80, 255],
            getLineWidth: 1
          })
        ]
      });
      updateLegend();
    }

    // ----------------------------------------------------------------
    // updateTitle: Fade out title inner text and the metric icon,
    // then update text and fade them back in after the width transition.
    function updateTitle(newText) {
      const titleElement = document.getElementById('title');
      const textElement = titleElement.querySelector('.title-text');
      const iconElement = document.querySelector('#metric-button .metric-icon');
      const oldWidth = titleElement.offsetWidth;
      // Fade out inner text and icon over 0.3s
      textElement.style.transition = 'opacity 0.3s ease';
      iconElement.style.transition = 'opacity 0.3s ease';
      textElement.style.opacity = 0;
      iconElement.style.opacity = 0;
      setTimeout(() => {
        // Measure target width off-screen.
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.whiteSpace = 'nowrap';
        const computedStyle = window.getComputedStyle(textElement);
        tempSpan.style.fontFamily = computedStyle.fontFamily;
        tempSpan.style.fontSize = computedStyle.fontSize;
        tempSpan.textContent = newText;
        document.body.appendChild(tempSpan);
        const targetWidth = tempSpan.offsetWidth + 30; // add padding
        document.body.removeChild(tempSpan);
        // Set container width to oldWidth.
        titleElement.style.width = oldWidth + 'px';
        // Force reflow.
        titleElement.offsetWidth;
        // Animate container width over 0.7s
        titleElement.style.transition = 'width 0.7s ease';
        titleElement.style.width = targetWidth + 'px';
        titleElement.addEventListener('transitionend', function onTitleWidth(e) {
          if (e.propertyName === 'width') {
            titleElement.removeEventListener('transitionend', onTitleWidth);
            textElement.textContent = newText;
            // Fade text and icon back in over 0.3s
            textElement.style.transition = 'opacity 0.3s ease';
            iconElement.style.transition = 'opacity 0.3s ease';
            textElement.style.opacity = 1;
            iconElement.style.opacity = 1;
          }
        });
      }, 300);
    }

    // ----------------------------------------------------------------
    // updateLegend: Fade out the legend items (colorbar and labels),
    // hide them completely during transition, update content, then fade in.
    // The fade timing is synchronized with the title update.
    function updateLegend() {
      const legendItems = document.getElementById('legend-items');
      // Fade out over 0.3s
      legendItems.style.transition = 'opacity 0.5s ease';
      legendItems.style.opacity = 0;
      setTimeout(() => {
        // Ensure nothing is visible during update
        legendItems.style.visibility = 'hidden';
        renderLegend();
        // Wait for title transition (0.7s) then make legend items visible and fade them in.
        setTimeout(() => {
          legendItems.style.visibility = 'visible';
          legendItems.style.transition = 'opacity 0.5s ease';
          legendItems.style.opacity = 1;
        }, 700);
      }, 300);
    }

    // ----------------------------------------------------------------
    // updateLegendColor: When palette changes, update only the colorbar background.
    function updateLegendColor() {
      const gradientElement = document.querySelector('.legend-gradient');
      if (gradientElement) {
        // Create an overlay element to hold the new gradient
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = `linear-gradient(to top, ${palettes[currentPalette].join(', ')})`;
        // Start overlay fully transparent
        overlay.style.opacity = '0';
        // Use the same 3s duration and an easing function similar to the map's transition
        overlay.style.transition = 'opacity 3s ease-out';
        
        // Append overlay on top of the current gradient
        gradientElement.appendChild(overlay);
        // Force reflow to ensure transition starts
        void overlay.offsetWidth;
        // Animate overlay to fully opaque
        overlay.style.opacity = '1';
        
        // After the transition, update the parent's background and remove the overlay
        setTimeout(() => {
          gradientElement.style.background = overlay.style.background;
          gradientElement.removeChild(overlay);
        }, 3000);
      }
    }

    // ----------------------------------------------------------------
    // renderLegend: Build the legend items (colorbar and labels) only.
    function renderLegend() {
      [minValue, maxValue] = computeMetricRange(currentMetric);
      const legendItems = document.getElementById('legend-items');
      legendItems.innerHTML = '';

      // Create an inner container for the items.
      const innerContainer = document.createElement('div');
      innerContainer.style.display = 'flex';
      innerContainer.style.alignItems = 'center';
      // Apply the offset using transform (so it doesn't affect the grid centering of the title).
      innerContainer.style.transform = `translateX(${legendOffsets[currentMetric]})`;

      const gradientElement = document.createElement('div');
      gradientElement.className = 'legend-gradient';
      gradientElement.style.background = `linear-gradient(to top, ${palettes[currentPalette].join(', ')})`;

      const labelsContainer = document.createElement('div');
      labelsContainer.className = 'legend-labels';
      // Use evenly distributed positions for labels.
      const positions = [0, 0.275, 0.5, 0.725, 1];
      positions.forEach(pos => {
        const value = maxValue - (maxValue - minValue) * pos;
        const label = document.createElement('div');
        label.className = 'legend-label';
        label.textContent = formatValue(value);
        label.style.top = `${pos * 100}%`;
        // Apply transform based on position and shift up by 1px:
        if (pos === 0) {
          label.style.transform = 'translateY(0%) translateY(-2px)';
        } else if (pos === 1) {
          label.style.transform = 'translateY(-100%) translateY(-2px)';
        } else {
          label.style.transform = 'translateY(-50%) translateY(-2px)';
        }
        labelsContainer.appendChild(label);
      });
      innerContainer.appendChild(gradientElement);
      innerContainer.appendChild(labelsContainer);
      legendItems.appendChild(innerContainer);
    }

    // Initial render of legend items
    renderLegend();

    // ----------------------------------------------------------------
    // Palette control events.
    document.getElementById('palette-control').addEventListener('click', () => {
      document.getElementById('palette-control-container').classList.toggle('expanded');
    });

    // Close palette options when clicking outside
    document.addEventListener('click', (e) => {
      const paletteContainer = document.getElementById('palette-control-container');
      const paletteControl = document.getElementById('palette-control');
      if (!paletteContainer.contains(e.target) && paletteContainer.classList.contains('expanded')) {
        paletteContainer.classList.remove('expanded');
      }
    });

    document.querySelectorAll('.palette-option').forEach(button => {
      button.addEventListener('click', (e) => {
        const palette = e.target.dataset.palette;
        if (palette && palette !== currentPalette) {
          currentPalette = palette;
          updateMap();
          updateLegendColor();
        }
        document.getElementById('palette-control-container').classList.remove('expanded');
      });
    });

    // ----------------------------------------------------------------
    // Metric dropdown events with smooth title transition.
    document.getElementById('metric-button').addEventListener('click', () => {
      const options = document.getElementById('metric-options');
      options.style.display = options.style.display === 'block' ? 'none' : 'block';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const metricDropdown = document.getElementById('metric-dropdown');
      const options = document.getElementById('metric-options');
      if (!metricDropdown.contains(e.target) && options.style.display === 'block') {
        options.style.display = 'none';
      }
    });

    // Handle category button clicks
    document.querySelectorAll('.metric-category-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const category = button.parentElement;
        
        // Close all other categories first
        document.querySelectorAll('.metric-category').forEach(otherCategory => {
          if (otherCategory !== category && otherCategory.classList.contains('expanded')) {
            otherCategory.classList.remove('expanded');
          }
        });
        
        // Toggle the clicked category
        category.classList.toggle('expanded');
      });
    });

    // Handle metric option clicks
    document.querySelectorAll('.metric-option').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const metric = e.target.dataset.metric;
        if (metric && metric !== currentMetric) {
          currentMetric = metric;
          if (metric === "Population") {
            updateTitle(`${metric} of Kenya`);
          } else if (metric === "No Education" || metric === "Lower Primary" || metric === "Upper Primary" || 
                     metric === "Secondary" || metric === "Middle-Level College" || metric === "University Undergraduate" || 
                     metric === "University Masters/PhD" || metric === "Adult Basic Education" || 
                     metric === "Vocational Training" || metric === "Madrasa/Duksi") {
            updateTitle(`Education Level: ${metric}`);
          } else if (metric === "Married Monogamous" || metric === "Married Polygamous" || 
                     metric === "Living Together" || metric === "Separated" || metric === "Divorced" || 
                     metric === "Widow or Widowed" || metric === "Never Married") {
            updateTitle(`Marital Status: ${metric}`);
          } else if (metric === "Bungalow" || metric === "Flat" || metric === "Maisonnette" || metric === "Swahili" || 
                     metric === "Shanty" || metric === "Manyatta/Traditional House" || metric === "Landhie") {
            updateTitle(`Housing Type: ${metric}`);
          } else if (metric === "Owns" || metric === "Pays Rent/Lease" || metric === "No Rent, with Consent of Owner" || metric === "No Rent, Squatting") {
            updateTitle(`Housing Tenure: ${metric}`);
          } else if (metric === "Electricity" || metric === "Paraffin" || metric === "LPG (Gas)" || 
                     metric === "Biogas" || metric === "Firewood" || metric === "Charcoal") {
            updateTitle(`Cooking Energy Source: ${metric}`);
          } else {
            updateTitle(`${metric} in Kenya`);
          }
          updateMap();
        }
        // Close all expanded categories
        document.querySelectorAll('.metric-category').forEach(category => {
          category.classList.remove('expanded');
        });
        document.getElementById('metric-options').style.display = 'none';
      });
    });
  } catch (error) {
    console.error('Error loading map data:', error);
  }
});
