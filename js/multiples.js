class MultipleScatterPlot {

    constructor(_config, _dispatcher, _data ,_attributeName) {
      this.config = {
        parentElement: _config.parentElement,
        containerWidth: 200,
        containerHeight: 125,
        tooltipPadding: 15,
        margin: {top: 30, right: 0, bottom: 30, left: 40}
      }
      this.attribute = _attributeName;
      this.dispatcher = _dispatcher;
      this.data = _data;
      this.initVis();
    }
      
    initVis() {
      // Create SVG area, initialize scales and axes
      let vis = this;
  
      vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
      vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;
  
      // Initialize the x scale and y scale together with the axis
      vis.xScale = d3.scaleLinear()
        .range([0, vis.width])
  
      vis.yScale = d3.scaleLinear ()
        .range([vis.height, 0]) 
    
      vis.xAxis = d3.axisBottom(vis.xScale)
        .ticks(6)
        .tickSize(-vis.height - 10)
        .tickPadding(10)
  
      vis.yAxis = d3.axisLeft(vis.yScale)
        .ticks(6)
        .tickSize(-vis.width - 10)
        .tickPadding(10);
  
      // Define size of SVG drawing area
      vis.svg = d3.select(vis.config.parentElement).append('svg')
        .attr('width', vis.config.containerWidth)
        .attr('height', vis.config.containerHeight)
        .attr('id', 'multiScatter')
        .on('click', function(event, d) {
          if(vis.attribute !== WorldData.attribute){
            vis.dispatcher.call('selectAttribute', event, vis.attribute);
          }
        }
      );

  
      // Append group element that will contain our actual chart 
      // and position it according to the given margin config
      vis.chartArea = vis.svg.append('g')
        .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`)
  
      vis.chart = vis.chartArea.append('g');
  
      // Append empty x-axis group and move it to the bottom of the chart
      vis.xAxisG = vis.chartArea.append('g')
        .attr('class', 'axis x-axis')
        .attr('transform', `translate(0,${vis.height})`);
  
      // Append y-axis group
      vis.yAxisG = vis.chartArea.append('g')
        .attr('class', 'axis y-axis');
  
      // Append x axis titles Age
      vis.xtitle = vis.chart.append('text')
        .attr('class', 'axis-title')
        .attr('dy', '.15em')
        .attr('dx', '-.45em')
        .style('text-anchor', 'end')
        .attr('font-size', 10);

      vis.updateVis();
    }
  
    updateVis() {
      // Prepare data and scales
      let vis = this;

      // Filter out all data missing data entry based on the selection and the current selected year
      vis.filteredData = vis.data.filter((d) => {
        if(d.life_expect !== null && d.year == WorldData.year){
          return(d);
        }
      });

      // Get the correct x legend
      vis.xLegend = legendName[vis.attribute];

      // Append x legend dynamically
      if(vis.xLegend.length > 22){
        vis.xtitle
        .attr('y', -15)
        .attr('x', 140)
      }else if(vis.xLegend.length > 13){
        vis.xtitle
        .attr('y', -15)
        .attr('x', 70)
      }else{
        vis.xtitle
        .attr('y', -15)
        .attr('x', 25)
      }
      vis.xtitle.text(vis.xLegend);

      vis.xValue = d => d.life_expect;
      vis.yValue = d =>  d[vis.attribute];

      vis.xScale.domain(d3.extent(vis.data, vis.xValue));
      vis.yScale.domain([0, d3.max(vis.data, vis.yValue)]);
  
      vis.renderVis();
    }
  
    renderVis() {
      // Prepare data and scales
      let vis = this;
      // Append the points
      vis.points = vis.chart.selectAll('.point')
      .data(vis.filteredData)
      .join('circle')
      .attr('class', 'point')
      .attr('r', 2)
      .attr('cy', d => vis.yScale(vis.yValue(d)))
      .attr('cx', d => vis.xScale(vis.xValue(d)))
      .attr('fill-opacity', 0.5)
      .attr('fill', '0x301934');

      vis.xAxisG.call(vis.xAxis)
      .attr('stroke-opacity',0.15).call(g => g.select('.domain').remove());
  
      vis.yAxisG.call(vis.yAxis)
      .attr('stroke-opacity',0.15).call(g => g.select('.domain').remove());
    }
      
  }