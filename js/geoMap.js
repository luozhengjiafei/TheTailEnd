class geoMap {
  constructor(_config, _dispatcher, _data) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 600,
      containerHeight: _config.containerHeight || 678,
      margin: _config.margin || {top: 0, right: 0, bottom: 0, left: 0},
      tooltipPadding: 10,
      legendBottom: 50,
      legendLeft: 50,
      legendRectHeight: 12, 
      legendRectWidth: 150
    }
    this.dispatcher = _dispatcher;
    this.data = _data;
    this.initVis();
  }
  
  /**
   * We initialize scales/axes and append static elements, such as axis titles.
   */
  initVis() {
    let vis = this;

    // Calculate inner chart size. Margin specifies the space around the actual chart.
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    // Define size of SVG drawing area
    vis.svg = d3.select(vis.config.parentElement).append('svg')
      .attr('width', vis.config.containerWidth)
      .attr('height', vis.config.containerHeight);

    vis.border = vis.svg.append('rect')
      .attr('class', 'border')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', + vis.width)
      .attr('height', + vis.height)
      .attr('fill', 'none')
      .attr('stroke', 'grey')
      .attr('stroke-width', 1);

    // Append group element that will contain our actual chart 
    // and position it according to the given margin config
    vis.chart = vis.svg.append('g')
      .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    // Initialize projection and path generator
    vis.projection = d3.geoMercator();
    vis.geoPath = d3.geoPath().projection(vis.projection);

    vis.colorScale = d3.scaleLinear()
      .range(['#F44336', '#38761D'])
      .interpolate(d3.interpolateHcl);


    // Initialize gradient that we will later use for the legend
    vis.linearGradient = vis.svg.append('defs').append('linearGradient')
      .attr("id", "legend-gradient");

    // Append legend
    vis.legend = vis.chart.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${vis.config.legendLeft},${vis.height - vis.config.legendBottom})`);
    
    vis.legendRect = vis.legend.append('rect')
      .attr('width', vis.config.legendRectWidth)
      .attr('height', vis.config.legendRectHeight);

    vis.legendTitle = vis.legend.append('text')
      .attr('class', 'legend-title')
      .attr('dy', '.35em')
      .attr('y', -10)
      .text('Human development index')

    vis.updateVis();
  }

  updateVis() {
    let vis = this;

    vis.selectedYear = 'HDI_' + WorldData.year;
    const HDIExtent = d3.extent(vis.data.objects.countries.geometries, d => d.properties[vis.selectedYear]);
    
    // Update color scale
    vis.colorScale.domain(HDIExtent);

    // Define begin and end of the color gradient (legend)
    vis.legendStops = [
      { color: '#F44336', value: HDIExtent[0], offset: 0},
      { color: '#38761D', value: HDIExtent[1], offset: 100},
    ];

    vis.renderVis();
  }


  renderVis() {
    let vis = this;

    // Convert compressed TopoJSON to GeoJSON format
    vis.countries = topojson.feature(vis.data, vis.data.objects.countries)

    // Defines the scale of the projection so that the geometry fits within the SVG area
    vis.projection.fitSize([vis.width, vis.height], vis.countries);

    // Append world map
    const countryPath = vis.chart.selectAll('.country')
      .data(vis.countries.features)
      .join('path')
      .attr('class', 'country')
      .attr('d', vis.geoPath)
      .attr('fill', d => {
        if (d.properties[vis.selectedYear] > 0) {
          return vis.colorScale(d.properties[vis.selectedYear]);
        }else{
          return 'url(#lightstripe)';
        }
      // if country is selected append id for css style
      }).attr('id', d => {
        if(WorldData.country.includes(d.properties.name)){
          return 'country-selected';
        }
      // on click event for data filtering.
      }).on('click', function(event, d) {
        const isActive = d3.select(this).classed('active');
        d3.select(this).classed('active', !isActive);
        const selectCountry = vis.chart.selectAll('.country.active').data();
        vis.dispatcher.call('mapSelection', event, selectCountry);
      });

    countryPath
      .on('mousemove', (event,d) => {
      const hdiNumber = d.properties[vis.selectedYear] ? `HDI value: <strong>${d.properties[vis.selectedYear]}</strong>` : 'No data available'; 
      d3.select('#tooltip')
        .style('display', 'block')
        .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')   
        .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
        .html(`
          <div class="tooltip-title">${d.properties.name}</div>
          <div>${hdiNumber}</div>
        `);
      })
      .on('mouseleave', () => {
        d3.select('#tooltip').style('display', 'none');
      });

    // Add legend labels
    vis.legend.selectAll('.legend-label')
      .data(vis.legendStops)
      .join('text')
      .attr('class', 'legend-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('y', 20)
      .attr('x', (d,index) => {
        return index === 0 ? 0 : vis.config.legendRectWidth;
      })
      .text(d => Math.round(d.value * 10 ) / 10);

    // Update gradient for legend
    vis.linearGradient.selectAll('stop')
      .data(vis.legendStops)
      .join('stop')
      .attr('offset', d => d.offset)
      .attr('stop-color', d => d.color);

    vis.legendRect.attr('fill', 'url(#legend-gradient)');
  }
}