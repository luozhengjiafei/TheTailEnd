/**
 * Global variables
 */
let lifeExpData = [];

// Declare userData based on user's selection. This variable is used in Part 1 and Part 3.
const userData = {
  dob: new Date(1998, 0, 1), // Default date
  gender: 'male', // Default male
  countryOfRes: 'Canada', // Default Canada
  lifeExp: 0, // Computed when updateLifeExp() is called
  heatmapDataYear: 2015 // Use 2015 data only for heatmap
}

// Declare worldData for geoMap and the scatter plot
const WorldData = {
  year: 2000,
  attribute: 'bmi',
  country: [],
  regressionToggle: true
}

// Global legend name for data maping
const legendName = {
  "bmi": "BMI",
  "alcohol": 'Alcohol consumption %',
  "basic_water": "Population using basic drinking water %",
  "age5-19thinness": "Thinness percentage amoung children",
  "age5-19obesity": "Obesity percentage amoung children",
  "che_gdp": "Health expenditure percentage to GDP",
  "une_hiv": "Prevalence of HIV",
  "une_gni": "GNI per capita",
  "doctors": "Medical doctors per 10,000 populations",
};

// Declare an object for the small multiples of scatter plots
const smallMultiple = {
  "bmi": [],
  "alcohol": [],
  "basic_water": [],
  "age5-19thinness": [],
  "age5-19obesity": [],
  "che_gdp": [],
  "une_hiv": [],
  "une_gni": [],
  "doctors": []
};

// Declare each class for updating values.
let heatmap, scatterPlot, choroplethMap, transitionVis;

// Initialize dispatchers for the event orchestration
const userInputDispatcher = d3.dispatch(
    'changeDob',
    'changeGender',
    'changeCountry',
    'dataSelection',
    'mapSelection',
    'selectAttribute',
    'clearData'
);

// Load life expectancy data from CSV file asynchronously and render charts
Promise.all([
  d3.csv('data/who_life_exp.csv'),
  d3.csv('data/regression_parameter.csv')
])
.then((data) => {
    const who_data = data[0];
    const regression_data = data[1];

    // Convert numerical columns to numerical values
    who_data.forEach(d => {
      Object.keys(d).forEach(attr => {
        if (attr !== 'country' && attr !== 'country_code' && attr !== 'region') {
            d[attr] = (d[attr] === '') ? null : +d[attr];
        }
      });
    });

    regression_data.forEach(d => {
      Object.keys(d).forEach(attr => {
            d[attr] = (d[attr] === '') ? null : +d[attr];
      });
    });
    
    // Assign data to global variable so that it can be accessed by dispatchers
    lifeExpData = who_data;

    // Update life expectancy in userData
    updateLifeExp();

    // Instantiate new heatmap (life expectancy calendar)
    heatmap = new Heatmap(
        {parentElement: '#heatmap-container'},
        who_data,
        userData,
        userInputDispatcher
    );
    
    // Instantiate the large scatter plot for vis 2
    scatterPlot = new ScatterPlot(
        {parentElement: '#largeScatterPlot-container'},
        userInputDispatcher,
        who_data,
        regression_data
    );

    // Create the small multiples of scatter plots
    for( var key in legendName) {
      smallMultiple[key] = new MultipleScatterPlot(
        {parentElement: '#smallMultiple-container'},
        userInputDispatcher,
        who_data,
        key
      );
    }
});

Promise.all([
  d3.json('data/world.json'),
  d3.csv('data/HDI.csv')
])
.then((data) => {
  const geoData = data[0];
  const countryData = data[1];

  // Combine both datasets by adding the HID  from 2000 to 2016 to the TopoJSON file
  geoData.objects.countries.geometries.forEach((d) => {
    let propertiesName = '';
    for (let i = 0; i < countryData.length; i++) {
      if (d.properties.name === countryData[i].country) {
        for(let year = 2000; year <= 2016; year++) {
          propertiesName = 'HDI_' + year;
          d.properties[propertiesName] = countryData[i][propertiesName] ? +countryData[i][propertiesName]: 0;
        }
      }
    }
    for(let year = 2000; year <= 2016; year++) {
        propertiesName = 'HDI_' + year;
        if(d.properties[propertiesName] == null){
          d.properties[propertiesName] = 0;
        }
    }
  });

  choroplethMap = new geoMap(
      {parentElement: "#map"},
      userInputDispatcher,
      data[0]
  );
}).catch(error => console.error(error));

// Load data for the Part 3.
d3.csv('data/olympic_hosts.csv').then(data => {
    transitionVis = new TransitionVis(
        {parentElement: '#vis3'},
        data,
        userData
    );
})

/**
 * Dispatchers and event listeners
 */

// Listener for the year filter
d3.select('#year-selector').on('change', function(){
  // Get the value of the selected year and clear the save country
  WorldData.year = d3.select(this).property('value');
  choroplethMap.updateVis();
  scatterPlot.updateVis();

  // Update each one of the small multiples
  for( var key in smallMultiple) {
    smallMultiple[key].updateVis();
  }
});

// Listener for the attribute filter
d3.select('#regression-selector').on('change', function(){
  // Get the value of the selection
  WorldData.regressionToggle = d3.select(this).property('value');
  scatterPlot.updateVis();
});

// Dispatch update large scatter plot
userInputDispatcher.on('selectAttribute', attribute => {
  WorldData.attribute = attribute;
  scatterPlot.updateVis();
});

// Dispatch listeners for selecting points
userInputDispatcher.on("dataSelection", selectPoints => {
  // If some data is selected then add to selection array and also filter out duplicate data
  if (selectPoints.length !== 0) {
    if(WorldData.country.includes(selectPoints[0].country)){
      WorldData.country = WorldData.country.filter(e => e !== selectPoints[0].country);
    } else {
      WorldData.country.push(selectPoints[0].country);
    }
  }
  choroplethMap.updateVis();
  scatterPlot.renderVis();
});

// Dispatchers for country, gender filters
userInputDispatcher.on('changeDob', selectedDate => {
    userData.dob = selectedDate;
    heatmap.updateVis(userData);
    transitionVis.updateVis(userData);
})

userInputDispatcher.on('changeGender', selectedGender => {
    userData.gender = selectedGender;
    updateLifeExp();
    heatmap.updateVis(userData);
    transitionVis.updateVis(userData);
});

userInputDispatcher.on('changeCountry', selectedCountry => {
    userData.countryOfRes = selectedCountry;
    updateLifeExp();
    heatmap.updateVis(userData);
    transitionVis.updateVis(userData);
});

// Dispatch listeners for selecting countries
userInputDispatcher.on("mapSelection", selectCountry => {
  // If some data is selected then add to selection array and also filter out duplicate data
  if (selectCountry.length !== 0) {
    if(WorldData.country.includes(selectCountry[0].properties.name)){
      WorldData.country = WorldData.country.filter(e => e !== selectCountry[0].properties.name);
    }else{
      WorldData.country.push(selectCountry[0].properties.name);
    }
  }
  choroplethMap.updateVis();
  scatterPlot.renderVis();
});

// Clearing existing selected points
userInputDispatcher.on('clearData', function(){
  WorldData.country = [];
  choroplethMap.updateVis();
  scatterPlot.updateVis();
});


/**
 * Helper methods
 */

// Updates life expectancy in userData
function updateLifeExp() {
  let filteredData = lifeExpData.filter(d => {
    if (d.country === userData.countryOfRes && d.year === userData.heatmapDataYear) {
      return d;
    }
  });
  userData.lifeExp = filteredData[0][`life_expectancy_${userData.gender}`];
}

