// Declare constants.
const WEEKS_IN_YEAR = 52;
const DESCRIPTION = {
    0: "The first view shows how many weeks you have lived (grey) and how many weeks you have left (green).",
    1: "The second view overlaps an important event in your lifetime. Let's use the Summer (red) and Winter Olympics (blue) as a proxy.",
    2: "In the final view, you can see how many weeks you've already spent with Olympics, and how many weeks of Olympics you have left."
}

class TransitionVis {

    /**
     * class constructor with initial config.
     * @param _config
     * @param _data
     * @param _userData
     */
    constructor(_config, _data, _userData) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 1200,
            containerHeight: 600,
            tooltipPadding: 15,
            cellSize: 15,
            currStatus: 0,
            cellSpacing: 12,
            margin: {top: 40, right: 10, bottom: 10, left: 60},
            newMarginLeft: 150
        };
        this.data = _data;
        this.userData = _userData;

        this.initVis();
    }

    /**
     * Create scales, axes, and append static elements.
     */
    initVis() {
        let vis = this;

        vis.svg = d3.select(vis.config.parentElement).append('svg')
            .attr('id', 'vis3')
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Draw a borderline.
        vis.border = vis.svg.append('rect')
            .attr('class', 'border')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', +vis.svg.attr('width'))
            .attr('height', +vis.svg.attr('height'))
            .attr('fill', 'none')
            .attr('stroke', 'grey')
            .attr('stroke-width', 1);

        // Draw the actual chart area according to the margin.
        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.xAxisG = vis.chart.append('g').attr('class', 'axis x-axis');
        vis.yAxisG = vis.chart.append('g').attr('class', 'axis y-axis')
            .attr('transform', `translate(-20,0)`);

        vis.xScale = d3.scaleLinear().range([0, vis.width]);
        vis.yScale = d3.scaleLinear().range([0, vis.height]);

        // Another yScale for the third view of this part.
        vis.yScaleBand = d3.scaleBand()
            .domain(['passed', 'not passed'])
            .range([30, vis.height/4])

        vis.xAxis = d3.axisTop(vis.xScale)
            .tickPadding(5)
            .tickSize(3)
            .ticks(Math.ceil(WEEKS_IN_YEAR / 5));

        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(Math.ceil(vis.userData.lifeExp)/5)
            .tickPadding(0)
            .tickSize(3);

        // Labels for each axis.
        vis.xAxisLabel = vis.svg.append('text')
            .attr('class', 'x-axis-label')
            .attr('y', 5)
            .attr('x', 60)
            .attr('dy', '.81em')
            .text('Week of the year →')
            .style('font-weight', 'bold');

        vis.yAxisLabel = vis.svg.append('text')
            .attr('class', 'y-axis-label')
            .attr('y', 60)
            .attr('x', 20)
            .text('Age →')
            .style('writing-mode', 'vertical-lr')
            .style('font-weight', 'bold');

        vis.passedLabel = vis.svg.append('text')
            .attr('class', 'passed-label')
            .attr('x', 50)
            .attr('y', 55)
            .attr('opacity', 0)
            .text('Weeks you spent with olympics.')
            .style('font-style', 'italic');

        vis.notPassedLabel = vis.svg.append('text')
            .attr('class', 'not-passed-label')
            .attr('x', 50)
            .attr('y', 110)
            .attr('opacity', 0)
            .text('Weeks you have left with olympics.')
            .style('font-style', 'italic');


        vis.updateVis(vis.userData);
    }

    updateVis(userData) {
        let vis = this;

        // Pre-process user inputs and olympic data.
        this.isWeeksPassed = calcWeeksPassed(this.data, this.userData);

        vis.xScale.domain([1, WEEKS_IN_YEAR]);
        vis.yScale.domain([0, userData.lifeExp])

        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        // Helper function for selecting rectangles' color.
        const getRectColor = (d) => {
            switch (true) {
                case !d.passed && !d.inGame:
                    return '#93D285'; // green
                case !d.passed && d.inGame && d.season === 'Summer':
                    return 'red';
                case !d.passed && d.inGame && d.season === 'Winter':
                    return '#0B1557';
                case d.passed && !d.inGame:
                    return '#CED0CE'; //grey
                case d.passed && d.inGame && d.season === 'Summer':
                    return 'red';
                case d.passed && d.inGame && d.season === 'Winter':
                    return '#0B1557';
                default:
                    return 'black';
            }
        };

        const text = d3.select('#vis3-text')
        const rect = vis.chart.selectAll('.rect')
            .data(vis.isWeeksPassed.flat())
            .join('rect')
            .attr('class', 'rect')
            .attr('x', (_, i) => vis.xScale((i % 52)))
            .attr('y', (_, i) => vis.yScale(Math.floor(i / 52)))
            .attr('width', vis.xScale(1) - vis.xScale(0) - 5)
            .attr('height', vis.yScale(1) - vis.yScale(0) - 5);

        vis.xAxisG
            .call(vis.xAxis)
            .call(g => g.select('.domain').remove());

        vis.yAxisG
            .call(vis.yAxis)
            .call(g => g.select('.domain').remove());

        // currStatus is changed based on clicking buttons.
        switch (vis.config.currStatus) {
            case 0:
                text.text(DESCRIPTION[0]);

                rect.transition()
                    .duration(500)
                    .attr('fill', d => d.passed ? '#CED0CE' : '#93D285'); // grey or green
                break;
            case 1:
                text.text(DESCRIPTION[1]);

                vis.yAxisLabel.attr('opacity', 1);
                vis.yAxisG.attr('opacity', 1);
                vis.passedLabel.attr('opacity', 0);
                vis.notPassedLabel.attr('opacity', 0);

                rect.transition()
                    .attr('opacity', 1)
                    .duration(500)
                    .attr('x', (_, i) => vis.xScale((i % 52)))
                    .attr('y', (_, i) => vis.yScale(Math.floor(i / 52)))
                    .attr('width', vis.xScale(1) - vis.xScale(0) - 5)
                    .attr('height', vis.yScale(1) - vis.yScale(0) - 5)
                    .attr('fill', d => getRectColor(d));
                break;
            default:
                text.text(DESCRIPTION[2]);

                vis.yAxisLabel.attr('opacity', 0);
                vis.yAxisG.attr('opacity', 0);
                vis.passedLabel.attr('opacity', 1);
                vis.notPassedLabel.attr('opacity', 1);

                rect.transition()
                    .duration(1000)
                    .attr('opacity', 0)
                    .filter(d => d.inGame)
                    .attr('opacity', 1)
                    .attr('width', vis.xScale(1) - vis.xScale(0) - 5)
                    .attr('height', vis.yScale(1) - vis.yScale(0) - 5)
                    .attr('x', d => vis.xScale(d.index % 52))
                    .attr('y', d => {
                        const rowSpacing = d.index ? (Math.floor(d.index / 52) * vis.config.cellSpacing) : 0
                        return d.passed
                            ? vis.yScaleBand('passed') + rowSpacing
                            : vis.yScaleBand('not passed') + rowSpacing;
                    })
                    .attr('fill', d => d.passed ? '#CED0CE' : '#93D285'); // grey or green
                break;
        }

        d3.select('.previous')
            .on('click', () => {
                if (vis.config.currStatus === 0) return;
                vis.config.currStatus--;
                vis.updateVis(userData)
            });

        d3.select('.next')
            .on('click', () => {
                if (vis.config.currStatus === 2) return;
                vis.config.currStatus++;
                vis.updateVis(userData)
            });
    }
}

const calcWeeksPassed = (data, userData) => {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000; // 1wk = 7d * 24h * 60m * 60s * 1000ms
    const dobMS = userData.dob.getTime();
    const todayMS = new Date().getTime();
    const ageInWeeks = Math.floor((todayMS - dobMS) / msPerWeek);
    const isWithinGamePeriod = (d, weekStart, weekEnd) => {
        const gameStart = new Date(d.game_start_date);
        const gameEnd = new Date(d.game_end_date);
        const isWithinGame = (weekStart <= gameStart && gameStart <= weekEnd)
            || (weekEnd <= gameEnd && gameEnd <= weekEnd)
            || (gameStart <= weekStart && weekStart <= gameEnd)
            || (gameStart <= weekEnd && weekEnd <= gameEnd);
        return { inGame : isWithinGame, game_year: d.game_year, game_season: d.game_season }
    }
    const result = Array.from({ length: userData.lifeExp }, (_, i) => {
        const start = i * WEEKS_IN_YEAR;
        return Array.from({ length: WEEKS_IN_YEAR }, (_, j) => {
            const weekStart = dobMS + (start + j) * msPerWeek;
            const weekEnd = weekStart + msPerWeek;
            const isWithinInGame = data.reduce((acc, d) => {
                const gamePeriod = isWithinGamePeriod(d, weekStart, weekEnd);
                if (gamePeriod.inGame) {
                    acc.inGame = true;
                    acc.game_year = gamePeriod.game_year;
                    acc.game_season = gamePeriod.game_season;
                }
                return acc;
            }, { inGame: false, game_year: null, game_season: null })
            const passed = start + j < ageInWeeks;
            const inGame = isWithinInGame.inGame;
            const season = isWithinInGame.game_season;
            return { passed, inGame, season };
        });
    });
    let passedCount = -1;
    let notPassedCount = -1;
    result.forEach((nestedArr, i) => {
        nestedArr.forEach((elem, j) => {
            let index = null;
            if (elem.inGame && elem.passed) {
                passedCount++;
                index = passedCount;
            } else if (elem.inGame && !elem.passed) {
                notPassedCount++;
                index = notPassedCount;
            }
            elem.index = index;
        })
    })
    return result;
}

