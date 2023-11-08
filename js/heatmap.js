class Heatmap {

    /**
     * Class constructor
     */
    constructor(_config, _data, _userData, _dispatcher) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 1220,
            containerHeight: 450,
            tooltipPadding: 15,
            margin: {top: 15, right: 150, bottom: 40, left: 40},
            legendWidth: 180,
            legendHeight: 19,
        }
        this.year = _userData.heatmapDataYear;
        this.data = _data;
        this.dob = _userData.dob;
        this.lifeExp = _userData.lifeExp;
        this.dod = this.computeDateOfDeath(this.dob, this.lifeExp);
        this.gender = _userData.gender;
        this.countryOfRes = _userData.countryOfRes;
        this.probOfDeathMap = new Map();
        this.mortRateAnnotationsMap = new Map();
        this.parseYear = d3.timeParse('%Y');
        this.currentDate = new Date();
        this.dispatcher = _dispatcher;
        this.initVis();
    }

    /**
     * Initialize scales, axes, append static elements
     */
    initVis() {
        let vis = this;

        // Define inner chart size
        vis.config.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.config.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Define size of the SVG drawing area
        vis.svg = d3.select(vis.config.parentElement).append('svg')
	        .attr('width', vis.config.containerWidth)
	        .attr('height', vis.config.containerHeight)
            .attr('id', 'chart');

        // Append group element that will contain our actual chart 
        // and position it according to the given margin config
        vis.chartArea = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`)
            .attr('class', 'heatmap');

        // Initialize scales
        vis.colourScale = d3.scaleSequential()
            .interpolator(d3.interpolateReds);

        vis.xScale = d3.scaleTime()
            .domain([new Date('2024-01-01'), new Date('2025-01-01')]) // Use arbitrary leap year 
            .range([0, vis.config.width]);

        vis.yScale = d3.scaleTime()
            .domain([vis.dod.getFullYear(), vis.dob.getFullYear()]) 
            .range([vis.config.height, 0]);
            
        // Initialize axes
        vis.xAxis = d3.axisTop(vis.xScale)
            .ticks(d3.timeMonth.every(1))
            .tickFormat(d3.timeFormat('%b'))
            .tickSize(0); 

        vis.yAxis = d3.axisLeft(vis.yScale)
            .tickSize(0)
            .tickFormat('');

        // Append axis groups to chartArea
        vis.xAxisGroup = vis.chartArea.append("g")
            .attr("class", "axis x-axis")
            .call(vis.xAxis)
            .raise();
       
       vis.yAxisGroup = vis.chartArea.append("g")
            .attr("class", "axis y-axis")
            .call(vis.yAxis)
            .raise();
            
        // Create filters for dob, country, and gender dropdowns and set default values
        let defaultDate = vis.convertDateFormat(vis.dob);
        let maxDate = vis.convertDateFormat(new Date());

        d3.select('#dob-selector')
             .attr('value', defaultDate)
             .attr('max', maxDate);

        let genders = ['Male', 'Female']
        vis.genderDropdown = d3.select('#gender-selector')
            .selectAll('option')
            .data(genders)
            .join('option')
                .append('option')
                .text(d => d)
                .attr('value', d => d)
                .property('selected', d => d === vis.gender);

        let countries = Array.from(d3.group(vis.data, d => d.country).keys()).sort();
        vis.countryDropdown = d3.select('#country-selector')
            .selectAll('option')
            .data(countries)
            .join('option')
            .text(d => d)
            .attr('value', d => d)
            .property('selected', d => d === vis.countryOfRes)
            .enter() // Append only if new options don't already exist
            .append('option')
            .text(d => d)
            .attr('value', d => d)
            .property('selected', d => d === vis.countryOfRes);
                

        // Create heatmap colour legend
        vis.legendSvg = d3.select('#heatmap-legend-svg')
            .attr('width', vis.config.legendWidth+50)
            .attr('height', vis.config.legendHeight+50)

        vis.legend = vis.legendSvg
            .append('g')
            .attr('width', vis.config.legendWidth)
            .attr('height', vis.config.legendHeight)
            .attr('transform', `translate(10, 33)`)
            .attr('id', 'heatmap-legend')

        vis.legend.append('text')
            .attr('x', 0)
            .attr('y', -3)
            .attr('font-size', '13px')
            .text('Probability of death:');
    
        vis.legendColorGradient = vis.legend.append('defs').append('linearGradient')
            .attr('id', 'linear-gradient');
    
        vis.legendColorRamp = vis.legend.append('rect')
            .attr('width', vis.config.legendWidth)
            .attr('height', vis.config.legendHeight)
            .attr('fill', 'url(#linear-gradient)');
    
        vis.xLegendScale = d3.scaleLinear()
            .range([0, vis.config.legendWidth]);
    
        vis.xLegendAxis = d3.axisBottom(vis.xLegendScale)
            .tickSize(vis.config.legendHeight +3)
            .tickFormat(d3.format('.0%'));
    
        vis.xLegendAxisG = vis.legend.append('g')
            .attr('class', 'axis x-axis legend-axis');

        // Call updateVis()
        vis.updateVis(userData);
    }

    /**
     * Prepare data and scales before rendering
     */
    updateVis(userData) {
        let vis = this;

        // Update dob, gender, country of residence based on user data
        vis.dob = userData.dob;
        vis.gender = userData.gender;
        vis.countryOfRes = userData.countryOfRes;

        // Filter data based on chosen country and the year, which is hardcoded to 2015
        vis.filteredData = vis.data.filter((d) => {
            if (d.country === vis.countryOfRes && d.year === vis.year) {
                return(d);
            }
        });

        // Update life expectancy and dod
        vis.lifeExp = vis.filteredData[0][`life_expectancy_${vis.gender}`];
        vis.dod = vis.computeDateOfDeath(vis.dob, vis.lifeExp);

        // Process probability of death data to create two maps
        vis.processProbDeathData();

        // Update yScale 
        vis.yScale.domain([vis.dod.getFullYear(), vis.dob.getFullYear()]);
        
        // Call renderVis() and renderLegend()
        vis.renderVis();
        vis.renderLegend();
    }

    /**
     * Bind data to visual elements (enter-update-exit) and update axes
     */
    renderVis() {
        // Referenced "The Impact of Vaccines on the Measles" case study
        let vis = this;

        // Set heatmap cell dimensions
        let cellWidth = (vis.config.width/366)-1;
        let cellHeight = (vis.config.height/(vis.dod.getFullYear()-vis.dob.getFullYear()))-1;

        // Create heatmap rows
        vis.row = vis.chartArea.selectAll('.h-row')
            .data(Array.from(vis.probOfDeathMap), d => d[0])
            .join('g')
                .attr('class', 'h-row')
                .attr('transform', d => {
                    return `translate(0, ${vis.yScale(d[0])})`;
                })

        // Add year labels for y-axis
        vis.row.selectAll('.h-label')
            .data((d, i) => (i % 10 == 0 || i == 0 ? [d] : [])) // Start at dob and add label for every 10 years
            .join('text')
                .attr('class', 'h-label')
                .attr('text-anchor', 'end')
                .attr('dy', '0.85em')
                .attr('x', -8)
                .attr('font-size', '10px')
                .attr('font-family', 'sans-serif')
                .text(d => d[0]);
        
        // Create cells for each row
        vis.cell = vis.row.selectAll('.h-cell')
            .data(d => d[1])
            .join('rect')
                .attr('class', 'h-cell')
                .attr('height', cellHeight)
                .attr('width', cellWidth)
                .attr('x', d => vis.xScale(new Date(d.date).setFullYear(2024)))
                .attr('fill', d => {
                    if (d.value == 0) {
                        return '#fff';
                    } else {
                        return vis.colourScale(d.value);
                    }
                });
                
        // Create a slash across cells for days already lived
        vis.line = vis.row.selectAll('.h-line')
            .data(d => d[1].filter(k => k.date < vis.currentDate && k.date >= vis.dob))
            .join('line')
                .attr('class', 'h-line')
                .attr('x1', d => vis.xScale(new Date(d.date).setFullYear(2024)))
                .attr('x2', d => vis.xScale(new Date(d.date).setFullYear(2024)) + cellWidth)
                .attr('y1', cellHeight)
                .attr('y2', 0)
                .attr('stroke', '#808080');

        // Update position of prob death annotations based on birth year
        // Create svg group to hold mortality line and text
        vis.mortalityRateAnnotation = vis.chartArea.selectAll('.mortality-annotation')
            .data(vis.mortRateAnnotationsMap)
            .join('g')
                .attr('class', 'mortality-annotation')
                .attr('transform', d => `translate(0, ${vis.yScale(d[1].year)})`);

        // Create mortality line
        vis.mortalityRateAnnotation.selectAll('.mortality-line')
            .data(d => [d])
            .join('line')
                .attr('class', 'mortality-line')
                .attr('x1', vis.xScale(new Date('2024-01-01')))
                .attr('x2', vis.xScale(new Date('2025-01-01'))+10)
                .attr('stroke', '#000000')

        // Create mortality text
        vis.mortalityRateAnnotation.selectAll('.mortality-text')
            .data(d => [d])
            .join('text')
                .attr('class', 'mortality-text')
                .attr('x', vis.xScale(new Date('2025-01-01'))+15)
                .attr('fill', '#000000')
                .attr('font-size', '10px')
                .attr('font-family', 'sans-serif')
                .attr('transform', `translate(0,-6)`)
                .selectAll('tspan')
                    .data(d => {
                        let text = [`${(d[1].value*100).toFixed(2)}% of ${vis.gender}s don't`, 
                                    `live past the age of ${d[1].age}`
                                ]
                        return text;
                    })
                    .join('tspan')
                        .text(d => d)
                        .attr('x', vis.xScale(new Date('2025-01-01'))+15)
                        .attr('dy', (d, i) => {
                            if (i !== 0) {
                                return 10;
                            }
                        });

        // Create tooltips
        vis.cell
            .on('mouseover', (event, d) => {
                d3.select('#tooltip-heatmap')
                    .style('display', 'block')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')   
                    .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
                    .html(`
                        <div class='tooltip-date'><b>Date:</b> ${d.date.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})}</div>
                        <div class='tooltip-age'><b>Age:</b> ${((d.date - vis.dob)/(1000*60*60*24*365.25)).toFixed(1)} years</div>
                        <div class='tooltip-prob-death'><b>Probability of death:</b> ${(d.value*100).toFixed(2)}%</div>
                    `);
            })
            .on('mouseleave', () => {
                d3.select('#tooltip-heatmap').style('display', 'none');
            });

        // Create dynamic caption
        vis.dynamicCaption = d3.select('#heatmap-dynamic-caption')
            .html(`If you were born on <u>${vis.dob.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})}</u>, 
                   then you are ${((vis.currentDate - vis.dob)/(1000*60*60*24*365.25)).toFixed(1)} years old today. Based on the 
                   life expectancy (${vis.lifeExp}) for a <u>${vis.gender}</u> in <u>${vis.countryOfRes}</u>, you will live until 
                   ${vis.dod.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})}. This means that you 
                   have lived ${(((vis.currentDate-vis.dob)/(vis.lifeExp*1000*60*60*24*365.25))*100).toFixed(2)}% of your life so far.`)


        // Raise and lower elements
        vis.cell.lower();
        vis.xAxisGroup.raise();
        vis.yAxisGroup.raise();
        vis.mortalityRateAnnotation.raise();

        // Event listeners
        d3.select('#dob-selector')
            .on('change', function(event, d) {
                let selectedDate = new Date(d3.select(this).property('value') + "T00:00:00")
                vis.dispatcher.call('changeDob', event, selectedDate);
            });

        d3.select('#gender-selector')
            .on('change', function(event, d) {
                let selectedGender = d3.select(this).property('value').toLowerCase();
                vis.dispatcher.call('changeGender', event, selectedGender);
            });

        d3.select('#country-selector')
            .on('change', function(event, d) {
                let selectedCountry = d3.select(this).property('value');
                vis.dispatcher.call('changeCountry', event, selectedCountry);
            });
    }

    /**
     * Update colour legend
     */
    renderLegend() {
        let vis = this;

        // Add stops to the gradient
        vis.legendColorGradient.selectAll('stop')
            .data(vis.colourScale.range())
        .join('stop')
            .attr('offset', (d,i) => i/(vis.colourScale.range().length-1))
            .attr('stop-color', d => d);

        // Set x-scale and reuse colour-scale because they share the same domain
        // Round values using `nice()` to make them easier to read.
        vis.xLegendScale.domain(vis.colourScale.domain()).nice();
        const extent = vis.xLegendScale.domain();

        // Manually calculate tick values
        vis.xLegendAxis.tickValues([
            extent[0],
            parseFloat((extent[1]/3).toFixed(2)),
            parseFloat((extent[1]/3*2).toFixed(2)),
            extent[1]
        ]);

        // Update legend axis
        vis.xLegendAxisG.call(vis.xLegendAxis);
    }

    /**
     * Helper function to process probability of death data
     * 
     * Creates probOfDeathMap
     *      Key: Each year of user's life 
     *      Value: Object containing each date of that year and the corresponding prob of death value
     *      Note: Each date will have year 2024 to match with our xScale
     * 
     * Creates mortRateAnnotationsMap
     *      Key: 'underFive', 'underSixty'
     *      Value: {year: year when the user will be under five or under sixty, 
     *              value: mortality rate at that age, 
     *              age: either 5 or 60}
     */
    processProbDeathData() {
        let vis = this;

        // Clear map containing probability of death
        vis.probOfDeathMap.clear();

        // Pull prob of death fields that start with selected gender
        let probOfDeathData = Object.keys(vis.filteredData[0]).filter((d) => {
            return d.startsWith(vis.gender);
        });

        // Sort age ranges in ascending order and extract the numeric age range
        // Create map with age range as key and prob death as value
        let sortedProbOfDeath = probOfDeathData.sort();
        let age_ranges = new Map();
        for (let i = 0; i < sortedProbOfDeath.length; i++) {
            age_ranges.set((sortedProbOfDeath[i].match(/\d+/g).map(Number)), vis.filteredData[0][sortedProbOfDeath[i]]);
        }

     
        // Create map to store mortality rates for map
        vis.mortRateAnnotationsMap.clear();
        let underFiveYear = vis.dob.getFullYear() + 5;
        let underFiveVal = Array.from(age_ranges.values()).slice(0, 2).reduce((partialSum, val) => partialSum + val, 0);
        let underSixtyYear = vis.dod.getFullYear() < vis.dob.getFullYear() + 60 ? vis.dod.getFullYear() : vis.dob.getFullYear() + 60;
        let underSixtyVal = 0;

        if (vis.lifeExp < 60) {
            for (let [key, value] of age_ranges) {
                if (key[1] > vis.lifeExp) {
                    underSixtyVal += value;
                    break;
                } else {
                    underSixtyVal += value;
                }
            }
        } else {
            underSixtyVal = Array.from(age_ranges.values()).slice(0, 13).reduce((partialSum, val) => partialSum + val, 0);;
        }

        vis.mortRateAnnotationsMap.set('underFive', {'year': underFiveYear, 'value': underFiveVal, 'age': 5});
        vis.mortRateAnnotationsMap.set('underSixty', {'year': underSixtyYear, 'value': underSixtyVal, 'age': (vis.lifeExp < 60) ? vis.lifeExp : 60});

        // Create probOfDeathMap
        for (let [key, value] of age_ranges) {
            let lowerAgeRange = key[0];
            let upperAgeRange = key[1];
            let dateRange = d3.timeDays(new Date('2024-01-01'), new Date('2025-01-01'));

            // If upperAgeRange surpases life expectancy, cap the data we use at life expectancy
            // Break out of the loop since this is the last year we need to account for
            // upperAgeRange undefined means prob death data for > 85 years
            if (upperAgeRange >= vis.dod.getFullYear() - vis.dob.getFullYear() || upperAgeRange === undefined) {
                upperAgeRange = vis.dod.getFullYear() - vis.dob.getFullYear();
                for (let i = lowerAgeRange; i <= upperAgeRange; i++) {
                    if (i === upperAgeRange) {
                        dateRange = d3.timeDays(new Date('2024-01-01'), new Date(`2024-${vis.dod.getMonth()+1}-${vis.dod.getDate()+1}`));
                    }
                    for (let j = 0; j < dateRange.length; j++) {
                        if (!vis.probOfDeathMap.has(vis.dob.getFullYear() + i)) {
                            vis.probOfDeathMap.set(vis.dob.getFullYear() + i, []);
                        }
                        let date = new Date(dateRange[j]);
                        date.setFullYear(vis.dob.getFullYear() + i);
                        vis.probOfDeathMap.get(vis.dob.getFullYear() + i).push({'date': date, 'value': value });
                    }
                }
                break;
            } 
            // Case where life expectancy > upperAgeRange
            else {
                for (let i = lowerAgeRange; i < upperAgeRange + 1; i++) {
                    if (i === 0) {
                        dateRange = d3.timeDays(new Date(`2024-${vis.dob.getMonth()+1}-${vis.dob.getDate().toString()}`), new Date('2025-01-01'));
                    } else {
                        dateRange = d3.timeDays(new Date('2024-01-01'), new Date('2025-01-01'));
                    }
                    for (let j = 0; j < dateRange.length; j++) {
                        if (!vis.probOfDeathMap.has(vis.dob.getFullYear() + i)) {
                            vis.probOfDeathMap.set(vis.dob.getFullYear() + i, []);
                        }
                        let date = new Date(dateRange[j]);
                        date.setFullYear(vis.dob.getFullYear() + i);
                        vis.probOfDeathMap.get(vis.dob.getFullYear() + i).push({ 'date': date, 'value': value });
                    }
                }
            }
        }
    }

    /**
     * Helper function that approximates date of death given date of birth and life expectancy
     */
    computeDateOfDeath(dob, lifeExp) {
        let vis = this;
        // Convert lifeExp from years into milliseconds
        let lifeExpInMs = lifeExp * 365.25 * 24 * 60 * 60 * 1000
        // Compute dob
        return new Date(dob.getTime() + lifeExpInMs);
    }

    /**
     * Helper function that converts JS Date object to a string in the form `${year}-${month}-${day}`
     */
    convertDateFormat(date) {
        let year = date.getFullYear();
        let month = date.getMonth()+1;
        month = month.toString().length == 1 ? `0${month.toString()}` : 0;
        let day = date.getDate();
        day = day.toString().length == 1 ? `0${day.toString()}` : day.toString();
        let returnDate = `${year}-${month}-${day}`
        return returnDate;
    }

}
