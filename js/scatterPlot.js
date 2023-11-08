class ScatterPlot {

  constructor(_config, _dispatcher, _data, regression_data) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: 600,
      containerHeight: 300,
      tooltipPadding: 15,
      margin: {top: 40, right: 15, bottom: 40, left: 40}
    }
    this.dispatcher = _dispatcher;
    this.data = _data;
    this.regressionWidth = regression_data;
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

    vis.yScale = d3.scaleLinear()
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
      // Detect click events and if the postion is outside of any poins then clear Seletion by calling dispatcher
      .on('click', function(event, d) {
        if(d3.select(event.target).classed('point') === false){
          vis.dispatcher.call('clearData', event);
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
      .attr('font-size',14);

    // Append y axis titles life expectancy
    vis.ytitle = vis.chart.append('text')
      .attr('class', 'axis-title')
      .attr('y', vis.height + 25)
      .attr('x', vis.width + 10)
      .attr('dy', '.80em')
      .attr('dx', '-.50em')
      .style('text-anchor', 'end')
      .text('Life Expectancy');

    vis.updateVis();
  }

  updateVis() {
    // Prepare data and scales
    let vis = this;

    // Filter out all data missing data entry based on the selection and the current selected year
    vis.filteredData = vis.data.filter((d) => {
      if(d[WorldData.attribute] !== null && d.life_expect !== null && d.year == WorldData.year){
        return(d);
      }
    });

     // Map the data to the x,y format for d3-regression
     vis.regressionData = vis.filteredData.map(d => {
      return {
        x: d.life_expect,
        y: d[WorldData.attribute]
      };
    });

    // Declare either Polynomial regression or Loess regression
    if(WorldData.attribute === 'basic_water'){
      vis.regression = d3r.regressionPoly()
      .x(d => d.x)
      .y(d => d.y)
      .order(6);
    }else if(WorldData.attribute === 'doctors' || WorldData.attribute === 'une_gni'){
      vis.regression = d3r.regressionPoly()
      .x(d => d.x)
      .y(d => d.y)
      .order(4);
    }else{
       // Pull bandwidth parameters from the regression data
       vis.bandwidth = vis.regressionWidth[WorldData.year-2000][WorldData.attribute];
       vis.regression = d3r.regressionLoess()
       .x(d => d.x)
       .y(d => d.y)
       .bandwidth(vis.bandwidth);
    }

    vis.regressionPoints = vis.regression(vis.regressionData);

    vis.lineGenerator = d3.line()
      .x(d => vis.xScale(d[0]))
      .y(d => vis.yScale(d[1]));

    // Get the correct x legend
    vis.xLegend = legendName[WorldData.attribute];
    // Append x legend dynamically
    if(vis.xLegend.length > 22){
      vis.xtitle
      .attr('y', -25)
      .attr('x', 230)
    }else if(vis.xLegend.length > 13){
      vis.xtitle
      .attr('y', -25)
      .attr('x', 120)
    }else{
      vis.xtitle
      .attr('y', -25)
      .attr('x', 25)
    }
    vis.xtitle.text(vis.xLegend);

    vis.xValue = d => d.life_expect;
    vis.yValue = d =>  d[WorldData.attribute];

    vis.xScale.domain(d3.extent(vis.data, vis.xValue));
    vis.yScale.domain([0, d3.max(vis.data, vis.yValue)]);

    vis.renderVis();
  }

  renderVis() {
    // Bind data to visual elements, update axes
    let vis = this;

    // Append the points
    vis.points = vis.chart.selectAll('.point')
      .data(vis.filteredData)
      .join('circle')
      .attr('class', 'point')
      // If none of the gender is selected I append point-hover which will have the hover effect
      // otherwise if the current points matches with the genderSelection array then append the append point-hover
      .attr('id', d => {
        if(WorldData.country.length !== 0){
          if(WorldData.country.includes(d.country)){
            return 'point-hover';
          }else{
            return ;
          }
        }else{
          return 'point-hover';
        }
      })
      .attr('r', 5)
      .attr('cy', d => vis.yScale(vis.yValue(d)))
      .attr('cx', d => vis.xScale(vis.xValue(d)))
      .attr('stroke' , 'black')
      .attr('stroke-width', d => {
          if(WorldData.country.includes(d.country)){
            return 0.8;
          }else{
            return 0.0;
          }
      })
      // The opacity of the points will be base on if any of the country are selected
      // If none then it will be default 0.8 for selected points 0.4 for others
      // If some gender is selected matched gender points will have opacity of 0.65 and the oppsite gender points have 0.15
      .attr('fill-opacity', d => {
        if(WorldData.country.length !== 0){
          if(WorldData.country.includes(d.country)){
            return 0.65;
          }else{
            return 0.15;
          }
        }else{
          return 0.3;
        }
      })
      // Fill condtion will be similar to the opacity of the points just with different colors
      .attr('fill', d => {
        if(WorldData.country.length === 0){
          return '0x301934';
        }else{
          if(WorldData.country.includes(d.country)){
            return '#FFC55C';
          }else{
            return '0x301934';
          }
        }
      })
      // on click event for data filitering
      .on('click', function(event, d) {
        const isActive = d3.select(this).classed('active');
        d3.select(this).classed('active', !isActive);
        const selectPointsData = vis.chart.selectAll('.point.active').data();
        vis.dispatcher.call('dataSelection', event, selectPointsData);
      }
    );

    // Add tooltip for all the country points
    vis.points
      .on('mouseover', (event,d) => {
        // If none of the country points are selected or points is selected then display the tooltip
        if(WorldData.country.length === 0 || WorldData.country.includes(d.country)){
          d3.select('#tooltip')
            .style('display', 'block')
            .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')   
            .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
            .html(`
              <div><strong>${d.country}</strong></div>
              <ul class='leader-list'>
                <li>${'Average life expectancy: ' + d.life_expect.toFixed(2)}</li>
                <li>${legendName[WorldData.attribute] +  ': ' + d[WorldData.attribute].toFixed(2)}</li>
              </ul>  
            `);
        }
      })
      .on('mouseleave', () => {
        d3.select('#tooltip').style('display', 'none');
      }
    );

    // append the regression line to the scatter plot
    vis.regressionPath = vis.chart.selectAll(".regression-path")
      .data([vis.regressionPoints]) // Use an array with a single element so that .join() has exactly one group to work with
      .join("path")
      .attr("class", "regression-path")
      .attr("fill", "none")
      .attr("stroke", "red")
      .attr("stroke-width", 2)
      .attr("d", vis.lineGenerator)
      .attr('opacity', d => {
        if(WorldData.regressionToggle === "false"){
          return 0.0;
        }else if( WorldData.country.length === 0){
          return 0.5;
        }else{
          return 0.7
        }
      });

    vis.xAxisG.call(vis.xAxis)
    .attr('stroke-opacity',0.15).call(g => g.select('.domain').remove());

    vis.yAxisG.call(vis.yAxis)
    .attr('stroke-opacity',0.15).call(g => g.select('.domain').remove());
  }
}